"""
ml/fit-scorer/train.py

Trains a fit quality scorer from accumulated try-on interaction data.
This is the "learns over time" model — it uses real user behaviour
(which frames converted, which were adjusted, time spent) to predict
how well a given frame will suit a given face.

How it works:
  1. Pull interaction data from the database
  2. Engineer features from face landmark ratios + frame metadata
  3. Use conversion/engagement as training labels
  4. Train a GradientBoosting model
  5. Export to ONNX → deploy to Node.js

Run weekly via cron:
  0 2 * * 0 cd /opt/tryon/ml/fit-scorer && python train.py

Requirements:
    pip install psycopg2-binary pandas scikit-learn onnxmltools numpy joblib

Environment:
    DATABASE_URL  — PostgreSQL connection string
"""

import os
import json
import hashlib
import joblib
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score, classification_report
from sklearn.preprocessing import LabelEncoder
import psycopg2

# ─── Config ───────────────────────────────────────────────────────────
DB_URL        = os.environ.get('DATABASE_URL', 'postgresql://tryon:pass@localhost/tryon_db')
MODELS_DIR    = 'models'
LOOKBACK_DAYS = 60     # train on last 60 days of data
MIN_SAMPLES   = 500    # don't train if fewer than this many sessions
VERSION_FILE  = os.path.join(MODELS_DIR, 'current_version.txt')

os.makedirs(MODELS_DIR, exist_ok=True)


# ─── 1. Load data from PostgreSQL ─────────────────────────────────────
def load_data():
    print("Loading data from database...")
    conn = psycopg2.connect(DB_URL)
    since = datetime.now() - timedelta(days=LOOKBACK_DAYS)

    # Load try-on sessions with face ratios
    # NOTE: Prisma generates camelCase columns — use quoted identifiers
    sessions_q = """
        SELECT
            s."sessionId"  AS session_id,
            s."faceShape"  AS face_shape,
            s."faceRatios" AS face_ratios,
            s."createdAt"  AS created_at
        FROM "AnalyticsSession" s
        WHERE s."createdAt" > %s
          AND s."faceRatios" IS NOT NULL
    """

    # Load events per session (for labels and frame features)
    events_q = """
        SELECT
            e."sessionId"  AS session_id,
            e."frameId"    AS frame_id,
            e."eventType"  AS event_type,
            e."metadata"   AS metadata,
            f."style"      AS style
        FROM "AnalyticsEvent" e
        LEFT JOIN "Frame" f ON f.id = e."frameId"
        WHERE e."createdAt" > %s
          AND e."sessionId" IS NOT NULL
    """

    sessions_df = pd.read_sql(sessions_q, conn, params=(since,))
    events_df   = pd.read_sql(events_q,   conn, params=(since,))
    conn.close()

    print(f"  Loaded {len(sessions_df)} sessions, {len(events_df)} events")
    return sessions_df, events_df


# ─── 2. Build training dataset ────────────────────────────────────────
def build_features(sessions_df, events_df):
    print("Engineering features...")

    # Pivot events to get per-session-frame metrics
    rows = []

    for _, session in sessions_df.iterrows():
        sid         = session['session_id']
        face_ratios = session['face_ratios'] or {}
        face_shape  = session['face_shape'] or 'unknown'

        # Get events for this session
        sess_events = events_df[events_df['session_id'] == sid]

        # Get frames tried in this session
        frames_tried = sess_events[sess_events['event_type'] == 'frame_tried']['frame_id'].unique()

        for frame_id in frames_tried:
            if frame_id is None:
                continue

            frame_events = sess_events[sess_events['frame_id'] == frame_id]
            frame_style  = frame_events['style'].iloc[0] if len(frame_events) > 0 else None

            # ── Label: did user convert? ──────────────────────────────
            # Strong signal: checkout click
            converted = int(any(
                e == 'checkout_click'
                for e in sess_events[sess_events['frame_id'] == frame_id]['event_type']
            ))

            # ── Features ─────────────────────────────────────────────
            # Was frame manually adjusted? (negative signal — poor initial fit)
            adjusted = int(any(
                e == 'frame_adjusted'
                for e in frame_events['event_type']
            ))

            # How much was it adjusted? (large offset = bad auto-fit)
            adj_events = frame_events[frame_events['event_type'] == 'frame_adjusted']
            avg_offset_x = 0.0
            avg_offset_y = 0.0
            if len(adj_events) > 0:
                offsets = [e.get('offsetX', 0) for e in adj_events['metadata'] if e]
                avg_offset_x = float(np.mean(offsets)) if offsets else 0.0

            rows.append({
                # Face shape features
                'face_width_to_length':  float(face_ratios.get('widthToLength',  0.75)),
                'face_jaw_to_cheekbone': float(face_ratios.get('jawToCheekbone', 0.90)),
                'face_forehead_to_jaw':  float(face_ratios.get('foreheadToJaw',  1.00)),
                'face_shape_oval':    int(face_shape == 'oval'),
                'face_shape_round':   int(face_shape == 'round'),
                'face_shape_square':  int(face_shape == 'square'),
                'face_shape_heart':   int(face_shape == 'heart'),
                'face_shape_oblong':  int(face_shape == 'oblong'),

                # Frame style features
                'style_rectangular': int(frame_style == 'rectangular'),
                'style_round':       int(frame_style == 'round'),
                'style_cat_eye':     int(frame_style == 'cat_eye'),
                'style_aviator':     int(frame_style == 'aviator'),
                'style_square':      int(frame_style == 'square'),
                'style_geometric':   int(frame_style == 'geometric'),

                # Fit quality signals
                'was_adjusted':   adjusted,
                'avg_offset_x':   abs(avg_offset_x),

                # Label
                'converted': converted,
            })

    df = pd.DataFrame(rows)
    print(f"  Built {len(df)} training samples")
    return df


# ─── 3. Train model ───────────────────────────────────────────────────
def train(df):
    print("Training fit scorer model...")

    if len(df) < MIN_SAMPLES:
        print(f"  ⚠️  Only {len(df)} samples — need {MIN_SAMPLES}. Skipping training.")
        return None, None

    feature_cols = [c for c in df.columns if c != 'converted']
    X = df[feature_cols].values
    y = df['converted'].values

    # Class imbalance — conversions are rare, weight them higher
    pos_weight = max(1, int((y == 0).sum() / max((y == 1).sum(), 1)))
    print(f"  Class ratio 0:{1} = {pos_weight}:1 — using sample_weight")

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    model = GradientBoostingClassifier(
        n_estimators=200,
        max_depth=4,
        learning_rate=0.05,
        subsample=0.8,
        random_state=42,
    )

    # Weight positive (converted) samples more
    sample_weights = np.where(y_train == 1, pos_weight, 1.0)
    model.fit(X_train, y_train, sample_weight=sample_weights)

    # Evaluate
    y_pred_proba = model.predict_proba(X_test)[:, 1]
    auc = roc_auc_score(y_test, y_pred_proba)
    print(f"  AUC-ROC: {auc:.4f}")
    print(classification_report(y_test, model.predict(X_test)))

    return model, feature_cols


# ─── 4. Save model (joblib + ONNX) ────────────────────────────────────
def save_model(model, feature_cols):
    version = datetime.now().strftime('%Y%m%d_%H%M%S')
    model_path   = os.path.join(MODELS_DIR, f'fit_scorer_{version}.joblib')
    onnx_path    = os.path.join(MODELS_DIR, f'fit_scorer_{version}.onnx')
    feature_path = os.path.join(MODELS_DIR, f'fit_scorer_{version}_features.json')

    # Save scikit-learn model (for Python inference / retraining)
    joblib.dump(model, model_path)
    print(f"  Saved joblib model: {model_path}")

    # Export to ONNX (for Node.js inference via onnxruntime-node)
    try:
        from onnxmltools import convert_sklearn
        from onnxmltools.convert.common.data_types import FloatTensorType

        initial_type = [('features', FloatTensorType([None, len(feature_cols)]))]
        onnx_model = convert_sklearn(model, initial_types=initial_type)

        with open(onnx_path, 'wb') as f:
            f.write(onnx_model.SerializeToString())

        print(f"  Saved ONNX model: {onnx_path}")
    except ImportError:
        print("  ⚠️  onnxmltools not installed — skipping ONNX export")
        print("     Install: pip install onnxmltools")
    except Exception as e:
        print(f"  ⚠️  ONNX export failed: {e}")

    with open(feature_path, 'w') as f:
        json.dump(feature_cols, f)

    # Mark as current version
    with open(VERSION_FILE, 'w') as f:
        f.write(version)

    return version


# ─── 5. Main ──────────────────────────────────────────────────────────
if __name__ == '__main__':
    print(f"\n{'='*50}")
    print(f"Fit Scorer Training — {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print('='*50)

    sessions_df, events_df = load_data()
    df = build_features(sessions_df, events_df)

    if len(df) < MIN_SAMPLES:
        print(f"\n⏳ Not enough data yet ({len(df)}/{MIN_SAMPLES} samples needed).")
        print("   Come back after more try-ons accumulate.")
        exit(0)

    model, feature_cols = train(df)

    if model is not None:
        version = save_model(model, feature_cols)
        print(f"\n✅ Training complete! Version: {version}")
        print(f"   Deploy: copy models/fit_scorer_{version}.joblib to production")
    else:
        print("\n❌ Training skipped — insufficient data")

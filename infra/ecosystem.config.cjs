// infra/ecosystem.config.cjs
//
// PM2 process manager config for production.
// Usage: pm2 start infra/ecosystem.config.cjs

const APP_DIR = '/opt/tryon'

module.exports = {
  apps: [
    // ── API (Express) — cluster mode for multi-core ──────────────
    {
      name: 'tryon-api',
      script: `${APP_DIR}/api/src/server.js`,
      cwd: `${APP_DIR}/api`,
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
      },
      node_args: `--env-file=${APP_DIR}/api/.env`,
      error_file: `${APP_DIR}/logs/api-error.log`,
      out_file: `${APP_DIR}/logs/api-out.log`,
      merge_logs: true,
      max_memory_restart: '512M',
    },

    // ── Dashboard (Next.js) ──────────────────────────────────────
    {
      name: 'tryon-dashboard',
      script: 'npm',
      args: 'start',
      cwd: `${APP_DIR}/dashboard`,
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      error_file: `${APP_DIR}/logs/dashboard-error.log`,
      out_file: `${APP_DIR}/logs/dashboard-out.log`,
      merge_logs: true,
      max_memory_restart: '512M',
    },

    // ── Rembg (Python Flask via venv) ────────────────────────────
    {
      name: 'tryon-rembg',
      script: `${APP_DIR}/ml/rembg-service/venv/bin/gunicorn`,
      args: 'app:app --bind 0.0.0.0:5000 --workers 2 --timeout 120',
      cwd: `${APP_DIR}/ml/rembg-service`,
      interpreter: 'none',
      error_file: `${APP_DIR}/logs/rembg-error.log`,
      out_file: `${APP_DIR}/logs/rembg-out.log`,
      merge_logs: true,
      max_memory_restart: '1G',
    },
  ],
}

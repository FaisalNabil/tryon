#!/bin/bash
# infra/backup.sh
#
# Daily PostgreSQL backup with 7-day retention.
# Add to cron: 0 3 * * * bash /opt/tryon/infra/backup.sh
#
# Backups are stored in /opt/tryon/backups/

set -e

BACKUP_DIR="/opt/tryon/backups"
DB_NAME="tryon"
DB_USER="tryon"
RETENTION_DAYS=7
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/${DB_NAME}_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "[backup] Starting PostgreSQL backup — $(date)"

# Dump and compress
sudo -u postgres pg_dump "$DB_NAME" | gzip > "$BACKUP_FILE"

SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "[backup] Saved: $BACKUP_FILE ($SIZE)"

# Clean up backups older than retention period
DELETED=$(find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -mtime +$RETENTION_DAYS -delete -print | wc -l)
if [ "$DELETED" -gt 0 ]; then
  echo "[backup] Cleaned up $DELETED old backup(s)"
fi

echo "[backup] Done — $(date)"

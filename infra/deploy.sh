#!/bin/bash
# infra/deploy.sh
#
# Full deploy script for Hetzner CX21 VPS (Ubuntu 24.04)
# Run once on a fresh server: bash deploy.sh
#
# After first run, for updates use: bash deploy.sh update

set -e  # exit on any error

APP_DIR="/opt/tryon"
REPO_URL="https://github.com/FaisalNabil/tryon.git"

# ─── Colors ────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
log()  { echo -e "${GREEN}[deploy] $1${NC}"; }
warn() { echo -e "${YELLOW}[warn]   $1${NC}"; }
err()  { echo -e "${RED}[error]  $1${NC}"; }

# ─── Update mode (just pulls code and restarts) ────────────────────
if [ "$1" = "update" ]; then
  log "Pulling latest code..."
  cd $APP_DIR
  git pull origin main

  log "Installing API dependencies..."
  cd api && npm ci --omit=dev
  npx prisma migrate deploy
  npx prisma generate

  log "Building dashboard..."
  cd ../dashboard && npm ci && npm run build

  log "Building widget..."
  cd ../widget && npm ci && npm run build
  warn "Upload dist/tryon.iife.js to Cloudflare R2 CDN if changed"

  log "Restarting services..."
  cd $APP_DIR
  pm2 restart infra/ecosystem.config.cjs
  pm2 save

  # Post-deploy health check
  sleep 3
  if curl -sf http://localhost:3000/health > /dev/null 2>&1; then
    log "API health check passed"
  else
    err "API health check FAILED — check logs: pm2 logs tryon-api"
  fi

  log "Update complete!"
  exit 0
fi

# ─── First-time full setup ─────────────────────────────────────────
log "Starting full server setup..."

# System update
apt-get update && apt-get upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Install Python 3.11
apt-get install -y python3.11 python3-pip python3.11-venv

# Install PostgreSQL 16
apt-get install -y postgresql postgresql-contrib
systemctl enable postgresql
systemctl start postgresql

# Install Redis 7
apt-get install -y redis-server
systemctl enable redis-server
systemctl start redis-server

# Install Nginx
apt-get install -y nginx certbot python3-certbot-nginx
systemctl enable nginx

# Install PM2 (process manager)
npm install -g pm2

# ─── Database setup ────────────────────────────────────────────────
log "Setting up PostgreSQL database..."
sudo -u postgres psql -c "CREATE DATABASE tryon;" 2>/dev/null || warn "DB may already exist"
sudo -u postgres psql -c "CREATE USER tryon WITH PASSWORD 'changeme_strong_password';" 2>/dev/null || warn "User may already exist"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE tryon TO tryon;"
sudo -u postgres psql -d tryon -c "GRANT ALL ON SCHEMA public TO tryon;" 2>/dev/null || true

# ─── Clone app ─────────────────────────────────────────────────────
log "Cloning repository..."
mkdir -p $APP_DIR
git clone $REPO_URL $APP_DIR 2>/dev/null || (cd $APP_DIR && git pull)

# Create logs directory
mkdir -p $APP_DIR/logs
mkdir -p $APP_DIR/backups

# ─── Install dependencies & build ──────────────────────────────────
log "Installing API dependencies..."
cd $APP_DIR/api

if [ ! -f .env ]; then
  cp .env.example .env
  warn "Created api/.env from example — edit it with your production values:"
  warn "  nano $APP_DIR/api/.env"
  warn "  Required: DATABASE_URL, JWT_SECRET, STRIPE keys, R2 credentials"
  warn ""
  warn "Minimum .env for the API to start:"
  warn "  DATABASE_URL=postgresql://tryon:changeme_strong_password@localhost:5432/tryon"
  warn "  REDIS_URL=redis://localhost:6379"
  warn "  JWT_SECRET=$(openssl rand -hex 32)"
  warn "  PORT=3000"
  warn "  DASHBOARD_URL=https://app.yourdomain.com"
fi

npm ci --omit=dev
npx prisma migrate deploy
npx prisma generate

log "Building widget..."
cd $APP_DIR/widget
npm ci
npm run build
warn "Upload dist/tryon.iife.js to your CDN (Cloudflare R2, S3, etc.)"
warn "  Example: aws s3 cp dist/tryon.iife.js s3://your-bucket/tryon.js --content-type application/javascript"

log "Building dashboard..."
cd $APP_DIR/dashboard
if [ ! -f .env.local ]; then
  cp .env.example .env.local
  warn "Created dashboard/.env.local — update NEXT_PUBLIC_API_URL if using a custom domain"
fi
npm ci
npm run build

# ─── Python ML services ────────────────────────────────────────────
log "Setting up Python rembg service..."
cd $APP_DIR/ml/rembg-service
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
deactivate

# ─── PM2 processes ─────────────────────────────────────────────────
log "Starting services with PM2..."
cd $APP_DIR
pm2 start infra/ecosystem.config.cjs
pm2 save
pm2 startup  # auto-start on server reboot

# Log rotation
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 50M
pm2 set pm2-logrotate:retain 7

# ─── Nginx ─────────────────────────────────────────────────────────
log "Configuring Nginx..."
cp $APP_DIR/infra/nginx.conf /etc/nginx/sites-available/tryon
ln -sf /etc/nginx/sites-available/tryon /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# ─── Backup cron ───────────────────────────────────────────────────
log "Setting up daily database backup cron..."
CRON_LINE="0 3 * * * bash $APP_DIR/infra/backup.sh >> $APP_DIR/logs/backup.log 2>&1"
(crontab -l 2>/dev/null | grep -v backup.sh; echo "$CRON_LINE") | crontab -

# ─── Health check ──────────────────────────────────────────────────
sleep 5
if curl -sf http://localhost:3000/health > /dev/null 2>&1; then
  log "API health check passed"
else
  err "API health check FAILED — check: pm2 logs tryon-api"
fi

# ─── SSL ───────────────────────────────────────────────────────────
warn "Set up SSL with Let's Encrypt:"
warn "  certbot --nginx -d api.yourdomain.com -d app.yourdomain.com"

log "Deploy complete!"
log ""
log "Services:"
log "  API:       http://api.yourdomain.com"
log "  Dashboard: http://app.yourdomain.com"
log ""
log "Next steps:"
log "  1. Edit api/.env with production credentials"
log "  2. Run: pm2 restart infra/ecosystem.config.cjs"
log "  3. Run certbot for HTTPS (see command above)"
log "  4. Upload widget JS to CDN"
log "  5. Configure DNS: api.yourdomain.com → server IP"
log "  6. Configure DNS: app.yourdomain.com → server IP"
log "  7. Set up Stripe webhook: POST https://api.yourdomain.com/v1/billing/webhook"

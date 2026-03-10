#!/bin/bash
# infra/deploy.sh
#
# Full deploy script for Hetzner CX21 VPS (Ubuntu 24.04)
# Run once on a fresh server: bash deploy.sh
#
# After first run, for updates use: bash deploy.sh update

set -e  # exit on any error

APP_DIR="/opt/tryon"
REPO_URL="https://github.com/yourname/tryon-saas.git"  # TODO: update

# ─── Colors ────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log()  { echo -e "${GREEN}[deploy] $1${NC}"; }
warn() { echo -e "${YELLOW}[warn]   $1${NC}"; }

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

  log "Restarting services..."
  pm2 restart tryon-api tryon-dashboard
  pm2 save

  log "✅ Update complete!"
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
sudo -u postgres psql -c "CREATE DATABASE tryon_db;" 2>/dev/null || warn "DB may already exist"
sudo -u postgres psql -c "CREATE USER tryon WITH PASSWORD 'changeme_strong_password';" 2>/dev/null || warn "User may already exist"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE tryon_db TO tryon;"

# ─── Clone app ─────────────────────────────────────────────────────
log "Cloning repository..."
mkdir -p $APP_DIR
git clone $REPO_URL $APP_DIR 2>/dev/null || (cd $APP_DIR && git pull)

# ─── Install dependencies & build ──────────────────────────────────
log "Installing API dependencies..."
cd $APP_DIR/api
cp .env.example .env
warn "⚠️  Edit $APP_DIR/api/.env before continuing!"
warn "   Set DATABASE_URL, JWT_SECRET, STRIPE keys, R2 credentials"
read -p "Press Enter after editing .env to continue..."

npm ci --omit=dev
npx prisma migrate deploy
npx prisma generate

log "Building widget..."
cd $APP_DIR/widget
npm ci
npm run build
# TODO: upload dist/tryon.iife.js to Cloudflare R2

log "Building dashboard..."
cd $APP_DIR/dashboard
cp .env.example .env.local
npm ci
npm run build

# ─── Python ML services ────────────────────────────────────────────
log "Setting up Python rembg service..."
cd $APP_DIR/ml/rembg-service
python3 -m venv venv
source venv/bin/activate
pip install rembg flask pillow
deactivate

# ─── PM2 processes ─────────────────────────────────────────────────
log "Starting services with PM2..."

pm2 start $APP_DIR/api/src/server.js \
  --name tryon-api \
  --node-args="--env-file=$APP_DIR/api/.env" \
  -i 2

pm2 start npm \
  --name tryon-dashboard \
  --cwd $APP_DIR/dashboard \
  -- start

pm2 start "$APP_DIR/ml/rembg-service/venv/bin/python $APP_DIR/ml/rembg-service/app.py" \
  --name tryon-rembg \
  --interpreter none

pm2 save
pm2 startup  # auto-start on server reboot

# ─── Nginx ─────────────────────────────────────────────────────────
log "Configuring Nginx..."
cp $APP_DIR/infra/nginx.conf /etc/nginx/sites-available/tryon
ln -sf /etc/nginx/sites-available/tryon /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# ─── SSL ───────────────────────────────────────────────────────────
warn "Set up SSL with Let's Encrypt:"
warn "  certbot --nginx -d api.yourdomain.com -d app.yourdomain.com"

log "✅ Deploy complete!"
log "   API:       http://api.yourdomain.com"
log "   Dashboard: http://app.yourdomain.com"
log ""
log "Next steps:"
log "  1. Run certbot for HTTPS"
log "  2. Upload widget JS to Cloudflare R2"
log "  3. Configure Cloudflare DNS"
log "  4. Set up Stripe webhook: POST https://api.yourdomain.com/v1/billing/webhook"

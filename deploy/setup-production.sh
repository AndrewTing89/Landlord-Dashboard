#!/bin/bash

# Production setup script for Landlord Dashboard
set -e

DOMAIN="landlord-dashboard.onlyjobs-studios.com"
APP_DIR="/home/beehiveting/apps/landlord-dashboard"
BACKEND_PORT=3002
FRONTEND_PORT=3000

echo "Setting up Landlord Dashboard for production..."

# 1. Create systemd service for backend
sudo tee /etc/systemd/system/landlord-backend.service > /dev/null <<EOF
[Unit]
Description=Landlord Dashboard Backend
After=network.target

[Service]
Type=simple
User=beehiveting
WorkingDirectory=$APP_DIR/backend
ExecStart=/usr/bin/node src/server.js
Restart=always
RestartSec=10
Environment="NODE_ENV=production"
Environment="PORT=$BACKEND_PORT"

[Install]
WantedBy=multi-user.target
EOF

# 2. Create systemd service for frontend (build and serve with static server)
sudo tee /etc/systemd/system/landlord-frontend.service > /dev/null <<EOF
[Unit]
Description=Landlord Dashboard Frontend
After=network.target

[Service]
Type=simple
User=beehiveting
WorkingDirectory=$APP_DIR/frontend
ExecStart=/usr/bin/npx serve -s dist -l $FRONTEND_PORT
Restart=always
RestartSec=10
Environment="NODE_ENV=production"

[Install]
WantedBy=multi-user.target
EOF

# 3. Build frontend for production
echo "Building frontend..."
cd $APP_DIR/frontend
npm run build

# 4. Install serve globally for frontend
npm install -g serve

# 5. Create Nginx configuration
sudo tee /etc/nginx/sites-available/$DOMAIN > /dev/null <<EOF
server {
    listen 80;
    server_name $DOMAIN;

    # Frontend
    location / {
        proxy_pass http://localhost:$FRONTEND_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:$BACKEND_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

# 6. Enable the site
sudo ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/

# 7. Test Nginx configuration
sudo nginx -t

# 8. Reload services
sudo systemctl daemon-reload
sudo systemctl enable landlord-backend
sudo systemctl enable landlord-frontend
sudo systemctl start landlord-backend
sudo systemctl start landlord-frontend
sudo systemctl reload nginx

echo "Production setup complete!"
echo "Services status:"
sudo systemctl status landlord-backend --no-pager
sudo systemctl status landlord-frontend --no-pager

echo ""
echo "Next steps:"
echo "1. Update DNS to point $DOMAIN to this server's IP"
echo "2. Run: sudo certbot --nginx -d $DOMAIN"
echo "3. Configure Cloudflare DNS and SSL settings"
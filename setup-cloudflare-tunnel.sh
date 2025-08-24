#!/bin/bash

# Cloudflare Tunnel Setup Script for Multiple Apps
# This script helps you set up or update your Cloudflare tunnel

echo "================================================"
echo "Cloudflare Tunnel Setup for onlyapps-studio.com"
echo "================================================"
echo ""

# Check if cloudflared is installed
if ! command -v cloudflared &> /dev/null; then
    echo "cloudflared is not installed. Installing..."
    # Download and install cloudflared
    wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
    sudo dpkg -i cloudflared-linux-amd64.deb
    rm cloudflared-linux-amd64.deb
fi

echo "Current cloudflared version:"
cloudflared --version
echo ""

# Check for existing tunnels
echo "Checking for existing tunnels..."
cloudflared tunnel list 2>/dev/null || echo "No tunnels found or not authenticated"
echo ""

echo "=== SETUP OPTIONS ==="
echo "1. Create a new tunnel"
echo "2. Use existing tunnel (update configuration)"
echo "3. Show current tunnel status"
echo "4. Run tunnel with config file"
echo "5. Install tunnel as systemd service"
echo "6. Exit"
echo ""

read -p "Select option (1-6): " option

case $option in
    1)
        echo ""
        echo "Creating new tunnel..."
        echo "First, you need to authenticate with Cloudflare:"
        cloudflared tunnel login
        
        echo ""
        read -p "Enter a name for your tunnel (e.g., onlyapps-server): " tunnel_name
        cloudflared tunnel create $tunnel_name
        
        echo ""
        echo "Tunnel created! Now you need to:"
        echo "1. Copy the tunnel ID from above"
        echo "2. Update /home/beehiveting/apps/cloudflare-tunnel-config.yml with your tunnel ID"
        echo "3. Add DNS records in Cloudflare dashboard:"
        echo "   - portfolio.onlyapps-studio.com → CNAME → <tunnel-id>.cfargotunnel.com"
        echo "   - landlord-dashboard.onlyapps-studio.com → CNAME → <tunnel-id>.cfargotunnel.com"
        echo "   - tenant.landlord-dashboard.onlyapps-studio.com → CNAME → <tunnel-id>.cfargotunnel.com (optional)"
        ;;
        
    2)
        echo ""
        echo "To use an existing tunnel:"
        echo "1. Make sure your tunnel ID is in cloudflare-tunnel-config.yml"
        echo "2. Ensure DNS records point to your tunnel"
        echo ""
        cloudflared tunnel list
        ;;
        
    3)
        echo ""
        echo "Current tunnel status:"
        cloudflared tunnel list
        echo ""
        echo "To check if tunnel is running:"
        ps aux | grep cloudflared | grep -v grep
        ;;
        
    4)
        echo ""
        echo "Running tunnel with config file..."
        echo "This will run in the foreground. Press Ctrl+C to stop."
        echo ""
        cloudflared tunnel run --config /home/beehiveting/apps/cloudflare-tunnel-config.yml
        ;;
        
    5)
        echo ""
        echo "Installing tunnel as systemd service..."
        
        read -p "Enter your tunnel name: " tunnel_name
        
        # Install the service
        sudo cloudflared service install --config /home/beehiveting/apps/cloudflare-tunnel-config.yml
        
        # Enable and start the service
        sudo systemctl enable cloudflared
        sudo systemctl start cloudflared
        
        echo ""
        echo "Service installed! Check status with:"
        echo "sudo systemctl status cloudflared"
        ;;
        
    6)
        echo "Exiting..."
        exit 0
        ;;
        
    *)
        echo "Invalid option"
        exit 1
        ;;
esac

echo ""
echo "=== NEXT STEPS ==="
echo "1. Ensure all your apps are running:"
echo "   - Portfolio app on port 8501"
echo "   - Landlord frontend on port 3001"
echo "   - Landlord backend on port 3002"
echo "   - Tenant portal on port 3003"
echo ""
echo "2. Update DNS records in Cloudflare dashboard"
echo "3. Run the tunnel or install as service"
echo "4. Test your domains:"
echo "   - https://portfolio.onlyapps-studio.com"
echo "   - https://landlord-dashboard.onlyapps-studio.com"
echo "   - https://tenant.landlord-dashboard.onlyapps-studio.com"
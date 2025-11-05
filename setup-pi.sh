#!/bin/bash
# Raspberry Pi Setup Script for Trader Ranker Backend
# Run this script on your Raspberry Pi

set -e  # Exit on any error

echo "🚀 Trader Ranker Backend Setup Script"
echo "======================================"
echo ""

# Check if running on Raspberry Pi
if [ ! -f /proc/cpuinfo ] || ! grep -q "Raspberry Pi" /proc/cpuinfo; then
    echo "⚠️  Warning: This doesn't appear to be a Raspberry Pi"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Update system
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Python if needed
echo "🐍 Checking Python installation..."
if ! command -v python3 &> /dev/null; then
    echo "Installing Python..."
    sudo apt install python3 python3-pip python3-venv -y
else
    echo "✅ Python already installed: $(python3 --version)"
fi

# Install cloudflared
echo "☁️  Installing Cloudflare Tunnel (cloudflared)..."
if ! command -v cloudflared &> /dev/null; then
    wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm
    sudo mv cloudflared-linux-arm /usr/local/bin/cloudflared
    sudo chmod +x /usr/local/bin/cloudflared
    echo "✅ cloudflared installed: $(cloudflared --version)"
else
    echo "✅ cloudflared already installed: $(cloudflared --version)"
fi

# Get the directory where script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Create Python virtual environment
echo "🔧 Setting up Python virtual environment..."
if [ ! -d "venv" ]; then
    python3 -m venv venv
    echo "✅ Virtual environment created"
else
    echo "✅ Virtual environment already exists"
fi

# Activate and install dependencies
echo "📚 Installing Python dependencies..."
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  IMPORTANT: Edit .env file with your actual credentials!"
    echo "   Run: nano .env"
else
    echo "✅ .env file already exists"
fi

# Test backend
echo ""
echo "🧪 Testing backend..."
if python3 -c "import fastapi, uvicorn; print('✅ Dependencies OK')"; then
    echo "Backend dependencies installed successfully!"
else
    echo "❌ Error: Failed to import required modules"
    exit 1
fi

# Create log files
echo "📄 Creating log files..."
sudo touch /var/log/trader-ranker-backend.log
sudo touch /var/log/trader-ranker-backend-error.log
sudo touch /var/log/cloudflared.log
sudo touch /var/log/cloudflared-error.log
sudo chown pi:pi /var/log/trader-ranker-backend*.log
sudo chown pi:pi /var/log/cloudflared*.log

echo ""
echo "✨ Setup Complete!"
echo "=================="
echo ""
echo "Next steps:"
echo "1. Edit .env file with your credentials:"
echo "   nano .env"
echo ""
echo "2. Test the backend:"
echo "   source venv/bin/activate"
echo "   uvicorn main:app --host 0.0.0.0 --port 8000"
echo "   Visit: http://$(hostname -I | awk '{print $1}'):8000/docs"
echo ""
echo "3. Setup Cloudflare Tunnel:"
echo "   cloudflared tunnel login"
echo "   cloudflared tunnel create trader-ranker-backend"
echo "   # Then edit cloudflare-tunnel-config.yml with your tunnel ID"
echo ""
echo "4. Install systemd services:"
echo "   sudo cp trader-ranker-backend.service /etc/systemd/system/"
echo "   sudo cp cloudflared-tunnel.service /etc/systemd/system/"
echo "   sudo systemctl daemon-reload"
echo "   sudo systemctl enable trader-ranker-backend.service"
echo "   sudo systemctl enable cloudflared-tunnel.service"
echo "   sudo systemctl start trader-ranker-backend.service"
echo "   sudo systemctl start cloudflared-tunnel.service"
echo ""
echo "📖 See DEPLOYMENT.md for full instructions"
echo ""

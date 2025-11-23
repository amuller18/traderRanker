# TraderRanker Raspberry Pi Backend

This is the Express.js API server that runs on your Raspberry Pi and serves data to your Next.js frontend on Vercel.

## Architecture

```
┌─────────────┐         ┌──────────────────┐         ┌──────────────┐
│   Vercel    │  HTTPS  │  Cloudflare      │  HTTP   │ Raspberry Pi │
│  (Next.js)  │────────▶│  Tunnel          │────────▶│  (Express)   │
│   Static    │         │  + Access (Auth) │         │   Backend    │
└─────────────┘         └──────────────────┘         └──────────────┘
                                                              │
                                                              ▼
                                                       ┌─────────────┐
                                                       │  DynamoDB   │
                                                       └─────────────┘
```

## Setup on Raspberry Pi

### 1. Install Node.js

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js (v18 or higher)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version
npm --version
```

### 2. Copy Backend Files

```bash
# Copy the entire pi-backend directory to your Raspberry Pi
# Example using scp:
scp -r pi-backend pi@raspberrypi.local:~/traderranker-api

# Or clone your repository on the Pi
cd ~
git clone https://github.com/yourusername/traderRanker.git
cd traderRanker/pi-backend
```

### 3. Install Dependencies

```bash
cd ~/traderranker-api  # or wherever you copied the files
npm install
```

### 4. Configure Environment Variables

```bash
# Copy the example env file
cp .env.example .env

# Edit the .env file
nano .env
```

Fill in your actual values:

```env
# Server Configuration
PORT=4000
NODE_ENV=production

# API Security - Generate a strong random key
API_KEY=your-secure-random-api-key-min-32-characters

# Allowed origins (your Vercel deployment URL)
ALLOWED_ORIGINS=https://your-app.vercel.app,https://your-app-git-main.vercel.app

# AWS DynamoDB Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIAXXXXXXXXXX
AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxx
DYNAMODB_TRADERS_TABLE=CallerStatistics
DYNAMODB_TRADES_TABLE=Trades
```

### 5. Set Up Cloudflare Tunnel

Install Cloudflare Tunnel (cloudflared):

```bash
# Download cloudflared
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb
sudo dpkg -i cloudflared-linux-arm64.deb

# Login to Cloudflare
cloudflared tunnel login

# Create a tunnel
cloudflared tunnel create traderranker-api

# Copy the tunnel ID shown, you'll need it

# Create config file
sudo nano ~/.cloudflared/config.yml
```

Add this configuration:

```yaml
tunnel: YOUR_TUNNEL_ID
credentials-file: /home/pi/.cloudflared/YOUR_TUNNEL_ID.json

ingress:
  - hostname: api.yourdomain.com
    service: http://localhost:4000
  - service: http_status:404
```

Route the tunnel:

```bash
cloudflared tunnel route dns traderranker-api api.yourdomain.com
```

### 6. Set Up as System Service

Create a systemd service for the API:

```bash
sudo nano /etc/systemd/system/traderranker-api.service
```

Add this content:

```ini
[Unit]
Description=TraderRanker API Server
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/traderranker-api
Environment=NODE_ENV=production
ExecStart=/usr/bin/node src/server.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Create a systemd service for Cloudflare Tunnel:

```bash
sudo nano /etc/systemd/system/cloudflared.service
```

Add this content:

```ini
[Unit]
Description=Cloudflare Tunnel
After=network.target

[Service]
Type=simple
User=pi
ExecStart=/usr/local/bin/cloudflared tunnel run traderranker-api
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start both services:

```bash
# Enable services to start on boot
sudo systemctl enable traderranker-api
sudo systemctl enable cloudflared

# Start services
sudo systemctl start traderranker-api
sudo systemctl start cloudflared

# Check status
sudo systemctl status traderranker-api
sudo systemctl status cloudflared

# View logs
sudo journalctl -u traderranker-api -f
sudo journalctl -u cloudflared -f
```

### 7. Optional: Add Cloudflare Access for Extra Security

1. Go to Cloudflare Zero Trust dashboard
2. Create an Access application for `api.yourdomain.com`
3. Set up authentication rules (e.g., service tokens)
4. Update your `.env` with Cloudflare Access settings if using JWT validation

### 8. Test the API

```bash
# From your Pi (local)
curl http://localhost:4000/health

# From anywhere (through Cloudflare Tunnel)
curl https://api.yourdomain.com/health

# Test authenticated endpoint
curl -H "X-API-Key: your-api-key" https://api.yourdomain.com/api/traders/stats
```

## API Endpoints

All endpoints require `X-API-Key` header for authentication.

### Traders

- `GET /api/traders/stats` - Get all trader statistics with optional filters
  - Query params: `winRateMin`, `winRateMax`, `totalCallsMin`, `totalCallsMax`, `roiMin`, `roiMax`, `search`
- `GET /api/traders/:caller/trades` - Get trades for specific trader
- `POST /api/traders` - Create/update trader
- `DELETE /api/traders/:caller` - Delete trader

### Trades

- `GET /api/trades` - Get all trades
- `GET /api/trades/filtered` - Get filtered trades
  - Query params: `roiMin`, `roiMax`, `mcMin`, `mcMax`, `dateFrom`, `dateTo`, `search`, `trader`
- `POST /api/trades` - Create/update trade
- `DELETE /api/trades` - Delete trade (body: `{caller, ca, date_called}`)

## Monitoring

```bash
# Check API logs
sudo journalctl -u traderranker-api -f

# Check tunnel logs
sudo journalctl -u cloudflared -f

# Restart API
sudo systemctl restart traderranker-api

# Restart tunnel
sudo systemctl restart cloudflared
```

## Security Checklist

- ✅ Use a strong, random API key (32+ characters)
- ✅ Only allow your Vercel domain in CORS
- ✅ Use HTTPS only (enforced by Cloudflare Tunnel)
- ✅ Keep Node.js and dependencies updated
- ✅ Consider adding rate limiting for production
- ✅ Monitor API logs for suspicious activity
- ✅ Optional: Add Cloudflare Access for additional auth layer

## Troubleshooting

**API not responding:**
```bash
sudo systemctl status traderranker-api
sudo journalctl -u traderranker-api --since "10 minutes ago"
```

**Tunnel not connecting:**
```bash
sudo systemctl status cloudflared
cloudflared tunnel info traderranker-api
```

**CORS errors:**
- Make sure `ALLOWED_ORIGINS` in `.env` matches your Vercel deployment URL exactly
- Include all Vercel preview URLs if needed

**DynamoDB connection issues:**
- Verify AWS credentials are correct
- Check IAM permissions for DynamoDB access
- Verify table names match your actual tables

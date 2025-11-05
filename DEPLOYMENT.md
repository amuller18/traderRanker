# Deployment Guide: Cloudflare Pages + Raspberry Pi

This guide walks you through deploying the Trader Ranker application with:
- **Frontend**: Cloudflare Pages (global CDN)
- **Backend**: Raspberry Pi (your home network via Cloudflare Tunnel)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│          Users (Worldwide)                              │
└────────────────┬────────────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────────────┐
│     Cloudflare Pages (Frontend - Next.js)              │
│     https://trader-ranker.pages.dev                     │
└────────────────┬────────────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────────────┐
│     Cloudflare Tunnel                                   │
│     https://api.yourdomain.com                          │
└────────────────┬────────────────────────────────────────┘
                 │
                 ↓ (secure tunnel)
┌─────────────────────────────────────────────────────────┐
│     Raspberry Pi (Backend - FastAPI)                    │
│     localhost:8000 (main.py)                            │
└─────────────────────────────────────────────────────────┘
```

---

## Part 1: Setup Raspberry Pi Backend

### 1.1 Prerequisites on Raspberry Pi

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Python 3.11+ (if not already installed)
sudo apt install python3 python3-pip python3-venv -y

# Install cloudflared
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm
sudo mv cloudflared-linux-arm /usr/local/bin/cloudflared
sudo chmod +x /usr/local/bin/cloudflared
```

### 1.2 Clone Repository to Raspberry Pi

```bash
cd /home/pi
git clone https://github.com/amuller18/traderRanker.git
cd traderRanker
git checkout claude/github-pages-backend-setup-011CUqcCQMTiHg5okCkjPDoL
```

### 1.3 Setup Python Environment

```bash
# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 1.4 Configure Environment Variables

```bash
# Create .env file (copy from example)
cp .env.example .env

# Edit with your actual values
nano .env
```

Add your AWS credentials, API keys, etc.:
```env
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
BIRDEYE_API_KEY=your_key
COINGECKO_API_KEY=your_key
QUICKNODE_RPC=https://your-quicknode-url.solana-mainnet.quiknode.pro/your-token/
```

### 1.5 Test Backend Locally

```bash
# Run backend
uvicorn main:app --host 0.0.0.0 --port 8000

# Test in browser
# Visit: http://your-pi-ip:8000/docs
```

---

## Part 2: Setup Cloudflare Tunnel

### 2.1 Login to Cloudflare

```bash
cloudflared tunnel login
```

This will open a browser window. Select your domain.

### 2.2 Create Tunnel

```bash
# Create a new tunnel
cloudflared tunnel create trader-ranker-backend

# This creates a credentials file at:
# ~/.cloudflared/<TUNNEL_ID>.json
# Note down the TUNNEL_ID from the output
```

### 2.3 Configure Tunnel

Edit the tunnel config file:
```bash
nano /home/pi/traderRanker/cloudflare-tunnel-config.yml
```

Update with your tunnel ID:
```yaml
tunnel: YOUR_TUNNEL_ID_HERE
credentials-file: /home/pi/.cloudflared/YOUR_TUNNEL_ID_HERE.json

ingress:
  - hostname: api.yourdomain.com
    service: http://localhost:8000
  - service: http_status:404
```

### 2.4 Create DNS Record

```bash
# Route your domain to the tunnel
cloudflared tunnel route dns trader-ranker-backend api.yourdomain.com
```

This creates a CNAME record: `api.yourdomain.com` → `YOUR_TUNNEL_ID.cfargotunnel.com`

### 2.5 Test Tunnel

```bash
# Start backend (in one terminal)
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000

# Start tunnel (in another terminal)
cloudflared tunnel --config /home/pi/traderRanker/cloudflare-tunnel-config.yml run

# Test publicly
# Visit: https://api.yourdomain.com/docs
```

---

## Part 3: Auto-Start Services on Boot

### 3.1 Install Backend Service

```bash
# Copy service file
sudo cp /home/pi/traderRanker/trader-ranker-backend.service /etc/systemd/system/

# Create log files
sudo touch /var/log/trader-ranker-backend.log
sudo touch /var/log/trader-ranker-backend-error.log
sudo chown pi:pi /var/log/trader-ranker-backend*.log

# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable trader-ranker-backend.service
sudo systemctl start trader-ranker-backend.service

# Check status
sudo systemctl status trader-ranker-backend.service
```

### 3.2 Install Cloudflare Tunnel Service

```bash
# Copy service file
sudo cp /home/pi/traderRanker/cloudflared-tunnel.service /etc/systemd/system/

# Create log files
sudo touch /var/log/cloudflared.log
sudo touch /var/log/cloudflared-error.log
sudo chown pi:pi /var/log/cloudflared*.log

# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable cloudflared-tunnel.service
sudo systemctl start cloudflared-tunnel.service

# Check status
sudo systemctl status cloudflared-tunnel.service
```

### 3.3 View Logs

```bash
# Backend logs
sudo journalctl -u trader-ranker-backend.service -f

# Tunnel logs
sudo journalctl -u cloudflared-tunnel.service -f

# Or view log files directly
tail -f /var/log/trader-ranker-backend.log
tail -f /var/log/cloudflared.log
```

---

## Part 4: Deploy Frontend to Cloudflare Pages

### 4.1 Connect GitHub to Cloudflare Pages

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to **Workers & Pages** → **Create Application** → **Pages** → **Connect to Git**
3. Select your GitHub repository: `amuller18/traderRanker`
4. Choose branch: `main` (or your preferred branch)

### 4.2 Configure Build Settings

In Cloudflare Pages settings:

**Framework preset**: `Next.js`

**Build command**:
```bash
pnpm install && pnpm build
```

**Build output directory**:
```
.next
```

**Root directory**: `/` (leave default)

**Node version**: `20.x` or `22.x`

### 4.3 Set Environment Variables

In Cloudflare Pages → Settings → Environment Variables, add:

**Production variables**:
```
NEXT_PUBLIC_API_URL=https://your-site.pages.dev
NEXT_PUBLIC_PYTHON_API_URL=https://api.yourdomain.com

AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
DYNAMODB_TRADERS_TABLE=Trades
DYNAMODB_TRADER_STATISTICS=CallerStatistics

BIRDEYE_API_KEY=your_key
COINGECKO_API_KEY=your_key
QUICKNODE_RPC=https://your-quicknode-url
```

**Important**:
- `NEXT_PUBLIC_PYTHON_API_URL` should point to your Cloudflare Tunnel URL: `https://api.yourdomain.com`
- Do NOT include trailing slashes

### 4.4 Deploy

Click **Save and Deploy**

Cloudflare Pages will:
1. Clone your repo
2. Install dependencies with `pnpm`
3. Build your Next.js app
4. Deploy to global CDN

Your site will be available at: `https://trader-ranker.pages.dev`

### 4.5 Custom Domain (Optional)

To use a custom domain:
1. Go to **Custom domains** in Cloudflare Pages
2. Click **Set up a custom domain**
3. Enter your domain (e.g., `traderranker.com`)
4. Follow DNS instructions

---

## Part 5: Testing the Complete Setup

### 5.1 Test Backend

```bash
curl https://api.yourdomain.com/docs
# Should return Swagger UI HTML
```

### 5.2 Test Frontend

Visit: `https://trader-ranker.pages.dev`

1. Navigate to **Backtest** page
2. Load sample trades
3. Run simulation
4. Check if it connects to backend successfully

### 5.3 Check Connectivity

Open browser DevTools (F12) → Network tab:
- Look for requests to `https://api.yourdomain.com/api/simulate/...`
- Should return 200 status codes

---

## Part 6: Maintenance & Monitoring

### 6.1 Update Backend Code

```bash
cd /home/pi/traderRanker
git pull origin main

# Restart service
sudo systemctl restart trader-ranker-backend.service
```

### 6.2 Update Frontend

Simply push to GitHub:
```bash
git add .
git commit -m "Update frontend"
git push origin main
```

Cloudflare Pages will auto-deploy on push.

### 6.3 Monitor Services

```bash
# Check if services are running
sudo systemctl status trader-ranker-backend.service
sudo systemctl status cloudflared-tunnel.service

# View real-time logs
sudo journalctl -u trader-ranker-backend.service -f
sudo journalctl -u cloudflared-tunnel.service -f
```

### 6.4 Restart Services

```bash
# Restart backend
sudo systemctl restart trader-ranker-backend.service

# Restart tunnel
sudo systemctl restart cloudflared-tunnel.service

# Restart both
sudo systemctl restart trader-ranker-backend.service cloudflared-tunnel.service
```

---

## Troubleshooting

### Backend won't start
```bash
# Check logs
sudo journalctl -u trader-ranker-backend.service -n 50

# Common issues:
# - Missing dependencies: pip install -r requirements.txt
# - Port already in use: sudo lsof -i :8000
# - Permission issues: Check file ownership
```

### Tunnel not connecting
```bash
# Check tunnel status
sudo systemctl status cloudflared-tunnel.service

# Common issues:
# - Wrong tunnel ID in config
# - Credentials file path incorrect
# - DNS not propagated (wait 5-10 minutes)
```

### Frontend can't reach backend
- Check `NEXT_PUBLIC_PYTHON_API_URL` in Cloudflare Pages environment variables
- Verify tunnel is running: `curl https://api.yourdomain.com/docs`
- Check CORS settings in backend if needed

### Port forwarding needed?
**No!** Cloudflare Tunnel handles everything. Your Pi doesn't need port forwarding or public IP.

---

## Security Notes

1. **Never commit `.env` files** to git
2. **Rotate API keys regularly**
3. **Keep Raspberry Pi updated**: `sudo apt update && sudo apt upgrade`
4. **Monitor tunnel logs** for suspicious activity
5. **Use strong passwords** for Pi user account
6. **Enable Pi firewall** (optional):
   ```bash
   sudo apt install ufw
   sudo ufw allow 22/tcp  # SSH
   sudo ufw enable
   ```

---

## Cost Breakdown

- **Cloudflare Pages**: Free (500 builds/month)
- **Cloudflare Tunnel**: Free (unlimited traffic)
- **Raspberry Pi**: One-time cost (~$50-100)
- **Electricity**: ~$2-5/month
- **Total ongoing**: ~$2-5/month 🎉

---

## Next Steps

1. ✅ Set up Raspberry Pi with backend
2. ✅ Configure Cloudflare Tunnel
3. ✅ Deploy frontend to Cloudflare Pages
4. ✅ Test complete flow
5. 🚀 Go live!

---

## Support

If you encounter issues:
1. Check logs on Raspberry Pi
2. Review Cloudflare Pages deployment logs
3. Verify environment variables
4. Test backend independently at `https://api.yourdomain.com/docs`

---

**Happy deploying!** 🚀

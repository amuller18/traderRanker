# Deployment Guide: Static Next.js Frontend + Raspberry Pi Backend

This guide explains how to deploy TraderRanker with a static Next.js frontend on Vercel and a backend API on Raspberry Pi.

## Architecture Overview

```
┌───────────────────────────────────────────────────────────────┐
│                         END USERS                              │
└───────────────────┬───────────────────────────────────────────┘
                    │ HTTPS
                    ▼
┌───────────────────────────────────────────────────────────────┐
│              VERCEL (Static Next.js Frontend)                  │
│  • Output: 'export' (static HTML/CSS/JS)                      │
│  • No Node.js runtime required                                │
│  • Client-side React app                                      │
└───────────────────┬───────────────────────────────────────────┘
                    │ HTTPS API Calls
                    │ (with X-API-Key header)
                    ▼
┌───────────────────────────────────────────────────────────────┐
│            CLOUDFLARE TUNNEL + ACCESS (Optional)               │
│  • Exposes Pi to internet via HTTPS                           │
│  • api.yourdomain.com → localhost:4000                        │
│  • Optional: JWT-based authentication                         │
└───────────────────┬───────────────────────────────────────────┘
                    │ HTTP (local network)
                    ▼
┌───────────────────────────────────────────────────────────────┐
│             RASPBERRY PI (Express.js Backend)                  │
│  • Node.js + Express server                                   │
│  • API key authentication                                     │
│  • CORS restricted to Vercel domain                           │
└───────────────────┬───────────────────────────────────────────┘
                    │ AWS SDK
                    ▼
┌───────────────────────────────────────────────────────────────┐
│                    AWS DYNAMODB                                │
│  • CallerStatistics table (traders)                           │
│  • Trades table                                               │
└───────────────────────────────────────────────────────────────┘
```

## What Changed from Server Actions

### Before (Server Actions - Incompatible with Static Export)
```typescript
// app/actions/trader-actions.ts
"use server"
export async function fetchTraderStats() {
  // Runs on server, requires Node.js runtime
}

// Component
import { fetchTraderStats } from "@/app/actions/trader-actions"
const data = await fetchTraderStats() // Server-side only
```

### After (Client-Side API Calls - Compatible with Static Export)
```typescript
// lib/api-client.ts
export async function fetchTraderStats() {
  // Calls external API from browser
  return fetch(`${NEXT_PUBLIC_PI_API_BASE}/api/traders/stats`)
}

// Component
"use client"
import { fetchTraderStats } from "@/lib/api-client"
useEffect(() => {
  fetchTraderStats().then(setData) // Client-side
}, [])
```

## Files Modified

### Frontend Changes

1. **NEW: `lib/api-client.ts`**
   - Client-side API utilities
   - Replaces all Server Actions
   - Uses `NEXT_PUBLIC_PI_API_BASE` and `NEXT_PUBLIC_PI_API_KEY`
   - Handles authentication via X-API-Key header

2. **DELETED: `app/actions/trader-actions.ts`**
   - Removed Server Actions file
   - Incompatible with `output: 'export'`

3. **Updated Components:**
   - `app/rankings/components/trader-rankings.tsx`
   - `app/trades/client-page.tsx`
   - `dynamic-routes-rankings-trader/page.tsx`
   - `dynamic-routes-token-analysis-token/page.tsx`
   - `dynamic-routes-trades-token/page.tsx`
   - `app/test-minimal-dynamo/page.tsx`

   All now import from `@/lib/api-client` instead of `@/app/actions/trader-actions`

4. **Config: `next.config.mjs`**
   - Already has `output: 'export'` - no changes needed
   - Remains compatible with static export

### Backend Changes (New)

1. **NEW: `pi-backend/` directory**
   - Complete Express.js server
   - Ready to deploy on Raspberry Pi
   - See `pi-backend/README.md` for setup

## Part 1: Deploy Frontend to Vercel

### 1. Set Environment Variables on Vercel

Go to your Vercel project settings → Environment Variables and add:

```env
NEXT_PUBLIC_PI_API_BASE=https://api.yourdomain.com
NEXT_PUBLIC_PI_API_KEY=your-secure-api-key-here
```

**Important:**
- Use the same API key as your Pi backend
- `NEXT_PUBLIC_PI_API_BASE` should be your Cloudflare Tunnel URL (set up in Part 2)

### 2. Verify Static Export Build Locally

```bash
# Install dependencies
npm install --legacy-peer-deps

# Build for production
npm run build

# The build should complete without errors
# You should see: "Exported as static HTML to 'out' folder"
```

### 3. Deploy to Vercel

```bash
# Option 1: Push to GitHub (automatic deployment)
git add .
git commit -m "Migrate to client-side API with Pi backend"
git push origin main

# Option 2: Deploy manually
npx vercel --prod
```

### 4. Update CORS on Pi Backend

After Vercel deployment, note your production URL (e.g., `https://your-app.vercel.app`)

Update your Pi's `.env` file:
```env
ALLOWED_ORIGINS=https://your-app.vercel.app,https://your-app-git-main.vercel.app
```

Restart the Pi backend:
```bash
sudo systemctl restart traderranker-api
```

## Part 2: Deploy Backend to Raspberry Pi

See **`pi-backend/README.md`** for complete setup instructions.

### Quick Setup Summary

1. **Install Node.js on Pi** (v18+)
2. **Copy backend files** to Pi
3. **Install dependencies:** `npm install`
4. **Configure `.env`** with AWS credentials and API key
5. **Set up Cloudflare Tunnel** to expose API via HTTPS
6. **Create systemd services** for auto-start
7. **Start services:**
   ```bash
   sudo systemctl start traderranker-api
   sudo systemctl start cloudflared
   ```

## Part 3: Verification

### 1. Test API Directly

```bash
# Health check (no auth)
curl https://api.yourdomain.com/health

# Authenticated endpoint
curl -H "X-API-Key: your-api-key" https://api.yourdomain.com/api/traders/stats
```

### 2. Test Frontend

1. Visit your Vercel deployment: `https://your-app.vercel.app`
2. Check browser console for errors
3. Verify data loads from Pi API
4. Check Network tab to see API calls to `api.yourdomain.com`

### 3. Common Issues

**CORS errors:**
- Verify `ALLOWED_ORIGINS` in Pi's `.env` matches your Vercel URL exactly
- Restart Pi backend after changing `.env`

**API connection failed:**
- Check Cloudflare Tunnel is running: `sudo systemctl status cloudflared`
- Verify DNS is configured: `dig api.yourdomain.com`
- Check Pi backend is running: `sudo systemctl status traderranker-api`

**Build errors (Next.js):**
- Make sure no files still import from `@/app/actions/trader-actions`
- Verify `output: 'export'` is in `next.config.mjs`
- Check for any remaining `"use server"` directives

**Authentication errors:**
- Verify `NEXT_PUBLIC_PI_API_KEY` on Vercel matches `API_KEY` on Pi
- Check API key is being sent in requests (see Network tab)

## Security Best Practices

1. **API Key Management:**
   - Use a strong random key (32+ characters)
   - Never commit API keys to git
   - Rotate keys periodically

2. **CORS Configuration:**
   - Only allow your specific Vercel domains
   - Don't use wildcards (`*`) in production

3. **HTTPS Only:**
   - Cloudflare Tunnel enforces HTTPS
   - Never expose Pi directly to internet

4. **Optional: Cloudflare Access:**
   - Add JWT-based authentication layer
   - Restrict access by email, IP, or service tokens
   - See Pi backend README for setup

5. **Monitoring:**
   - Set up log monitoring: `sudo journalctl -u traderranker-api -f`
   - Monitor for failed authentication attempts
   - Set up alerts for service downtime

## Development vs Production

### Development (Local)

**Frontend (.env.local):**
```env
NEXT_PUBLIC_PI_API_BASE=http://localhost:4000
NEXT_PUBLIC_PI_API_KEY=dev-api-key
```

**Backend (Pi .env):**
```env
ALLOWED_ORIGINS=http://localhost:3000
API_KEY=dev-api-key
NODE_ENV=development
```

### Production

**Frontend (Vercel):**
```env
NEXT_PUBLIC_PI_API_BASE=https://api.yourdomain.com
NEXT_PUBLIC_PI_API_KEY=prod-secure-key-32-chars-min
```

**Backend (Pi .env):**
```env
ALLOWED_ORIGINS=https://your-app.vercel.app
API_KEY=prod-secure-key-32-chars-min
NODE_ENV=production
```

## Maintenance

### Update Frontend
```bash
git pull origin main
npm install --legacy-peer-deps
npm run build
git push origin main  # Auto-deploys to Vercel
```

### Update Backend
```bash
cd ~/traderranker-api
git pull origin main
npm install
sudo systemctl restart traderranker-api
```

### View Logs
```bash
# Frontend (Vercel)
# Check Vercel dashboard → Deployments → Function Logs

# Backend (Pi)
sudo journalctl -u traderranker-api -f
sudo journalctl -u cloudflared -f
```

## Cost Breakdown

- **Vercel:** Free tier (static hosting)
- **Cloudflare Tunnel:** Free
- **Raspberry Pi:** One-time hardware cost (~$50-100)
- **AWS DynamoDB:** Pay per request (can be free tier)
- **Domain:** ~$10-15/year (for Cloudflare Tunnel)

Total monthly cost: **~$0-5** (mostly AWS usage)

## Next Steps

- [ ] Set up monitoring and alerts
- [ ] Configure automated backups for DynamoDB
- [ ] Add rate limiting to API
- [ ] Set up Cloudflare Access for extra security
- [ ] Configure auto-deployment with GitHub Actions
- [ ] Add API response caching

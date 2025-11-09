# Cloudflare Pages Static Build Configuration

This project has been configured for static deployment to Cloudflare Pages.

## Changes Made

### 1. Next.js Configuration (next.config.mjs)
- Added `output: 'export'` to enable static HTML export
- Removed experimental features incompatible with static export
- Kept `images: { unoptimized: true }` for static image handling

### 2. Removed Dynamic Server Features
- Removed `"use server"` directives from:
  - `app/actions/trader-actions.ts`
  - `app/actions/token-actions.ts`
- Removed `export const dynamic = "force-dynamic"` from all pages
- Removed `export const revalidate` settings from all pages

### 3. Font Configuration
- Changed from Google Fonts (`next/font/google`) to system fonts
- Using `className="font-sans"` for consistent typography

### 4. Moved Files (Temporarily)
The following dynamic routes and API routes were moved out of the build:
- `app/api/*` → `api-backup/` (API routes need separate deployment)
- `app/trades/[token]` → `dynamic-routes-trades-token/`
- `app/rankings/[trader]` → `dynamic-routes-rankings-trader/`
- `app/token-analysis/[token]` → `dynamic-routes-token-analysis-token/`

## Build Output

The static site is generated in the `out/` directory with the following pages:
- `/` - Landing page
- `/trades` - Trades listing
- `/rankings` - Trader rankings
- `/token-analysis` - Token analysis search
- `/backtest` - Backtesting tool
- `/copy-trader` - Copy trading dashboard
- And other test pages

## Cloudflare Pages Deployment

### Build Settings
```
Build command: npm run build
Build output directory: out
Node version: 18 or higher
```

### Environment Variables
If you need AWS DynamoDB access, set these in Cloudflare Pages:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`

Note: The build will use mock data if AWS credentials are not available.

## API Routes

The API routes in `api-backup/` require server-side execution and cannot be deployed as static files. Options:

1. **Cloudflare Functions**: Convert API routes to Cloudflare Functions (place in `functions/` directory)
2. **Separate API Deployment**: Deploy the API separately (e.g., Vercel, AWS Lambda, etc.)
3. **Client-Side Only**: Use the static pages without backend API calls

## Dynamic Routes

The dynamic routes (trader detail pages, token detail pages) are currently excluded from the static build. To add them back:

1. **Option A**: Pre-generate static pages for known traders/tokens using `generateStaticParams`
2. **Option B**: Implement client-side routing and data fetching
3. **Option C**: Use Cloudflare Pages Functions for dynamic routes

## Development

```bash
# Install dependencies
npm install --legacy-peer-deps

# Development server (will have limited functionality)
npm run dev

# Build static site
npm run build

# The static files will be in the 'out/' directory
```

## Notes

- The static build uses mock data during build time since AWS credentials aren't available
- Dynamic features requiring server-side rendering will need to be implemented client-side
- Some features may have reduced functionality in the static build

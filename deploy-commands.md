# 🚀 Quick Deployment Commands

## One-Line Vercel Deployment

```bash
# Install Vercel CLI globally (one time)
npm install -g vercel

# Deploy with environment variables
vercel --prod -e VITE_BACKEND_URL=https://your-railway-app.railway.app -e VITE_NODE_ENV=production
```

## Local Testing Before Deployment

```bash
# Test production build locally
npm run build && npm run preview
```

## Environment Setup

Create `.env.local` in project root:
```env
VITE_BACKEND_URL=https://your-railway-app.railway.app
VITE_NODE_ENV=production
```

Then deploy:
```bash
vercel --prod
```

## Check Deployment Status

```bash
# List all deployments
vercel ls

# View deployment logs  
vercel logs [deployment-url]
``` 
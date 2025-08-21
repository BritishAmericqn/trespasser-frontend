# 🚨 EMERGENCY NETWORK HOTFIX - APPLY NOW!

## The Problem
Other machines can't connect because the frontend is trying to connect to `localhost:3000` instead of your Railway backend.

## Immediate Fix (5 minutes)

### Option A: Fix on Vercel (RECOMMENDED)
1. Go to https://vercel.com/dashboard
2. Select your `trespasser-frontend` project
3. Go to Settings → Environment Variables
4. Add new variable:
   - **Name:** `VITE_BACKEND_URL`
   - **Value:** Your Railway backend URL (check Railway dashboard)
   - Example: `https://trespasser-backend.up.railway.app`
5. Click "Save"
6. Go to Deployments tab
7. Click "..." on latest deployment → "Redeploy"
8. Wait 2 minutes for deployment

### Option B: Quick Code Fix (if you need it working NOW)
Run these commands:

```bash
# Create a temporary environment file
echo "VITE_BACKEND_URL=https://your-backend.up.railway.app" > .env.production

# Commit and push
git add .env.production
git commit -m "Add production backend URL"
git push
```

Vercel will auto-deploy.

## Verify It's Working

1. Open trespass.gg in Chrome DevTools Console
2. You should see:
   ```
   🔍 DEBUG: VITE_BACKEND_URL = https://your-backend.up.railway.app
   ```
   NOT:
   ```
   🔍 DEBUG: VITE_BACKEND_URL = undefined
   ```

## Additional Quick Fixes

### If WebSocket Still Fails
The issue might be CORS on your backend. Ask your backend developer to:

1. Find the Socket.IO initialization in their code
2. Update CORS to include your domain:
```javascript
cors: {
  origin: ["https://trespass.gg", "https://www.trespass.gg", "https://*.vercel.app"],
  credentials: true
}
```

### Test Connection
Run this in browser console at trespass.gg:
```javascript
// Should print your backend URL, not localhost
console.log(import.meta.env.VITE_BACKEND_URL || 'NOT SET - THIS IS THE PROBLEM');
```

## Still Not Working?

The backend might be down or rejecting connections. Check:
1. Railway dashboard - is backend running?
2. Try: `curl https://your-backend.up.railway.app/health`
3. Check Railway logs for errors

## Emergency Contact
If backend is down, contact your backend developer immediately with:
- Error: "WebSocket connections failing from production"
- Users affected: All except development machine
- Priority: CRITICAL - Game unplayable

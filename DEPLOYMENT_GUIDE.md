# 🚀 Deployment Guide: Frontend (Vercel) + Backend (Railway)

## Overview
This guide walks you through deploying your multiplayer game:
- **Frontend**: Vite/TypeScript app deployed to Vercel
- **Backend**: Socket.io server deployed to Railway
- **Real-time Connection**: WebSocket communication between services

## 📋 Prerequisites

### 1. Backend Deployment (Railway)
First, deploy your backend to Railway:

1. Connect your backend repository to Railway
2. Railway will assign a URL like: `https://your-app-name.railway.app`
3. Make sure your backend is configured to accept connections from your Vercel domain
4. Note the Railway URL - you'll need it for the frontend environment variables

### 2. CORS Configuration (Backend)
Ensure your backend allows connections from Vercel:

```javascript
// In your backend Socket.io setup
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:5173",
      "https://your-vercel-app.vercel.app"  // Add your Vercel domain
    ],
    methods: ["GET", "POST"]
  }
});
```

## 🔧 Frontend Deployment (Vercel)

### Step 1: Environment Variables
Create these environment files in your project root:

**`.env.example`** (commit this to git):
```env
# Backend Configuration
VITE_BACKEND_URL=http://localhost:3000

# Development
VITE_NODE_ENV=development

# Production Example
# VITE_BACKEND_URL=https://your-railway-app.railway.app
# VITE_NODE_ENV=production
```

**`.env.local`** (DO NOT commit - add to .gitignore):
```env
# Local development
VITE_BACKEND_URL=http://localhost:3000
VITE_NODE_ENV=development
```

### Step 2: Deploy to Vercel

#### Option A: Vercel CLI
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy from project root
vercel

# Set environment variables during setup:
# VITE_BACKEND_URL = https://your-railway-app.railway.app
# VITE_NODE_ENV = production
```

#### Option B: Vercel Web Interface
1. Go to [vercel.com](https://vercel.com)
2. Connect your GitHub repository
3. Import your project
4. In **Environment Variables**, add:
   - `VITE_BACKEND_URL` = `https://your-railway-app.railway.app`
   - `VITE_NODE_ENV` = `production`
5. Deploy

### Step 3: Configure Domain (Optional)
- Vercel provides a free domain: `your-app.vercel.app`
- Add custom domain in Vercel dashboard if desired
- Update backend CORS with your final domain

## 🔍 Testing the Deployment

### 1. Check Frontend
- Visit your Vercel URL
- Open browser dev tools → Network tab
- Should see successful connection to Railway backend

### 2. Check Backend Connection
In browser console, you should see:
```
🔌 Attempting to connect to backend at: https://your-railway-app.railway.app
✅ Connected to server: [socket-id]
```

### 3. Test Multiplayer
- Open multiple browser tabs/windows
- Players should see each other
- Real-time updates should work

## 🛠️ Troubleshooting

### CORS Errors
```
Access to XMLHttpRequest at 'wss://your-railway-app.railway.app/socket.io/' 
from origin 'https://your-app.vercel.app' has been blocked by CORS policy
```

**Solution**: Update backend CORS configuration to include your Vercel domain.

### Connection Timeout
```
WebSocket connection failed: timeout
```

**Solutions**:
1. Check Railway backend is running
2. Verify `VITE_BACKEND_URL` environment variable
3. Check Railway logs for errors

### Environment Variables Not Working
```
Cannot read properties of undefined (reading 'VITE_BACKEND_URL')
```

**Solutions**:
1. Ensure variables are prefixed with `VITE_`
2. Redeploy after adding environment variables
3. Check Vercel environment variable settings

## 📊 Production Configuration

### Vercel Settings
```json
// vercel.json
{
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/static-build",
      "config": { "distDir": "dist" }
    }
  ],
  "routes": [
    {
      "src": "/assets/(.*)",
      "headers": { "cache-control": "max-age=31536000, immutable" }
    },
    { "handle": "filesystem" },
    { "src": "/(.*)", "dest": "/index.html" }
  ]
}
```

### Optimization Features
- ✅ Asset compression (Gzip + Brotli)
- ✅ Code splitting (Phaser, Socket.io, Vendor)
- ✅ Static asset caching
- ✅ Source maps disabled in production

## 🔄 Continuous Deployment

### Automatic Deployments
- Vercel automatically deploys on git push to main branch
- Environment variables persist across deployments
- Preview deployments for pull requests

### Manual Deployments
```bash
# Redeploy current branch
vercel --prod

# Deploy specific branch
vercel --prod --branch feature-branch
```

## 📝 Environment Variables Reference

| Variable | Development | Production | Description |
|----------|-------------|------------|-------------|
| `VITE_BACKEND_URL` | `http://localhost:3000` | `https://your-app.railway.app` | Backend WebSocket URL |
| `VITE_NODE_ENV` | `development` | `production` | Environment identifier |

## 🎯 Final Checklist

- [ ] Backend deployed to Railway
- [ ] Backend CORS configured for Vercel domain
- [ ] Frontend deployed to Vercel
- [ ] Environment variables set in Vercel
- [ ] Connection tested between services
- [ ] Multiplayer functionality verified
- [ ] Custom domain configured (optional)

Your multiplayer game is now live! 🎮 
# 🎮 Trespasser Frontend

A real-time multiplayer game frontend built with TypeScript, Vite, and Phaser.js.

## 🚀 Quick Start

### Development
```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Access the game at `http://localhost:5173`

### Production Build
```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

## 🌐 Deployment

This frontend is designed to deploy to **Vercel** and connect to a **Railway** backend.

### Deploy to Vercel
1. Connect your GitHub repository to Vercel
2. Set environment variable: `VITE_BACKEND_URL` = `https://your-railway-app.railway.app`
3. Deploy automatically on push to main

### Full Deployment Guide
See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for complete deployment instructions.

## 🛠️ Tech Stack

- **Frontend**: Vite + TypeScript + Phaser.js
- **Networking**: Socket.io-client
- **Deployment**: Vercel (Frontend) + Railway (Backend)
- **Real-time**: WebSocket communication

## 📁 Project Structure

```
src/
├── client/          # Game client code
│   ├── scenes/      # Phaser scenes
│   ├── systems/     # Game systems
│   └── ui/          # User interface
├── assets/          # Game assets
└── main.ts          # Entry point

shared/              # Shared types/constants
├── constants/       # Game configuration
├── interfaces/      # System interfaces
└── types/           # TypeScript types
```

## 🎯 Features

- Real-time multiplayer gameplay
- WebSocket-based networking
- Client-side prediction
- Destructible environments
- Multiple weapon types
- Team-based gameplay

## 🔧 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_BACKEND_URL` | Backend WebSocket URL | `http://localhost:3000` |
| `VITE_NODE_ENV` | Environment mode | `development` |

## 📜 License

See [LICENSE](./LICENSE) file for details.
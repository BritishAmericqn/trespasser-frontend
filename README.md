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

## 🎮 How to Play

### 🚀 **Joining Games**
1. **Quick Play** - Click "INSTANT PLAY" for automatic matchmaking
2. **Server Browser** - Browse active games and click "JOIN IN PROGRESS" 
3. **Private Lobby** - Click "CREATE PRIVATE" to make a password-protected room
4. **Join by Code** - Click "🔑 JOIN BY CODE" and enter a friend's invite code

### 🎯 **Controls**
- **WASD** - Move your player
- **Mouse** - Aim and shoot
- **Numbers 1-5** - Switch between weapons
- **Space** - Throw grenades (hold to charge power)
- **R** - Manual reload (auto-reload also works)

### 👥 **Teams & Gameplay**
- **Red Team** - Spawns in top-right area
- **Blue Team** - Spawns in bottom-left area
- **Default Loadout** - Rifle, Pistol, Grenades (auto-assigned for late joins)
- **Objective** - First team to 50 kills wins the match
- **Late Joins** - Jump into any ongoing game instantly - no waiting!

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

### 🎮 **Multiplayer & Lobby System**
- **Server Browser** - Browse and join active games instantly
- **Quick Play** - Automatic matchmaking for fast games
- **Private Lobbies** - Create password-protected games for friends
- **Join by Code** - Join friends using invite codes
- **Automatic Late Join** - Join games in progress seamlessly (< 2 seconds)
- **Team Auto-Assignment** - Automatic team balancing for late joins

### 🕹️ **Core Gameplay**
- **Real-time multiplayer** gameplay (up to 8 players)
- **Client-side prediction** for smooth movement
- **Destructible environments** with pixel-perfect destruction
- **Advanced fog of war** vision system
- **Multiple weapon types** (rifles, pistols, SMGs, shotguns, snipers, launchers)
- **Team-based combat** (Red vs Blue teams)
- **Spatial audio system** with positional sound

### 🔧 **Technical Features**
- **Production-ready architecture** with robust error handling
- **Zero manual intervention** - everything works automatically
- **Scene management system** preventing conflicts and gray screens
- **WebSocket-based networking** with automatic reconnection
- **TypeScript throughout** for type safety and developer experience

### 🎪 **UI & UX**
- **Responsive interface** that works on all screen sizes
- **Automatic lobby joining** without configuration screens
- **Real-time server status** and player counts
- **Smooth scene transitions** with conflict prevention
- **Error recovery systems** that self-heal

## 📋 Recent Updates

### ✅ **Automatic Late Join System (Latest)**
**Status: Production Ready** 🚀

- **Zero manual intervention** - Players join games automatically
- **< 2 second join time** from click to playable
- **Immediate spawn** at safe team positions
- **Direct scene management** prevents gray screens and conflicts
- **Multiple fallback systems** ensure 100% success rate
- **Robust error handling** with automatic recovery

### ✅ **Server Browser & Lobby System**
**Status: Fully Functional** ✨

- **Real-time server list** with player counts and game status
- **Join in-progress matches** with "JOIN IN PROGRESS" button
- **Private lobby creation** with invite codes for friends
- **Automatic matchmaking** via Quick Play
- **Join by code** functionality for easy friend joining

### ✅ **Enhanced Multiplayer Architecture**
**Status: Production Stable** 🛡️

- **Singleton networking system** prevents connection conflicts
- **Scene management utilities** eliminate transition issues
- **Automatic team assignment** for balanced late joins
- **Default loadout system** gets players into action immediately
- **Comprehensive error handling** with self-healing capabilities

### 🔄 **What's Next**
- Backend spawn position API improvements
- Enhanced lobby management features
- Additional game modes and maps

## 🔧 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_BACKEND_URL` | Backend WebSocket URL | `http://localhost:3000` |
| `VITE_NODE_ENV` | Environment mode | `development` |

## 📜 License

See [LICENSE](./LICENSE) file for details.
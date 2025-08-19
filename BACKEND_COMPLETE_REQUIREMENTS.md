# 📋 COMPLETE BACKEND REQUIREMENTS - All Systems

## 🔴 CRITICAL FIXES (Game Breaking)

### 1. Death/Respawn Events
```javascript
// REQUIRED: Send this event when player respawns
socket.emit('backend:player:respawned', {
  playerId: socket.id,
  position: {x: 50, y: 135}, // Team-based position
  health: 100,
  team: 'red', // or 'blue'
  invulnerableUntil: Date.now() + 3000
});
```

### 2. Kill Tracking in Game State
```javascript
// Add to player object in game state
gameState.players[playerId] = {
  id: playerId,
  position: {x, y},
  health: 100,
  team: 'red',
  kills: 0,        // REQUIRED - Track kills
  deaths: 0,       // REQUIRED - Track deaths
  score: 0,        // Optional - Points system
  killStreak: 0,   // Optional - Current streak
  weapon: 'rifle'  // Current weapon
};
```

### 3. Kill Attribution Events
```javascript
// When a player gets a kill
socket.emit('backend:kill', {
  killerId: killer.id,
  victimId: victim.id,
  weapon: 'rifle',
  headshot: false,
  distance: 125,
  timestamp: Date.now()
});

// Update both players' stats
gameState.players[killerId].kills++;
gameState.players[victimId].deaths++;
```

## 🟡 HIGH PRIORITY FIXES

### 4. Team-Based Spawn Positions
```javascript
function getSpawnPosition(team) {
  // DO NOT use (0, 0) - that's a bug
  const spawns = {
    red: {x: 50, y: 135},   // Left side
    blue: {x: 430, y: 135}  // Right side
  };
  return spawns[team] || spawns.blue;
}
```

### 5. Match End Event
```javascript
// When kill target reached or time expires
io.emit('backend:match_end', {
  winningTeam: 'red',
  reason: 'kill_target', // or 'time_limit'
  finalScores: {
    red: 50,
    blue: 45
  },
  topPlayers: [
    {id: 'player1', kills: 15, deaths: 3, team: 'red'},
    {id: 'player2', kills: 12, deaths: 5, team: 'blue'}
  ],
  matchDuration: 300000, // milliseconds
  timestamp: Date.now()
});
```

### 6. Player Join Response
```javascript
// When player joins, send their initial state
socket.on('player:join', (data) => {
  const player = createPlayer(data.loadout);
  
  // Send confirmation with spawn data
  socket.emit('backend:player:joined', {
    playerId: socket.id,
    team: player.team,
    position: getSpawnPosition(player.team),
    health: 100,
    matchState: {
      killTarget: 50,
      timeRemaining: 300,
      scores: {red: 0, blue: 0}
    }
  });
});
```

## 🟢 MEDIUM PRIORITY

### 7. Weapon State in Game State
```javascript
gameState.players[playerId].weapons = {
  current: 'rifle',
  rifle: {ammo: 30, maxAmmo: 30, reserve: 90},
  pistol: {ammo: 12, maxAmmo: 12, reserve: 36},
  grenades: 3
};
```

### 8. Damage Events with Attribution
```javascript
socket.emit('backend:player:damaged', {
  playerId: victim.id,
  attackerId: attacker.id,
  damage: 25,
  newHealth: 75,
  weapon: 'rifle',
  bodyPart: 'torso', // head, torso, limbs
  timestamp: Date.now()
});
```

## 📊 Game State Structure (Complete)

```javascript
{
  players: {
    'socketId1': {
      id: 'socketId1',
      name: 'Player1',
      team: 'red',
      position: {x: 100, y: 135},
      rotation: 0,
      health: 100,
      isDead: false,
      kills: 5,
      deaths: 2,
      score: 500,
      killStreak: 3,
      weapons: {
        current: 'rifle',
        rifle: {ammo: 25, maxAmmo: 30, reserve: 60}
      },
      lastUpdate: Date.now()
    }
  },
  match: {
    killTarget: 50,
    timeRemaining: 180,
    scores: {
      red: 23,
      blue: 18
    },
    state: 'active' // 'waiting', 'active', 'ending', 'ended'
  },
  walls: [...],
  projectiles: [...],
  pickups: [...]
}
```

## ✅ Validation Checklist

### Death/Respawn
- [ ] `backend:player:died` sent on death
- [ ] Health stays 0 while dead
- [ ] `player:respawn` request accepted after 3 seconds
- [ ] `backend:player:respawned` sent with position
- [ ] Position is team spawn, not (0,0)

### Kill Tracking
- [ ] `kills` field in player state
- [ ] `deaths` field in player state
- [ ] Kill count increments on kill
- [ ] Death count increments on death
- [ ] `backend:kill` event sent with details

### Match Flow
- [ ] Match starts with all players at 0 kills
- [ ] Kill counter tracks team totals
- [ ] Match ends at kill target
- [ ] `backend:match_end` sent with stats
- [ ] Players return to lobby after match

## 🔍 Debug Logging

Add these logs to help debug:
```javascript
console.log('[DEATH] Player died:', playerId, 'killer:', killerId);
console.log('[RESPAWN] Request from:', playerId, 'canRespawn:', !player.isDead);
console.log('[RESPAWN] Sending event:', {playerId, position, health});
console.log('[KILL] Player:', killerId, 'killed:', victimId, 'total kills:', player.kills);
console.log('[GAMESTATE] Sending to:', playerId, 'players:', Object.keys(gameState.players));
```

## 📞 Contact

Frontend team is ready to test immediately. Please notify when ANY of these fixes are deployed.

---

**Priority Order:**
1. 🔴 Respawn events (game breaking)
2. 🔴 Kill tracking fields (core feature)
3. 🟡 Team spawn positions (user experience)
4. 🟡 Match end events (game flow)
5. 🟢 Additional features (polish)

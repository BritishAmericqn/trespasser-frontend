# 🚨 CRITICAL: Backend Double-Counting Kills Bug

## The Problem
**Kills are incrementing by 2 instead of 1** when a player eliminates an opponent.

## Root Cause Analysis

The backend is likely incrementing kills in TWO places:
1. **In the damage handler** - When damage reduces health to 0
2. **In the death event handler** - When processing the death

This causes each kill to be counted twice.

## Backend Fix Required

### Option 1: Fix in Damage Handler (RECOMMENDED)
```javascript
// In damage processing
if (targetPlayer.health <= 0 && targetPlayer.alive) {
  // Increment kills ONLY here
  if (attackerId && attackerId !== targetId) {
    attackerPlayer.kills = (attackerPlayer.kills || 0) + 1;
    targetPlayer.deaths = (targetPlayer.deaths || 0) + 1;
  }
  
  // Mark as dead but DON'T increment kills again
  targetPlayer.alive = false;
  
  // Emit death event WITHOUT incrementing kills
  io.emit('backend:player:died', {
    playerId: targetId,
    killerId: attackerId,
    // Don't increment kills here!
  });
}
```

### Option 2: Fix in Death Handler
```javascript
// In death event handler
function handlePlayerDeath(victimId, killerId) {
  // Check if already counted
  if (!player.deathProcessed) {
    player.deathProcessed = true;
    
    if (killerId && killerId !== victimId) {
      // Increment ONLY if not already done
      killerPlayer.kills = (killerPlayer.kills || 0) + 1;
    }
    player.deaths = (player.deaths || 0) + 1;
  }
}
```

## How to Verify Fix

1. Join game with 2 players on different teams
2. Kill one player
3. Check console: Should show `📊 KILL TOTALS - RED: 1, BLUE: 0` (not 2)
4. Check game state has `kills: 1` not `kills: 2`

## Frontend Logging

The frontend already logs:
```
📊 KILL TOTALS - RED: X, BLUE: Y
```

This should show 1 kill, not 2, after a single elimination.

---

# 🚨 CRITICAL: Debug Match End Not Working

## The Problem
Pressing M or N keys sends events to backend but nothing happens.

## Events Being Sent

### M Key - Trigger Match End
```javascript
socket.emit('debug:trigger_match_end', { 
  reason: 'Frontend M key test',
  timestamp: Date.now()
});
```

### N Key - Request Match State
```javascript
socket.emit('debug:request_match_state');
```

## Backend Must Implement

### 1. Debug Match End Handler
```javascript
socket.on('debug:trigger_match_end', (data) => {
  console.log('Debug match end requested:', data);
  
  // Only in development mode
  if (process.env.NODE_ENV !== 'production') {
    // Force match to end
    const lobby = getLobbyForPlayer(socket.id);
    if (lobby && lobby.status === 'playing') {
      // Set one team to win
      const gameState = getGameState(lobby.id);
      
      // Force red team to 50 kills
      Object.values(gameState.players).forEach(player => {
        if (player.team === 'red') {
          player.kills = 25; // Split among red players
        }
      });
      
      // Trigger normal match end flow
      checkMatchEnd(lobby.id);
      
      // Send confirmation
      socket.emit('debug:match_end_triggered', {
        success: true,
        redKills: 50,
        blueKills: gameState.blueKills || 0
      });
    } else {
      socket.emit('debug:match_end_failed', {
        reason: 'Not in active match'
      });
    }
  }
});
```

### 2. Debug Match State Handler
```javascript
socket.on('debug:request_match_state', () => {
  const lobby = getLobbyForPlayer(socket.id);
  const gameState = getGameState(lobby?.id);
  
  socket.emit('debug:match_state', {
    lobbyId: lobby?.id,
    status: lobby?.status,
    playerCount: lobby?.players.length,
    redKills: calculateTeamKills(gameState, 'red'),
    blueKills: calculateTeamKills(gameState, 'blue'),
    players: gameState?.players
  });
});
```

## Frontend Already Listening For:
- `debug:match_end_triggered` - Success confirmation
- `debug:match_end_failed` - Error message
- `debug:match_state` - Current game info

## Testing
1. Press M → Should end match immediately
2. Press N → Should log current match state
3. All players should see match end when M is pressed

# 🚨 Immediate Critical Fixes

## Priority 1: Stop the Memory Leaks (Do TODAY)

### Fix 1: LobbyMenuScene Socket Cleanup
```typescript
// In LobbyMenuScene.ts shutdown() method
shutdown(): void {
  // Clean up event listeners
  this.events.off('network:authenticated');
  this.events.off('network:connectionError');
  
  // CRITICAL: Clean up socket listeners
  const socket = this.networkSystem.getSocket();
  if (socket) {
    socket.off('lobby_joined');
    socket.off('matchmaking_failed');
    socket.off('private_lobby_created');
    socket.off('lobby_creation_failed');
    socket.off('lobby_join_failed');
  }
}
```

### Fix 2: NetworkSystem Socket Cleanup
```typescript
// Add to NetworkSystem.ts
private socketListeners: Map<string, Function> = new Map();

private addSocketListener(event: string, handler: Function) {
  this.socketListeners.set(event, handler);
  this.socket.on(event, handler);
}

cleanupSocketListeners() {
  this.socketListeners.forEach((handler, event) => {
    this.socket.off(event, handler);
  });
  this.socketListeners.clear();
}

// In updateScene()
updateScene(newScene: Phaser.Scene): void {
  // ... existing code ...
  
  // CRITICAL: Clean up ALL socket listeners
  this.cleanupSocketListeners();
  
  // Re-add them
  this.setupSocketListeners();
}
```

### Fix 3: Destroy LobbyStateManager Properly
```typescript
// In GameScene.ts create()
// Synchronously destroy LobbyStateManager
const LobbyStateManager = (window as any).LobbyStateManagerInstance;
if (LobbyStateManager) {
  console.log('🧹 Force destroying LobbyStateManager');
  LobbyStateManager.destroy();
  delete (window as any).LobbyStateManagerInstance;
}
```

## Priority 2: Prevent Scene Chaos (Do TODAY)

### Fix 4: Ignore Lobby Events During Gameplay
```typescript
// In NetworkSystem.ts setupSocketListeners()
this.socket.on('lobby_joined', (data) => {
  // CRITICAL: Check current scene
  const activeScene = this.scene?.scene?.key;
  if (activeScene === 'GameScene') {
    console.warn('⚠️ Ignoring lobby_joined - already in game!');
    return;
  }
  // Normal handling...
});
```

### Fix 5: Remove Emergency Transitions
```typescript
// In NetworkSystem.ts - REMOVE this entire block:
if (actuallyActiveScene === 'LobbyWaitingScene' || actuallyActiveScene === 'MatchmakingScene') {
  // DELETE ALL OF THIS - it causes more problems than it solves
}

// Replace with simple logging:
if (actuallyActiveScene !== 'GameScene') {
  console.warn(`⚠️ Game state received in ${actuallyActiveScene}, ignoring`);
  return;
}
```

## Priority 3: Backend Requirements (Send to Backend Team)

### Fix 6: Player State Tracking
```javascript
// Backend needs to track player states
const PlayerStates = {
  IN_MENU: 'in_menu',
  IN_LOBBY: 'in_lobby', 
  IN_GAME: 'in_game'
};

// Before sending any event
function sendToPlayer(playerId, event, data) {
  const player = getPlayer(playerId);
  
  // Don't send lobby events to in-game players
  if (player.state === PlayerStates.IN_GAME && event.startsWith('lobby_')) {
    return;
  }
  
  player.socket.emit(event, data);
}
```

### Fix 7: Scoped Broadcasting
```javascript
// WRONG - broadcasts to everyone
io.emit('lobby_joined', data);

// CORRECT - only to lobby members not in game
const lobby = getLobby(lobbyId);
lobby.players.forEach(player => {
  if (player.state !== PlayerStates.IN_GAME) {
    player.socket.emit('lobby_joined', data);
  }
});
```

## Testing After Fixes

### Test 1: Memory Leak Check
1. Open Chrome DevTools → Memory tab
2. Take heap snapshot
3. Play game, transition scenes 10 times
4. Take another snapshot
5. Memory should NOT grow significantly

### Test 2: Socket Listener Check
```javascript
// In console
const socket = game.scene.keys.GameScene.networkSystem.getSocket();
console.log('Listeners:', socket._callbacks);
// Should show < 50 listeners, not 100+
```

### Test 3: Multiplayer Sync
1. Player 1: Start game via instant play
2. Player 2: Join via instant play
3. Player 1 should NOT see lobby transitions
4. Both players should move smoothly

## Expected Results

### Before Fixes
- Memory grows 50MB per scene transition
- 45+ socket listeners after 3 transitions
- Scene chaos when player 2 joins
- Walls disappear, players teleport

### After Fixes
- Memory stable
- < 20 socket listeners total
- Clean scene transitions
- Smooth multiplayer

## Emergency Rollback

If fixes cause issues:
1. `git stash` all changes
2. Restart servers
3. Apply fixes one at a time
4. Test after each fix

## Monitoring

Add this temporary debug code:
```typescript
// In main.ts
setInterval(() => {
  const scenes = game.scene.getScenes(true);
  const memory = (performance as any).memory?.usedJSHeapSize;
  console.log('🏥 Health:', {
    activeScenes: scenes.length,
    memory: Math.round(memory / 1024 / 1024) + 'MB',
    socketListeners: Object.keys(socket._callbacks || {}).length
  });
}, 10000);
```

## Communication Template

### To Backend Team:
"Critical: We need you to track player states (in_menu, in_lobby, in_game) and NEVER send lobby events to players who are in_game. This is causing severe desync issues. See BACKEND_CRITICAL_REQUIREMENTS.md for details."

### To QA Team:
"After applying fixes, please test instant play flow with 2+ players repeatedly. Monitor browser memory usage and watch for any scene transition issues."

## Success Criteria

✅ No memory growth after 10 scene transitions
✅ Socket listeners stay under 30 total
✅ Player 2 joining doesn't affect Player 1's game
✅ No position errors > 10px
✅ Walls remain visible

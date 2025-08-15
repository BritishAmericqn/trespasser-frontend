# 🔧 Instant Play Fix Plan

## Immediate Fixes (Frontend)

### 1. **Prevent Scene Event Handlers During Gameplay**
```typescript
// In NetworkSystem setupEventListeners
socket.on('lobby_joined', (data) => {
  // CRITICAL: Ignore lobby events if already in game
  const activeScene = this.scene?.scene?.key;
  if (activeScene === 'GameScene') {
    console.warn('⚠️ Ignoring lobby_joined - already in game!');
    return;
  }
  // ... normal handling
});
```

### 2. **Clean Up Scene Listeners Properly**
```typescript
// In each scene's shutdown()
shutdown(): void {
  const socket = this.networkSystem?.getSocket();
  if (socket) {
    // Remove ALL listeners added by this scene
    socket.off('lobby_joined');
    socket.off('match_starting');
    socket.off('matchmaking_failed');
    // etc...
  }
}
```

### 3. **Destroy LobbyStateManager on Game Start**
```typescript
// In GameScene create()
// Force destroy LobbyStateManager completely
LobbyStateManager.getInstance().destroy();
// Remove the singleton reference
(window as any).LobbyStateManagerInstance = undefined;
```

### 4. **Fix ConfigureScene Instant Play**
```typescript
// Don't emit find_match if game already active
socket.once('game:state', (state) => {
  if (state.gameActive) {
    // Go directly to game, don't start matchmaking
    this.scene.start('GameScene');
    return;
  }
});
socket.emit('check_game_state'); // New event needed
```

### 5. **Add Scene Transition Validation**
```typescript
// In NetworkSystem
private validateSceneTransition(from: string, to: string): boolean {
  // Prevent invalid transitions
  if (from === 'GameScene' && to === 'LobbyWaitingScene') {
    console.error('❌ Invalid transition: Cannot go from game to lobby!');
    return false;
  }
  return true;
}
```

## Backend Requirements

### 1. **Don't Broadcast Lobby Events to In-Game Players**
```javascript
// When broadcasting lobby_joined
room.getPlayers().forEach(player => {
  if (!player.inGame) { // Only send to players not in game
    player.socket.emit('lobby_joined', data);
  }
});
```

### 2. **Add Game State Check Endpoint**
```javascript
socket.on('check_game_state', () => {
  const player = getPlayer(socket.id);
  socket.emit('game:state', {
    gameActive: player?.room?.status === 'playing',
    roomId: player?.room?.id
  });
});
```

### 3. **Separate Lobby vs Game Events**
- Lobby events: `lobby_*` (only for waiting players)
- Game events: `game:*` (only for active players)
- Never mix them!

## Testing Plan

### Test 1: Clean Instant Play
1. Clear all browser state
2. Click Instant Play
3. Should go: Menu → Configure → Matchmaking → Lobby → Game
4. No emergency transitions

### Test 2: Second Player Joins
1. Player 1 in game
2. Player 2 clicks Instant Play
3. Player 1 should see NO lobby events
4. Player 2 should join smoothly

### Test 3: Scene Cleanup
1. Monitor socket listeners count
2. Should stay under 10 total
3. No accumulation through transitions

## Priority Order

1. **CRITICAL**: Fix lobby events during gameplay (causes desync)
2. **HIGH**: Clean up socket listeners (memory leak)
3. **HIGH**: Destroy LobbyStateManager properly
4. **MEDIUM**: Validate scene transitions
5. **LOW**: Optimize flow for existing games

## Expected Results

- ✅ No more wall disappearing
- ✅ No more position snapping
- ✅ No more drawImage errors
- ✅ Clean scene transitions
- ✅ Proper multiplayer sync

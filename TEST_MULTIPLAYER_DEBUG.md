# 🧪 Multiplayer Debug Test Plan

## Theory
The matchmaking flow has imperfect scene transitions that leave lingering event listeners or state managers active, causing interference when new players join.

## Test 1: Track Active Scenes & Event Listeners

Add this to GameScene.create():

```typescript
// DEBUG: Track what's actually active
console.log('🔍 SCENE DEBUG ON GAME START:');
console.log('  - Active scenes:', this.scene.manager.getScenes(true).map(s => s.scene.key));
console.log('  - Running scenes:', this.scene.manager.getScenes(false).map(s => s.scene.key));
console.log('  - Is LobbyStateManager active?', typeof (window as any).LobbyStateManager !== 'undefined');

// Track socket listeners
const socket = this.networkSystem.getSocket();
if (socket) {
  const callbacks = (socket as any)._callbacks || {};
  console.log('  - Socket event listeners:', Object.keys(callbacks).map(k => `${k}(${callbacks[k]?.length || 0})`));
}
```

## Test 2: Compare Flows

### Private Lobby Flow (WORKS)
1. MenuScene → GameScene
2. GameScene creates its own lobby
3. No intermediate scenes
4. No LobbyStateManager

### Instant Play Flow (BREAKS)
1. MenuScene → LobbyMenuScene → ConfigureScene → MatchmakingScene → LobbyWaitingScene → GameScene
2. Multiple scene transitions
3. LobbyStateManager active
4. Many socket listeners accumulated

## Test 3: Check for Interference

When player 2 joins, log:
1. Which scenes are still active
2. Which event listeners fire
3. If LobbyStateManager is still updating
4. If any scene transition attempts happen

## Expected Problems

1. **Scene Cleanup Issues**
   - Previous scenes not fully stopped
   - Event listeners not removed
   - Timers still running

2. **LobbyStateManager Interference**
   - Still active during gameplay
   - Trying to update destroyed UI
   - Triggering state changes

3. **Socket Event Conflicts**
   - Multiple listeners for same events
   - Events handled by wrong scenes
   - State updates from lobby system during game

## Solution Approach

If confirmed, we need to:
1. Ensure proper scene cleanup
2. Stop LobbyStateManager when game starts
3. Remove all lobby-related listeners
4. Simplify the flow

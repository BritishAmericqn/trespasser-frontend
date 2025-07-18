# NetworkSystem Singleton Pattern Fix

## Problem
The NetworkSystem was losing its socket connection and authentication state when transitioning from MenuScene to GameScene because:
1. MenuScene was destroying the NetworkSystem on shutdown
2. Scene transitions were causing socket disconnect events
3. Authentication state was being lost between scenes

## Solution: Singleton Pattern

### 1. Created NetworkSystemSingleton
- Manages a single instance of NetworkSystem across all scenes
- Preserves socket connection and authentication state
- Updates scene reference without destroying the connection

### 2. Key Changes

**NetworkSystemSingleton.ts:**
```typescript
class NetworkSystemSingleton {
  private static instance: NetworkSystem | null = null;
  
  static getInstance(scene?: Phaser.Scene): NetworkSystem {
    if (!this.instance && scene) {
      // Create new instance
      this.instance = new NetworkSystem(scene);
      this.instance.initialize();
    } else if (this.instance && scene) {
      // Update scene reference without destroying
      this.instance.updateScene(scene);
    }
    return this.instance;
  }
}
```

**MenuScene.ts:**
```typescript
create(): void {
  // Get or create singleton
  this.networkSystem = NetworkSystemSingleton.getInstance(this);
}

shutdown(): void {
  // Don't destroy - singleton is preserved
}
```

**GameScene.ts:**
```typescript
create(): void {
  // Get existing singleton and update scene reference
  this.networkSystem = NetworkSystemSingleton.getInstance(this);
}
```

### 3. Connection State Preservation
- Added `isUpdatingScene` flag to ignore disconnect events during transitions
- Force restore connection state if socket is still connected
- Check actual socket.connected state instead of just internal flags

### 4. Benefits
- ✅ Socket connection maintained across scenes
- ✅ Authentication state preserved
- ✅ No more "Cannot send input" errors
- ✅ Seamless multiplayer experience

## Testing
1. Connect in MenuScene
2. Transition to GameScene
3. Connection and authentication should be maintained
4. Game state updates should continue working 
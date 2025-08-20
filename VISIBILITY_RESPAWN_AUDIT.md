# 🔍 Visibility & Respawn System Audit

## Executive Summary

After thorough review of the visibility and respawn systems, I've identified several potential issues that could cause problems during game transitions and respawns.

## ✅ What's Working Well

### Respawn System:
1. **Death Detection** (GameScene.ts lines 1350-1364)
   - Properly differentiates between local and other player deaths
   - Shows death screen for local player
   - Updates PlayerManager for visual changes

2. **Respawn Position Validation** (lines 1758-1767)
   - Correctly rejects (0,0) spawn positions
   - Falls back to team-based spawn positions
   - Updates both playerPosition and sprite position

3. **Player State Management** (PlayerManager.ts lines 274-284)
   - Properly tracks alive/dead states
   - Handles death → respawn transitions
   - Shows invulnerability effects

### Visibility System:
1. **Fog of War Rendering** (VisionRenderer.ts)
   - Uses RenderTexture for efficient fog
   - Supports both tile and polygon vision
   - Proper depth layering (85-90 range)

2. **Vision Updates** (lines 38-51)
   - Handles both legacy and new formats
   - Updates fog dynamically
   - Clears properly between updates

## ⚠️ Potential Issues Found

### 1. **No Vision Reset on Respawn**
**Location:** GameScene.ts handleLocalPlayerRespawn()
**Problem:** Vision isn't explicitly reset when player respawns
**Impact:** Player might keep vision from death location

**Fix:**
```javascript
private handleLocalPlayerRespawn(respawnData: any): void {
  // ... existing code ...
  
  // Reset vision to respawn position
  if (this.visionRenderer) {
    this.visionRenderer.clearVision();
    // Vision will update with next game state
  }
}
```

### 2. **Vision Not Cleared on Scene Shutdown**
**Location:** GameScene.ts shutdown()
**Problem:** VisionRenderer not explicitly cleaned up
**Impact:** Fog might persist between matches

**Fix:**
```javascript
shutdown(): void {
  // ... existing code ...
  
  if (this.visionRenderer) {
    this.visionRenderer.destroy();
  }
}
```

### 3. **Dead Players Still Have Vision**
**Location:** Vision updates don't check isAlive state
**Problem:** Dead players might still reveal fog
**Impact:** Spectating players reveal enemy positions

**Fix:**
```javascript
// In handleGameState, only update vision if alive
if (localPlayer && localPlayer.isAlive && visionData) {
  this.visionRenderer.updateVisionFromBackend(visionData);
} else if (localPlayer && !localPlayer.isAlive) {
  // Show limited spectator vision or full fog
  this.visionRenderer.showSpectatorVision();
}
```

### 4. **Match End Vision State**
**Location:** handleMatchEnd()
**Problem:** Vision continues updating during results transition
**Impact:** Unnecessary processing, potential visual glitches

**Fix:**
```javascript
private handleMatchEnd(redKills: number, blueKills: number, players: any): void {
  if (this.isMatchEnding) return;
  this.isMatchEnding = true;
  
  // Stop vision updates
  if (this.visionRenderer) {
    this.visionRenderer.pauseUpdates();
  }
  
  // ... rest of match end logic
}
```

## 🔧 Recommended Improvements

### Priority 1: Add Vision Reset on Respawn
```javascript
// In handleLocalPlayerRespawn
private handleLocalPlayerRespawn(respawnData: any): void {
  console.log('🔄 Respawning player...');
  
  this.isPlayerDead = false;
  
  // Reset position
  if (respawnData.position) {
    this.playerPosition = respawnData.position;
    // ... position validation ...
  }
  
  // CRITICAL: Reset vision system
  if (this.visionRenderer) {
    // Clear old vision
    this.visionRenderer.clearVision();
    
    // Force immediate vision update at new position
    this.visionRenderer.requestImmediateUpdate();
  }
  
  // Reset client prediction
  if (this.clientPrediction) {
    this.clientPrediction.reset(this.playerPosition);
  }
  
  // Hide death screen
  this.hideDeathScreen();
}
```

### Priority 2: Proper Cleanup in Shutdown
```javascript
shutdown(): void {
  // Reset match state
  this.isMatchEnding = false;
  this.matchStartTime = 0;
  this.isPlayerDead = false;
  
  // Clean up vision system
  if (this.visionRenderer) {
    this.visionRenderer.clearVision();
    this.visionRenderer.destroy();
  }
  
  // Clean up player manager
  if (this.playerManager) {
    this.playerManager.clearAllPlayers();
  }
  
  // ... rest of cleanup
}
```

### Priority 3: Spectator Vision Mode
```javascript
// Add to VisionRenderer
showSpectatorVision(): void {
  // Option 1: Show full map (no fog)
  this.fogLayer.clear();
  
  // Option 2: Show limited vision around death location
  // this.fogLayer.fill(0x000000, 0.7); // Darker fog
  
  // Option 3: Follow teammate vision
  // (requires tracking team members)
}
```

## 🎮 Testing Scenarios

### Test 1: Death → Respawn Vision
1. Player dies in enemy territory
2. Player respawns at base
3. **Verify:** Vision cleared from death location
4. **Verify:** New vision at spawn position

### Test 2: Match End Transition
1. Team reaches 50 kills
2. Transition to results
3. **Verify:** No vision updates during transition
4. **Verify:** Clean scene shutdown

### Test 3: Spectator Mode
1. Player dies
2. Watch teammates while dead
3. **Verify:** Cannot reveal enemy positions
4. **Verify:** Vision appropriate for spectating

### Test 4: Late Join Vision
1. Player joins mid-match
2. **Verify:** Vision initializes at spawn
3. **Verify:** No vision artifacts from previous players

## 📊 Current Risk Assessment

### High Risk:
- Dead players revealing enemy positions
- Vision not resetting on respawn

### Medium Risk:
- Memory leaks from uncleaned vision
- Performance issues during transitions

### Low Risk:
- Visual glitches during match end
- Fog persistence between matches

## Summary

The visibility and respawn systems are **mostly solid** but need specific fixes for edge cases:

1. **Must Fix:** Reset vision on respawn
2. **Should Fix:** Clean up vision on shutdown
3. **Nice to Have:** Proper spectator vision mode

These fixes will prevent the issues you've experienced before and ensure clean transitions between death, respawn, and match end states.

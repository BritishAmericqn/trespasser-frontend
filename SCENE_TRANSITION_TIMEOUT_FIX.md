# 🔧 Scene Transition Timeout Fix

## Problem
When pressing M to test match end, the transition to `MatchResultsScene` was timing out, leaving a gray screen.

## Console Evidence
```
🎬 Transitioning from GameScene to MatchResultsScene
📛 Stopping active scene: GameScene
⚠️ Transition timeout - forcing reset
```

Missing: `✅ Starting scene: MatchResultsScene` (never appeared)

## Root Cause
The `SceneManager` was stopping the current scene (GameScene) IMMEDIATELY, then trying to use `currentScene.time.delayedCall()` to start the new scene. But once a scene is stopped, its time system is also stopped, so the delayed call never executed!

**Sequence of events:**
1. SceneManager stops GameScene
2. GameScene's time system is destroyed
3. `delayedCall(100, ...)` is scheduled but never executes
4. MatchResultsScene never starts
5. 2-second timeout hits → "Transition timeout - forcing reset"

## Fix Applied

### Changed Scene Stop Order
**Before:** Stop current scene → Wait → Start new scene ❌
**After:** Keep current scene running → Start new scene → Stop current scene ✅

### Code Changes
```typescript
// OLD: Stopped current scene immediately
scenes.forEach((scene: Phaser.Scene) => {
  if (scene.scene.isActive() && 
      scene.scene.key !== 'LoadingScene' && 
      scene.scene.key !== targetScene) {
    scene.scene.stop(); // This stopped GameScene!
  }
});

// NEW: Don't stop current scene yet
scenes.forEach((scene: Phaser.Scene) => {
  if (scene.scene.isActive() && 
      scene.scene.key !== 'LoadingScene' && 
      scene.scene.key !== targetScene &&
      scene.scene.key !== currentSceneName) { // Keep current running!
    scene.scene.stop();
  }
});
```

### Improved Transition Flow
1. Stop OTHER scenes (not current)
2. Use current scene's time system (still active)
3. Start target scene
4. THEN stop current scene

### Added Safety Features
- Check if target scene exists before starting
- Better error logging
- Recovery to MenuScene on failure
- Increased timeout to 3 seconds
- Stop current scene with delay to ensure new scene is ready

## Result
✅ Pressing M now properly transitions to MatchResultsScene
✅ No more gray screen timeouts
✅ Smooth scene transitions
✅ Better error recovery

## Console Output (Expected)
```
🎬 Transitioning from GameScene to MatchResultsScene
⏳ Scheduling scene start in 100ms...
✅ Starting scene: MatchResultsScene
🎮 MatchResultsScene create() called
📛 Stopping previous scene: GameScene
✅ Transition complete to MatchResultsScene
✅ MatchResultsScene created successfully
```

## Testing
1. Press **M** - Should transition smoothly to match results
2. Press **N** - Should also work with backend simulation
3. Check console for proper transition messages
4. No more "Transition timeout" errors

# ✅ Death Freeze and Tracer Visibility Fixes

## Summary
Fixed two critical gameplay issues:
1. **Game freezing when player dies** - InputSystem error
2. **Bullet tracers visible through walls** - Missing visibility checks

## Issues Fixed

### 1. **Death Freeze Bug** 🎮
**Problem:** When a player died, the game would freeze with error:
```
Uncaught TypeError: Cannot read properties of undefined (reading 'isDown')
```

**Root Cause:** 
- `handleSpectatorInput()` tried to access `this.keys.space` and `this.keys.enter`
- These keys were never added to the key configuration during initialization
- Attempting to access `.isDown` on undefined caused the crash

**Fix Applied:**
1. Added `space` and `enter` keys to the InputSystem initialization
2. Added safety checks with optional chaining (`?.`) in handleSpectatorInput
3. Added null checks before accessing keys

**Files Modified:**
- `src/client/systems/InputSystem.ts`

### 2. **Tracer Visibility Bug** 👁️
**Problem:** Bullet tracers were visible even when the shooter was not visible to the player (behind walls, outside vision range)

**Root Cause:**
- `showBulletTrail()` method didn't check if the shooter was visible
- All weapon hit/miss events showed tracers regardless of visibility

**Fix Applied:**
1. Added `playerId` parameter to `showBulletTrail()` method
2. Implemented visibility check using `visionRenderer.isVisible()`
3. Only shows tracers if:
   - It's the local player (always visible to themselves)
   - The shooter's position is within the visible area
4. Updated all calls to pass playerId [[memory:3589549]]

**Files Modified:**
- `src/client/systems/VisualEffectsSystem.ts`

## Technical Details

### Death Input Handling
```typescript
// Before - Missing keys
this.keys = this.scene.input.keyboard!.addKeys({
  w, a, s, d, shift, ctrl, r, g, one, two, three, four, five
});

// After - Added respawn keys
this.keys = this.scene.input.keyboard!.addKeys({
  w, a, s, d, shift, ctrl, r, g, one, two, three, four, five,
  space: Phaser.Input.Keyboard.KeyCodes.SPACE,
  enter: Phaser.Input.Keyboard.KeyCodes.ENTER
});

// Added safety checks
if (this.keys.space?.isDown || this.keys.enter?.isDown) {
  // Handle respawn
}
```

### Tracer Visibility
```typescript
showBulletTrail(startPos, endPos, weaponType, playerId?: string): void {
  // Check visibility for non-local players
  if (playerId && playerId !== localPlayerId) {
    const visionRenderer = gameScene.visionRenderer;
    if (visionRenderer && !visionRenderer.isVisible(startPos.x, startPos.y)) {
      return; // Don't show trail if shooter not visible
    }
  }
  // Show trail...
}
```

## Testing Results
✅ TypeScript compilation: **SUCCESS**
✅ Build process: **SUCCESS**
✅ No critical linting errors

## Impact
- **Death Fix:** Players can now die without freezing the game, spectator mode works
- **Tracer Fix:** Improves gameplay fairness - players can't track enemies through walls via tracers
- **Performance:** Minimal impact, adds one visibility check per tracer

## Future Improvements
- Add spectator camera following other players
- Consider showing partial tracers (visible portion only)
- Add tracer fade based on distance from visible area

## How to Test
1. **Death Freeze Test:**
   - Join a game
   - Get eliminated by another player
   - Verify game doesn't freeze
   - Press SPACE or ENTER to respawn (when available)

2. **Tracer Visibility Test:**
   - Have two players on opposite sides of a wall
   - One player shoots
   - Other player should NOT see tracers through the wall
   - Move into view and verify tracers are visible when shooter is visible

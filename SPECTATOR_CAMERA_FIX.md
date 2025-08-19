# ✅ Spectator Camera Fix

## Problem
When a player died, pressing WASD in spectator mode would move the entire game screen/viewport, causing a disorienting experience where the death screen UI would move with the camera.

## Root Cause
The `handleSpectatorInput()` method in InputSystem was directly manipulating the main camera's scroll position:
```typescript
// BAD - Moved entire viewport
camera.scrollY -= spectatorSpeed;
camera.scrollX -= spectatorSpeed;
```

## Solution
Removed the camera movement code from spectator mode. The camera now stays locked at the death position, showing the death screen properly.

## Current Behavior
- **Death Screen:** Shows "YOU DIED" overlay at fixed position
- **WASD:** No longer moves the camera (disabled in spectator mode)
- **SPACE/ENTER:** Still works for respawning
- **Camera:** Locked at death position for stable view

## Code Changed
**File:** `src/client/systems/InputSystem.ts`
**Method:** `handleSpectatorInput()`

### Before:
```typescript
// Allow spectator camera movement (free look)
const spectatorSpeed = 3;
const camera = this.scene.cameras.main;

if (this.keys.w?.isDown) {
  camera.scrollY -= spectatorSpeed;
}
// ... etc for all directions
```

### After:
```typescript
// Camera stays locked on death position - no free movement
// This prevents the disorienting effect of the entire screen moving
// Future enhancement: implement proper spectator mode that follows other players
```

## Future Enhancements
- Implement proper spectator mode that follows other living players
- Add TAB key to cycle through players to spectate
- Show kill cam replay of death

## Testing
1. Get killed in game
2. Try pressing WASD - camera should NOT move
3. Death screen should stay centered and stable
4. Press SPACE/ENTER to respawn when available

## Build Status
✅ Build successful - No compilation errors

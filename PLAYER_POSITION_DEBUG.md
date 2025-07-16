# Player Position Debug Guide

## Issue
Frontend is receiving errors: "Cannot read properties of undefined (reading 'x')" when trying to render other players.

## What's Working
- ✅ Vision system is working (receiving tile indices)
- ✅ Local player movement works
- ✅ Network connection established

## The Problem
The `PlayerManager` is trying to access `player.position.x` but `player.position` is undefined. This happens when:
1. Backend sends `visiblePlayers` array with players missing position data
2. Or the player object structure is different than expected

## Expected Player Structure
```typescript
interface PlayerState {
  id: string;
  position: { x: number; y: number; };  // This is missing!
  velocity: Vector2;
  health: number;
  team: 'red' | 'blue';
  isAlive: boolean;
  angle?: number;
  weaponType?: string;
  movementState?: string;
}
```

## Debugging Steps
1. **Check Backend**: Make sure backend is sending complete player data
2. **Check for Other Players**: Are you testing alone? No other players = empty visiblePlayers
3. **Watch Console**: The defensive code will now log warnings instead of crashing

## Temporary Fix Applied
Added validation in `PlayerManager.ts`:
```typescript
if (!state || !state.position || typeof state.position.x !== 'number' || typeof state.position.y !== 'number') {
  console.warn(`Invalid player state for ${id}:`, state);
  continue;
}
```

This prevents the error but doesn't render players with invalid data.

## Next Steps
1. Check backend's `visiblePlayers` format
2. Ensure player objects have position property
3. Test with multiple browser tabs to have other players 
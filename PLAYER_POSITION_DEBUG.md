# Player Position Debug Guide

## Issue
Frontend is receiving errors: "Cannot read properties of undefined (reading 'x')" when trying to render other players.

## What's Working
- ✅ Vision system is working (receiving tile indices)
- ✅ Local player movement works
- ✅ Network connection established

## The Problem - IDENTIFIED!
The backend is sending player data with `transform: {}` instead of `position: {x, y}`. The transform object is empty, causing the error.

## Root Cause
The backend is using a different property name (`transform`) than what the frontend expects (`position`)

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
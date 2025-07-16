# Vision System Debug Guide

## Current Status
- ✅ Fog layer renders (toggle with F key)
- ❓ Vision data from backend not showing holes in fog
- ✅ Player rendering works with multiple players

## Debug Keys
- **F** - Toggle fog layer visibility
- **V** - Toggle vision debug visualization
- **T** - Test vision with hardcoded tiles (5x5 square in center)

## What's Happening
The backend is sending `visibleTiles` as an array of numbers (tile indices), but the fog isn't showing the visible areas properly.

## Things to Check

1. **Press T** to test with hardcoded vision
   - This creates a 5x5 square of visible tiles in the center
   - If this works, the rendering is fine and the issue is with backend data
   - If this doesn't work, the rendering logic needs fixing

2. **Check Console** for vision debug info:
   - Look for "🔍 Vision debug:" which shows:
     - How many tiles are visible
     - Sample tile indices
     - Sample pixel positions

3. **Backend Data Format**
   - Expected: Array of tile indices (0-2039)
   - Each index = `y * 60 + x` where grid is 60x34 tiles
   - Tiles are 8x8 pixels each (updated from 16x16)

## Possible Issues

1. **Wrong Index Format**: Backend might be sending pixel indices instead of tile indices
2. **Empty Vision Data**: Backend might not be calculating vision properly
3. **Coordinate Mismatch**: Player position might not align with vision calculation

## Quick Tests in Console
```javascript
// Check current vision data
scene = game.scene.scenes[0]
console.log('Visible tiles:', scene.visionRenderer.lastVisibleTiles)

// Force test vision (center tiles in 60x34 grid)
scene.visionRenderer.updateVisionFromBackend([1020, 1021, 1022, 1080, 1081, 1082])
```

## Next Steps
1. Press **T** to test hardcoded vision
2. Check if you see a clear square in the center
3. Look at console logs to see what tile indices the backend is actually sending
4. Compare backend indices with expected values (should be 0-2039 range) 
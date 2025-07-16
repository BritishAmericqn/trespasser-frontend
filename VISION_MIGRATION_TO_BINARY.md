# Vision System Migration to Binary Format

## Overview

The backend has migrated from string-based vision data to numeric indices for improved performance. This reduces bandwidth by 67% and eliminates string allocation overhead.

## What Changed

### Old Format (String Arrays)
```javascript
gameState.vision.visiblePixels = ["15,8", "16,8", "16,9", ...]  // Strings
```

### New Format (Numeric Indices)
```javascript
gameState.vision.visibleTiles = [255, 256, 286, ...]  // Numbers
```

## Key Differences

1. **Property Name**: `visiblePixels` → `visibleTiles`
2. **Data Type**: `string[]` → `number[]`
3. **Coordinate System**: Now uses tile indices (0-509) instead of "x,y" strings

## Implementation Details

### Constants
- **Tile Size**: 16×16 pixels
- **Grid Dimensions**: 30×17 tiles (480÷16 × 270÷16)
- **Max Index**: 509 (30×17-1)

### Conversion Formulas
```typescript
// Index to tile coordinates
tileX = index % 30
tileY = Math.floor(index / 30)

// Index to pixel coordinates
pixelX = (index % 30) * 16
pixelY = Math.floor(index / 30) * 16

// Tile coordinates to index
index = tileY * 30 + tileX
```

## Files Updated

1. **shared/types/index.ts**
   - Updated `GameState` interface
   - Added `VISION_CONSTANTS`

2. **src/client/utils/visionHelpers.ts** (NEW)
   - Helper functions for coordinate conversion
   - Rectangle grouping optimization
   - Pre-calculated lookup table

3. **src/client/systems/VisionRenderer.ts**
   - Changed from pixel strings to tile indices
   - Updated fog rendering logic
   - Modified debug visualization

4. **src/client/scenes/GameScene.ts**
   - Updated to use `visibleTiles` property
   - Changed debug logging

## Performance Improvements

- **67% bandwidth reduction**: 2 bytes per tile vs 6+ bytes per string
- **Zero string allocations**: No more garbage collection pressure
- **Faster processing**: Integer operations instead of string parsing
- **Direct TypedArray support**: Ready for future binary protocols

## Testing

To verify the migration:
1. Check that fog of war renders correctly
2. Verify vision updates when moving
3. Confirm tile boundaries align with 16×16 pixel grid
4. Monitor network traffic for reduced bandwidth

## Notes

- This is a breaking change - no backward compatibility
- The backend is already sending the new format
- Destroyed walls don't affect indices (they remain fixed)
- Only visible tiles are sent (indices can have gaps) 
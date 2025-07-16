# Polygon Vision System Implementation

## Overview

The vision system has been upgraded from tile-based (8×8 pixel blocks) to polygon-based rendering, providing pixel-perfect visibility boundaries.

## Benefits Over Tile System

- **Pixel-perfect boundaries** - No more 8×8 tile artifacts
- **90% less data** - ~400 bytes instead of ~7KB
- **Sharper visuals** - Clean geometric edges at walls
- **Better performance** - Fewer calculations on both ends

## Implementation Details

### Data Format

The backend sends vision data with `type: 'polygon'`:

```typescript
interface PolygonVision {
  type: 'polygon';
  polygon: Vector2[];       // Array of vertices forming visibility polygon
  viewAngle: number;        // FOV angle in radians (e.g., 2.094 for 120°)
  viewDirection: number;    // Player's facing direction in radians
  viewDistance: number;     // Maximum view distance in pixels
  position: Vector2;        // Player position
}
```

### How It Works

1. **Backend calculates visibility polygon** using raycasting and wall occlusion
2. **Frontend receives compact polygon data** (typically 20-50 vertices)
3. **Render using Phaser masks** to create sharp visibility boundaries
4. **Fog fills everything outside polygon** for clean edges

### Rendering Process

1. Clear fog layer
2. Fill screen with dark fog
3. Create mask from polygon vertices
4. Apply inverted mask (polygon area = clear)
5. Draw masked fog to render texture

## Debug Visualization

Press **V** to toggle debug mode:
- **Green outline** - Visibility polygon boundary
- **Red dots** - Polygon vertices
- Shows vertex count

## Backwards Compatibility

The system maintains support for tile-based vision:
- Checks `vision.type` field
- Falls back to tile rendering if `type === 'tiles'`
- Supports legacy array format

## Performance

- **Polygon rendering**: Single mask operation
- **Tile rendering**: Up to 2040 tile draws
- **Data size**: ~400 bytes vs ~7KB
- **Visual quality**: Pixel-perfect vs 8×8 blocks

## Testing

The backend can switch between systems:
- `usePolygonVision = true` - New polygon system
- `usePolygonVision = false` - Legacy tile system

Both work seamlessly with the same frontend code. 
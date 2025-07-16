# Polygon Vision Testing Guide

## Quick Test (Without Backend)

Press these keys to test different vision modes:

- **P** - Test polygon vision (120° cone)
- **T** - Test tile vision (7×7 square)
- **F** - Toggle fog on/off
- **V** - Toggle debug visualization

## What to Expect

### Polygon Mode (P key)
- Sharp, pixel-perfect visibility cone
- Green outline showing polygon boundary
- Red dots at each vertex
- Smooth edges, no tile artifacts

### Tile Mode (T key)
- Blocky 8×8 pixel visibility
- Green squares showing visible tiles
- Staircase effect on diagonals

## Backend Integration

When the backend sends vision data:

### Old Format (tiles)
```json
{
  "vision": {
    "visibleTiles": [255, 256, 286, ...],
    "viewAngle": 1.57,
    "position": {"x": 240, "y": 135}
  }
}
```

### New Format (polygon)
```json
{
  "vision": {
    "type": "polygon",
    "polygon": [
      {"x": 240, "y": 135},
      {"x": 360, "y": 75},
      {"x": 360, "y": 195}
    ],
    "viewAngle": 2.094,
    "viewDirection": 0,
    "viewDistance": 120,
    "position": {"x": 240, "y": 135}
  }
}
```

## Console Logs to Watch

- `🔺 Polygon vision active!` - Backend sending polygon data
- `👁️ Tile vision active` - Backend sending tile data
- `📥 Game state received` - Shows vision type and data size

## Performance Comparison

| Metric | Tile-Based | Polygon-Based |
|--------|------------|---------------|
| Data Size | ~7KB | ~400 bytes |
| Visual Quality | 8×8 blocks | Pixel-perfect |
| Render Calls | 100+ tiles | 1 mask operation |
| Backend CPU | High | Low |

## Troubleshooting

1. **No vision?** - Press F to ensure fog is enabled
2. **Debug not showing?** - Press V to toggle
3. **Backend not sending?** - Check `usePolygonVision` flag
4. **Black screen?** - Fog layer issue, reload page 
# Debug Commands Summary

## 🎮 All Debug Keys

### Wall & Boundary Testing
- **'W'** - Wall sync diagnostic (lists all walls with details)
- **'R'** - Clear all walls and refresh from backend
- **'O'** - Toggle boundary wall visibility (with camera zoom)
- **'U'** - Manually draw boundary walls (yellow/red) for 5 seconds
- **'D'** - Show wall debug info in console
- **'B'** - Simulate random wall damage

### Vision System
- **'V'** - Toggle vision debug visualization
- **'F'** - Toggle fog layer visibility
- **'T'** - Test tile-based vision
- **'P'** - Test polygon vision

### Connection & Info
- **'C'** - Check connection status
- **'H'** - Test hit marker effect
- **'M'** - Test miss effect
- **'E'** - Test explosion effect

## 🔍 Debugging Boundary Walls

1. **Press 'O' first** - This should:
   - Toggle boundary walls on/off
   - Zoom camera out to 0.8x when showing boundaries
   - Log all boundary walls in console

2. **If you don't see them, press 'U'** - This will:
   - Manually draw bright yellow/red rectangles where boundaries should be
   - These appear for 5 seconds
   - If you see these but not the actual walls, the issue is with wall rendering

3. **Check the green game bounds** - Added permanent green markers:
   - Thin green border around game area (480x270)
   - Green squares in each corner
   - This shows the exact game boundaries

## 📊 What to Look For

When boundary walls are working correctly with 'O':
- Red thick borders on boundary walls
- Red diagonal lines across them
- Walls at positions:
  - Top: (0, -10) 
  - Bottom: (0, 270)
  - Left: (-10, 0)
  - Right: (480, 0)

## 🐛 Vision Offset Issue

The light bleeding through walls appears to be because:
- Backend vision calculation doesn't align with wall positions
- The vision polygon vertices might have an offset
- This needs backend adjustment to fix

## 💡 Quick Test Sequence

1. Press **'F'** to hide fog
2. Press **'O'** to show boundaries
3. Press **'U'** to see where they should be
4. Check console for wall data
5. Press **'V'** to see vision polygon 
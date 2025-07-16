# Boundary Walls Visibility Fix

## ✅ Fixed Issues

1. **DestructionRenderer.getWallsData()** now accepts an optional parameter to include boundary walls
2. **GameScene** now properly passes the showBoundaryWalls flag when getting wall data
3. **Boundary walls** are now visually distinct with:
   - Red border (2px thick)
   - Red diagonal lines across them to make them obvious
4. **Removed double filtering** that was preventing boundary walls from showing

## 🎮 How to Test

1. **Press 'O'** to toggle boundary wall visibility
2. When enabled, you should see:
   - Red-bordered walls outside the game area
   - Diagonal red lines across boundary walls
   - Console message: "🚧 Boundary walls: SHOWN"

## 📍 Expected Boundary Wall Positions

Based on your console output, the backend is sending these boundary walls:
- **wall_boundary_top**: pos(0, -10) size(480, 10)
- **wall_boundary_bottom**: pos(0, 270) size(480, 10)  
- **wall_boundary_left**: pos(-10, 0) size(10, 270)
- **wall_boundary_right**: pos(480, 0) size(10, 270)

These should now be visible when you press 'O'.

## 🔍 If Still Not Visible

If boundary walls still don't appear:
1. Check console for errors
2. Make sure you're getting the latest wall data from backend
3. Try refreshing the page (F5)
4. The vision system might be covering them - press 'F' to toggle fog

## 🐛 Vision Alignment Issue

The vision offset problem (light bleeding through walls) is likely because:
- Backend vision calculation uses different coordinate system
- Wall bounds for physics don't match visual bounds
- Vision polygon vertices might have an offset

This needs to be fixed on the backend side. 
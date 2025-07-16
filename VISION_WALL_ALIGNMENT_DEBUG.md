# Vision/Wall Alignment Debug Guide

## 🐛 Issues Fixed

### 1. **Test Walls vs Backend Walls Conflict**
- Fixed: Test walls are now only created when not connected to backend
- Backend is now the authoritative source for wall data

### 2. **Boundary Wall Filtering**
- Improved boundary wall detection to check both position and bounds
- Added debug toggle (Press 'O') to show/hide boundary walls

### 3. **Wall Data Logging**
- Added detailed logging of wall data received from backend
- Logs wall positions, sizes, and boundary status

## 🎮 Debug Controls

- **Press 'O'**: Toggle boundary wall visibility (debug mode)
- **Press 'V'**: Toggle vision debug visualization  
- **Press 'F'**: Toggle fog layer visibility
- **Press 'D'**: Show wall boundaries and debug info
- **Press 'C'**: Check connection status

## 🔍 Things to Check

### 1. **Console Logs**
Look for these messages:
- `📦 Backend walls received:` - Shows all walls from backend
- `🚫 Skipping test walls` - Confirms using backend walls
- `🚧 Boundary walls:` - Shows boundary wall toggle state

### 2. **Vision Alignment**
The vision system offset might be caused by:
- Backend using different coordinate system for vision calculation
- Wall collision bounds not matching visual bounds
- Vision polygon vertices calculated with offset

### 3. **Phantom Walls**
Possible causes:
- Walls being rendered twice (once from test, once from backend)
- Walls with wrong orientation being rendered incorrectly
- Z-ordering issues causing walls to appear/disappear

## 🛠️ Next Steps

1. **Check Backend Vision Calculation**
   - Ensure backend uses same wall bounds for vision as sent to frontend
   - Verify vision polygon vertices are in correct coordinate space

2. **Verify Wall Synchronization**
   - Make sure wall IDs match between frontend and backend
   - Check that wall positions are exactly the same

3. **Test with Boundary Walls Visible**
   - Press 'O' to show boundary walls
   - Check if vision correctly stops at boundary walls
   - Verify boundary walls are positioned correctly

## 📊 Expected Wall Layout

```
Game Area: 480x270

Boundary Walls (should be invisible):
- Top:    pos(-10, -10)  size(500, 10)
- Bottom: pos(-10, 270)  size(500, 10)  
- Left:   pos(-10, 0)    size(10, 270)
- Right:  pos(480, 0)    size(10, 270)

Game Walls (8 visible):
- Horizontal: wall_1, wall_3, wall_6, wall_8
- Vertical: wall_2, wall_4, wall_5, wall_7
```

## 🚨 Common Issues

1. **Light bleeding through walls**: Vision polygon calculation doesn't account for wall thickness
2. **Invisible walls**: Walls exist in physics but not rendered (check render method)
3. **Phantom walls**: Walls rendered but not in physics (check collision detection) 
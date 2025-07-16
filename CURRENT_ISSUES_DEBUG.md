# Current Issues & Debug Guide

## 🔴 Issue 1: Player Position Data
**Problem**: Backend is sending `transform: {}` (empty object) instead of `position: {x, y}`

**What I've Done**:
- Added code to check both `position` and `transform` properties
- Added validation to prevent crashes
- Players with invalid data will be skipped (logged as warnings)

**Backend Needs To**:
- Either populate the `transform` object with `{x: number, y: number}`
- OR change to use `position` property instead
- Currently sending: `{id: '...', transform: {}, velocity: {}, health: 75, ...}`
- Should send: `{id: '...', position: {x: 240, y: 135}, velocity: {}, health: 75, ...}`

## 🔴 Issue 2: Fog of War Not Visible
**Problem**: The fog layer exists but isn't showing up

**Debug Steps**:
1. Press **F key** to toggle fog visibility
2. Check console for: `🌫️ Fog layer toggled - visible: true/false`
3. Press **V key** to see vision debug (should show green tiles)

**Possible Causes**:
- Fog layer depth conflict (currently set to 100)
- Render texture not drawing correctly
- All tiles might be marked as visible (no fog needed)

## 🟢 What's Working
- ✅ Vision data from backend (receiving tile indices)
- ✅ Local player movement
- ✅ Network connection
- ✅ Wall rendering

## Quick Test Commands
```javascript
// In browser console:
// Check if fog layer exists
scene = game.scene.scenes[0]
fogLayer = scene.visionRenderer.fogLayer
console.log('Fog visible:', fogLayer.visible, 'Depth:', fogLayer.depth)

// Force fog visible
fogLayer.setVisible(true)
fogLayer.setDepth(1000)

// Test fog fill
fogLayer.clear()
fogLayer.fill(0xff0000, 0.5) // Should show red overlay
```

## Next Steps
1. **For Backend Team**: Fix the player data format (use `position` not empty `transform`)
2. **For Frontend**: 
   - Try pressing F to toggle fog
   - Check if fog appears when toggled
   - If fog never shows, the render texture might need a different approach 
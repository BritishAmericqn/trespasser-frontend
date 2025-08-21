# 🔴 Critical Coordinate System Bug Analysis

## The Problem

Windows desktops cannot play the game because mouse coordinates are being calculated incorrectly due to screen scaling.

## Root Cause

1. **Canvas Size**: 480x270 (very small)
2. **Scaling Mode**: `Phaser.Scale.FIT` - scales canvas to fit screen
3. **Coordinate Conversion**: 
   - Code uses `getWorldPoint(pointer.x, pointer.y)` 
   - This converts screen pixels → game world coordinates
   - On scaled displays, world coordinates can exceed canvas bounds

4. **The Bug Chain**:
   ```
   Windows Desktop (1920x1080) 
   → Canvas scaled 4x (480→1920, 270→1080)
   → Mouse at screen (960, 540)
   → getWorldPoint returns (960, 540) not (240, 135)!
   → Our validation clamps to (480, 270)
   → Backend sees mouse at edge when it's actually centered
   → Input validation fails
   ```

## Why It Works on Laptop

Your laptop likely has:
- Different screen resolution that scales evenly
- Different DPI settings
- The scaling happens to keep coordinates within bounds

## The Fix

We need to use the CORRECT coordinate system. The backend expects coordinates in GAME SPACE (0-480, 0-270), not WORLD SPACE.

### Option 1: Use Pointer Position Directly (RECOMMENDED)
```javascript
// Instead of:
const worldPoint = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);

// Use:
const gameX = pointer.x * (480 / this.scene.scale.width);
const gameY = pointer.y * (270 / this.scene.scale.height);
```

### Option 2: Remove Clamping
Let the coordinates be what they are and let backend handle it.

### Option 3: Use Camera-Relative Coordinates
```javascript
const camera = this.scene.cameras.main;
const gameX = pointer.x + camera.scrollX;
const gameY = pointer.y + camera.scrollY;
```

## Testing Required

1. Get actual coordinate values on Windows:
   - What does `getWorldPoint` return?
   - What is `this.scene.scale.width/height`?
   - What is the pointer.x/y vs worldPoint.x/y?

2. Verify backend expectations:
   - Does it expect 0-480, 0-270?
   - Or does it accept any coordinates?
   - How does it validate mouse position?

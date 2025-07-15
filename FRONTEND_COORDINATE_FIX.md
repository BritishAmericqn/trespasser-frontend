# 🔧 Frontend Coordinate System Fixes

## 🚨 Critical Issues Found

### 1. **Weapon Direction Calculation Problem**

**Current Code (WRONG):**
```typescript
// InputSystem.ts - getAimDirection()
private getAimDirection(): number {
    const mouseX = this.inputState.mouse.x;
    const mouseY = this.inputState.mouse.y;
    const playerX = this.playerPosition.x;
    const playerY = this.playerPosition.y;
    
    return Math.atan2(mouseY - playerY, mouseX - playerX);
}
```

**Issues:**
- When player is at origin (0,0) and mouse is near origin, atan2 gives unpredictable results
- Frontend calculates direction independently from backend
- Backend expects us to use the player's rotation it calculated

### 2. **Missing Player Rotation Tracking**

The frontend doesn't track player rotation at all! We need to:
1. Store player rotation locally
2. Update it based on mouse position each frame
3. Use it for weapon firing

### 3. **Coordinate System Mismatch**

**Symptoms:**
- Shooting "straight down" appears as "down and left"
- Walls hit at wrong positions
- Visual positions don't match physics

**Possible Causes:**
1. Y-axis might be inverted (screen coords vs game coords)
2. Origin point mismatch
3. Mouse coordinates not in game space

## 🛠️ Fixes Required

### Fix 1: Add Player Rotation Tracking

```typescript
// In InputSystem.ts
private playerRotation: number = 0;

// Add method to update rotation
private updatePlayerRotation(): void {
    const dx = this.inputState.mouse.x - this.playerPosition.x;
    const dy = this.inputState.mouse.y - this.playerPosition.y;
    
    // Prevent atan2(0,0) issues
    if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) {
        this.playerRotation = Math.atan2(dy, dx);
    }
}

// In weapon fire event
this.scene.events.emit('weapon:fire', {
    weaponType: weapon,
    position: this.playerPosition,
    targetPosition: targetPosition,
    direction: this.playerRotation, // Use stored rotation!
    // ...
});
```

### Fix 2: Debug Coordinate System

Add debug logging to understand the coordinate mismatch:

```typescript
// In InputSystem.ts - handleWeaponFire()
console.log('🎯 WEAPON FIRE DEBUG:', {
    playerPos: this.playerPosition,
    mousePos: { x: this.inputState.mouse.x, y: this.inputState.mouse.y },
    calculatedDir: this.playerRotation,
    dirInDegrees: (this.playerRotation * 180 / Math.PI),
    expectedTarget: {
        x: this.playerPosition.x + Math.cos(this.playerRotation) * 100,
        y: this.playerPosition.y + Math.sin(this.playerRotation) * 100
    }
});
```

### Fix 3: Verify Mouse Coordinates

The mouse coordinates might not be in game space:

```typescript
// In InputSystem.ts - captureMouseInput()
private captureMouseInput(): void {
    const pointer = this.scene.input.activePointer;
    
    // Get world coordinates, not screen coordinates
    const worldPoint = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
    
    this.inputState.mouse.x = Math.round(worldPoint.x);
    this.inputState.mouse.y = Math.round(worldPoint.y);
    
    // Update stored values
    this.updatePlayerRotation();
}
```

### Fix 4: Coordinate System Alignment Test

Add visual debug to verify coordinates:

```typescript
// In GameScene.ts
private addCoordinateDebug(): void {
    // Draw origin
    this.add.circle(0, 0, 5, 0xff0000);
    this.add.text(0, 0, '(0,0)', { fontSize: '10px' });
    
    // Draw game bounds
    this.add.rectangle(240, 135, 480, 270, undefined, 0xffffff, 0.1);
    
    // Show mouse world position
    this.input.on('pointermove', (pointer) => {
        const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        console.log(`Mouse world: (${worldPoint.x.toFixed(0)}, ${worldPoint.y.toFixed(0)})`);
    });
}
```

## 📋 Implementation Steps

1. **Update InputSystem.ts**:
   - Add playerRotation property
   - Update rotation each frame based on mouse
   - Use rotation for weapon firing
   - Fix mouse coordinate capture

2. **Debug Logging**:
   - Add coordinate logging
   - Verify mouse is in world space
   - Check rotation calculations

3. **Visual Debug**:
   - Add coordinate grid
   - Show player rotation visually
   - Draw expected bullet path

4. **Test Cases**:
   - Player at origin shooting in each direction
   - Player at corners shooting to center
   - Verify bullets go where crosshair points

## 🎯 Expected Results

After fixes:
- Bullets should go exactly where the crosshair points
- No "shooting at self" when at origin
- Consistent behavior regardless of player position
- Visual and physics should align perfectly 
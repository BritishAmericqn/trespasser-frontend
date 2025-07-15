# Backend Wall Collision Fix - Simple Guide

## The Problem
You're treating ALL wall hits as misses. The frontend is sending you shot data, but you're not checking if it hits walls.

## What You're Getting From Frontend
```javascript
{
  weaponType: 'rifle',
  position: { x: 283.33, y: 152.5 },    // Player shot from here
  targetPosition: { x: 325, y: 158 },   // Player aimed here (mouse)
  direction: 0.131,                     // Angle in radians
  // ... other fields
}
```

## What You Need to Do

### 1. Store These Wall Positions
```javascript
const walls = [
  { id: 'wall_3', x: 300, y: 150, width: 60, height: 15 },
  { id: 'wall_4', x: 150, y: 50, width: 60, height: 15 },
  { id: 'wall_5', x: 320, y: 80, width: 60, height: 15 },
  { id: 'wall_6', x: 280, y: 120, width: 90, height: 15 },
  { id: 'wall_7', x: 350, y: 160, width: 45, height: 15 },
  { id: 'wall_8', x: 250, y: 180, width: 75, height: 15 }
];
```

### 2. Check If Shot Hits Wall
```javascript
function checkWallHit(startPos, direction, maxDistance = 1000) {
  // Cast a ray from startPos in direction
  for (let dist = 0; dist < maxDistance; dist += 2) {
    const x = startPos.x + Math.cos(direction) * dist;
    const y = startPos.y + Math.sin(direction) * dist;
    
    // Check each wall
    for (const wall of walls) {
      if (x >= wall.x && x <= wall.x + wall.width &&
          y >= wall.y && y <= wall.y + wall.height) {
        return { hit: true, wall: wall, hitPoint: { x, y } };
      }
    }
  }
  return { hit: false };
}
```

### 3. Send Correct Events
```javascript
// In your weapon fire handler:
const hitResult = checkWallHit(data.position, data.direction);

if (hitResult.hit) {
  // Send wall damaged event - NOT weapon:miss!
  socket.emit('wall:damaged', {
    wallId: hitResult.wall.id,
    position: hitResult.hitPoint,
    damage: 25,  // rifle damage
    sliceIndex: Math.floor((hitResult.hitPoint.x - hitResult.wall.x) / 12),
    newHealth: 75,  // track this per wall
    isDestroyed: false
  });
} else {
  // Only send miss if it actually missed everything
  socket.emit('weapon:miss', data);
}
```

## Test Cases

### Test 1
- Player at (283, 152) shoots towards (325, 158)
- Should hit wall_4 at approximately (208, 59)
- Send `wall:damaged` for wall_4

### Test 2  
- Player at (251, 47) shoots towards (202, 61)
- Should hit wall_4 at approximately (208, 59)
- Send `wall:damaged` for wall_4

## What Success Looks Like

Frontend console should show:
```
🔫 FIRING rifle from (283.33, 152.5) → (325, 158) angle: 8°
🎯 CLIENT HIT DETECTION: Wall wall_4 hit at (208.9, 59.1)
🔥 BACKEND EVENT RECEIVED: wall:damaged {wallId: 'wall_4', ...}
```

NOT:
```
🔥 BACKEND EVENT RECEIVED: weapon:miss
```

## Quick Checklist

- [ ] Add wall positions to your game state
- [ ] Implement ray-rectangle collision detection
- [ ] Track wall health (100 HP per wall)
- [ ] Send `wall:damaged` events when walls are hit
- [ ] Send `wall:destroyed` when health reaches 0
- [ ] Stop sending `weapon:miss` for wall hits

That's it! The frontend is ready and waiting for these events. 
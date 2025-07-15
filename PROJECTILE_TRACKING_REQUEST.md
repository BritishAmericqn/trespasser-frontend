# Projectile Tracking Implementation Request

## Summary
The frontend needs projectile tracking events to display animated trails for rockets and grenades. Currently, these weapons show no visual trail because the backend doesn't send position updates during flight.

## Current Issue
- When firing rocket/grenade: Frontend only receives `weapon:fired` and later `weapon:miss` or `explosion:created`
- No position updates during flight = no visual trail
- Players can't see where their projectiles are going

## Required Events

### 1. `projectile:created` - When rocket/grenade is fired
```javascript
socket.emit('projectile:created', {
  id: 'proj_123',              // Unique projectile ID
  type: 'rocket',              // 'rocket' or 'grenade'
  playerId: socket.id,         // Who fired it
  position: { x: 100, y: 100 }, // Starting position
  velocity: { x: 200, y: -50 }, // Speed and direction
  timestamp: Date.now()
});
```

### 2. `projectile:updated` - Every physics tick while flying
```javascript
socket.emit('projectile:updated', {
  id: 'proj_123',
  position: { x: 150, y: 90 }   // Current position
});
```

### 3. `projectile:exploded` - When it hits something
```javascript
socket.emit('projectile:exploded', {
  id: 'proj_123',
  position: { x: 300, y: 100 }, // Impact position
  radius: 50                    // Explosion radius
});
```

## Implementation Notes

1. **Unique IDs**: Each projectile needs a unique ID to track it
2. **Update Frequency**: Send `projectile:updated` at your physics tick rate (e.g., 60Hz)
3. **Cleanup**: Remove projectile from tracking after explosion
4. **Grenades**: Should include gravity in velocity calculations
5. **Rockets**: Travel in straight lines at constant speed

## Benefits
- Players can see projectile trajectories
- Rockets show red trails with smoke effects
- Grenades show orange arcing trails
- Better visual feedback for combat

## Frontend is Ready
The frontend already has all the code to handle these events and render beautiful trails. We just need the backend to send the position data!

## Example Backend Implementation Pattern
```javascript
class Projectile {
  constructor(type, position, direction, speed) {
    this.id = `proj_${Date.now()}_${Math.random()}`;
    this.type = type;
    this.position = { ...position };
    this.velocity = {
      x: Math.cos(direction) * speed,
      y: Math.sin(direction) * speed
    };
    
    // Emit creation event
    io.emit('projectile:created', {
      id: this.id,
      type: this.type,
      playerId: this.ownerId,
      position: this.position,
      velocity: this.velocity
    });
  }
  
  update(deltaTime) {
    // Update position
    this.position.x += this.velocity.x * deltaTime;
    this.position.y += this.velocity.y * deltaTime;
    
    // Apply gravity for grenades
    if (this.type === 'grenade') {
      this.velocity.y += GRAVITY * deltaTime;
    }
    
    // Emit update event
    io.emit('projectile:updated', {
      id: this.id,
      position: this.position
    });
    
    // Check collisions...
    if (this.checkCollision()) {
      this.explode();
    }
  }
  
  explode() {
    io.emit('projectile:exploded', {
      id: this.id,
      position: this.position,
      radius: this.type === 'rocket' ? 50 : 40
    });
    
    // Remove from active projectiles
    this.destroy();
  }
}
```

Let me know if you need any clarification! 
# Critical Lesson: Phaser 3 Graphics Objects and Particle Systems

## The Problem We Solved
Individual `Phaser.GameObjects.Graphics` objects created with `scene.add.graphics()` don't properly destroy when calling `destroy()` on them. This led to persistent visual artifacts (particles, hitmarkers) that wouldn't disappear from the screen.

## The Root Cause
1. **Multiple VisualEffectsSystem instances** were being created when transitioning between scenes
2. **Old instances weren't being destroyed** because GameScene wasn't calling `stop()` on itself
3. **Individual Graphics objects persist** even after `destroy()` is called on them

## The Solution: Single Canvas Pattern

### ❌ DON'T DO THIS (Individual Graphics Objects)
```typescript
// BAD: Creates persistent graphics that won't destroy properly
showParticle(position) {
  const particle = this.scene.add.graphics();
  particle.fillStyle(0xFF0000, 1);
  particle.fillRect(position.x, position.y, 2, 2);
  
  // Later...
  particle.destroy(); // DOESN'T ACTUALLY REMOVE FROM SCREEN!
}
```

### ✅ DO THIS (Single Canvas Pattern)
```typescript
// GOOD: Use a single canvas that gets cleared and redrawn
class VisualEffectsSystem {
  private particleCanvas: Phaser.GameObjects.Graphics;
  private particleData: Array<{x, y, color, alpha}> = [];
  
  initialize() {
    // Create ONE canvas for all particles
    this.particleCanvas = this.scene.add.graphics();
    this.particleCanvas.setDepth(55);
  }
  
  update() {
    // Clear canvas every frame
    this.particleCanvas.clear();
    
    // Redraw all particles with current state
    for (const particle of this.particleData) {
      this.particleCanvas.fillStyle(particle.color, particle.alpha);
      this.particleCanvas.fillRect(particle.x, particle.y, 2, 2);
    }
  }
}
```

## Key Principles

### 1. **One Canvas Per Effect Type**
- Particles → One canvas
- Hitmarkers → One canvas  
- Bullet trails → One canvas
- Never create individual Graphics objects for temporary effects

### 2. **Data-Driven Rendering**
- Store effect data in arrays (position, color, age, etc.)
- Clear canvas each frame
- Redraw all effects based on current data
- Remove old data, not Graphics objects

### 3. **Proper Scene Cleanup**
When transitioning between scenes:
```typescript
// Always stop the current scene before starting another
this.scene.stop('CurrentScene');
this.scene.start('NextScene');
```

### 4. **Destroy Event Listeners First**
In destroy methods, remove event listeners BEFORE destroying objects:
```typescript
destroy() {
  // FIRST: Stop receiving events
  this.removeBackendEventListeners();
  this.removeLocalEventListeners();
  
  // THEN: Clean up objects
  if (this.particleCanvas) {
    this.particleCanvas.clear();
    this.particleCanvas.destroy();
  }
}
```

## Common Pitfalls to Avoid

1. **Creating Graphics in event handlers** - Use data arrays instead
2. **Forgetting to stop scenes** - Always call `scene.stop()` before `scene.start()`
3. **Not removing event listeners** - Leads to zombie instances responding to events
4. **Using alpha on filled Graphics** - Sometimes doesn't update visually
5. **Moving Graphics objects** - Draw at absolute positions instead

## Testing Checklist

- [ ] Start game, shoot walls, see particles
- [ ] Press ESC to leave properly
- [ ] Start new game, shoot again
- [ ] Verify only ONE instance responds in console
- [ ] Check particles and hitmarkers fade and disappear
- [ ] No visual artifacts remain after effects expire

## Reference Implementation
See `src/client/systems/VisualEffectsSystem.ts` for the complete implementation using the single canvas pattern for both particles and hitmarkers.

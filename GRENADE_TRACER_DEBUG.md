# Grenade Tracer Debug Summary

## Current Setup

### Event Flow (Should Work):
1. **Backend** sends: `projectile:created`, `projectile:updated`, `projectile:exploded`
2. **NetworkSystem** (lines 568-584) forwards as: `backend:projectile:*` events
3. **VisualEffectsSystem** (lines 465-477) listens and renders

### Code Verified:
- ✅ NetworkSystem IS listening for projectile events
- ✅ NetworkSystem forwards them (if AUTHENTICATED)
- ✅ VisualEffectsSystem has handlers for all three events
- ✅ Textures are loaded (`fraggrenade`, `weapon_smokegrenade`, `weapon_flashbang`)
- ✅ Trail rendering code exists (lines 1373-1381 for grenades)

## Debug Logging Added

### NetworkSystem.ts:
```
🎆 Forwarding projectile:created to scene: [type] [id]
⚠️ Projectile created but not authenticated: [state]
📡 Projectile update: [id] [position] (1% sample rate)
💥 Forwarding projectile:exploded: [id]
```

### VisualEffectsSystem.ts:
```
🚀 Projectile created: [type] [id]
⚠️ Projectile update for unknown projectile: [id]
⚠️ Projectile already exists: [id]
🎯 Projectile [emoji] created with id: [id], total: [count]
💥 Projectile exploded: [id]
```

## What to Look For

### Test Steps:
1. Throw a grenade
2. Check console for:
   - `🎆 Forwarding projectile:created` - Backend sent create event
   - `🚀 Projectile created` - Frontend created visual
   - `📡 Projectile update` - Position updates arriving
   - `💥 Projectile exploded` - Explosion event

### Possible Issues:

#### Issue 1: No "Forwarding projectile:created"
**Cause:** Backend not sending `projectile:created`
**Fix:** Backend needs to emit this event

#### Issue 2: "Projectile created but not authenticated"
**Cause:** Not authenticated when grenades are thrown
**Fix:** Check authentication state

#### Issue 3: "Projectile update for unknown projectile"
**Cause:** Updates arriving before create event
**Fix:** Backend timing issue or ID mismatch

#### Issue 4: No logs at all
**Cause:** Events not reaching NetworkSystem
**Fix:** Check socket connection

## Quick Test Code

Add this to GameScene to bypass the whole chain:
```typescript
// Test: Create fake grenade projectile
this.input.keyboard.on('keydown-T', () => {
  this.events.emit('backend:projectile:created', {
    id: `test_${Date.now()}`,
    type: 'grenade',
    position: { x: 240, y: 135 },
    velocity: { x: 100, y: -100 },
    lifetime: 5000
  });
});
```

This will test if the rendering works when events DO arrive.

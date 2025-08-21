# 🚨 CRITICAL: Backend Not Sending `projectile:created` Event

## The Problem
Grenades work (physics, explosions) but **NO VISUAL TRACERS** because backend never sends the initial creation event.

## Evidence from Frontend Console

When throwing a grenade:
```
⚠️ Projectile update for unknown projectile: projectile_1   [x30+ times]
💥 Projectile exploded: projectile_1
```

**Missing:** 
```
🚀 Projectile created: grenade projectile_1   ← NEVER APPEARS
```

## What Backend IS Sending ✅
- `projectile:updated` - Position updates (60Hz)
- `projectile:exploded` - Explosion event

## What Backend is NOT Sending ❌
- `projectile:created` - Initial creation event

## Why Frontend Can't Render

The frontend flow:
1. Waits for `projectile:created` to create visual object
2. Uses `projectile:updated` to move the visual
3. Uses `projectile:exploded` to remove visual and show explosion

**Without step 1, steps 2-3 fail!**

## Backend Fix Required

When creating a grenade projectile, backend MUST emit:

```javascript
// When grenade is thrown
socket.emit('projectile:created', {
  id: 'projectile_1',           // Unique ID
  type: 'grenade',               // or 'flashbang', 'smokegrenade'
  position: { x: 100, y: 100 },  // Initial position
  velocity: { x: 200, y: -150 }, // Initial velocity
  playerId: 'player_123',        // Who threw it
  timestamp: Date.now()
});
```

## Verification

After fix, console should show:
1. `🎆 Forwarding projectile:created to scene: grenade projectile_1`
2. `🚀 Projectile created: grenade projectile_1`
3. `📡 Projectile update: projectile_1` (occasional)
4. `💥 Projectile exploded: projectile_1`

## Frontend is Ready

The frontend code is fully implemented and waiting for this event:
- NetworkSystem.ts:568 - Listening for `projectile:created`
- VisualEffectsSystem.ts:465 - Handler creates visual with trail

Just need backend to send the initial event!

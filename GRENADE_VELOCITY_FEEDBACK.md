# Grenade Velocity Adjustment Needed

## Issue
Grenades are currently being thrown with velocity values that are too high, causing them to travel much too far and fast across the game world.

## Current Behavior
When throwing a grenade with charge level 1-5, the grenades travel almost across the entire map, making them difficult to use tactically.

## Suggested Fix
The backend should reduce the grenade throw velocity. Here's a suggested scaling:

```javascript
// Current velocities seem to be something like:
const speed = chargeLevel * 200; // Too fast!

// Suggested velocities:
const baseSpeed = 50;  // Much slower base speed
const speed = baseSpeed + (chargeLevel * 30); // Results in 80-200 speed range

// This would give:
// Charge 1: 80 speed
// Charge 2: 110 speed
// Charge 3: 140 speed
// Charge 4: 170 speed
// Charge 5: 200 speed (max)
```

## Benefits
- Grenades will arc more naturally
- Players can use them for close to medium range combat
- The charge mechanic becomes more meaningful
- Better tactical gameplay

The frontend rendering is working perfectly - we just need the initial velocity values adjusted on the backend! 
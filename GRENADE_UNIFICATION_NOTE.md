# Grenade System Unification

## Change Summary
The frontend has unified the grenade throwing system to ensure consistent behavior and projectile tracking.

## Previous Behavior (REMOVED)
- **G key**: Sent `grenade:throw` event → No projectile tracking
- **Left-click with grenade**: Sent `weapon:fire` event → Had projectile tracking

## New Unified Behavior
Both methods now use the same system:
- **G key (any weapon)**: Hold to charge, release to throw
- **Left-click (grenade selected)**: Hold to charge, release to throw

Both send `weapon:fire` event with:
```javascript
{
  weaponType: 'grenade',
  position: { x, y },
  targetPosition: { x, y },
  direction: angle,
  chargeLevel: 1-5,    // NEW: Charge level included
  isADS: false,
  timestamp: number,
  sequence: number
}
```

## Backend Considerations
1. The `grenade:throw` event is NO LONGER SENT - all grenades come through `weapon:fire`
2. The `chargeLevel` field indicates throw strength (1-5)
3. Backend should use chargeLevel to calculate initial velocity:
   ```javascript
   const baseSpeed = 50;
   const speed = baseSpeed + (chargeLevel * 30); // 80-200 range
   ```

## Benefits
- Consistent projectile tracking for all grenades
- Unified control scheme
- Better user experience
- Visible grenade trails always work 
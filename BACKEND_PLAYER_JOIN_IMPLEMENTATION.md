# Backend player:join Event Implementation Guide

## What Changed
The frontend now properly sends player loadout when joining the game. The `player:join` event is sent:
1. When GameScene starts (immediate)
2. Again after 1 second (failsafe)

## Event Structure
```javascript
socket.on('player:join', (data) => {
  // data structure:
  {
    loadout: {
      primary: string,      // One of: rifle, smg, shotgun, battlerifle, sniperrifle
      secondary: string,    // One of: pistol, revolver, suppressedpistol
      support: string[],    // Array of: grenade, smokegrenade, flashbang, grenadelauncher, rocket, machinegun, antimaterialrifle
      team: string         // Either: 'red' or 'blue'
    },
    timestamp: number      // Client timestamp
  }
});
```

## Backend Implementation Checklist

### 1. Store Player Loadout
```javascript
// On player join
players[socket.id].loadout = data.loadout;
players[socket.id].team = data.loadout.team;
```

### 2. Initialize Ammo for Selected Weapons
```javascript
// Initialize ammo ONLY for weapons in loadout
const ammo = {};
ammo[data.loadout.primary] = MAGAZINE_SIZES[data.loadout.primary];
ammo[data.loadout.secondary] = MAGAZINE_SIZES[data.loadout.secondary];
data.loadout.support.forEach(weapon => {
  ammo[weapon] = MAGAZINE_SIZES[weapon];
});
players[socket.id].ammo = ammo;
```

### 3. Validate Weapon Fire Events
```javascript
socket.on('weapon:fire', (fireData) => {
  const player = players[socket.id];
  const weaponType = fireData.weaponType;
  
  // Check if player has this weapon in their loadout
  const hasWeapon = 
    weaponType === player.loadout.primary ||
    weaponType === player.loadout.secondary ||
    player.loadout.support.includes(weaponType);
    
  if (!hasWeapon) {
    console.warn(`Player ${socket.id} tried to fire ${weaponType} but doesn't have it!`);
    return; // Reject the fire event
  }
  
  // Check ammo
  if (!player.ammo[weaponType] || player.ammo[weaponType] <= 0) {
    socket.emit('weapon:empty', { weaponType });
    return;
  }
  
  // Process the shot...
});
```

### 4. Handle Team-Based Logic
```javascript
// Use player.loadout.team for:
- Spawn locations (red vs blue spawn points)
- Friendly fire checks
- Team scoring
- Visual indicators
```

### 5. Broadcast Loadout to Other Players (Optional)
```javascript
// Let other players know what weapons this player has
socket.broadcast.emit('player:loadout', {
  playerId: socket.id,
  primary: data.loadout.primary,
  team: data.loadout.team
  // Don't send full loadout for security
});
```

## Testing
1. Have player select non-default weapons (e.g., shotgun, suppressedpistol, machinegun)
2. Check server logs show correct loadout (not rifle/pistol/grenade defaults)
3. Verify player can only fire weapons in their loadout
4. Confirm ammo tracking works per weapon

## Common Issues
- If you get default weapons, the frontend might be cached - have player refresh
- The event is sent twice (immediate + 1s delay) - handle duplicates gracefully
- Player might disconnect/reconnect - store loadout persistently if needed 
# Backend Wall Destruction Implementation Guide

## 🎯 Current Status

### ✅ Frontend Implementation Complete
The frontend is **fully functional** and ready for backend integration. All client-side systems are working:

- **Collision detection** ✅ Working
- **Explosion effects** ✅ Working  
- **Bullet trails** ✅ Working
- **Client-side wall damage prediction** ✅ Working
- **Event sending to backend** ✅ Working
- **Backend event listeners** ✅ Ready

### 🔄 Frontend Console Output (Working Correctly)
```
🔫 Firing weapon: rocket
📉 Ammo decreased for rocket: 0
📡 NetworkSystem forwarding weapon:fire to backend
🔥 Muzzle flash created at (240, 128.33333333333337)
🚀 Bullet trail created from (240, 128.33333333333337) to (239.39457044905046, 150.32500118865622) - rocket
💥 Explosion effect created at (239.39457044905046, 150.32500118865622) - radius: 50
🧱 Wall damage effect created at (239.39457044905046, 150.32500118865622) - concrete
💥 rocket hit wall and exploded at client-side collision detection
```

## 🏗️ What the Backend Needs to Implement

### 1. **Receive Weapon Fire Events**
The frontend is already sending these events via Socket.io:

```javascript
// Event the backend receives
socket.on('player:input', (inputData) => {
  // Contains weapon fire data when player shoots
  if (inputData.mouse.leftPressed) {
    // Player fired weapon - process this!
  }
});

// Also receives direct weapon events
socket.on('weapon:fire', (data) => {
  // {
  //   weaponType: 'rocket' | 'grenade' | 'rifle' | 'pistol',
  //   position: { x: number, y: number },
  //   targetPosition: { x: number, y: number },
  //   direction: number,
  //   isADS: boolean,
  //   timestamp: number,
  //   sequence: number
  // }
});
```

### 2. **Implement Wall Damage System**
The backend needs to:

#### A. **Wall Data Structure**
```javascript
// Wall representation (suggested structure)
const walls = {
  'wall-1': {
    id: 'wall-1',
    position: { x: 100, y: 100 },
    width: 60,
    height: 15,
    material: 'concrete',
    maxHealth: 100,
    sliceHealth: [100, 100, 100, 100, 100], // 5 slices per wall
    destructionMask: [0, 0, 0, 0, 0] // 0=intact, 1=destroyed
  },
  'wall-2': {
    id: 'wall-2',
    position: { x: 200, y: 150 },
    width: 60,
    height: 15,
    material: 'wood',
    maxHealth: 80,
    sliceHealth: [80, 80, 80, 80, 80],
    destructionMask: [0, 0, 0, 0, 0]
  },
  'wall-3': {
    id: 'wall-3',
    position: { x: 300, y: 120 },
    width: 60,
    height: 15,
    material: 'metal',
    maxHealth: 120,
    sliceHealth: [120, 120, 120, 120, 120],
    destructionMask: [0, 0, 0, 0, 0]
  }
};
```

#### B. **Weapon Damage Values**
```javascript
const weaponDamage = {
  rifle: 25,
  pistol: 35,
  grenade: 100,
  rocket: 150
};

const explosionRadius = {
  grenade: 40,
  rocket: 50
};
```

#### C. **Collision Detection Logic**
```javascript
function processWeaponFire(playerPos, targetPos, weaponType) {
  // 1. Calculate bullet/projectile path
  const hitPoint = calculateRaycast(playerPos, targetPos);
  
  // 2. Check if hit a wall
  const hitWall = checkWallCollision(hitPoint);
  
  // 3. If explosive weapon, calculate area damage
  if (weaponType === 'grenade' || weaponType === 'rocket') {
    const radius = explosionRadius[weaponType];
    const affectedWalls = getWallsInRadius(hitPoint, radius);
    
    affectedWalls.forEach(wall => {
      damageWall(wall, weaponDamage[weaponType], hitPoint);
    });
    
    // Send explosion event
    socket.emit('backend:explosion:created', {
      position: hitPoint,
      radius: radius,
      weaponType: weaponType,
      damagedWalls: affectedWalls
    });
  }
  
  // 4. If hitscan weapon, damage single wall
  else if (hitWall) {
    damageWall(hitWall, weaponDamage[weaponType], hitPoint);
  }
}
```

#### D. **Wall Damage Function**
```javascript
function damageWall(wall, damage, hitPoint) {
  // Calculate which slice was hit
  const sliceIndex = Math.floor((hitPoint.x - wall.position.x) / (wall.width / 5));
  
  // Apply damage
  wall.sliceHealth[sliceIndex] -= damage;
  
  // Check if slice is destroyed
  if (wall.sliceHealth[sliceIndex] <= 0) {
    wall.sliceHealth[sliceIndex] = 0;
    wall.destructionMask[sliceIndex] = 1;
    
    // Send destruction event
    socket.emit('backend:wall:destroyed', {
      wallId: wall.id,
      sliceIndex: sliceIndex,
      position: hitPoint,
      material: wall.material
    });
  } else {
    // Send damage event
    socket.emit('backend:wall:damaged', {
      wallId: wall.id,
      sliceIndex: sliceIndex,
      newHealth: wall.sliceHealth[sliceIndex],
      maxHealth: wall.maxHealth,
      position: hitPoint,
      material: wall.material,
      startPosition: playerPos,
      hitPosition: hitPoint,
      weaponType: weaponType
    });
  }
}
```

### 3. **Required Socket.io Events to Send**

#### A. **Wall Damage Event**
```javascript
socket.emit('backend:wall:damaged', {
  wallId: 'wall-1',
  sliceIndex: 2,
  newHealth: 75,
  maxHealth: 100,
  position: { x: 130, y: 107 },
  material: 'concrete',
  startPosition: { x: 240, y: 128 },
  hitPosition: { x: 130, y: 107 },
  weaponType: 'rocket'
});
```

#### B. **Wall Destruction Event**
```javascript
socket.emit('backend:wall:destroyed', {
  wallId: 'wall-1',
  sliceIndex: 2,
  position: { x: 130, y: 107 },
  material: 'concrete'
});
```

#### C. **Explosion Event**
```javascript
socket.emit('backend:explosion:created', {
  position: { x: 239, y: 150 },
  radius: 50,
  weaponType: 'rocket',
  damagedWalls: [
    { wallId: 'wall-1', position: { x: 130, y: 107 }, material: 'concrete' },
    { wallId: 'wall-2', position: { x: 210, y: 160 }, material: 'wood' }
  ]
});
```

#### D. **Weapon Hit Events**
```javascript
// For successful hits
socket.emit('backend:weapon:hit', {
  position: { x: 130, y: 107 },
  startPosition: { x: 240, y: 128 },
  hitPosition: { x: 130, y: 107 },
  weaponType: 'rocket',
  damage: 150,
  target: 'wall' // or 'player'
});

// For misses
socket.emit('backend:weapon:miss', {
  position: { x: 239, y: 150 },
  startPosition: { x: 240, y: 128 },
  hitPosition: { x: 239, y: 150 },
  weaponType: 'rocket',
  direction: 1.5
});
```

### 4. **Game State Updates**
```javascript
// Send updated game state with wall information
socket.emit('game:state', {
  players: {...},
  walls: walls, // Include wall states
  timestamp: Date.now(),
  tickRate: 60
});
```

## 🔧 Integration Points

### Frontend Event Listeners (Already Implemented)
The frontend is already listening for these events:
- `backend:wall:damaged` ✅ Ready
- `backend:wall:destroyed` ✅ Ready  
- `backend:explosion:created` ✅ Ready
- `backend:weapon:hit` ✅ Ready
- `backend:weapon:miss` ✅ Ready
- `backend:weapon:fired` ✅ Ready

### What Frontend Will Do When Events Are Received
1. **`backend:wall:damaged`** → Update wall visuals (darker, cracks)
2. **`backend:wall:destroyed`** → Remove wall slice completely
3. **`backend:explosion:created`** → Show authoritative explosion effects
4. **`backend:weapon:hit`** → Show hit markers and trails
5. **`backend:weapon:miss`** → Show miss effects

## 🧪 Testing Instructions

### 1. **Basic Wall Damage Test**
1. Player fires rifle at wall
2. Backend should receive weapon fire event
3. Backend calculates collision and damage
4. Backend sends `backend:wall:damaged` event
5. Frontend should show wall getting darker

### 2. **Explosion Test**
1. Player fires rocket at wall
2. Backend should receive weapon fire event  
3. Backend calculates explosion damage to nearby walls
4. Backend sends `backend:explosion:created` event
5. Frontend should show explosion and wall damage

### 3. **Wall Destruction Test**
1. Player fires multiple rockets at same wall slice
2. Backend tracks cumulative damage
3. When slice health reaches 0, send `backend:wall:destroyed`
4. Frontend should remove that wall slice

## 📋 Implementation Checklist

### Backend Tasks
- [ ] Set up wall data structure
- [ ] Implement weapon damage processing
- [ ] Add collision detection for projectiles
- [ ] Calculate explosion area damage
- [ ] Track wall health and destruction
- [ ] Send wall damage events to frontend
- [ ] Send explosion events to frontend  
- [ ] Update game state with wall information
- [ ] Test weapon fire event reception
- [ ] Test wall damage calculation
- [ ] Test explosion radius calculation

### Testing Checklist
- [ ] Rifle shots damage walls
- [ ] Pistol shots damage walls
- [ ] Grenades explode and damage multiple walls
- [ ] Rockets explode and damage multiple walls
- [ ] Wall slices are destroyed at 0 health
- [ ] Frontend receives all backend events
- [ ] Wall visuals update correctly
- [ ] Explosion effects show properly

## 🚀 Priority Order

1. **HIGH**: Implement basic wall damage for rifle/pistol
2. **HIGH**: Set up event emission to frontend
3. **HIGH**: Test with simple wall damage
4. **MEDIUM**: Add explosion damage calculation
5. **MEDIUM**: Test rocket/grenade explosions
6. **LOW**: Optimize performance for multiple walls

## 📞 Frontend Contact

The frontend team has implemented all required systems and is ready to integrate. The frontend is sending all necessary events and listening for all required responses. Once the backend implements the wall damage system as described above, the integration should work immediately.

**Key Console Messages to Look For:**
- `🔫 Firing weapon: rocket` (Frontend working)
- `📡 NetworkSystem forwarding weapon:fire to backend` (Events being sent)
- `💥 rocket hit wall and exploded at client-side collision detection` (Collision detection working)

The frontend is **production-ready** and waiting for backend implementation. 
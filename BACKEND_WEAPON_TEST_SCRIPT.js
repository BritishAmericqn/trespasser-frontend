// Backend Weapon Event Test Script
// Run this to test if your backend properly handles all weapon events

const io = require('socket.io-client');
const socket = io('http://localhost:3000');

// Test data
const testPlayer = {
  id: 'test-player-123',
  position: { x: 240, y: 135 },
  direction: 0.785 // 45 degrees
};

const allWeapons = [
  // Primary
  'rifle', 'smg', 'shotgun', 'battlerifle', 'sniperrifle',
  // Secondary  
  'pistol', 'revolver', 'suppressedpistol',
  // Support
  'grenade', 'smokegrenade', 'flashbang', 'grenadelauncher', 
  'rocket', 'machinegun', 'antimaterialrifle'
];

let currentWeaponIndex = 0;
let testResults = {};

// Listen for backend responses
socket.on('connect', () => {
  console.log('✅ Connected to backend');
  // Wait for authentication before sending anything
});

socket.on('authenticated', () => {
  console.log('✅ Authenticated');
  
  // Send player join with loadout
  const testLoadout = {
    loadout: {
      primary: 'smg',
      secondary: 'pistol',
      support: ['grenade', 'rocket'],
      team: 'blue'
    },
    timestamp: Date.now()
  };
  
  console.log('📤 Sending player:join with loadout:', testLoadout);
  socket.emit('player:join', testLoadout);
  
  // Start weapon tests after a short delay
  setTimeout(() => startTests(), 500);
});

// Listen for all weapon-related events
socket.on('weapon:fired', (data) => {
  console.log('📨 Received weapon:fired', data);
  testResults[data.weaponType] = { ...testResults[data.weaponType], fired: true };
});

socket.on('weapon:hit', (data) => {
  console.log('🎯 Received weapon:hit', data);
  testResults[data.weaponType] = { ...testResults[data.weaponType], hit: true };
});

socket.on('weapon:miss', (data) => {
  console.log('❌ Received weapon:miss', data);
  testResults[data.weaponType] = { ...testResults[data.weaponType], miss: true };
});

socket.on('wall:damaged', (data) => {
  console.log('🧱 Received wall:damaged', data);
  testResults[data.weaponType] = { ...testResults[data.weaponType], wallDamaged: true };
});

socket.on('projectile:created', (data) => {
  console.log('🚀 Received projectile:created', data);
  testResults[data.type] = { ...testResults[data.type], projectileCreated: true };
});

socket.on('weapon:switched', (data) => {
  console.log('🔄 Received weapon:switched', data);
  testResults.weaponSwitch = true;
});

socket.on('weapon:reloaded', (data) => {
  console.log('🔄 Received weapon:reloaded', data);
  testResults[data.weaponType] = { ...testResults[data.weaponType], reloaded: true };
});

// Test functions
function startTests() {
  console.log('\n🧪 Starting weapon tests...\n');
  setTimeout(() => testNextWeapon(), 1000);
}

function testNextWeapon() {
  if (currentWeaponIndex >= allWeapons.length) {
    testWeaponSwitch();
    return;
  }

  const weapon = allWeapons[currentWeaponIndex];
  console.log(`\n🔫 Testing ${weapon}...`);
  
  // Initialize test results for this weapon
  testResults[weapon] = {};
  
  // Test firing
  const fireData = {
    weaponType: weapon,
    position: testPlayer.position,
    targetPosition: { x: 300, y: 150 },
    direction: testPlayer.direction,
    isADS: false,
    timestamp: Date.now(),
    sequence: currentWeaponIndex
  };
  
  // Add weapon-specific data
  if (weapon === 'shotgun') {
    fireData.pelletCount = 8;
  } else if (['grenade', 'smokegrenade', 'flashbang'].includes(weapon)) {
    fireData.chargeLevel = weapon === 'grenade' ? 3 : 1;
  }
  
  console.log('📤 Sending weapon:fire', fireData);
  socket.emit('weapon:fire', fireData);
  
  // Test reload after a short delay
  setTimeout(() => {
    console.log(`📤 Sending weapon:reload for ${weapon}`);
    socket.emit('weapon:reload', {
      weaponType: weapon,
      timestamp: Date.now()
    });
  }, 500);
  
  // Move to next weapon after delay
  currentWeaponIndex++;
  setTimeout(() => testNextWeapon(), 2000);
}

function testWeaponSwitch() {
  console.log('\n🔄 Testing weapon switch...');
  
  socket.emit('weapon:switch', {
    fromWeapon: 'rifle',
    toWeapon: 'shotgun',
    timestamp: Date.now()
  });
  
  setTimeout(() => testADS(), 1000);
}

function testADS() {
  console.log('\n🎯 Testing ADS toggle...');
  
  socket.emit('ads:toggle', {
    isADS: true,
    timestamp: Date.now()
  });
  
  setTimeout(() => printResults(), 2000);
}

function printResults() {
  console.log('\n\n📊 TEST RESULTS:');
  console.log('================\n');
  
  let passed = 0;
  let failed = 0;
  
  allWeapons.forEach(weapon => {
    const result = testResults[weapon] || {};
    const isProjectile = ['grenade', 'smokegrenade', 'flashbang', 'grenadelauncher', 'rocket'].includes(weapon);
    
    let status = '❌ FAILED';
    if (isProjectile && result.projectileCreated) {
      status = '✅ PASSED';
      passed++;
    } else if (!isProjectile && (result.hit || result.miss || result.wallDamaged)) {
      status = '✅ PASSED';
      passed++;
    } else {
      failed++;
    }
    
    console.log(`${weapon}: ${status}`);
    if (result.fired) console.log('  - weapon:fired received');
    if (result.hit) console.log('  - weapon:hit received');
    if (result.miss) console.log('  - weapon:miss received');
    if (result.wallDamaged) console.log('  - wall:damaged received');
    if (result.projectileCreated) console.log('  - projectile:created received');
    if (result.reloaded) console.log('  - weapon:reloaded received');
    console.log('');
  });
  
  console.log(`\nWeapon Switch: ${testResults.weaponSwitch ? '✅ PASSED' : '❌ FAILED'}`);
  
  console.log('\n📈 Summary:');
  console.log(`  Passed: ${passed}/${allWeapons.length} weapons`);
  console.log(`  Failed: ${failed}/${allWeapons.length} weapons`);
  
  process.exit(0);
} 
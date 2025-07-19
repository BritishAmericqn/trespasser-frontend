/**
 * AudioIntegration - Example integration with existing game systems
 * This shows how to connect the AudioManager with your weapons and hit detection
 */

import { audioManager } from './AudioManager';
import { audioTest } from './AudioTest';

/**
 * Initialize audio system - call this after user clicks to start game
 * (Required due to browser autoplay policies)
 */
export async function initializeGameAudio(): Promise<void> {
  try {
    // Initialize both audio systems
    await audioTest.initialize();
    await audioManager.initialize();
    
    // Try to load real sound files (will fail gracefully if missing)
    await audioManager.loadAllSounds();
    
    console.log('Game audio system ready!');
  } catch (error) {
    console.error('Failed to initialize audio:', error);
  }
}

/**
 * Play weapon sound - uses real audio if available, synthetic otherwise
 */
export function fireWeapon(weaponType: string, playerPosition?: { x: number, y: number }): void {
  switch (weaponType) {
    // Primary weapons
    case 'rifle':
      if (audioManager.playWeaponSound('rifle', 'shot', { volume: 1.0 })) {
        audioManager.playShellDrop(0.15);
      } else {
        audioTest.playTestSound('shoot');
      }
      break;
      
    case 'smg':
      if (audioManager.playWeaponSound('smg', 'shot', { volume: 0.7 })) {
        audioManager.playShellDrop(0.1);
      } else {
        audioTest.playTestSound('shoot');
      }
      break;
      
    case 'shotgun':
      if (audioManager.playWeaponSound('shotgun', 'shot', { volume: 1.2 })) {
        audioManager.playShellDrop(0.25);
      } else {
        audioTest.playTestSound('shoot');
      }
      break;
      
    case 'battlerifle':
      if (audioManager.playWeaponSound('battlerifle', 'shot', { volume: 1.1 })) {
        audioManager.playShellDrop(0.18);
      } else {
        audioTest.playTestSound('shoot');
      }
      break;
      
    case 'sniperrifle':
      if (audioManager.playWeaponSound('sniperrifle', 'shot', { volume: 1.3 })) {
        audioManager.playShellDrop(0.3);
      } else {
        audioTest.playTestSound('shoot');
      }
      break;
      
    // Secondary weapons
    case 'pistol':
      if (audioManager.playWeaponSound('pistol', 'shot', { volume: 0.8 })) {
        audioManager.playShellDrop(0.2);
      } else {
        audioTest.playTestSound('shoot');
      }
      break;
      
    case 'revolver':
      if (audioManager.playWeaponSound('revolver', 'shot', { volume: 1.0 })) {
        // No shell drop for revolver (keeps casings)
      } else {
        audioTest.playTestSound('shoot');
      }
      break;
      
    case 'suppressedpistol':
      if (audioManager.playWeaponSound('suppressedpistol', 'shot', { volume: 0.3 })) {
        audioManager.playShellDrop(0.2);
      } else {
        audioTest.playTestSound('shoot');
      }
      break;
      
    // Support weapons
    case 'rocket':
    case 'rocketlauncher':
      if (!audioManager.playWeaponSound('rocketlauncher', 'launch', { volume: 1.2 })) {
        audioTest.playTestSound('explosion');
      }
      break;
      
    case 'grenadelauncher':
      if (!audioManager.playWeaponSound('grenadelauncher', 'shot', { volume: 1.0 })) {
        audioTest.playTestSound('shoot');
      }
      break;
      
    case 'machinegun':
      if (audioManager.playWeaponSound('machinegun', 'shot', { volume: 1.1 })) {
        audioManager.playShellDrop(0.12);
      } else {
        audioTest.playTestSound('shoot');
      }
      break;
      
    case 'antimaterialrifle':
      if (audioManager.playWeaponSound('antimaterialrifle', 'shot', { volume: 1.5 })) {
        audioManager.playShellDrop(0.4);
      } else {
        audioTest.playTestSound('shoot');
      }
      break;
      
    // Thrown weapons handled elsewhere
    case 'grenade':
    case 'smokegrenade':
    case 'flashbang':
      // These don't have firing sounds, handled in throw events
      break;
      
    default:
      console.warn(`Unknown weapon type: ${weaponType}`);
      audioTest.playTestSound('shoot'); // Generic fallback
  }
}

/**
 * Example reload integration
 */
export function reloadWeapon(weaponType: string): void {
  if (!audioManager.playWeaponSound(weaponType, 'reload', { volume: 0.7 })) {
    audioTest.playTestSound('click');
    console.log('🔊 Using synthetic reload sound');
  }
}

/**
 * Example projectile impact integration
 */
export function playImpactSound(hitInfo: { material: string, position: { x: number, y: number } }): void {
  // Map your game's material types to audio materials
  let audioMaterial = 'concrete'; // default
  
  if (hitInfo.material.includes('metal') || hitInfo.material.includes('wall')) {
    audioMaterial = 'metal';
  } else if (hitInfo.material.includes('wood')) {
    audioMaterial = 'wood';
  }
  
  if (!audioManager.playImpactSound(audioMaterial, { volume: 0.6 })) {
    audioTest.playTestSound('click');
    console.log('🔊 Using synthetic impact sound');
  }
}

/**
 * Example explosion integration (for rockets/grenades)
 */
export function playExplosion(explosionType: 'rocket' | 'grenade', position: { x: number, y: number }): void {
  const soundName = `${explosionType}_explode`;
  if (!audioManager.playSoundIfAvailable(soundName, { volume: 1.0 })) {
    audioTest.playTestSound('explosion');
    console.log('🔊 Using synthetic explosion sound');
  }
}

/**
 * Thrown weapon sounds
 */
export function throwWeapon(weaponType: string): void {
  switch (weaponType) {
    case 'grenade':
      // Pin pull
      if (!audioManager.playWeaponSound('grenade', 'pin', { volume: 0.5 })) {
        audioTest.playTestSound('click');
      }
      
      // Throw sound after short delay
      setTimeout(() => {
        if (!audioManager.playWeaponSound('grenade', 'throw', { volume: 0.6 })) {
          audioTest.playTestSound('click');
        }
      }, 300);
      break;
      
    case 'smokegrenade':
      // Pin pull
      if (!audioManager.playWeaponSound('smokegrenade', 'pin', { volume: 0.5 })) {
        audioTest.playTestSound('click');
      }
      
      // Throw sound after short delay
      setTimeout(() => {
        if (!audioManager.playWeaponSound('smokegrenade', 'throw', { volume: 0.6 })) {
          audioTest.playTestSound('click');
        }
      }, 300);
      break;
      
    case 'flashbang':
      // Pin pull
      if (!audioManager.playWeaponSound('flashbang', 'pin', { volume: 0.5 })) {
        audioTest.playTestSound('click');
      }
      
      // Throw sound after short delay
      setTimeout(() => {
        if (!audioManager.playWeaponSound('flashbang', 'throw', { volume: 0.6 })) {
          audioTest.playTestSound('click');
        }
      }, 300);
      break;
  }
}

export function grenadeHitGround(): void {
  if (!audioManager.playSoundIfAvailable('grenade_bounce', { volume: 0.7 })) {
    audioTest.playTestSound('click');
  }
}

/**
 * UI sound helpers
 */
export function playUIClick(): void {
  if (!audioManager.playSoundIfAvailable('ui_click', { volume: 0.5 })) {
    audioTest.playTestSound('click');
  }
}

export function playUIHover(): void {
  if (!audioManager.playSoundIfAvailable('ui_hover', { volume: 0.3 })) {
    audioTest.playTestSound('click');
  }
}

export function playNotification(): void {
  if (!audioManager.playSoundIfAvailable('notification', { volume: 0.8 })) {
    audioTest.playTestSound('beep');
  }
}

/**
 * Example volume controls (for settings menu)
 */
export function setGameVolume(masterVolume: number, sfxVolume: number): void {
  audioManager.setMasterVolume(masterVolume);
  audioManager.setSFXVolume(sfxVolume);
}

/**
 * Emergency stop all sounds (useful for game pause)
 */
export function stopAllGameAudio(): void {
  audioManager.stopAllSounds();
}

/**
 * Test all sound systems - useful for debugging
 */
export function testAllSounds(): void {
  console.log('🎵 Testing all sound systems...');
  
  console.log('Testing synthetic sounds:');
  setTimeout(() => audioTest.playTestSound('click'), 100);
  setTimeout(() => audioTest.playTestSound('shoot'), 600);
  setTimeout(() => audioTest.playTestSound('explosion'), 1100);
  setTimeout(() => audioTest.playTestSound('beep'), 1600);
  
  console.log('Testing weapon integration:');
  setTimeout(() => fireWeapon('pistol'), 2100);
  setTimeout(() => fireWeapon('rifle'), 2600);
  setTimeout(() => fireWeapon('rocketlauncher'), 3100);
}

/**
 * Example integration with your existing GameScene
 * Add this to your GameScene.ts file:
 */
/*
// In your GameScene.ts, add these imports:
import { 
  initializeGameAudio, 
  fireWeapon, 
  playImpactSound, 
  playExplosion,
  testAllSounds
} from './AudioIntegration';

// In your scene initialization:
async init() {
  // ... existing initialization code ...
  
  // Initialize audio system
  await initializeGameAudio();
  
  // Test sounds (remove this in production)
  testAllSounds();
}

// In your weapon firing logic:
private handleWeaponFire(weapon: string, playerId: string) {
  // ... existing weapon logic ...
  
  // Play weapon sound
  fireWeapon(weapon);
}

// In your hit detection/projectile impact:
private handleProjectileHit(hitData: any) {
  // ... existing hit logic ...
  
  // Play impact sound based on what was hit
  playImpactSound({
    material: hitData.materialType,
    position: hitData.position
  });
}

// In your explosion handling:
private handleExplosion(explosionData: any) {
  // ... existing explosion logic ...
  
  // Play explosion sound
  playExplosion(explosionData.type, explosionData.position);
}
*/ 
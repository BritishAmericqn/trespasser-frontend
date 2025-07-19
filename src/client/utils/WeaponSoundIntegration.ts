/**
 * WeaponSoundIntegration - Simple example showing how to integrate synthetic weapon sounds
 * with your existing weapon firing system
 */

import { AudioManager } from '../systems/AudioManager';

export class WeaponSoundIntegration {
  private audioManager: AudioManager;

  constructor(audioManager: AudioManager) {
    this.audioManager = audioManager;
  }

  /**
   * Call this when a weapon is fired to play the appropriate synthetic sound
   */
  playWeaponFireSound(weaponType: string, options?: {
    isLocal?: boolean;      // Is this the local player firing?
    distance?: number;      // Distance from listener (0-100)
    isSupressed?: boolean;  // Is the weapon suppressed?
    isMuffled?: boolean;    // Is sound muffled (through walls)?
  }): void {
    const opts = options || {};
    
    // Determine sound modifications based on context
    const modifications: any = {};
    
    // Distance effects
    if (opts.distance !== undefined) {
      if (opts.distance > 50) {
        modifications.distant = true;
        modifications.volume = Math.max(0.1, 1 - (opts.distance / 100));
      } else if (opts.distance > 20) {
        modifications.volume = 1 - (opts.distance / 200);
      }
    }
    
    // Environmental effects
    if (opts.isMuffled) {
      modifications.muffled = true;
    }
    
    // Local player gets slightly different sound for feedback
    if (opts.isLocal) {
      modifications.volume = (modifications.volume || 1) * 1.1;
    }
    
    // Play the sound
    if (Object.keys(modifications).length > 0) {
      this.audioManager.playSyntheticWeaponSound(weaponType, modifications);
    } else {
      this.audioManager.generateWeaponSound(weaponType);
    }
  }

  /**
   * Easy integration with your existing event system
   */
  setupEventListeners(scene: any): void {
    // Listen for weapon fire events and play appropriate sounds
    scene.events.on('weapon:fire', (data: any) => {
      this.playWeaponFireSound(data.weaponType, {
        isLocal: true  // This is the local player firing
      });
    });

    // Listen for other players firing
    scene.events.on('backend:weapon:fired', (data: any) => {
      if (data.playerId !== scene.networkSystem?.getSocket()?.id) {
        // Calculate distance to other player
        const distance = this.calculateDistance(
          scene.player?.x || 0, 
          scene.player?.y || 0,
          data.position?.x || 0, 
          data.position?.y || 0
        );
        
        this.playWeaponFireSound(data.weaponType, {
          isLocal: false,
          distance: distance,
          isMuffled: distance > 100 // Muffled if very far
        });
      }
    });
  }

  private calculateDistance(x1: number, y1: number, x2: number, y2: number): number {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
  }
}

/**
 * Quick setup function - call this in your GameScene.create() method
 */
export function setupWeaponSounds(scene: any, audioManager: AudioManager): void {
  const integration = new WeaponSoundIntegration(audioManager);
  integration.setupEventListeners(scene);
  
  // Store reference for later use
  (scene as any).weaponSoundIntegration = integration;
  
  console.log('🎵 Synthetic weapon sounds integrated!');
}

/**
 * Example usage in your existing weapon firing code:
 * 
 * // Instead of just this:
 * this.scene.events.emit('weapon:fire', fireData);
 * 
 * // You can now add:
 * if (this.scene.weaponSoundIntegration) {
 *   this.scene.weaponSoundIntegration.playWeaponFireSound(weapon, { isLocal: true });
 * }
 * 
 * // Or for easy testing, add to GameScene:
 * setupWeaponSounds(this, this.audioManager);
 */ 
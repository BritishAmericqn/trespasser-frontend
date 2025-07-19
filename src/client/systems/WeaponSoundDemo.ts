/**
 * WeaponSoundDemo - Shows how to use and customize synthetic weapon sounds
 */

import { AudioManager } from './AudioManager';

export class WeaponSoundDemo {
  private audioManager: AudioManager;

  constructor(audioManager: AudioManager) {
    this.audioManager = audioManager;
  }

  /**
   * Basic weapon sounds - each weapon has its own distinct character
   */
  demonstrateBasicWeaponSounds(): void {
    console.log('🔫 Playing basic weapon sounds...');
    
    // Each weapon has unique characteristics:
    setTimeout(() => this.audioManager.generateWeaponSound('pistol'), 0);        // High-pitched, crisp
    setTimeout(() => this.audioManager.generateWeaponSound('suppressedpistol'), 300); // Muffled, quiet
    setTimeout(() => this.audioManager.generateWeaponSound('revolver'), 600);    // Deep, powerful
    setTimeout(() => this.audioManager.generateWeaponSound('rifle'), 900);       // Sharp, medium
    setTimeout(() => this.audioManager.generateWeaponSound('smg'), 1200);        // Fast, light
    setTimeout(() => this.audioManager.generateWeaponSound('shotgun'), 1500);    // Booming, wide
    setTimeout(() => this.audioManager.generateWeaponSound('machinegun'), 1800); // Heavy, sustained
    setTimeout(() => this.audioManager.generateWeaponSound('sniperrifle'), 2100); // Very deep, long
    setTimeout(() => this.audioManager.generateWeaponSound('antimaterialrifle'), 2400); // Ultra-powerful
  }

  /**
   * Demonstrate volume modifications
   */
  demonstrateVolumeVariations(): void {
    console.log('🔊 Playing volume variations...');
    
    // Same weapon, different volumes
    setTimeout(() => this.audioManager.playSyntheticWeaponSound('rifle', { volume: 0.3 }), 0);    // Quiet
    setTimeout(() => this.audioManager.playSyntheticWeaponSound('rifle', { volume: 1.0 }), 500);  // Normal
    setTimeout(() => this.audioManager.playSyntheticWeaponSound('rifle', { volume: 1.5 }), 1000); // Loud
  }

  /**
   * Demonstrate pitch modifications 
   */
  demonstratePitchVariations(): void {
    console.log('🎵 Playing pitch variations...');
    
    // Same weapon, different pitches
    setTimeout(() => this.audioManager.playSyntheticWeaponSound('pistol', { pitch: 0.7 }), 0);    // Lower
    setTimeout(() => this.audioManager.playSyntheticWeaponSound('pistol', { pitch: 1.0 }), 400);  // Normal
    setTimeout(() => this.audioManager.playSyntheticWeaponSound('pistol', { pitch: 1.4 }), 800);  // Higher
  }

  /**
   * Demonstrate environmental effects
   */
  demonstrateEnvironmentalEffects(): void {
    console.log('🌫️ Playing environmental effects...');
    
    // Normal vs muffled vs distant
    setTimeout(() => this.audioManager.playSyntheticWeaponSound('shotgun'), 0);                              // Normal
    setTimeout(() => this.audioManager.playSyntheticWeaponSound('shotgun', { muffled: true }), 800);        // Muffled (through wall)
    setTimeout(() => this.audioManager.playSyntheticWeaponSound('shotgun', { distant: true }), 1600);       // Distant (far away)
    setTimeout(() => this.audioManager.playSyntheticWeaponSound('shotgun', { muffled: true, distant: true }), 2400); // Both
  }

  /**
   * Demonstrate duration modifications
   */
  demonstrateDurationVariations(): void {
    console.log('⏱️ Playing duration variations...');
    
    // Same weapon, different durations
    setTimeout(() => this.audioManager.playSyntheticWeaponSound('machinegun', { duration: 0.5 }), 0);   // Quick
    setTimeout(() => this.audioManager.playSyntheticWeaponSound('machinegun', { duration: 1.0 }), 600); // Normal
    setTimeout(() => this.audioManager.playSyntheticWeaponSound('machinegun', { duration: 2.0 }), 1200); // Long
  }

  /**
   * Create custom weapon variants by overriding specific parameters
   */
  demonstrateCustomVariants(): void {
    console.log('🎨 Playing custom weapon variants...');
    
    // Create a "heavy pistol" by modifying pistol
    setTimeout(() => {
      this.audioManager.generateWeaponSound('pistol', {
        volume: 0.6,           // Louder
        baseFrequency: 800,    // Lower pitch
        frequencyDecay: 300,   // Lower decay
        duration: 0.18,        // Longer
        noise: 0.5             // More texture
      });
    }, 0);

    // Create a "light rifle" by modifying rifle
    setTimeout(() => {
      this.audioManager.generateWeaponSound('rifle', {
        volume: 0.3,           // Quieter
        baseFrequency: 1400,   // Higher pitch
        frequencyDecay: 500,   // Higher decay
        duration: 0.08,        // Shorter
        waveType: 'square'     // Different waveform
      });
    }, 600);

    // Create a "super shotgun" by modifying shotgun
    setTimeout(() => {
      this.audioManager.generateWeaponSound('shotgun', {
        volume: 0.9,           // Much louder
        baseFrequency: 400,    // Much lower
        frequencyDecay: 80,    // Very low decay
        duration: 0.5,         // Longer
        noise: 0.8             // More noise
      });
    }, 1200);
  }

  /**
   * Rapid-fire demo to test performance
   */
  demonstrateRapidFire(): void {
    console.log('🔥 Playing rapid-fire sequence...');
    
    // Simulate machine gun burst
    for (let i = 0; i < 10; i++) {
      setTimeout(() => {
        this.audioManager.playSyntheticWeaponSound('machinegun', { 
          duration: 0.08,  // Short for rapid fire
          volume: 0.4      // Prevent overwhelming
        });
      }, i * 80); // 750 RPM simulation
    }
  }

  /**
   * Battle scenario with multiple weapon types
   */
  demonstrateBattleScenario(): void {
    console.log('⚔️ Playing battle scenario...');
    
    // Simulate a firefight
    setTimeout(() => this.audioManager.playSyntheticWeaponSound('rifle'), 0);
    setTimeout(() => this.audioManager.playSyntheticWeaponSound('rifle', { distant: true }), 200);
    setTimeout(() => this.audioManager.playSyntheticWeaponSound('pistol'), 400);
    setTimeout(() => this.audioManager.playSyntheticWeaponSound('shotgun', { muffled: true }), 600);
    setTimeout(() => this.audioManager.playSyntheticWeaponSound('smg'), 800);
    setTimeout(() => this.audioManager.playSyntheticWeaponSound('smg'), 880);
    setTimeout(() => this.audioManager.playSyntheticWeaponSound('smg'), 960);
    setTimeout(() => this.audioManager.playSyntheticWeaponSound('sniperrifle', { distant: true }), 1200);
  }
}

// Usage examples:
export function setupWeaponSoundDemos(audioManager: AudioManager): void {
  const demo = new WeaponSoundDemo(audioManager);
  
  // Add keyboard shortcuts for testing
  document.addEventListener('keydown', (event) => {
    switch (event.key) {
      case '1': demo.demonstrateBasicWeaponSounds(); break;
      case '2': demo.demonstrateVolumeVariations(); break;
      case '3': demo.demonstratePitchVariations(); break;
      case '4': demo.demonstrateEnvironmentalEffects(); break;
      case '5': demo.demonstrateDurationVariations(); break;
      case '6': demo.demonstrateCustomVariants(); break;
      case '7': demo.demonstrateRapidFire(); break;
      case '8': demo.demonstrateBattleScenario(); break;
      
      // Individual weapon tests
      case 'q': audioManager.generateWeaponSound('pistol'); break;
      case 'w': audioManager.generateWeaponSound('rifle'); break;
      case 'e': audioManager.generateWeaponSound('shotgun'); break;
      case 'r': audioManager.generateWeaponSound('machinegun'); break;
      case 't': audioManager.generateWeaponSound('sniperrifle'); break;
    }
  });
  
  console.log(`
🎵 WEAPON SOUND DEMO CONTROLS:
Press 1-8 for demonstrations:
  1: Basic weapon sounds
  2: Volume variations 
  3: Pitch variations
  4: Environmental effects
  5: Duration variations
  6: Custom variants
  7: Rapid fire
  8: Battle scenario

Press Q/W/E/R/T for individual weapons:
  Q: Pistol
  W: Rifle  
  E: Shotgun
  R: Machine gun
  T: Sniper rifle
  `);
} 
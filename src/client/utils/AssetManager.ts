export class AssetManager {
  private scene: Phaser.Scene;
  private wallVariationCache: Map<string, number> = new Map();
  
  // Scaling constants for 480x270 pixel art game
  private readonly SCALES = {
    PLAYER: 1.25,        // Scale players appropriately 
    MUZZLE_FLASH: 0.8,   // Scale down muzzle flash
    EXPLOSION: 1.5,      // Scale up explosion for impact
    WALL: 1.0,           // 10x20 → 10x20 (no scaling, sprites overhang above tiles)
    FLOOR: 0.1,          // Scale down floor texture (adjusted for better tiling)
    WEAPON_UI: 0.6,      // Scale weapons for UI display
    WEAPON_HELD: 0.8     // Scale weapons when held by players
  } as const;
  
  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.createAnimations();
  }

  // Create all sprite animations on startup
  private createAnimations(): void {
    // Create explosion animation from spritesheet
    if (!this.scene.anims.exists('explosion_anim')) {
      this.scene.anims.create({
        key: 'explosion_anim',
        frames: this.scene.anims.generateFrameNumbers('explosion', { 
          start: 0, 
          end: 16 // 17 frames = 0-16
        }),
        frameRate: 30, // Fast explosion
        repeat: 0      // Play once
      });
    }
  }

  // Create right-handed player sprites
  createPlayer(x: number, y: number, team: 'red' | 'blue'): Phaser.GameObjects.Sprite {
    const textureKey = team === 'red' ? 'player_red' : 'player_blue';
    const sprite = this.scene.add.sprite(x, y, textureKey);
    sprite.setScale(this.SCALES.PLAYER);
    
    // Ensure right-handed orientation (flip if needed)
    sprite.setFlipX(false); // Keep right-handed
    
    return sprite;
  }

  // Create wall sprites with random variation for tiling
  createWall(x: number, y: number, material: 'concrete' | 'wood'): Phaser.GameObjects.Sprite {
    const cacheKey = `${x},${y}`;
    
    // Use cached variation or generate new one
    let variation: number;
    if (this.wallVariationCache.has(cacheKey)) {
      variation = this.wallVariationCache.get(cacheKey)!;
    } else {
      variation = Math.random() > 0.5 ? 1 : 2; // Randomly choose variant 1 or 2
      this.wallVariationCache.set(cacheKey, variation);
    }
    
    // Select texture based on material and variation
    let textureKey: string;
    if (material === 'concrete') {
      textureKey = `wall_concrete_${variation}`;
    } else {
      textureKey = `wall_soft_${variation}`;
    }
    
    const sprite = this.scene.add.sprite(x, y, textureKey);
    sprite.setScale(this.SCALES.WALL); // 10x20 → 10x20 (no scaling)
    
    // Set origin to bottom-center so 10x20 sprite aligns bottom with tile bottom
    // This makes the sprite overhang ABOVE the 10x10 tile, not below
    sprite.setOrigin(0.5, 1.0);
    
    return sprite;
  }

  // Create weapon sprites for players to hold
  createWeapon(x: number, y: number, weaponType: string, facingAngle: number = 0): Phaser.GameObjects.Sprite {
    let textureKey: string;
    
    switch (weaponType) {
      case 'rifle':
        textureKey = 'weapon_rifle';
        break;
      case 'pistol':
        textureKey = 'weapon_pistol';
        break;
      case 'rocket':
        textureKey = 'weapon_rocket';
        break;
      default:
        textureKey = 'weapon_rifle'; // Default fallback
    }
    
    // Calculate shoulder offset (right side of player)
    const shoulderOffset = 8; // Distance from center to shoulder
    const shoulderAngle = facingAngle + Math.PI / 2; // 90 degrees clockwise for right side
    const shoulderX = Math.cos(shoulderAngle) * shoulderOffset;
    const shoulderY = Math.sin(shoulderAngle) * shoulderOffset;
    
    // Calculate forward offset (ahead of player)
    const forwardOffset = 6; // Distance ahead of player
    const forwardX = Math.cos(facingAngle) * forwardOffset;
    const forwardY = Math.sin(facingAngle) * forwardOffset;
    
    // Combine both offsets
    const finalX = x + shoulderX + forwardX;
    const finalY = y + shoulderY + forwardY;
    
    const weapon = this.scene.add.sprite(finalX, finalY, textureKey);
    weapon.setScale(this.SCALES.WEAPON_HELD);
    weapon.setOrigin(0.2, 0.5); // Grip point for right-handed hold
    weapon.setRotation(facingAngle + Math.PI); // Weapon flipped 180 degrees (barrel away)
    
    return weapon;
  }

  // Create floor tiles
  createFloorTile(x: number, y: number): Phaser.GameObjects.Sprite {
    const sprite = this.scene.add.sprite(x, y, 'floor_tile');
    // Don't apply automatic scaling - let the caller handle scaling
    
    return sprite;
  }

  // Show muzzle flash (for all weapons except grenade) - Fixed direction
  showMuzzleFlash(x: number, y: number, angle: number, weaponType: string): Phaser.GameObjects.Sprite | null {
    // No muzzle flash for grenades as specified
    if (weaponType === 'grenade') {
      return null;
    }
    
    const flash = this.scene.add.sprite(x, y, 'muzzle_flash');
    flash.setScale(this.SCALES.MUZZLE_FLASH);
    flash.setFlipX(true); // Flip horizontally to point in correct direction
    flash.setRotation(angle); // Point in shooting direction
    flash.setDepth(55); // Above players but below UI
    
    // Calculate position at weapon muzzle tip
    // First offset to shoulder position
    const shoulderOffset = 8; // Distance from center to shoulder
    const shoulderAngle = angle + Math.PI / 2; // 90 degrees clockwise for right side
    const shoulderX = x + Math.cos(shoulderAngle) * shoulderOffset;
    const shoulderY = y + Math.sin(shoulderAngle) * shoulderOffset;
    
    // Then add forward offset (ahead of player)
    const forwardOffset = 6; // Distance ahead of player
    const forwardX = Math.cos(angle) * forwardOffset;
    const forwardY = Math.sin(angle) * forwardOffset;
    
    // Then offset from weapon position to barrel tip
    const weaponLength = 16; // Length of weapon sprite
    const barrelX = shoulderX + forwardX + Math.cos(angle) * weaponLength;
    const barrelY = shoulderY + forwardY + Math.sin(angle) * weaponLength;
    
    flash.setPosition(barrelX, barrelY);
    
    // Auto-destroy after short time with fade
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      scale: flash.scale * 1.2, // Slight expansion
      duration: 120,
      ease: 'Power2',
      onComplete: () => flash.destroy()
    });
    
    return flash;
  }

  // Show animated explosion
  showExplosion(x: number, y: number): Phaser.GameObjects.Sprite {
    const explosion = this.scene.add.sprite(x, y, 'explosion');
    explosion.setScale(this.SCALES.EXPLOSION);
    explosion.setDepth(60); // Above everything except UI
    
    // Play the animation
    explosion.play('explosion_anim');
    
    // Destroy when animation completes
    explosion.on('animationcomplete', () => {
      explosion.destroy();
    });
    
    return explosion;
  }

  // Create weapon sprites for UI
  createWeaponIcon(x: number, y: number, weaponType: string): Phaser.GameObjects.Sprite {
    const sprite = this.scene.add.sprite(x, y, `weapon_${weaponType}`);
    sprite.setScale(this.SCALES.WEAPON_UI);
    sprite.setDepth(100); // UI layer
    
    return sprite;
  }

  // Get random wall variation for a position (consistent per position)
  getWallVariation(x: number, y: number): number {
    const cacheKey = `${x},${y}`;
    if (this.wallVariationCache.has(cacheKey)) {
      return this.wallVariationCache.get(cacheKey)!;
    }
    
    const variation = Math.random() > 0.5 ? 1 : 2;
    this.wallVariationCache.set(cacheKey, variation);
    return variation;
  }

  // Clear wall variation cache (useful for level changes)
  clearWallVariations(): void {
    this.wallVariationCache.clear();
  }

  // Get properly scaled dimensions for collision detection
  getPlayerSize(): { width: number; height: number } {
    // Assuming original sprites are roughly 16x16, scaled by PLAYER scale
    const baseSize = 16;
    const scaledSize = baseSize * this.SCALES.PLAYER;
    return { width: scaledSize, height: scaledSize };
  }

  getWallSize(): { width: number; height: number } {
    // 10x10 walls at 1:1 scale (no scaling)
    const baseSize = 10;
    const actualSize = baseSize * this.SCALES.WALL; // 10 * 1.0 = 10
    return { width: actualSize, height: actualSize };
  }
} 
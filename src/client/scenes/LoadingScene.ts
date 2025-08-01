import { GAME_CONFIG } from '../../../shared/constants/index';

export class LoadingScene extends Phaser.Scene {
  constructor() {
    super({ key: 'LoadingScene' });
  }

  preload(): void {
    // Create loading bar
    const loadingBar = this.add.graphics();
    const loadingBox = this.add.graphics();
    
    // Loading box
    loadingBox.fillStyle(0x222222);
    loadingBox.fillRect(120, 120, 240, 30);
    
    // Loading text
    this.add.text(GAME_CONFIG.GAME_WIDTH / 2, 100, 'Loading Game Assets...', {
      fontSize: '16px',
      color: '#ffffff'
    }).setOrigin(0.5);

    // Loading progress bar
    this.load.on('progress', (value: number) => {
      loadingBar.clear();
      loadingBar.fillStyle(0x00ff00);
      loadingBar.fillRect(120, 120, 240 * value, 30);
    });

    // 🎨 LOAD ALL CUSTOM ASSETS
    this.loadPlayerAssets();
    this.loadWeaponAssets();
    this.loadEffectAssets();
    this.loadEnvironmentAssets();
    
    // Complete loading and show asset summary
    this.load.on('complete', () => {
      console.log('✅ All assets loaded successfully!');
      console.log('📦 Loaded: Players, Weapons, Effects, Environment');
      this.scene.start('MenuScene');
    });
  }

  private loadPlayerAssets(): void {
    // Right-handed player sprites
    this.load.image('player_red', 'assets/redplayer.png');
    this.load.image('player_blue', 'assets/blueplayer.png');
  }

  private loadWeaponAssets(): void {
    // Current weapon sprites for UI and effects
    this.load.image('weapon_rifle', 'assets/rifle.png');
    this.load.image('weapon_pistol', 'assets/pistol.png');
    this.load.image('weapon_rocket', 'assets/rocketlauncher.png');
    
    // NEW: Primary weapon sprites
    this.load.image('weapon_smg', 'assets/smg.png');
    this.load.image('weapon_shotgun', 'assets/shotgun.png');
    this.load.image('weapon_battlerifle', 'assets/battlerifle.png');
    this.load.image('weapon_sniperrifle', 'assets/sniperrifle.png');
    
    // NEW: Secondary weapon sprites
    this.load.image('weapon_revolver', 'assets/revolver.png');
    this.load.image('weapon_suppressedpistol', 'assets/suppressedpistol.png');
    
    // NEW: Support weapon sprites
    this.load.image('weapon_machinegun', 'assets/machinegun.png');
    this.load.image('weapon_smokegrenade', 'assets/smokegrenade.png');
    this.load.image('weapon_flashbang', 'assets/flashbang.png');
    this.load.image('weapon_antimaterialrifle', 'assets/antimaterialrifle.png');
    this.load.image('weapon_grenadelauncher', 'assets/grenadelauncher.png');
    
    // Projectile sprites
    this.load.image('fraggrenade', 'assets/fraggrenade.png');
  }

  private loadEffectAssets(): void {
    // Muzzle flash sprite
    this.load.image('muzzle_flash', 'assets/muzzleflash.png');
    
    // Explosion spritesheet (24x24 frames, 17 frames vertical)
    this.load.spritesheet('explosion', 'assets/explosionsprite.png', {
      frameWidth: 24,
      frameHeight: 24
      // Phaser automatically handles vertical strips
    });
  }

  private loadEnvironmentAssets(): void {
    // Floor texture
    this.load.image('floor_tile', 'assets/mapfloor.png');
    
    // Concrete wall variants (for variation in tiling) - Now using 12x12
    this.load.image('wall_concrete_1', 'assets/10x10wall.png');
    this.load.image('wall_concrete_2', 'assets/12x12wall2.png');  // NEW 12x12 texture
    
    // Soft wall variants (wood material) - Now using 12x12
    this.load.image('wall_soft_1', 'assets/12x12woodwall1.png');  // NEW 12x12 texture
    this.load.image('wall_soft_2', 'assets/10x10woodwall2.png');
  }
} 
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
    this.load.image('player_red', 'src/assets/redplayer.png');
    this.load.image('player_blue', 'src/assets/blueplayer.png');
  }

  private loadWeaponAssets(): void {
    // Weapon sprites for UI and effects
    this.load.image('weapon_rifle', 'src/assets/rifle.png');
    this.load.image('weapon_pistol', 'src/assets/pistol.png');
    this.load.image('weapon_rocket', 'src/assets/rocketlauncher.png');
  }

  private loadEffectAssets(): void {
    // Muzzle flash sprite
    this.load.image('muzzle_flash', 'src/assets/muzzleflash.png');
    
    // Explosion spritesheet (24x24 frames, 17 frames vertical)
    this.load.spritesheet('explosion', 'src/assets/explosionsprite.png', {
      frameWidth: 24,
      frameHeight: 24
      // Phaser automatically handles vertical strips
    });
  }

  private loadEnvironmentAssets(): void {
    // Floor texture
    this.load.image('floor_tile', 'src/assets/mapfloor.png');
    
    // Concrete wall variants (for variation in tiling)
    this.load.image('wall_concrete_1', 'src/assets/10x10wall.png');
    this.load.image('wall_concrete_2', 'src/assets/10x10wall2.png');
    
    // Soft wall variants (wood material)
    this.load.image('wall_soft_1', 'src/assets/10x10woodwall1.png');
    this.load.image('wall_soft_2', 'src/assets/10x10woodwall2.png');
  }
} 
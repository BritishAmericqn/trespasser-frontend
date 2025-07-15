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
    this.add.text(GAME_CONFIG.GAME_WIDTH / 2, 100, 'Loading...', {
      fontSize: '16px',
      color: '#ffffff'
    }).setOrigin(0.5);

    // Loading progress bar
    this.load.on('progress', (value: number) => {
      loadingBar.clear();
      loadingBar.fillStyle(0x00ff00);
      loadingBar.fillRect(120, 120, 240 * value, 30);
    });

    // Start loading assets here (none for now)
    // this.load.image('player', 'assets/player.png');
    
    // Force a small delay to show the loading screen
    this.time.delayedCall(500, () => {
      this.scene.start('MenuScene');
    });
  }
} 
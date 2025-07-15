import { GAME_CONFIG } from '../../../shared/constants/index';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
  }

  create(): void {
    // Create background
    this.add.rectangle(0, 0, GAME_CONFIG.GAME_WIDTH, GAME_CONFIG.GAME_HEIGHT, 0x111111)
      .setOrigin(0, 0);

    // Title
    this.add.text(GAME_CONFIG.GAME_WIDTH / 2, 80, 'TRESPASSER', {
      fontSize: '32px',
      color: '#00ff00',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Subtitle
    this.add.text(GAME_CONFIG.GAME_WIDTH / 2, 120, 'Destructible 2D Multiplayer Shooter', {
      fontSize: '12px',
      color: '#cccccc'
    }).setOrigin(0.5);

    // Play button
    const playButton = this.add.text(GAME_CONFIG.GAME_WIDTH / 2, 180, 'PLAY', {
      fontSize: '20px',
      color: '#ffffff',
      backgroundColor: '#333333',
      padding: { x: 20, y: 10 }
    }).setOrigin(0.5);

    // Make play button interactive
    playButton.setInteractive({ useHandCursor: true });
    
    playButton.on('pointerover', () => {
      playButton.setStyle({ backgroundColor: '#555555' });
    });
    
    playButton.on('pointerout', () => {
      playButton.setStyle({ backgroundColor: '#333333' });
    });
    
    playButton.on('pointerdown', () => {
      this.scene.start('GameScene');
    });

    // Instructions
    this.add.text(GAME_CONFIG.GAME_WIDTH / 2, 220, [
      'Controls:',
      'WASD - Move',
      'Ctrl - Sneak (50% speed)',
      'Shift + W - Run (150% speed)',
      'Mouse - Aim'
    ].join('\n'), {
      fontSize: '10px',
      color: '#888888',
      align: 'center'
    }).setOrigin(0.5);
  }
} 
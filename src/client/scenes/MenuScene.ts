import { GAME_CONFIG } from '../../../shared/constants/index';

export class MenuScene extends Phaser.Scene {
  // UI elements
  private connectionContainer!: Phaser.GameObjects.Container;

  constructor() {
    super({ key: 'MenuScene' });
  }

  create(): void {
    // Create background
    this.add.rectangle(0, 0, GAME_CONFIG.GAME_WIDTH, GAME_CONFIG.GAME_HEIGHT, 0x111111)
      .setOrigin(0, 0);

    // Create main menu UI
    this.createConnectionUI();
  }



  private createConnectionUI(): void {
    // Main container
    this.connectionContainer = this.add.container(GAME_CONFIG.GAME_WIDTH / 2, GAME_CONFIG.GAME_HEIGHT / 2);

    // Title
    const title = this.add.text(0, -60, 'TRESPASSER', {
      fontSize: '28px',
      color: '#00ff00',
      fontStyle: 'bold',
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    // Subtitle
    const subtitle = this.add.text(0, -35, 'Destructible 2D Multiplayer Shooter', {
      fontSize: '12px',
      color: '#cccccc',
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    // Connect to server button
    const connectServerButton = this.add.text(0, 10, 'CONNECT TO SERVER', {
      fontSize: '14px',
      color: '#ffffff',
      backgroundColor: '#006600',
      padding: { x: 20, y: 8 },
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    connectServerButton.setInteractive({ useHandCursor: true });
    connectServerButton.on('pointerover', () => connectServerButton.setStyle({ backgroundColor: '#008800' }));
    connectServerButton.on('pointerout', () => connectServerButton.setStyle({ backgroundColor: '#006600' }));
    connectServerButton.on('pointerdown', () => {
      this.scene.start('ServerConnectionSceneText');
    });

    // Configure button
    const configureButton = this.add.text(0, 50, 'CONFIGURE LOADOUT', {
      fontSize: '14px',
      color: '#ffffff',
      backgroundColor: '#333333',
      padding: { x: 20, y: 8 },
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    configureButton.setInteractive({ useHandCursor: true });
    configureButton.on('pointerover', () => configureButton.setStyle({ backgroundColor: '#555555' }));
    configureButton.on('pointerout', () => configureButton.setStyle({ backgroundColor: '#333333' }));
    configureButton.on('pointerdown', () => {
      this.scene.start('ConfigureScene');
    });

    // Loadout status display
    const loadoutStatus = this.add.text(0, 80, '', {
      fontSize: '9px',
      color: '#888888',
      align: 'center',
      fontFamily: 'monospace'
    }).setOrigin(0.5);
    
    // Check if loadout is configured
    const savedLoadout = this.game.registry.get('playerLoadout');
    if (savedLoadout) {
      const primary = savedLoadout.primary || 'None';
      const team = savedLoadout.team || 'None';
      loadoutStatus.setText(`Configured: ${team.toUpperCase()} team, ${primary.toUpperCase()}`);
      loadoutStatus.setColor('#00aa00');
    } else {
      loadoutStatus.setText('No loadout configured');
    }

    // Add all elements to container
    this.connectionContainer.add([
      title, subtitle, connectServerButton, configureButton, loadoutStatus
    ]);

    // Instructions at bottom
    this.add.text(GAME_CONFIG.GAME_WIDTH / 2, GAME_CONFIG.GAME_HEIGHT - 10, 
      'Controls: WASD - Move, Ctrl - Sneak, Shift+W - Run, Mouse - Aim', {
      fontSize: '8px',
      color: '#888888',
      align: 'center',
      fontFamily: 'monospace'
    }).setOrigin(0.5);
  }
} 
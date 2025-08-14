import { GAME_CONFIG } from '../../../shared/constants/index';
import { NetworkSystem } from '../systems/NetworkSystem';
import NetworkSystemSingleton from '../systems/NetworkSystemSingleton';

export class MatchmakingScene extends Phaser.Scene {
  private networkSystem!: NetworkSystem;
  
  // UI Elements
  private statusText!: Phaser.GameObjects.Text;
  private dotsText!: Phaser.GameObjects.Text;
  private cancelButton!: Phaser.GameObjects.Text;
  private tipsText!: Phaser.GameObjects.Text;
  
  // Animation state
  private dotCount: number = 0;
  private dotTimer!: Phaser.Time.TimerEvent;
  
  // Scene data
  private gameMode: string = 'deathmatch';

  constructor() {
    super({ key: 'MatchmakingScene' });
  }

  init(data: any): void {
    this.gameMode = data.gameMode || 'deathmatch';
  }

  create(): void {
    // Create dark background
    this.add.rectangle(0, 0, GAME_CONFIG.GAME_WIDTH, GAME_CONFIG.GAME_HEIGHT, 0x111111)
      .setOrigin(0, 0);

    // Get NetworkSystem singleton
    this.networkSystem = NetworkSystemSingleton.getInstance(this);
    
    // Setup network event listeners
    this.setupNetworkListeners();
    
    // Create the UI
    this.createUI();
    
    // Start loading animation
    this.startLoadingAnimation();
  }

  private setupNetworkListeners(): void {
    // Lobby events
    this.networkSystem.getSocket()?.on('lobby_joined', (data: any) => {
      console.log('🏢 Lobby joined from matchmaking:', data);
      this.stopLoadingAnimation();
      this.scene.start('LobbyWaitingScene', { lobbyData: data });
    });
    
    this.networkSystem.getSocket()?.on('matchmaking_failed', (data: any) => {
      console.error('❌ Matchmaking failed:', data.reason);
      this.stopLoadingAnimation();
      this.scene.start('LobbyMenuScene');
      // Error will be shown by LobbyMenuScene
    });
    
    // Handle disconnection
    this.networkSystem.getSocket()?.on('disconnect', () => {
      this.stopLoadingAnimation();
      this.scene.start('LobbyMenuScene');
    });
  }

  private createUI(): void {
    // Title
    const title = this.add.text(GAME_CONFIG.GAME_WIDTH / 2, 40, 'FINDING MATCH', {
      fontSize: '24px',
      color: '#00ff00',
      fontStyle: 'bold',
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    // Game mode display
    const modeText = this.add.text(GAME_CONFIG.GAME_WIDTH / 2, 70, `Game Mode: ${this.gameMode.toUpperCase()}`, {
      fontSize: '12px',
      color: '#cccccc',
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    // Status container with border (match your style)
    const statusContainer = this.add.graphics();
    statusContainer.lineStyle(1, 0x444444);
    statusContainer.strokeRect(
      GAME_CONFIG.GAME_WIDTH / 2 - 120, 
      GAME_CONFIG.GAME_HEIGHT / 2 - 40, 
      240, 
      80
    );

    // Main status text
    this.statusText = this.add.text(GAME_CONFIG.GAME_WIDTH / 2, GAME_CONFIG.GAME_HEIGHT / 2 - 20, 'Searching for available lobby', {
      fontSize: '14px',
      color: '#ffffff',
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    // Animated dots
    this.dotsText = this.add.text(GAME_CONFIG.GAME_WIDTH / 2, GAME_CONFIG.GAME_HEIGHT / 2, '', {
      fontSize: '16px',
      color: '#ffaa00',
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    // Pro tips section (match your existing style)
    const tipsTitle = this.add.text(GAME_CONFIG.GAME_WIDTH / 2, GAME_CONFIG.GAME_HEIGHT / 2 + 40, 'PRO TIPS:', {
      fontSize: '12px',
      color: '#00ff00',
      fontStyle: 'bold',
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    this.tipsText = this.add.text(GAME_CONFIG.GAME_WIDTH / 2, GAME_CONFIG.GAME_HEIGHT / 2 + 60, 
      '• Use destructible walls to create new sightlines\n' +
      '• Coordinate with your team for maximum effectiveness\n' +
      '• First team to 50 kills wins the match!', {
      fontSize: '9px',
      color: '#888888',
      align: 'center',
      fontFamily: 'monospace',
      lineSpacing: 2
    }).setOrigin(0.5);

    // Cancel button with fixed-width background
    const buttonWidth = 200;
    const buttonHeight = 20;
    
    const cancelBg = this.add.graphics();
    cancelBg.fillStyle(0x666666);
    cancelBg.fillRect(
      GAME_CONFIG.GAME_WIDTH / 2 - buttonWidth/2, 
      GAME_CONFIG.GAME_HEIGHT - 30 - buttonHeight/2, 
      buttonWidth, 
      buttonHeight
    );
    
    // 🧪 TEST FORCE MATCH BUTTON (for development/testing)
    const testMatchButton = this.add.text(GAME_CONFIG.GAME_WIDTH / 2 - 80, GAME_CONFIG.GAME_HEIGHT - 30, '🧪 FORCE MATCH', {
      fontSize: '10px',
      color: '#ffffff',
      backgroundColor: '#ff6600',
      padding: { x: 10, y: 4 },
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    this.setupButton(testMatchButton, '#ff6600', '#ff8833', () => this.forceCreateMatch());

    this.cancelButton = this.add.text(GAME_CONFIG.GAME_WIDTH / 2 + 80, GAME_CONFIG.GAME_HEIGHT - 30, 'CANCEL', {
      fontSize: '12px',
      color: '#ffffff',
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    this.setupButton(this.cancelButton, '#666666', '#888888', () => this.cancelMatchmaking());

    // Instructions at bottom
    this.add.text(GAME_CONFIG.GAME_WIDTH / 2, GAME_CONFIG.GAME_HEIGHT - 10, 
      'Average wait time: < 30 seconds', {
      fontSize: '8px',
      color: '#666666',
      fontFamily: 'monospace'
    }).setOrigin(0.5);
  }

  private setupButton(button: Phaser.GameObjects.Text, normalColor: string, hoverColor: string, callback: () => void): void {
    button.setInteractive({ useHandCursor: true });
    
    button.on('pointerover', () => {
      button.setStyle({ backgroundColor: hoverColor });
    });
    
    button.on('pointerout', () => {
      button.setStyle({ backgroundColor: normalColor });
    });
    
    button.on('pointerdown', callback);
  }

  private startLoadingAnimation(): void {
    // Animated dots (like your terminal aesthetic)
    this.dotTimer = this.time.addEvent({
      delay: 500,
      callback: () => {
        this.dotCount = (this.dotCount + 1) % 4;
        this.dotsText.setText('.'.repeat(this.dotCount));
      },
      loop: true
    });

    // Cycle through different status messages
    const statusMessages = [
      'Searching for available lobby',
      'Looking for players',
      'Checking server capacity',
      'Preparing match environment'
    ];

    let messageIndex = 0;
    this.time.addEvent({
      delay: 2000,
      callback: () => {
        messageIndex = (messageIndex + 1) % statusMessages.length;
        this.statusText.setText(statusMessages[messageIndex]);
      },
      loop: true
    });

    // Add subtle pulsing animation to title
    this.tweens.add({
      targets: this.statusText,
      alpha: 0.7,
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  private stopLoadingAnimation(): void {
    if (this.dotTimer) {
      this.dotTimer.destroy();
    }
    
    // Stop all tweens
    this.tweens.killAll();
  }

  private cancelMatchmaking(): void {
    console.log('❌ Canceling matchmaking...');
    
    // Emit cancel event if backend supports it
    const socket = this.networkSystem.getSocket();
    if (socket) {
      socket.emit('cancel_matchmaking');
    }
    
    this.stopLoadingAnimation();
    this.scene.start('LobbyMenuScene');
  }

  // 🧪 FORCE CREATE MATCH (for development/testing)
  private forceCreateMatch(): void {
    console.log('🧪 TEST: Force creating match...');
    
    const socket = this.networkSystem.getSocket();
    if (socket) {
      // Try multiple approaches to force a match
      socket.emit('admin:force_create_match', { 
        gameMode: this.gameMode,
        reason: 'test_force_match_button'
      });
      
      // Also try the standard create private lobby (which might work better)
      socket.emit('create_private_lobby', {
        gameMode: this.gameMode,
        password: '', // No password
        maxPlayers: 1, // Allow single player for testing
        forceStart: true
      });
      
      // Show feedback to user
      this.statusText.setText('🧪 Force creating test match...');
    } else {
      console.error('❌ No socket connection for force create match');
    }
  }

  shutdown(): void {
    this.stopLoadingAnimation();
    
    // Clean up network listeners
    const socket = this.networkSystem.getSocket();
    if (socket) {
      socket.off('lobby_joined');
      socket.off('matchmaking_failed');
      socket.off('disconnect');
    }
  }
}

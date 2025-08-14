import { GAME_CONFIG } from '../../../shared/constants/index';
import { NetworkSystem } from '../systems/NetworkSystem';
import NetworkSystemSingleton from '../systems/NetworkSystemSingleton';

interface LobbyData {
  lobbyId: string;
  playerCount: number;
  maxPlayers: number;
  gameMode: string;
  inviteCode?: string;
}

export class LobbyWaitingScene extends Phaser.Scene {
  private networkSystem!: NetworkSystem;
  
  // UI Elements
  private lobbyContainer!: Phaser.GameObjects.Container;
  private playerCountText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private countdownText!: Phaser.GameObjects.Text;
  private leaveLobbyButton!: Phaser.GameObjects.Text;
  private inviteCodeText!: Phaser.GameObjects.Text;
  
  // State
  private lobbyData!: LobbyData;
  private isPrivate: boolean = false;
  private countdown: number | null = null;
  private countdownTimer!: Phaser.Time.TimerEvent;

  constructor() {
    super({ key: 'LobbyWaitingScene' });
  }

  init(data: any): void {
    this.lobbyData = data.lobbyData;
    this.isPrivate = data.isPrivate || false;
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
    
    // Initialize with current lobby data
    this.updatePlayerCount();
    
    console.log('🏢 Lobby waiting scene created for:', this.lobbyData);
  }

  private setupNetworkListeners(): void {
    const socket = this.networkSystem.getSocket();
    if (!socket) return;

    // Player joined lobby (update count)
    socket.on('lobby_joined', (data: any) => {
      console.log('🏢 Player joined lobby:', data);
      this.lobbyData.playerCount = data.playerCount;
      this.updatePlayerCount();
    });

    // Player left lobby (update count)
    socket.on('player_left_lobby', (data: any) => {
      console.log('👋 Player left lobby:', data);
      this.lobbyData.playerCount = data.playerCount;
      this.updatePlayerCount();
    });

    // Match starting countdown
    socket.on('match_starting', (data: any) => {
      console.log('⏱️ Match starting countdown:', data.countdown);
      this.countdown = data.countdown;
      this.startCountdown();
    });

    // Match started - go to game
    socket.on('match_started', (data: any) => {
      console.log('🚀 Match started:', data);
      this.stopCountdown();
      this.scene.start('GameScene', { matchData: data });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log('❌ Disconnected from lobby');
      this.scene.start('LobbyMenuScene');
    });

    // Error handling
    socket.on('lobby_error', (data: any) => {
      console.error('🚨 Lobby error:', data);
      this.scene.start('LobbyMenuScene');
    });
  }

  private createUI(): void {
    // Title
    const title = this.add.text(GAME_CONFIG.GAME_WIDTH / 2, 30, 'LOBBY WAITING ROOM', {
      fontSize: '20px',
      color: '#00ff00',
      fontStyle: 'bold',
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    // Main container
    this.lobbyContainer = this.add.container(GAME_CONFIG.GAME_WIDTH / 2, GAME_CONFIG.GAME_HEIGHT / 2);

    // Lobby info box (match your terminal aesthetic)
    const lobbyBorder = this.add.graphics();
    lobbyBorder.lineStyle(2, 0x444444);
    lobbyBorder.fillStyle(0x1a1a1a);
    lobbyBorder.fillRect(-150, -60, 300, 120);
    lobbyBorder.strokeRect(-150, -60, 300, 120);

    // Lobby ID display
    const lobbyIdText = this.add.text(0, -40, `Lobby ID: ${this.lobbyData.lobbyId}`, {
      fontSize: '10px',
      color: '#cccccc',
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    // Game mode
    const gameMode = this.lobbyData.gameMode || 'deathmatch';
    const gameModeText = this.add.text(0, -25, `Game Mode: ${gameMode.toUpperCase()}`, {
      fontSize: '12px',
      color: '#ffffff',
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    // Player count (main display)
    this.playerCountText = this.add.text(0, -5, '', {
      fontSize: '16px',
      color: '#00ff00',
      fontStyle: 'bold',
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    // Status text
    this.statusText = this.add.text(0, 15, '', {
      fontSize: '11px',
      color: '#ffaa00',
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    // Countdown text (hidden initially)
    this.countdownText = this.add.text(0, 35, '', {
      fontSize: '14px',
      color: '#ff4444',
      fontStyle: 'bold',
      fontFamily: 'monospace'
    }).setOrigin(0.5);
    this.countdownText.setVisible(false);

    // Add to container
    this.lobbyContainer.add([
      lobbyBorder, lobbyIdText, gameModeText, 
      this.playerCountText, this.statusText, this.countdownText
    ]);

    // Private lobby invite code (if applicable)
    if (this.isPrivate && this.lobbyData.inviteCode) {
      this.inviteCodeText = this.add.text(GAME_CONFIG.GAME_WIDTH / 2, GAME_CONFIG.GAME_HEIGHT / 2 + 80, 
        `Share this code with friends: ${this.lobbyData.inviteCode}`, {
        fontSize: '9px',
        color: '#00aa00',
        backgroundColor: '#003300',
        padding: { x: 10, y: 4 },
        fontFamily: 'monospace'
      }).setOrigin(0.5);
    }

    // Leave lobby button with fixed-width background
    const buttonWidth = 200;
    const buttonHeight = 20;
    
    const leaveBg = this.add.graphics();
    leaveBg.fillStyle(0x666666);
    leaveBg.fillRect(
      GAME_CONFIG.GAME_WIDTH / 2 - buttonWidth/2,
      GAME_CONFIG.GAME_HEIGHT - 30 - buttonHeight/2,
      buttonWidth,
      buttonHeight
    );
    
    // 🧪 TEST START BUTTON (for development/testing)
    const testStartButton = this.add.text(GAME_CONFIG.GAME_WIDTH / 2 - 80, GAME_CONFIG.GAME_HEIGHT - 30, '🧪 TEST START', {
      fontSize: '10px',
      color: '#ffffff',
      backgroundColor: '#ff6600',
      padding: { x: 10, y: 4 },
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    this.setupButton(testStartButton, '#ff6600', '#ff8833', () => this.testStartMatch());

    this.leaveLobbyButton = this.add.text(GAME_CONFIG.GAME_WIDTH / 2 + 80, GAME_CONFIG.GAME_HEIGHT - 30, 'LEAVE', {
      fontSize: '12px',
      color: '#ffffff',
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    this.setupButton(this.leaveLobbyButton, '#666666', '#888888', () => this.leaveLobby());

    // Tips section (match your style)
    const tipsText = this.add.text(GAME_CONFIG.GAME_WIDTH / 2, GAME_CONFIG.GAME_HEIGHT - 10, 
      'Match starts automatically when enough players join • First to 50 kills wins', {
      fontSize: '8px',
      color: '#666666',
      align: 'center',
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    // Initial update
    this.updatePlayerCount();
  }

  private setupButton(button: Phaser.GameObjects.Text, normalColor: string, hoverColor: string, callback: () => void): void {
    button.setInteractive({ useHandCursor: true });
    
    button.on('pointerover', () => {
      button.setStyle({ backgroundColor: hoverColor });
      this.tweens.add({
        targets: button,
        scaleX: 1.02,
        scaleY: 1.02,
        duration: 100,
        ease: 'Power2'
      });
    });
    
    button.on('pointerout', () => {
      button.setStyle({ backgroundColor: normalColor });
      this.tweens.add({
        targets: button,
        scaleX: 1,
        scaleY: 1,
        duration: 100,
        ease: 'Power2'
      });
    });
    
    button.on('pointerdown', () => {
      this.tweens.add({
        targets: button,
        scaleX: 0.98,
        scaleY: 0.98,
        duration: 50,
        yoyo: true,
        ease: 'Power2',
        onComplete: callback
      });
    });
  }

  private updatePlayerCount(): void {
    // Safe property access with defaults
    const playerCount = this.lobbyData.playerCount || 0;
    const maxPlayers = this.lobbyData.maxPlayers || 8;
    
    // Check if UI elements exist before using them
    if (this.playerCountText) {
      this.playerCountText.setText(`Players: ${playerCount}/${maxPlayers}`);
    } else {
      console.warn('playerCountText not initialized yet');
    }
    
    // Update status based on player count
    if (this.statusText) {
      if (playerCount >= 2) {
        this.statusText.setText('Ready to start! Waiting for match begin...');
        this.statusText.setColor('#00ff00');
      
        // Add pulsing animation when ready
        this.tweens.add({
          targets: this.statusText,
          alpha: 0.7,
          duration: 1000,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        });
      } else {
        this.statusText.setText('Waiting for more players to join...');
        this.statusText.setColor('#ffaa00');
      
        // Stop pulsing if not enough players
        this.tweens.killTweensOf(this.statusText);
        this.statusText.setAlpha(1);
      }
    } else {
      console.warn('statusText not initialized yet');
    }

    // Color-code player count
    if (this.playerCountText) {
      if (playerCount >= 2) {
        this.playerCountText.setColor('#00ff00'); // Green when ready
      } else {
        this.playerCountText.setColor('#ffaa00'); // Yellow when waiting
      }
    }
  }

  private startCountdown(): void {
    if (this.countdown === null) return;

    this.countdownText.setVisible(true);
    this.statusText.setText('MATCH STARTING');
    
    // Stop existing countdown if any
    this.stopCountdown();
    
    // Update countdown display immediately
    this.updateCountdownDisplay();
    
    // Start countdown timer
    this.countdownTimer = this.time.addEvent({
      delay: 1000,
      callback: () => {
        if (this.countdown !== null && this.countdown > 0) {
          this.countdown--;
          this.updateCountdownDisplay();
        } else {
          this.stopCountdown();
        }
      },
      loop: true
    });
  }

  private updateCountdownDisplay(): void {
    if (this.countdown !== null) {
      this.countdownText.setText(`Starting in ${this.countdown}s...`);
      
      // Flash effect for last 3 seconds
      if (this.countdown <= 3) {
        this.tweens.add({
          targets: this.countdownText,
          scaleX: 1.2,
          scaleY: 1.2,
          duration: 200,
          yoyo: true,
          ease: 'Power2'
        });
      }
    }
  }

  private stopCountdown(): void {
    if (this.countdownTimer) {
      this.countdownTimer.destroy();
    }
    this.tweens.killTweensOf(this.countdownText);
    this.countdownText.setVisible(false);
  }

  private leaveLobby(): void {
    console.log('👋 Leaving lobby...');
    
    const socket = this.networkSystem.getSocket();
    if (socket) {
      socket.emit('leave_lobby');
    }
    
    this.stopCountdown();
    this.scene.start('LobbyMenuScene');
  }

  // 🧪 TEST START MATCH (for development/testing)
  private testStartMatch(): void {
    console.log('🧪 TEST: Force starting match...');
    
    const socket = this.networkSystem.getSocket();
    if (socket) {
      // Emit test start event to backend
      socket.emit('admin:force_start_match', { 
        lobbyId: this.lobbyData.lobbyId,
        reason: 'test_button_pressed'
      });
      
      // Show feedback to user
      this.statusText.setText('🧪 Test start requested...');
      this.statusText.setColor('#ff6600');
    } else {
      console.error('❌ No socket connection for test start');
    }
  }

  shutdown(): void {
    this.stopCountdown();
    
    // Clean up network listeners
    const socket = this.networkSystem.getSocket();
    if (socket) {
      socket.off('lobby_joined');
      socket.off('player_left_lobby');
      socket.off('match_starting');
      socket.off('match_started');
      socket.off('disconnect');
      socket.off('lobby_error');
    }
    
    // Clean up tweens
    this.tweens.killAll();
  }
}

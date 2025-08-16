import { GAME_CONFIG } from '../../../shared/constants/index';
import { NetworkSystem } from '../systems/NetworkSystem';
import NetworkSystemSingleton from '../systems/NetworkSystemSingleton';
import { LobbyStateManager, LobbyState } from '../systems/LobbyStateManager';
import { DebugOverlay } from '../ui/DebugOverlay';

export class MatchmakingScene extends Phaser.Scene {
  private networkSystem!: NetworkSystem;
  
  // UI Elements
  private statusText!: Phaser.GameObjects.Text;
  private debugOverlay?: DebugOverlay;
  private dotsText!: Phaser.GameObjects.Text;
  private cancelButton!: Phaser.GameObjects.Text;
  private tipsText!: Phaser.GameObjects.Text;
  
  // Animation state
  private dotCount: number = 0;
  private dotTimer!: Phaser.Time.TimerEvent;
  
  // Scene data
  private gameMode: string = 'deathmatch';
  private instantPlay: boolean = false;
  private playerCount: number = 1;
  private maxPlayers: number = 8;
  private lobbyId: string | null = null;
  
  // State management
  private lobbyStateManager!: LobbyStateManager;
  private stateUnsubscribe?: () => void;

  constructor() {
    super({ key: 'MatchmakingScene' });
  }

  init(data: any): void {
    this.gameMode = data.gameMode || 'deathmatch';
    this.instantPlay = data.instantPlay || false;
    this.playerCount = 1;
    this.maxPlayers = 8;
    this.lobbyId = null;
  }

  create(): void {
    // Create dark background
    this.add.rectangle(0, 0, GAME_CONFIG.GAME_WIDTH, GAME_CONFIG.GAME_HEIGHT, 0x111111)
      .setOrigin(0, 0);

    // Get NetworkSystem singleton
    this.networkSystem = NetworkSystemSingleton.getInstance(this);
    
    // Initialize LobbyStateManager
    this.lobbyStateManager = LobbyStateManager.getInstance();
    const socket = this.networkSystem.getSocket();
    if (socket) {
      this.lobbyStateManager.initialize(socket);
    }
    
    // Subscribe to lobby state changes
    this.stateUnsubscribe = this.lobbyStateManager.subscribe((state) => {
      this.handleLobbyStateChange(state);
    });
    
    // Setup network event listeners
    this.setupNetworkListeners();
    
    // Create the UI
    this.createUI();
    
    // Start loading animation
    this.startLoadingAnimation();
    
    // Create debug overlay (press F9 to toggle)
    this.debugOverlay = new DebugOverlay(this);
    console.log('🔍 Press F9 to toggle debug overlay');
    
    // Don't add game:state listeners - NetworkSystem handles that
  }

  private setupNetworkListeners(): void {
    const socket = this.networkSystem.getSocket();
    if (!socket) return;
    
    // Lobby events
    socket.on('lobby_joined', (data: any) => {
      console.log('🏢 Lobby joined from matchmaking:', data);
      this.lobbyId = data.lobbyId;
      this.playerCount = data.playerCount || 1;
      this.maxPlayers = data.maxPlayers || 8;
      
      // Check if this is instant play mode or normal matchmaking
      if (!this.instantPlay) {
        // ALWAYS go to loadout configuration for normal matchmaking - no exceptions!
        console.log(`📝 ALL players get loadout configuration - going to LobbyWaitingScene (status: ${data.status})`);
        this.stopLoadingAnimation();
        this.scene.start('LobbyWaitingScene', { lobbyData: data });
        return;
      }
      
      if (this.instantPlay) {
        // Update player count display for instant play
        this.updatePlayerCount();
        
        // Don't stop loading animation yet, wait for more players
        this.statusText.setText('Waiting for players...');
        
        // If we have 2+ players, backend will handle auto-start
        if (this.playerCount >= 2) {
          console.log('✅ Enough players for match - waiting for backend to start');
          this.statusText.setText('Ready! Match will start soon...');
          this.statusText.setColor('#00ff00');
        }
      } else {
        // For instant play that somehow missed the condition above
        // ALWAYS go to loadout configuration - no exceptions!
        console.log(`📝 Instant play fallback: ALL players get loadout configuration`);
        this.stopLoadingAnimation();
        this.scene.start('LobbyWaitingScene', { lobbyData: data });
      }
    });
    
    // Player joined/left updates (for instant play mode)
    socket.on('player_joined_lobby', (data: any) => {
      if (this.instantPlay && data.lobbyId === this.lobbyId) {
        this.playerCount = data.playerCount;
        this.updatePlayerCount();
        
        // If we now have 2+ players, backend will handle auto-start
        if (this.playerCount >= 2) {
          console.log('✅ Player joined, now have enough players - backend will start match');
          this.statusText.setText('Ready! Match will start soon...');
          this.statusText.setColor('#00ff00');
        }
      }
    });
    
    socket.on('player_left_lobby', (data: any) => {
      if (this.instantPlay && data.lobbyId === this.lobbyId) {
        this.playerCount = data.playerCount;
        this.updatePlayerCount();
      }
    });
    
    // Note: match_started is now handled by LobbyEventCoordinator
    
    // Don't listen for game:state here - NetworkSystem handles it
    // If we need to know about game state, we should listen to Phaser events instead
    
    // Match starting countdown
    socket.on('match_starting', (data: any) => {
      console.log('⏱️ Match starting soon:', data);
      // Update status to show match is about to start
      this.statusText.setText(`Match starting in ${data.countdown}s...`);
    });
    
    socket.on('matchmaking_failed', (data: any) => {
      console.error('❌ Matchmaking failed:', data.reason);
      this.stopLoadingAnimation();
      this.scene.start('LobbyMenuScene');
      // Error will be shown by LobbyMenuScene
    });
    
    // Handle disconnection
    socket.on('disconnect', () => {
      this.stopLoadingAnimation();
      this.scene.start('LobbyMenuScene');
    });
  }
  
  private updatePlayerCount(): void {
    // Safety check: Don't update if scene is not active
    if (!this.scene || !this.scene.isActive()) {
      return;
    }
    
    // Find and update the player count text
    const playerCountText = this.children?.list?.find((child: any) => 
      child && child.getData && child.getData('playerCountText')
    ) as Phaser.GameObjects.Text;
    
    if (playerCountText && playerCountText.scene) {
      playerCountText.setText(`${this.playerCount}/${this.maxPlayers} Players`);
      
      // Color based on player count
      if (this.playerCount >= 2) {
        playerCountText.setColor('#00ff00');
      } else {
        playerCountText.setColor('#ffaa00');
      }
    }
  }
  
  /**
   * Handle lobby state changes from LobbyStateManager
   */
  private handleLobbyStateChange(state: LobbyState | null): void {
    // Safety check: Don't update if scene is not active
    if (!this.scene || !this.scene.isActive()) {
      console.log('⚠️ MatchmakingScene not active, ignoring state change');
      return;
    }
    
    if (!state) {
      console.log('📊 No lobby state');
      return;
    }
    
    // Only log significant state changes
    if (state.status === 'starting' || state.playerCount !== this.playerCount) {
      console.log('📊 Lobby state change:', state.playerCount, '/', state.maxPlayers, '-', state.status);
    }
    
    // Update local state from authoritative source
    this.playerCount = state.playerCount;
    this.maxPlayers = state.maxPlayers;
    this.lobbyId = state.lobbyId;
    
    // Update UI only if scene is still active
    if (this.scene.isActive()) {
      this.updatePlayerCount();
    }
    
    // Handle status changes
    if (state.status === 'starting' && state.countdown) {
      if (this.statusText && this.scene.isActive()) {
        this.statusText.setText(`Match starting in ${state.countdown}s...`);
        this.statusText.setColor('#ff4444');
      }
    } else if (state.playerCount >= 2) {
      if (this.statusText && this.statusText.scene && this.scene.isActive()) {
        this.statusText.setText('Ready! Match will start soon...');
        this.statusText.setColor('#00ff00');
      }
    } else {
      if (this.statusText && this.statusText.scene && this.scene.isActive()) {
        this.statusText.setText('Waiting for players...');
        this.statusText.setColor('#ffaa00');
      }
    }
  }

  private createUI(): void {
    // Title changes based on mode
    const titleText = this.instantPlay ? 'JOINING MATCH' : 'FINDING MATCH';
    const title = this.add.text(GAME_CONFIG.GAME_WIDTH / 2, 40, titleText, {
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
    
    // Player count display (for instant play)
    const playerCountText = this.add.text(GAME_CONFIG.GAME_WIDTH / 2, GAME_CONFIG.GAME_HEIGHT / 2, 
      this.instantPlay ? '1/8 Players' : '', {
      fontSize: '18px',
      color: '#ffaa00',
      fontStyle: 'bold',
      fontFamily: 'monospace'
    }).setOrigin(0.5);
    playerCountText.setData('playerCountText', true);
    
    // Show player count only in instant play mode
    if (!this.instantPlay) {
      playerCountText.setVisible(false);
    }

    // Animated dots (shown when not in instant play)
    this.dotsText = this.add.text(GAME_CONFIG.GAME_WIDTH / 2, GAME_CONFIG.GAME_HEIGHT / 2 + 20, '', {
      fontSize: '16px',
      color: '#ffaa00',
      fontFamily: 'monospace'
    }).setOrigin(0.5);
    
    // Hide dots in instant play mode
    if (this.instantPlay) {
      this.dotsText.setVisible(false);
    }

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
    if (this.instantPlay) {
      // For instant play, just show waiting for players
      this.statusText.setText('Waiting for players...');
      this.updatePlayerCount();
      
      // Simple pulsing for player count
      const playerCountText = this.children.list.find((child: any) => 
        child.getData && child.getData('playerCountText')
      );
      
      if (playerCountText) {
        this.tweens.add({
          targets: playerCountText,
          scaleX: 1.05,
          scaleY: 1.05,
          duration: 1000,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        });
      }
    } else {
      // Normal matchmaking animation
      // Animated dots
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
    
    // Unsubscribe from state changes
    if (this.stateUnsubscribe) {
      this.stateUnsubscribe();
      this.stateUnsubscribe = undefined;
    }
    
    // Clean up debug overlay
    if (this.debugOverlay) {
      this.debugOverlay.destroy();
      this.debugOverlay = undefined;
    }
    
    // Clean up network listeners
    const socket = this.networkSystem.getSocket();
    if (socket) {
      socket.off('lobby_joined');
      socket.off('player_joined_lobby');
      socket.off('player_left_lobby');
      socket.off('match_starting');
      // Note: match_started handled by LobbyEventCoordinator
      // Don't remove game:state - that's owned by NetworkSystem
      socket.off('matchmaking_failed');
      socket.off('disconnect');
    }
  }
}

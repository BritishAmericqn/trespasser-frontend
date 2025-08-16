import { GAME_CONFIG } from '../../../shared/constants/index';
import { NetworkSystem } from '../systems/NetworkSystem';
import NetworkSystemSingleton from '../systems/NetworkSystemSingleton';
import { LobbyStateManager, LobbyState } from '../systems/LobbyStateManager';
import { SceneManager } from '../utils/SceneManager';
import { SceneDebugger } from '../systems/SceneDebugger';
import { DebugOverlay } from '../ui/DebugOverlay';
import LobbyEventCoordinator from '../systems/LobbyEventCoordinator';

interface LobbyData {
  lobbyId: string;
  playerCount: number;
  maxPlayers: number;
  gameMode: string;
  inviteCode?: string;
  status?: 'waiting' | 'playing' | 'finished';
  isInProgress?: boolean;
  killTarget?: number;
}

export class LobbyWaitingScene extends Phaser.Scene {
  private networkSystem!: NetworkSystem;
  private debugOverlay?: DebugOverlay;
  
  // UI Elements
  private lobbyContainer!: Phaser.GameObjects.Container;
  private playerCountText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private countdownText!: Phaser.GameObjects.Text;
  private leaveLobbyButton!: Phaser.GameObjects.Text;
  private inviteCodeText!: Phaser.GameObjects.Text;
  private lobbyIdText!: Phaser.GameObjects.Text;
  private copyNotification!: Phaser.GameObjects.Text;
  
  // State
  private lobbyData!: LobbyData;
  private isPrivate: boolean = false;
  private countdown: number | null = null;
  private countdownTimer!: Phaser.Time.TimerEvent;
  
  // State management
  private lobbyStateManager?: LobbyStateManager;
  private stateUnsubscribe?: () => void;

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

    // Force cleanup any conflicting scenes (prevents multiple scene issues)
    const sceneDebugger = new SceneDebugger(this);
    sceneDebugger.forceCleanup();

    // Get NetworkSystem singleton
    this.networkSystem = NetworkSystemSingleton.getInstance(this);
    
    // IMMEDIATELY register with LobbyEventCoordinator to intercept match_started events
    const coordinator = LobbyEventCoordinator.getInstance();
    coordinator.registerActiveScene(this);
    console.log('🎭 LobbyWaitingScene: Early registration with coordinator complete');
    
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
    
    // Check if the lobby is already playing - if so, go directly to game
    if (this.lobbyData.status === 'playing' || this.lobbyData.isInProgress) {
      console.log('🎮 Lobby is already playing, transitioning directly to GameScene');
      SceneManager.transition(this, 'GameScene', { 
        matchData: {
          lobbyId: this.lobbyData.lobbyId,
          isLateJoin: true,
          killTarget: this.lobbyData.killTarget || 50,
          gameMode: this.lobbyData.gameMode || 'deathmatch'
        }
      });
      return; // Don't setup the waiting room
    }
    
    // Setup network event listeners
    this.setupNetworkListeners();
    
    // Create the UI
    this.createUI();
    
    // Initialize with current lobby data
    this.updatePlayerCount();
    
    // Create debug overlay (press F9 to toggle)
    this.debugOverlay = new DebugOverlay(this);
    console.log('🔍 Press F9 to toggle debug overlay');
    
    // Already registered with LobbyEventCoordinator early in create()
    
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

    // Note: match_started is now handled by LobbyEventCoordinator
    // This scene only needs to handle other lobby events
    
    // Don't listen for game:state here - NetworkSystem handles it

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log('❌ Disconnected from lobby');
      SceneManager.transition(this, 'LobbyMenuScene');
    });

    // Error handling
    socket.on('lobby_error', (data: any) => {
      console.error('🚨 Lobby error:', data);
      SceneManager.transition(this, 'LobbyMenuScene');
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

    // Lobby ID display - make it clickable to copy
    this.lobbyIdText = this.add.text(0, -40, `Lobby ID: ${this.lobbyData.lobbyId}`, {
      fontSize: '10px',
      color: '#cccccc',
      fontFamily: 'monospace'
    }).setOrigin(0.5);
    
    // Make lobby ID interactive for copying
    this.lobbyIdText.setInteractive({ useHandCursor: true });
    this.setupCopyInteraction(this.lobbyIdText, this.lobbyData.lobbyId, 'Lobby ID');

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
      lobbyBorder, this.lobbyIdText, gameModeText, 
      this.playerCountText, this.statusText, this.countdownText
    ]);

    // Private lobby invite code (if applicable)
    if (this.isPrivate && this.lobbyData.inviteCode) {
      // "INVITE CODE" label
      const inviteLabel = this.add.text(GAME_CONFIG.GAME_WIDTH / 2, GAME_CONFIG.GAME_HEIGHT / 2 - 30, 
        'INVITE CODE', {
        fontSize: '10px',
        color: '#888888',
        fontFamily: 'monospace'
      }).setOrigin(0.5);
      
      // Large, prominent invite code display
      this.inviteCodeText = this.add.text(GAME_CONFIG.GAME_WIDTH / 2, GAME_CONFIG.GAME_HEIGHT / 2 - 10, 
        this.lobbyData.inviteCode, {
        fontSize: '16px',
        color: '#00ff00',
        backgroundColor: '#004400',
        padding: { x: 15, y: 8 },
        fontFamily: 'monospace'
      }).setOrigin(0.5);
      
      // "Click to copy" hint
      const copyHint = this.add.text(GAME_CONFIG.GAME_WIDTH / 2, GAME_CONFIG.GAME_HEIGHT / 2 + 15, 
        '[CLICK TO COPY]', {
        fontSize: '9px',
        color: '#ffff00',
        fontFamily: 'monospace'
      }).setOrigin(0.5);
      
      // Instructions for friends
      const instructions = this.add.text(GAME_CONFIG.GAME_WIDTH / 2, GAME_CONFIG.GAME_HEIGHT / 2 + 45, 
        'Friends can join using "JOIN BY CODE" button', {
        fontSize: '8px',
        color: '#888888',
        fontFamily: 'monospace',
        align: 'center'
      }).setOrigin(0.5);
      
      // Make invite code interactive for copying
      this.inviteCodeText.setInteractive({ useHandCursor: true });
      this.setupCopyInteraction(this.inviteCodeText, this.lobbyData.inviteCode, 'Invite Code');
      
      // Add all to lobby container
      this.lobbyContainer.add([inviteLabel, this.inviteCodeText, copyHint, instructions]);
    }
    
    // Create copy notification (hidden initially)
    this.copyNotification = this.add.text(GAME_CONFIG.GAME_WIDTH / 2, GAME_CONFIG.GAME_HEIGHT / 2 - 100, '', {
      fontSize: '11px',
      color: '#00ff00',
      backgroundColor: '#002200',
      padding: { x: 12, y: 6 },
      fontFamily: 'monospace'
    }).setOrigin(0.5);
    this.copyNotification.setVisible(false);
    this.copyNotification.setDepth(1000); // Ensure it's on top

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
    
    // Leave lobby button - centered since we removed TEST START
    this.leaveLobbyButton = this.add.text(GAME_CONFIG.GAME_WIDTH / 2, GAME_CONFIG.GAME_HEIGHT - 30, 'LEAVE LOBBY', {
      fontSize: '12px',
      color: '#ffffff',
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    this.setupButton(this.leaveLobbyButton, '#666666', '#888888', () => this.leaveLobby());

    // Tips section (match your style)
    const tipsText = this.add.text(GAME_CONFIG.GAME_WIDTH / 2, GAME_CONFIG.GAME_HEIGHT - 10, 
      'Match starts automatically with 2+ players • First to 50 kills wins', {
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

  private setupCopyInteraction(element: Phaser.GameObjects.Text, textToCopy: string, labelName: string): void {
    // Store original style
    const originalColor = element.style.color;
    const originalBg = element.style.backgroundColor;
    
    // Hover effect - highlight the text
    element.on('pointerover', () => {
      element.setStyle({ 
        color: '#ffffff',
        backgroundColor: '#004400'
      });
      // Add underline effect or border
      this.tweens.add({
        targets: element,
        scaleX: 1.02,
        scaleY: 1.02,
        duration: 100,
        ease: 'Power2'
      });
    });
    
    element.on('pointerout', () => {
      element.setStyle({ 
        color: originalColor,
        backgroundColor: originalBg || ''
      });
      this.tweens.add({
        targets: element,
        scaleX: 1,
        scaleY: 1,
        duration: 100,
        ease: 'Power2'
      });
    });
    
    // Click to copy
    element.on('pointerdown', async () => {
      try {
        // Copy to clipboard
        await navigator.clipboard.writeText(textToCopy);
        
        // Show notification
        this.showCopyNotification(`✓ ${labelName} copied to clipboard!`);
        
        // Visual feedback on the element
        element.setStyle({ color: '#00ff00' });
        this.tweens.add({
          targets: element,
          scaleX: 0.98,
          scaleY: 0.98,
          duration: 50,
          yoyo: true,
          ease: 'Power2',
          onComplete: () => {
            // Restore color after a moment
            this.time.delayedCall(300, () => {
              element.setStyle({ color: originalColor });
            });
          }
        });
        
        console.log(`📋 Copied ${labelName}: ${textToCopy}`);
      } catch (err) {
        console.error('Failed to copy:', err);
        // Fallback for older browsers
        this.fallbackCopy(textToCopy, labelName);
      }
    });
  }
  
  private showCopyNotification(message: string): void {
    // Clear any existing notification tweens
    this.tweens.killTweensOf(this.copyNotification);
    
    // Set the message and show
    this.copyNotification.setText(message);
    this.copyNotification.setVisible(true);
    this.copyNotification.setAlpha(0);
    
    // Animate in
    this.tweens.add({
      targets: this.copyNotification,
      alpha: 1,
      y: GAME_CONFIG.GAME_HEIGHT / 2 - 95,
      duration: 200,
      ease: 'Power2',
      onComplete: () => {
        // Hold for a moment then fade out
        this.time.delayedCall(2000, () => {
          this.tweens.add({
            targets: this.copyNotification,
            alpha: 0,
            y: GAME_CONFIG.GAME_HEIGHT / 2 - 105,
            duration: 300,
            ease: 'Power2',
            onComplete: () => {
              this.copyNotification.setVisible(false);
              this.copyNotification.y = GAME_CONFIG.GAME_HEIGHT / 2 - 100;
            }
          });
        });
      }
    });
  }
  
  private fallbackCopy(text: string, label: string): void {
    // Create temporary input element for fallback copy
    const tempInput = document.createElement('input');
    tempInput.value = text;
    tempInput.style.position = 'absolute';
    tempInput.style.left = '-9999px';
    document.body.appendChild(tempInput);
    tempInput.select();
    
    try {
      document.execCommand('copy');
      this.showCopyNotification(`✓ ${label} copied to clipboard!`);
      console.log(`📋 Copied ${label} (fallback): ${text}`);
    } catch (err) {
      console.error('Fallback copy failed:', err);
      this.showCopyNotification('❌ Copy failed - please copy manually');
    }
    
    document.body.removeChild(tempInput);
  }

  /**
   * Handle lobby state changes from LobbyStateManager
   */
  private handleLobbyStateChange(state: LobbyState | null): void {
    // Safety check: Don't update if scene is not active
    if (!this.scene || !this.scene.isActive()) {
      console.log('⚠️ LobbyWaitingScene not active, ignoring state change');
      return;
    }
    
    if (!state) {
      console.log('📊 No lobby state in waiting scene');
      return;
    }
    
    // Only log significant state changes
    if (state.status === 'starting' || state.playerCount !== this.lobbyData.playerCount) {
      console.log('📊 Lobby state change:', state.playerCount, '/', state.maxPlayers, '-', state.status);
    }
    
    // Update lobby data from authoritative source
    this.lobbyData.playerCount = state.playerCount;
    this.lobbyData.maxPlayers = state.maxPlayers;
    
    // Update UI only if scene is still active
    if (this.scene.isActive()) {
      this.updatePlayerCount();
    }
    
    // Handle status changes
    if (state.status === 'starting' && state.countdown) {
      this.countdown = state.countdown;
      if (this.scene.isActive()) {
        this.startCountdown();
      }
    }
  }

  private updatePlayerCount(): void {
    // Safety check: Don't update if scene is not active
    if (!this.scene || !this.scene.isActive()) {
      return;
    }
    
    // Safe property access with defaults
    const playerCount = this.lobbyData.playerCount || 0;
    const maxPlayers = this.lobbyData.maxPlayers || 8;
    
    // Check if UI elements exist before using them
    if (this.playerCountText && this.playerCountText.scene) {
      this.playerCountText.setText(`Players: ${playerCount}/${maxPlayers}`);
    } else {
      console.warn('playerCountText not initialized or destroyed');
    }
    
    // Update status based on player count
    if (this.statusText && this.statusText.scene) {
      if (playerCount >= 2) {
        this.statusText.setText('Ready to start! Auto-starting match...');
        this.statusText.setColor('#00ff00');
      
        // Add pulsing animation when ready (only if tweens still exist)
        if (this.tweens) {
          this.tweens.add({
            targets: this.statusText,
            alpha: 0.7,
            duration: 1000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
          });
        }
        
        // Backend will auto-start the match when we have 2+ players
        console.log('✅ Ready to start with', playerCount, 'players - waiting for backend');
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
          // Countdown reached 0, transition to game
          console.log('⏰ Countdown reached 0, transitioning to GameScene');
          this.stopCountdown();
          
          // Force transition to GameScene if we haven't already
          // The backend should have sent match_started, but as a fallback...
          if (this.scene.isActive('LobbyWaitingScene')) {
            console.log('⚠️ Forcing transition to GameScene (fallback)');
            SceneManager.transition(this, 'GameScene', { 
              matchData: { 
                lobbyId: this.lobbyData.lobbyId,
                gameMode: this.lobbyData.gameMode,
                fromCountdown: true,
                killTarget: 50,
                isLateJoin: false,
                mapData: { width: 480, height: 270 }
              }
            });
          }
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
    SceneManager.transition(this, 'LobbyMenuScene');
  }



  shutdown(): void {
    this.stopCountdown();
    
    // Unregister from LobbyEventCoordinator
    const coordinator = LobbyEventCoordinator.getInstance();
    coordinator.unregisterScene(this);
    
    // Unsubscribe from state changes
    if (this.stateUnsubscribe) {
      this.stateUnsubscribe();
      this.stateUnsubscribe = undefined;
    }
    
    // Clean up LobbyStateManager to prevent duplicate events
    if (this.lobbyStateManager) {
      console.log('🧹 Destroying LobbyStateManager in shutdown');
      this.lobbyStateManager.destroy();
      this.lobbyStateManager = undefined;
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
      socket.off('player_left_lobby');
      socket.off('match_starting');
      socket.off('match_started');
      // Don't remove game:state - that's owned by NetworkSystem
      socket.off('disconnect');
      socket.off('lobby_error');
    }
    
    // Clean up tweens
    this.tweens.killAll();
  }
}

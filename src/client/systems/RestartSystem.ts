import { IGameSystem } from '../../../shared/interfaces/IGameSystem';
import { GAME_CONFIG } from '../../../shared/constants/index';
import { NotificationSystem } from './NotificationSystem';

export class RestartSystem implements IGameSystem {
  private scene: Phaser.Scene;
  private notificationSystem: NotificationSystem;
  private isAdmin: boolean = false;
  
  // Admin controls
  private adminControlsContainer?: Phaser.GameObjects.Container;
  
  // Restart countdown overlay
  private countdownOverlay?: Phaser.GameObjects.Container;
  private countdownTimer?: Phaser.Time.TimerEvent;
  private currentCountdown: number = 0;

  constructor(scene: Phaser.Scene, notificationSystem: NotificationSystem) {
    this.scene = scene;
    this.notificationSystem = notificationSystem;
  }

  initialize(): void {
    console.log('RestartSystem: Initialized');
    this.setupEventListeners();
    this.setupKeyboardShortcuts();
  }

  update(deltaTime: number): void {
    // RestartSystem doesn't need regular updates
    // All functionality is event-driven
  }

  destroy(): void {
    console.log('RestartSystem: Destroying');
    this.hideAdminControls();
    this.hideRestartCountdown();
    
    // Remove event listeners
    this.scene.events.off('game:restarting');
    this.scene.events.off('game:restarted');
    this.scene.events.off('game:restart_failed');
    this.scene.events.off('admin:authenticated');
    this.scene.events.off('admin:auth-failed');
  }

  private setupEventListeners(): void {
    // Listen for restart events from NetworkSystem
    this.scene.events.on('game:restarting', (data: any) => {
      console.log('🔄 Game restarting event received:', data);
      this.showRestartCountdown(data.countdown, data.message, data.adminId);
    });

    this.scene.events.on('game:restarted', (data: any) => {
      console.log('✅ Game restarted event received:', data);
      this.hideRestartCountdown();
      
      // CRITICAL: Clear all local game state and re-establish player identity
      this.handleGameRestarted();
      
      // Add debug tracking for game state updates after restart
      this.setupPostRestartDebugging();
      
      this.notificationSystem.success(data.message, 5000);
      console.log(`✅ Restart complete: ${data.playersReconnected}/${data.totalPlayers} players reconnected`);
    });

    this.scene.events.on('game:restart_failed', (data: any) => {
      console.log('❌ Game restart failed:', data);
      this.hideRestartCountdown();
      this.notificationSystem.error(data.message, 5000);
      console.error('❌ Restart failed:', data.error);
    });

    // Listen for admin authentication events
    this.scene.events.on('admin:authenticated', () => {
      console.log('🔑 Admin authenticated');
      this.isAdmin = true;
      this.showAdminControls();
      this.notificationSystem.success('Admin privileges granted', 3000);
    });

    this.scene.events.on('admin:auth-failed', () => {
      console.log('❌ Admin authentication failed');
      this.notificationSystem.error('Invalid admin password', 3000);
    });
  }

  private setupKeyboardShortcuts(): void {
    // F9 + Ctrl for admin restart
    this.scene.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      if (event.key === 'F9' && event.ctrlKey && this.isAdmin) {
        event.preventDefault();
        this.requestGameRestart();
      }
    });
  }

  /**
   * Show admin authentication prompt
   */
  authenticateAsAdmin(): void {
    // Use browser prompt for simplicity (could be enhanced with custom UI later)
    const password = prompt('Enter admin password:');
    if (password) {
      const networkSystem = (this.scene as any).networkSystem;
      if (networkSystem) {
        networkSystem.emit('admin:authenticate', password);
      } else {
        this.notificationSystem.error('No network connection', 3000);
      }
    }
  }

  /**
   * Request a game restart (admin only, or bypassed for debug)
   */
  requestGameRestart(countdown: number = 3, bypassAdminCheck: boolean = false): void {
    if (!this.isAdmin && !bypassAdminCheck) {
      this.notificationSystem.error('Admin privileges required', 3000);
      return;
    }

    const confirmMessage = `Restart the game with ${countdown}s countdown?\n\nThis will:\n• Reset all player positions\n• Reset all wall damage\n• Clear all projectiles\n• Reset all player health`;
    
    if (confirm(confirmMessage)) {
      const networkSystem = (this.scene as any).networkSystem;
      if (networkSystem) {
        networkSystem.emit('admin:restart_game', { countdown });
        console.log(`🔄 Requesting game restart with ${countdown}s countdown`);
      } else {
        this.notificationSystem.error('No network connection', 3000);
      }
    }
  }

  /**
   * Show admin controls panel
   */
  private showAdminControls(): void {
    if (this.adminControlsContainer) {
      return; // Already showing
    }

    const container = this.scene.add.container(GAME_CONFIG.GAME_WIDTH - 5, 5);
    container.setDepth(9000);

    // Background panel
    const panelWidth = 140;
    const panelHeight = 80;
    const background = this.scene.add.rectangle(0, 0, panelWidth, panelHeight, 0x000000, 0.8);
    background.setStrokeStyle(1, 0x00ff00, 0.8);
    background.setOrigin(1, 0);
    container.add(background);

    // Title
    const title = this.scene.add.text(-5, 5, '🔑 Admin Controls', {
      fontSize: '8px',
      color: '#00ff00',
      fontFamily: 'monospace',
      fontStyle: 'bold'
    });
    title.setOrigin(1, 0);
    container.add(title);

    // Restart button (3s)
    const restartButton = this.scene.add.text(-5, 20, '🔄 Restart Game (3s)', {
      fontSize: '7px',
      color: '#ffffff',
      fontFamily: 'monospace',
      backgroundColor: '#333333',
      padding: { x: 4, y: 2 }
    });
    restartButton.setOrigin(1, 0);
    restartButton.setInteractive({ useHandCursor: true });
    restartButton.on('pointerover', () => restartButton.setStyle({ backgroundColor: '#555555' }));
    restartButton.on('pointerout', () => restartButton.setStyle({ backgroundColor: '#333333' }));
    restartButton.on('pointerdown', () => this.requestGameRestart(3));
    container.add(restartButton);

    // Restart button (10s)
    const restartButton10 = this.scene.add.text(-5, 35, '🔄 Restart Game (10s)', {
      fontSize: '7px',
      color: '#ffffff',
      fontFamily: 'monospace',
      backgroundColor: '#333333',
      padding: { x: 4, y: 2 }
    });
    restartButton10.setOrigin(1, 0);
    restartButton10.setInteractive({ useHandCursor: true });
    restartButton10.on('pointerover', () => restartButton10.setStyle({ backgroundColor: '#555555' }));
    restartButton10.on('pointerout', () => restartButton10.setStyle({ backgroundColor: '#333333' }));
    restartButton10.on('pointerdown', () => this.requestGameRestart(10));
    container.add(restartButton10);

    // Shortcut hint
    const shortcutHint = this.scene.add.text(-5, 55, 'Ctrl+F9: Quick restart', {
      fontSize: '6px',
      color: '#888888',
      fontFamily: 'monospace'
    });
    shortcutHint.setOrigin(1, 0);
    container.add(shortcutHint);

    this.adminControlsContainer = container;

    // Fade in animation
    container.setAlpha(0);
    this.scene.tweens.add({
      targets: container,
      alpha: 1,
      duration: 300,
      ease: 'Power2'
    });
  }

  /**
   * Hide admin controls panel
   */
  private hideAdminControls(): void {
    if (this.adminControlsContainer) {
      this.adminControlsContainer.destroy();
      this.adminControlsContainer = undefined;
    }
  }

  /**
   * Show restart countdown overlay
   */
  private showRestartCountdown(seconds: number, message: string, adminId?: string): void {
    this.hideRestartCountdown(); // Clean up any existing countdown

    const container = this.scene.add.container(GAME_CONFIG.GAME_WIDTH / 2, GAME_CONFIG.GAME_HEIGHT / 2);
    container.setDepth(15000); // Higher than notifications

    // Background overlay
    const overlay = this.scene.add.rectangle(0, 0, GAME_CONFIG.GAME_WIDTH, GAME_CONFIG.GAME_HEIGHT, 0x000000, 0.8);
    container.add(overlay);

    // Main content container
    const contentContainer = this.scene.add.container(0, 0);

    // Restart message
    const restartTitle = this.scene.add.text(0, -60, '🔄 ' + message, {
      fontSize: '16px',
      color: '#ffaa00',
      fontFamily: 'monospace',
      fontStyle: 'bold',
      align: 'center'
    });
    restartTitle.setOrigin(0.5);
    contentContainer.add(restartTitle);

    // Admin info
    if (adminId) {
      const adminText = this.scene.add.text(0, -35, `Initiated by: ${adminId}`, {
        fontSize: '10px',
        color: '#aaaaaa',
        fontFamily: 'monospace',
        align: 'center'
      });
      adminText.setOrigin(0.5);
      contentContainer.add(adminText);
    }

    // Countdown timer display
    const timerText = this.scene.add.text(0, 0, seconds.toString(), {
      fontSize: '48px',
      color: '#ff0000',
      fontFamily: 'monospace',
      fontStyle: 'bold',
      align: 'center'
    });
    timerText.setOrigin(0.5);
    contentContainer.add(timerText);

    // Instructions
    const instructionText = this.scene.add.text(0, 40, 'Please wait...', {
      fontSize: '12px',
      color: '#ffffff',
      fontFamily: 'monospace',
      align: 'center'
    });
    instructionText.setOrigin(0.5);
    contentContainer.add(instructionText);

    container.add(contentContainer);

    // Store references
    this.countdownOverlay = container;
    this.currentCountdown = seconds;

    // Start countdown timer
    this.countdownTimer = this.scene.time.addEvent({
      delay: 1000,
      repeat: seconds - 1,
      callback: () => {
        this.currentCountdown--;
        timerText.setText(this.currentCountdown.toString());
        
        // Change color as time runs out
        if (this.currentCountdown <= 3) {
          timerText.setColor('#ff0000');
        } else if (this.currentCountdown <= 5) {
          timerText.setColor('#ffaa00');
        }

        if (this.currentCountdown <= 0) {
          // Timer finished, but don't hide overlay yet - wait for server response
          instructionText.setText('Restarting...');
          timerText.setText('0');
        }
      }
    });

    // Fade in animation
    container.setAlpha(0);
    this.scene.tweens.add({
      targets: container,
      alpha: 1,
      duration: 500,
      ease: 'Power2'
    });
  }

  /**
   * Hide restart countdown overlay
   */
  private hideRestartCountdown(): void {
    if (this.countdownTimer) {
      this.countdownTimer.destroy();
      this.countdownTimer = undefined;
    }

    if (this.countdownOverlay) {
      this.scene.tweens.add({
        targets: this.countdownOverlay,
        alpha: 0,
        duration: 300,
        onComplete: () => {
          this.countdownOverlay?.destroy();
          this.countdownOverlay = undefined;
        }
      });
    }
  }

  /**
   * Public methods for external access
   */
  public getIsAdmin(): boolean {
    return this.isAdmin;
  }

  public showAuthPrompt(): void {
    this.authenticateAsAdmin();
  }

  /**
   * Handle game restart completion - clear state and re-establish player identity
   */
  private handleGameRestarted(): void {
    console.log('🔄 Handling game restart - clearing local state and re-establishing identity');
    
    try {
      // 1. Clear all cached player states
      this.clearLocalGameState();
      
      // 2. Re-establish local player identity 
      this.reestablishPlayerIdentity();
      
      // 3. Reset local player position and state
      this.resetLocalPlayerState();
      
      console.log('✅ Game restart handling complete');
    } catch (error) {
      console.error('❌ Error handling game restart:', error);
      this.notificationSystem.error('Error during restart cleanup', 3000);
    }
  }

  /**
   * Clear all local game state to prevent player merging
   */
  private clearLocalGameState(): void {
    const gameScene = this.scene as any;
    
    // Clear PlayerManager state
    if (gameScene.playerManager) {
      console.log('🧹 Clearing PlayerManager state');
      gameScene.playerManager.clearAllPlayers();
    }
    
    // Reset local player ID tracking
    if (gameScene.localPlayerId) {
      console.log(`🔄 Resetting local player ID from ${gameScene.localPlayerId}`);
      gameScene.localPlayerId = null;
    }
    
    // Clear client prediction state
    if (gameScene.clientPrediction) {
      console.log('🔄 Resetting client prediction');
      gameScene.clientPrediction.reset(gameScene.playerPosition || { x: 240, y: 135 });
    }
    
    // Clear visual effects that might reference old players
    if (gameScene.visualEffectsSystem) {
      console.log('🧹 Clearing visual effects');
      gameScene.visualEffectsSystem.clearAllEffects();
    }
    
    // Reset death state
    gameScene.isPlayerDead = false;
    
    // Reset health to full
    if (gameScene.weaponUI) {
      gameScene.weaponUI.updateHealth(100);
    }
  }

  /**
   * Re-establish player identity with backend
   */
  private reestablishPlayerIdentity(): void {
    const gameScene = this.scene as any;
    const networkSystem = gameScene.networkSystem;
    
    if (!networkSystem || !networkSystem.isAuthenticated()) {
      console.warn('⚠️ Cannot re-establish identity - not connected to server');
      return;
    }
    
    // Get current socket ID (should be the same, but confirm)
    const socketId = networkSystem.getSocket()?.id;
    if (!socketId) {
      console.warn('⚠️ No socket ID available for identity re-establishment');
      return;
    }
    
    console.log(`🆔 Re-establishing identity with socket ID: ${socketId}`);
    
    // Update local player ID
    gameScene.setLocalPlayerId(socketId);
    
    // Re-send player:join event with current loadout to re-establish identity
    const loadout = gameScene.game.registry.get('playerLoadout');
    if (loadout) {
      console.log('📝 Re-sending player:join event after restart');
      
      // Send join event immediately
      networkSystem.emit('player:join', {
        loadout: loadout,
        timestamp: Date.now(),
        isRestart: true  // Flag to indicate this is post-restart join
      });
      
      // Send again after short delay as failsafe
      setTimeout(() => {
        if (networkSystem.isAuthenticated()) {
          console.log('📝 Re-sending player:join (failsafe)');
          networkSystem.emit('player:join', {
            loadout: loadout,
            timestamp: Date.now(),
            isRestart: true
          });
        }
      }, 500);
    } else {
      console.error('❌ No loadout available for identity re-establishment');
      this.notificationSystem.error('No loadout configured - please rejoin', 5000);
    }
  }

  /**
   * Reset local player state after restart
   */
  private resetLocalPlayerState(): void {
    const gameScene = this.scene as any;
    
    // Reset player position to spawn point
    const spawnPosition = { x: 240, y: 135 }; // Center spawn
    gameScene.playerPosition = { ...spawnPosition };
    
    // Update player sprite position
    if (gameScene.playerSprite) {
      gameScene.playerSprite.setPosition(spawnPosition.x, spawnPosition.y);
      gameScene.playerSprite.setRotation(Math.PI / 2); // Reset rotation
    }
    
    // Update weapon sprite position
    if (gameScene.playerWeapon) {
      gameScene.playerWeapon.setPosition(spawnPosition.x, spawnPosition.y);
      gameScene.playerWeapon.setRotation(Math.PI / 2);
    }
    
    // Reset player rotation
    gameScene.playerRotation = 0;
    
    console.log(`🎮 Local player state reset to spawn position: ${spawnPosition.x}, ${spawnPosition.y}`);
  }

  /**
   * Setup debugging to track game state updates after restart
   */
  private setupPostRestartDebugging(): void {
    console.log('🔍 Setting up post-restart debugging to track desync issues');
    
    let gameStateCount = 0;
    let lastGameStateTime = Date.now();
    
    // Track if we're receiving game state updates
    const debugListener = () => {
      gameStateCount++;
      lastGameStateTime = Date.now();
      
      if (gameStateCount === 1) {
        console.log('✅ First game state received after restart');
      } else if (gameStateCount === 5) {
        console.log('✅ Game state updates flowing normally after restart');
        // Remove debug listener after 5 updates to avoid spam
        this.scene.events.off('network:gameState', debugListener);
      }
    };
    
    // Listen for game state updates
    this.scene.events.on('network:gameState', debugListener);
    
    // Check if updates stop coming
    const checkInterval = setInterval(() => {
      const timeSinceLastUpdate = Date.now() - lastGameStateTime;
      
      if (timeSinceLastUpdate > 5000) { // No updates for 5 seconds
        console.error('🚨 DESYNC DETECTED: No game state updates for 5+ seconds after restart!');
        console.error('🚨 This indicates a backend issue - server may not be sending game state');
        console.error(`🚨 Last update: ${timeSinceLastUpdate}ms ago, Total updates: ${gameStateCount}`);
        
        // Show error notification
        this.notificationSystem.error('Game state desync detected - backend issue', 10000);
        
        clearInterval(checkInterval);
        this.scene.events.off('network:gameState', debugListener);
      } else if (gameStateCount >= 5) {
        // Everything is working fine, stop monitoring
        clearInterval(checkInterval);
      }
    }, 2000); // Check every 2 seconds for 30 seconds max
    
    // Stop monitoring after 30 seconds regardless
    setTimeout(() => {
      clearInterval(checkInterval);
      this.scene.events.off('network:gameState', debugListener);
      if (gameStateCount > 0) {
        console.log(`✅ Post-restart monitoring complete. Received ${gameStateCount} game state updates.`);
      }
    }, 30000);
  }
} 
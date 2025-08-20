import { InputSystem } from '../systems/InputSystem';
import { NetworkSystem } from '../systems/NetworkSystem';
import NetworkSystemSingleton from '../systems/NetworkSystemSingleton';
import { VisualEffectsSystem } from '../systems/VisualEffectsSystem';
import { SceneManager } from '../utils/SceneManager';
import { SceneDebugger } from '../systems/SceneDebugger';
import { DestructionRenderer } from '../systems/DestructionRenderer';
import { WeaponUI } from '../ui/WeaponUI';
import { ClientPrediction } from '../systems/ClientPrediction';
import { VisionRenderer } from '../systems/VisionRenderer';
import { PlayerManager } from '../systems/PlayerManager';
import { ScreenShakeSystem } from '../systems/ScreenShakeSystem';
import { GAME_CONFIG } from '../../../shared/constants/index';
import { GameState, CollisionEvent, Vector2, PolygonVision } from '../../../shared/types/index';

import { AssetManager } from '../utils/AssetManager';
import { audioManager } from '../systems/AudioManager';
import { initializeGameAudio, fireWeapon, playUIClick, throwWeapon } from '../systems/AudioIntegration';
import { audioTest } from '../systems/AudioTest';
import { NotificationSystem } from '../systems/NotificationSystem';
import { RestartSystem } from '../systems/RestartSystem';
import { PerformanceMonitor } from '../systems/PerformanceMonitor';
import { LobbyStateManager } from '../systems/LobbyStateManager';

export class GameScene extends Phaser.Scene {
  private inputSystem!: InputSystem;
  private networkSystem!: NetworkSystem;
  private visualEffectsSystem!: VisualEffectsSystem;
  private destructionRenderer!: DestructionRenderer;
  private weaponUI!: WeaponUI;
  private clientPrediction!: ClientPrediction;
  private visionRenderer!: VisionRenderer;
  private playerManager!: PlayerManager;
  private screenShakeSystem!: ScreenShakeSystem;
  private assetManager!: AssetManager;
  private notificationSystem!: NotificationSystem;
  private restartSystem!: RestartSystem;
  private performanceMonitor!: PerformanceMonitor;
  private sceneDebugger!: SceneDebugger;
  private playerSprite!: Phaser.GameObjects.Sprite; // Changed from Rectangle to Sprite
  private playerWeapon!: Phaser.GameObjects.Sprite; // Add weapon sprite
  // Smoke and flashbang systems
  private smokeZoneGraphics!: Phaser.GameObjects.Graphics;
  private smokeParticles: Map<string, any[]> = new Map();
  private flashbangOverlay!: Phaser.GameObjects.Rectangle;
  private flashbangActive: boolean = false;
  // Player state tracking
  private playerPosition: { x: number; y: number } = { x: 240, y: 135 };
  private lastGameStateTime: number = 0;
  private currentGameState: any = null; // Store current game state for kill counter updates
  // Server indicator debug functionality removed
  private isPlayerDead: boolean = false; // Track if local player is dead
  private localPlayerId: string | null = null; // Track local player ID
  private killCounterDebugLogged: boolean = false; // Debug flag for kill counter
  private localKillTracker: Map<string, number> | null = null; // Local kill tracking fallback
  private playerRotation: number = 0;
  private connectionStatus!: Phaser.GameObjects.Text;
  private lastKillLogTime: number = 0; // Throttle kill count logging
  private previousKillCounts: Record<string, number> = {}; // Track kill changes
  private emergencyRespawnTimer: Phaser.Time.TimerEvent | null = null; // Track emergency timer
  
  // Match state (new lobby system)
  private killTarget: number = 50; // Default kill target
  private matchData: any = null;
  private killCounterContainer!: Phaser.GameObjects.Container;
  private isMatchEnding: boolean = false; // Prevent duplicate match end transitions
  private matchStartTime: number = 0; // Track actual match start time
  
  // Phaser UI elements
  private healthBar!: Phaser.GameObjects.Graphics;
  private crosshair!: Phaser.GameObjects.Graphics;
  private ammoText!: Phaser.GameObjects.Text;
  // private weaponText!: Phaser.GameObjects.Text; // Removed for clean UI
  private grenadeChargeBar!: Phaser.GameObjects.Graphics;
  private wallGraphics!: Phaser.GameObjects.Graphics;
  private wallSliceSprites: Map<string, Phaser.GameObjects.Sprite> = new Map(); // Back to regular Sprite
  private floorSprites: Phaser.GameObjects.Sprite[] = [];
  private mouseText?: Phaser.GameObjects.Text;
  
  // Test mode properties
  private backgroundSprite?: Phaser.GameObjects.TileSprite;
  private playerLoadout?: any;
  
  // Server position indicator visibility flag


  constructor() {
    super({ key: 'GameScene' });
    // Player position will be set based on spawn point or late join position
    this.playerPosition = { x: 240, y: 135 }; // Default center position
  }

  init(data: any): void {
    // NetworkSystem singleton will be retrieved in create()
    console.log('GameScene: Initializing with data:', data);
    
    // Handle match data from new lobby system
    if (data?.matchData) {
      this.matchData = data.matchData;
      this.killTarget = data.matchData.killTarget || 50;
      console.log('🎯 Match initialized with kill target:', this.killTarget);
      
      // Check if this is an emergency transition
      if (data.matchData.emergency || data.matchData.fromNetworkSystem) {
        console.log('🚨 Emergency transition detected - game already started');
      }
    }
    
    // Get configured loadout from registry - should ALWAYS exist now since everyone goes through ConfigureScene
    const initialLoadout = this.game.registry.get('playerLoadout');
    this.playerLoadout = initialLoadout;
    if (!initialLoadout) {
      // This should never happen since everyone goes through ConfigureScene now, but safety fallback
      console.error('GameScene: No player loadout configured! This should not happen. Using emergency default and returning to ConfigureScene.');
      const emergencyLoadout = {
        team: 'blue', // Default to blue team
        primary: 'rifle',
        secondary: 'pistol',
        support: ['grenade']
      };
      this.game.registry.set('playerLoadout', emergencyLoadout);
      this.playerLoadout = emergencyLoadout;
      console.log('📋 Used emergency default loadout:', emergencyLoadout);
      // Still return to configure to let them pick properly
      SceneManager.transition(this, 'ConfigureScene');
      return;
    }
    
    console.log('GameScene: Using configured loadout:', this.playerLoadout);
  }

  create(): void {
    // Clean up LobbyStateManager to prevent interference
    const lobbyStateManager = LobbyStateManager.getInstance();
    if (lobbyStateManager) {
      console.log('🧹 Cleaning up LobbyStateManager in GameScene');
      lobbyStateManager.destroy();
    }
    
    console.log('🎮 GameScene starting');
    
    // Initialize NetworkSystem singleton
    this.networkSystem = NetworkSystemSingleton.getInstance(this);
    
    // Initialize AssetManager first
    this.assetManager = new AssetManager(this);
    
    // Create floor background using actual floor texture
    try {
      this.createFloorBackground();
      console.log('✅ Floor background created');
    } catch (error) {
      console.error('❌ Failed to create floor background:', error);
      // Fallback: Create a simple colored rectangle
      const fallbackFloor = this.add.rectangle(0, 0, GAME_CONFIG.GAME_WIDTH, GAME_CONFIG.GAME_HEIGHT, 0x1a1a1a);
      fallbackFloor.setOrigin(0, 0);
      fallbackFloor.setDepth(0);
      console.log('⚠️ Using fallback floor');
    }

    // Get configured loadout for weapon system
    const configuredLoadout = this.game.registry.get('playerLoadout');
    
    // Initialize systems first (before using them)
    this.inputSystem = new InputSystem(this);
    
    // Configure InputSystem with player's weapon loadout
    if (configuredLoadout) {
      this.inputSystem.setLoadout(configuredLoadout);
      this.playerLoadout = configuredLoadout; // Store for later use
    } else if (this.playerLoadout) {
      // For late joins that created a default loadout in init()
      console.log('📋 Setting default loadout for InputSystem');
      this.inputSystem.setLoadout(this.playerLoadout);
    } else {
      console.error('⚠️ No loadout available for InputSystem!');
    }
    
    // Get NetworkSystem singleton (will update scene reference)
    this.networkSystem = NetworkSystemSingleton.getInstance(this);
    
    // Setup match lifecycle event listeners (new lobby system)
    this.setupMatchLifecycleListeners();
    
    // Track match start time for duration calculation
    this.matchStartTime = Date.now();
    console.log('⏱️ Match started at:', new Date(this.matchStartTime).toLocaleTimeString());
    
    this.visualEffectsSystem = new VisualEffectsSystem(this);
    this.destructionRenderer = new DestructionRenderer(this);
    this.weaponUI = new WeaponUI(this);
    this.clientPrediction = new ClientPrediction(this);
    this.visionRenderer = new VisionRenderer(this);
    this.playerManager = new PlayerManager(this);
    this.screenShakeSystem = new ScreenShakeSystem(this);
    
    // Initialize notification and restart systems
    this.notificationSystem = new NotificationSystem(this);
    this.restartSystem = new RestartSystem(this, this.notificationSystem);
    this.performanceMonitor = new PerformanceMonitor(this);
    
    // Initialize scene debugger (helps diagnose multiple scene issues)
    this.sceneDebugger = new SceneDebugger(this);
    // Debug mode disabled for clean UI
    
    // Force cleanup any lingering scenes (fixes multiple scene issues)
    this.sceneDebugger.forceCleanup();
    
    // For late joins, ensure robust activation
    if (this.matchData?.isLateJoin) {
      console.log('🎮 Setting up robust late join activation');
      
      // Force scene to be fully active
      this.scene.setActive(true);
      this.scene.setVisible(true);
      
      // Ensure update loop is running
      this.events.on('postupdate', () => {
        // This ensures the scene is actively updating
      });
      
      console.log('✅ Late join scene fully activated');
    }
    
    // Connect VisionRenderer to PlayerManager for partial visibility
    this.playerManager.setVisionRenderer(this.visionRenderer);
    
    // Connect WeaponUI to InputSystem for auto-reload functionality
    this.inputSystem.setWeaponUI(this.weaponUI);
    
    // Initialize audio system
    this.initializeAudio();
    
    // Set up audio event listeners
    this.setupAudioListeners();
    
    // Check if this is a late join - if so, use simplified setup
    const isLateJoin = this.matchData?.isLateJoin || false;
    
    if (isLateJoin) {
      console.log('🎮 Late join detected - using simplified setup', {
        matchData: this.matchData,
        team: this.playerLoadout?.team || 'blue'
      });
      
      // For late joins, create player at fallback position immediately
      const teamColor = this.playerLoadout?.team || 'blue';
      const fallbackPosition = teamColor === 'red' ? { x: 420, y: 50 } : { x: 60, y: 220 };
      
      this.playerSprite = this.assetManager.createPlayer(
        fallbackPosition.x, 
        fallbackPosition.y, 
        teamColor
      );
      this.playerSprite.setDepth(21);
      this.playerSprite.setVisible(true); // Start visible for late joins
      this.playerSprite.setAlpha(1);
      
      // Update internal position
      this.playerPosition = fallbackPosition;
      console.log('✅ Late join: Created player at fallback position:', fallbackPosition);

    } else {
      // Normal spawn - create at default position
      const teamColor = this.playerLoadout?.team || 'blue'; // Fallback to blue if no team configured
      
      // Debug log to verify team assignment
      console.log(`🎨 Creating local player with team: ${teamColor} (from loadout: ${this.playerLoadout?.team})`);
      
      this.playerSprite = this.assetManager.createPlayer(
        this.playerPosition.x,
        this.playerPosition.y,
        teamColor
      );
      this.playerSprite.setDepth(21); // Above other players
      this.playerSprite.setRotation(Math.PI / 2); // Start with 90-degree clockwise rotation
      this.playerSprite.setVisible(true); // Ensure player is visible
      this.playerSprite.setAlpha(1); // Ensure player is fully opaque
    }
    console.log('👤 Player sprite created:', {
      position: this.playerPosition,
      team: this.playerLoadout?.team || 'blue',
      visible: this.playerSprite.visible,
      alpha: this.playerSprite.alpha
    });
    
    // Create weapon sprite for local player using configured primary weapon
    const initialWeapon = this.playerLoadout?.primary || 'smg'; // Fallback to SMG if no primary configured
    this.playerWeapon = this.assetManager.createWeapon(
      this.playerPosition.x,
      this.playerPosition.y,
      initialWeapon,
      0 // Initial facing angle
    );
    this.playerWeapon.setDepth(20); // Just below player
    
    // Initialize client prediction with starting position
    this.clientPrediction.reset(this.playerPosition);
    
    // Backend position indicator removed (was debug functionality)

    // Create connection status text
    this.connectionStatus = this.add.text(GAME_CONFIG.GAME_WIDTH - 5, 5, 'Connecting...', {
      fontSize: '8px',
      color: '#ffffff'
    }).setOrigin(1, 0);

    // Check current connection state if NetworkSystem was passed from MenuScene
    if (this.networkSystem && this.networkSystem.isAuthenticated()) {
      this.connectionStatus.setText('Connected to server');
      this.connectionStatus.setColor('#00ff00');
      console.log('GameScene: Already authenticated via MenuScene');
    } else if (this.networkSystem) {
      console.log(`GameScene: NetworkSystem state = ${this.networkSystem.getConnectionState()}`);
    }

    // Initialize input system only if we have a valid network connection
    this.inputSystem.initialize();
    this.visualEffectsSystem.initialize();
    this.destructionRenderer.initialize();
    this.weaponUI.initialize();
    this.screenShakeSystem.initialize();
    this.notificationSystem.initialize();
    this.restartSystem.initialize();
    this.performanceMonitor.initialize();
    
    // Initialize smoke and flashbang graphics
    this.smokeZoneGraphics = this.add.graphics();
    this.smokeZoneGraphics.setDepth(45); // Above most effects but below UI
    
    // Create flashbang overlay (hidden initially)
    this.flashbangOverlay = this.add.rectangle(
      GAME_CONFIG.GAME_WIDTH / 2,
      GAME_CONFIG.GAME_HEIGHT / 2,
      GAME_CONFIG.GAME_WIDTH,
      GAME_CONFIG.GAME_HEIGHT,
      0xFFFFFF
    );
    this.flashbangOverlay.setDepth(100); // Above everything
    this.flashbangOverlay.setAlpha(0); // Start hidden
    this.flashbangOverlay.setScrollFactor(0); // UI layer
    
    // Create kill counter HUD if in a match
    this.createKillCounterHUD();
    
    // Create debug UI if in development
    if (process.env.NODE_ENV !== 'production') {
      this.createDebugUI();
    }
    
    // Set up client prediction callback
    this.clientPrediction.setPositionCallback((pos) => {
      this.playerPosition.x = pos.x;
      this.playerPosition.y = pos.y;
      try {
        if (this.playerSprite && this.playerSprite.scene) {
          this.playerSprite.setPosition(pos.x, pos.y); // Update sprite position
        }
      } catch (error) {
        console.error('❌ Error setting player sprite position from ClientPrediction:', error);
      }
      
      // Update weapon position with both shoulder and forward offsets
      const shoulderOffset = 8; // Distance from center to shoulder  
      const shoulderAngle = this.playerRotation + Math.PI / 2; // 90 degrees clockwise for right side
      const shoulderX = Math.cos(shoulderAngle) * shoulderOffset;
      const shoulderY = Math.sin(shoulderAngle) * shoulderOffset;
      
      const forwardOffset = 6; // Distance ahead of player
      const forwardX = Math.cos(this.playerRotation) * forwardOffset;
      const forwardY = Math.sin(this.playerRotation) * forwardOffset;
      
      const weaponX = pos.x + shoulderX + forwardX;
      const weaponY = pos.y + shoulderY + forwardY;
      this.playerWeapon.setPosition(weaponX, weaponY);
    });

    // Create UI elements using Phaser
    this.createPhaserUI();

    // Set up network event listeners
    this.setupNetworkListeners();
    
    // Create debug UI elements
    this.createUI();
    

    
    // Check if we came from the proper flow (should have matchData)
    const isDirectConnection = !this.matchData;
    
    if (isDirectConnection) {
      console.warn('⚠️ GameScene started without matchData! This should not happen in normal flow.');
      console.log('🔄 Redirecting to LobbyMenuScene to properly join a match...');
      
      // Store a flag to prevent infinite loops
      const hasRedirected = this.game.registry.get('gameSceneRedirected');
      if (!hasRedirected) {
        this.game.registry.set('gameSceneRedirected', true);
        // Clear the flag after a delay
        this.time.delayedCall(1000, () => {
          this.game.registry.set('gameSceneRedirected', false);
        });
        
        // Redirect to lobby menu
        SceneManager.transition(this, 'LobbyMenuScene');
        return; // Stop initialization
      } else {
        console.error('❌ Already redirected once, preventing infinite loop');
        // Continue with direct connection fallback
      }
    }
    
    // Store match data if not provided
    if (!this.matchData) {
      this.matchData = {
        lobbyId: 'game_' + Date.now(),
        status: 'in_progress',
        playerCount: 1,
        maxPlayers: 8,
        password: ''
      };
    }

    // Add debug instructions to UI
    const debugText = this.add.text(5, GAME_CONFIG.GAME_HEIGHT - 20, 
      'Debug: \\ - admin auth, F - toggle fog', {
      fontSize: '7px',
      color: '#666666'
    }).setOrigin(0, 1);

    // Add keyboard shortcut to manually request game state (for debugging)
    this.input.keyboard?.on('keydown-R', () => {
      console.log('🔄 R key pressed - requesting game state from backend');
      const socket = this.networkSystem.getSocket();
      if (socket && socket.connected) {
        socket.emit('request_game_state', {});
        console.log('📡 Sent request_game_state');
      } else {
        console.error('❌ Socket not connected');
      }
    });
    
    // Add debug key to check wall status
    this.input.keyboard?.on('keydown-W', () => {
      console.log('🧱 Wall Status Check:');
      console.log('  - DestructionRenderer walls:', this.destructionRenderer.getWallCount());
      console.log('  - Wall sprites rendered:', this.wallSliceSprites.size);
      console.log('  - Sample walls:', this.destructionRenderer.getWallsData().slice(0, 3));
      
      // Force an immediate wall update
      this.updateWallsFromDestructionRenderer();
      console.log('  - After forced update:', this.wallSliceSprites.size);
    });
    

    
    // Add ESC key to leave game
    this.input.keyboard?.on('keydown-ESC', () => {
      SceneManager.transition(this, 'LobbyMenuScene');
    });
    
    // Development: Add test mode button (only for development)
    if (this.game.config.physics?.arcade?.debug) {
      const testButton = this.add.text(GAME_CONFIG.GAME_WIDTH - 5, 5, '🧪 DEV MODE', {
        fontSize: '10px',
        color: '#ffffff',
        backgroundColor: '#444444',
        padding: { x: 8, y: 4 },
        fontFamily: 'monospace'
      }).setOrigin(1, 0);
      
      testButton.setInteractive({ useHandCursor: true });
      testButton.on('pointerdown', () => {
        console.log('🧪 DEV MODE: Creating test environment');
        this.createTestEnvironment();
      });
    }

    // Start game loop
    console.log('✅ GameScene initialized successfully');
    
    // Log initialization status
    console.log('📊 Systems initialized:', {
      floor: this.floorSprites.length > 0,
      player: !!this.playerSprite,
      input: !!this.inputSystem,
      destruction: !!this.destructionRenderer,
      vision: !!this.visionRenderer,
      network: !!this.networkSystem
    });
    
    // Request game state immediately for late joins
    if (this.matchData?.isLateJoin) {
      const socket = this.networkSystem.getSocket();
      if (socket && socket.connected) {
        console.log('📡 Late join: Requesting immediate game state');
        socket.emit('request_game_state', {});
      }
    }
    
    // Check for pending game state AFTER all systems are initialized
    const pendingGameState = this.game.registry.get('pendingGameState');
    if (pendingGameState) {
      console.log('📦 Found pending game state, processing after init...');
      this.game.registry.remove('pendingGameState');
      // Process it immediately for late joins
      this.time.delayedCall(100, () => {
        console.log('⏰ Processing delayed game state now');
        this.events.emit('network:gameState', pendingGameState);
      });
    }
    
    // For late joins, also listen for the initial game state
    if (this.matchData?.isLateJoin) {
      // Set up a one-time handler for game state that makes us visible
      const gameStateHandler = (gameState: any) => {
        console.log('📦 Received initial game state for late join');
        this.events.off('network:gameState', gameStateHandler);
        
        // Ensure we become visible immediately
        if (this.playerSprite && !this.playerSprite.visible) {
          console.log('👁️ Making late join player visible');
          this.playerSprite.setVisible(true);
          this.playerSprite.setAlpha(1);
        }
      };
      
      this.events.once('network:gameState', gameStateHandler);
    }
    
    // Send player:join to backend now that scene is ready
    const finalLoadout = this.game.registry.get('playerLoadout');
    if (finalLoadout && this.networkSystem.getSocket()?.connected) {
      // SENIOR DEV REVIEW: Include player name for scoreboard display
      const playerName = this.game.registry.get('playerName') || 
                        `Player${Math.floor(Math.random() * 9999)}`;
      
      console.log(`📤 Sending player:join with loadout and name: ${playerName}`);
      this.networkSystem.emit('player:join', {
        loadout: finalLoadout,
        playerName: playerName,  // Backend expects this for display
        timestamp: Date.now()
      });
      
      // For late joins, request spawn position now that scene is ready
      if (this.matchData?.isLateJoin && !this.playerSprite.visible) {
        const socket = this.networkSystem.getSocket();
        if (socket && socket.connected) {
          console.log('📡 Requesting spawn position for late join (scene ready)');
          socket.emit('request_spawn_position', {
            team: this.playerLoadout?.team || 'blue'
          });
        }
      }
    }
  }

  private updateWarned = false;
  private frameCount = 0;
  
  update(time: number, delta: number): void {
    this.frameCount++;
    
    // Debug: Check if we're in the right scene
    if (this.frameCount % 60 === 0) {
      const activeScenes = this.scene.manager.getScenes(true);
      if (activeScenes.length > 1) {
        console.warn('⚠️ Multiple scenes active:', activeScenes.map(s => s.scene.key));
      }
      
      // Periodic health check
      if (this.frameCount % 300 === 0) { // Every 5 seconds
        console.log('🏥 Health check at frame', this.frameCount);
        console.log('  - FPS:', Math.round(this.game.loop.actualFps));
        console.log('  - Sprites:', this.children.list.length);
        console.log('  - Wall slices:', this.wallSliceSprites.size);
        console.log('  - Socket listeners:', (this.networkSystem.getSocket() as any)?._callbacks ? Object.keys((this.networkSystem.getSocket() as any)._callbacks).length : 0);
      }
    }
    
    // Safety check for emergency transitions
    if (!this.playerSprite || !this.inputSystem) {
      if (!this.updateWarned) {
        console.warn('⚠️ Update called but systems not ready, skipping frames');
        this.updateWarned = true;
      }
      return;
    }
    
    // Update local player movement FIRST for immediate feedback
    this.updateLocalPlayer(delta);

    // Update player position in InputSystem BEFORE processing input
    this.inputSystem.setPlayerPosition(this.playerPosition.x, this.playerPosition.y);

    // Calculate player rotation from mouse position
    const mouse = this.input.activePointer;
    const worldPoint = this.cameras.main.getWorldPoint(mouse.x, mouse.y);
    this.playerRotation = Math.atan2(
      worldPoint.y - this.playerPosition.y,
      worldPoint.x - this.playerPosition.x
    );

    // Update player sprite rotation to face mouse (rotated 90 degrees clockwise)
    try {
      if (this.playerSprite && this.playerSprite.scene) {
        this.playerSprite.setRotation(this.playerRotation + Math.PI / 2);
      }
    } catch (error) {
      console.error('❌ Error updating player sprite rotation:', error);
    }
    
    // Update weapon position and rotation for shoulder mounting
    const shoulderOffset = 8; // Distance from center to shoulder
    const shoulderAngle = this.playerRotation + Math.PI / 2; // 90 degrees clockwise for right side
    const shoulderX = Math.cos(shoulderAngle) * shoulderOffset;
    const shoulderY = Math.sin(shoulderAngle) * shoulderOffset;
    
    // Add forward offset (ahead of player)
    const forwardOffset = 6; // Distance ahead of player
    const forwardX = Math.cos(this.playerRotation) * forwardOffset;
    const forwardY = Math.sin(this.playerRotation) * forwardOffset;
    
    // Combine both offsets
    const weaponX = this.playerPosition.x + shoulderX + forwardX;
    const weaponY = this.playerPosition.y + shoulderY + forwardY;
    
    this.playerWeapon.setPosition(weaponX, weaponY);
    this.playerWeapon.setRotation(this.playerRotation + Math.PI); // Weapon flipped 180 degrees

    // Update weapon type if it changed
    const currentWeapon = this.inputSystem.getCurrentWeapon();
    if (currentWeapon && currentWeapon !== (this.playerWeapon as any).weaponType) {
      // Destroy old weapon and create new one
      this.playerWeapon.destroy();
      
      this.playerWeapon = this.assetManager.createWeapon(
        this.playerPosition.x,
        this.playerPosition.y,
        currentWeapon,
        this.playerRotation // Pass current facing angle
      );
      this.playerWeapon.setDepth(20);
      (this.playerWeapon as any).weaponType = currentWeapon; // Store for comparison
    }

    // Vision is now updated from backend game state only
    // No local vision calculation needed!

    // Update systems
    this.inputSystem.update(delta);
    this.networkSystem.update(delta);
    this.visualEffectsSystem.update(delta);
    this.destructionRenderer.update(delta);
    this.weaponUI.update(delta);
    this.screenShakeSystem.update(delta);
    this.notificationSystem.update(delta);
    this.restartSystem.update(delta);
    this.performanceMonitor.update(delta);

    // Update UI elements
    this.updatePhaserUI();
    
    // Update kill counter if we have current game state
    if (this.killCounterContainer && this.currentGameState) {
      this.updateKillCounter(this.currentGameState);
    }
    

  }

  private createPhaserUI(): void {
    // Create health bar
    this.healthBar = this.add.graphics();
    this.healthBar.setDepth(100);

    // Create crosshair
    this.crosshair = this.add.graphics();
    this.crosshair.setDepth(100);

    // Create ammo text
    this.ammoText = this.add.text(GAME_CONFIG.GAME_WIDTH - 10, GAME_CONFIG.GAME_HEIGHT - 20, '30/90', {
      fontSize: '8px',
      color: '#ffffff'
    });
    this.ammoText.setOrigin(1, 0);
    this.ammoText.setDepth(100);

    // Weapon text removed for clean UI

    // Create grenade charge bar
    this.grenadeChargeBar = this.add.graphics();
    this.grenadeChargeBar.setDepth(100);

    // Create wall graphics
    this.wallGraphics = this.add.graphics();
    this.wallGraphics.setDepth(5);
    
    // Remove the green game bounds graphics that were causing "green tiling"
    // No more green bounds overlay
  }

  private updatePhaserUI(): void {
    // Update health bar
    this.healthBar.clear();
    const currentHealth = this.weaponUI.getHealth();
    const healthPercent = currentHealth / 100;
    
    // Background
    this.healthBar.fillStyle(0x333333);
    this.healthBar.fillRect(10, 10, 60, 6);
    
    // Health fill
    const healthColor = healthPercent > 0.6 ? 0x00ff00 : healthPercent > 0.3 ? 0xffff00 : 0xff0000;
    this.healthBar.fillStyle(healthColor);
    this.healthBar.fillRect(10, 10, 60 * healthPercent, 6);
    
    // Border
    this.healthBar.lineStyle(1, 0xffffff);
    this.healthBar.strokeRect(10, 10, 60, 6);

    // Update crosshair to follow mouse cursor
    this.updateDynamicCrosshair();

    // Update ammo text
    const ammo = this.weaponUI.getCurrentWeaponAmmo();
    if (ammo.isReloading) {
      this.ammoText.setText('RELOADING...');
      this.ammoText.setColor('#ffff00');
    } else {
      this.ammoText.setText(`${ammo.current}/${ammo.reserve}`);
      this.ammoText.setColor('#ffffff');
    }

    // Weapon text display removed for clean UI

    // Update grenade charge
    const grenadeCharge = this.weaponUI.getGrenadeCharge();
    this.grenadeChargeBar.clear();
    
    if (grenadeCharge > 0) {
      const barWidth = 40;
      const barHeight = 4;
      const centerX = GAME_CONFIG.GAME_WIDTH / 2;
      const centerY = GAME_CONFIG.GAME_HEIGHT / 2;
      const barX = centerX - barWidth / 2;
      const barY = centerY - 30;
      
      // Background
      this.grenadeChargeBar.fillStyle(0x333333);
      this.grenadeChargeBar.fillRect(barX, barY, barWidth, barHeight);
      
      // Charge fill
      const chargePercent = grenadeCharge / 5;
      this.grenadeChargeBar.fillStyle(chargePercent > 0.8 ? 0xff0000 : 0xffff00);
      this.grenadeChargeBar.fillRect(barX, barY, barWidth * chargePercent, barHeight);
      
      // Border
      this.grenadeChargeBar.lineStyle(1, 0xffffff);
      this.grenadeChargeBar.strokeRect(barX, barY, barWidth, barHeight);
    }

    // Update walls using DestructionRenderer - only update every 10 frames to reduce overhead
    if (this.frameCount % 10 === 0) {
      this.updateWallsFromDestructionRenderer();
    }
  }

  private updateWallsFromDestructionRenderer(): void {
    // Clear any previous graphics overlays (for debug mode)
    this.wallGraphics.clear();
    
    // Get walls from DestructionRenderer - only include boundary walls if debug mode is on
    const showBoundaryWalls = (this as any).showBoundaryWalls || false;
    const walls = this.destructionRenderer.getWallsData(showBoundaryWalls);
    
    // Log wall update status periodically
    if (this.frameCount % 600 === 0 || walls.length > 0 && this.wallSliceSprites.size === 0) {
      console.log(`🧱 Wall rendering: ${walls.length} walls, ${this.wallSliceSprites.size} sprites`);
    }
    
    // Track which wall slices we should have sprites for
    const expectedSliceIds = new Set<string>();
    
    walls.forEach(wall => {
      // Check if this is a 10x10 pillar (special case)
      const isPillar = wall.width === 10 && wall.height === 10;
      
      // Render each slice individually - back to one slice = one sprite
      for (let i = 0; i < 5; i++) {
        const sliceHealth = wall.sliceHealth[i];
        const isDestroyed = wall.destructionMask[i] === 1;
        const sliceId = `wall_${wall.id}_slice_${i}`;
        
        // Skip destroyed slices completely
        if (isDestroyed) {
          // Remove sprite if it exists
          if (this.wallSliceSprites.has(sliceId)) {
            this.wallSliceSprites.get(sliceId)!.destroy();
            this.wallSliceSprites.delete(sliceId);
          }
          continue;
        }
        
        expectedSliceIds.add(sliceId);
        
        // Calculate slice position and dimensions
        let sliceX: number, sliceY: number, sliceWidth: number, sliceHeight: number;
        
        if (isPillar) {
          // Special case: 10x10 pillars have 2px tall horizontal slices
          sliceWidth = wall.width;
          sliceHeight = 2;
          sliceX = wall.position.x + sliceWidth / 2;
          // For 10x20 sprites with bottom origin, position at bottom of slice
          sliceY = wall.position.y + (i * sliceHeight) + sliceHeight;
        } else if (wall.orientation === 'horizontal') {
          // Horizontal wall: vertical slices (divide width by 5)
          sliceWidth = wall.width / 5;
          sliceHeight = wall.height;
          sliceX = wall.position.x + (i * sliceWidth) + sliceWidth / 2;
          // For 10x20 sprites with bottom origin, position at bottom of slice
          sliceY = wall.position.y + sliceHeight;
        } else {
          // Vertical wall: horizontal slices (divide height by 5)
          sliceWidth = wall.width;
          sliceHeight = wall.height / 5;
          sliceX = wall.position.x + sliceWidth / 2;
          // For 10x20 sprites with bottom origin, position at bottom of slice
          sliceY = wall.position.y + (i * sliceHeight) + sliceHeight;
        }
        
        // Create or update wall slice sprite - back to simple createWall
        if (!this.wallSliceSprites.has(sliceId)) {
          // Determine material type for sprite selection
          const material = wall.material === 'wood' ? 'wood' : 'concrete';
          
          // Create simple wall slice sprite (one slice = one texture)
          const sliceSprite = this.assetManager.createWall(sliceX, sliceY, material);
          sliceSprite.setDepth(10); // Above floor but below players
          
          this.wallSliceSprites.set(sliceId, sliceSprite);
        }
        
        // Update wall slice appearance based on damage
        const sliceSprite = this.wallSliceSprites.get(sliceId)!;
        const healthPercent = sliceHealth / wall.maxHealth;
        
        // Apply damage effects to sprite
        if (healthPercent <= 0.25) {
          sliceSprite.setAlpha(0.6); // Critical damage
          sliceSprite.setTint(0x888888); // Darker
        } else if (healthPercent <= 0.75) {
          sliceSprite.setAlpha(0.8); // Damaged
          sliceSprite.setTint(0xcccccc); // Slightly darker
        } else {
          sliceSprite.setAlpha(1.0); // Healthy
          sliceSprite.setTint(0xffffff); // Normal color
        }
      }
      
      // Draw boundary wall indicators using graphics (debug)
      const isBoundaryWall = wall.position.x < 0 || wall.position.y < 0 || 
                            wall.position.x >= GAME_CONFIG.GAME_WIDTH || 
                            wall.position.y >= GAME_CONFIG.GAME_HEIGHT;
      
      if (isBoundaryWall && showBoundaryWalls) {
        // Draw boundary walls with a distinctive red border for debugging
        this.wallGraphics.lineStyle(2, 0xff0000, 0.8);
        this.wallGraphics.strokeRect(wall.position.x, wall.position.y, wall.width, wall.height);
        
        // Add visual indicator for boundary walls
        this.wallGraphics.lineStyle(1, 0xff0000, 0.3);
        this.wallGraphics.beginPath();
        this.wallGraphics.moveTo(wall.position.x, wall.position.y);
        this.wallGraphics.lineTo(wall.position.x + wall.width, wall.position.y + wall.height);
        this.wallGraphics.moveTo(wall.position.x + wall.width, wall.position.y);
        this.wallGraphics.lineTo(wall.position.x, wall.position.y + wall.height);
        this.wallGraphics.strokePath();
      }
    });
    
    // Remove sprites for wall slices that no longer exist
    for (const [sliceId, sprite] of this.wallSliceSprites.entries()) {
      if (!expectedSliceIds.has(sliceId)) {
        sprite.destroy();
        this.wallSliceSprites.delete(sliceId);
      }
    }
  }

  private getMaterialColor(material: string): number {
    switch (material) {
      case 'concrete': return 0x808080;
      case 'wood': return 0x8B4513;
      case 'metal': return 0x404040;  // Updated to match backend
      case 'glass': return 0x87CEEB;  // Updated to match backend
      default: return 0x808080;
    }
  }

  private getWeaponIndex(weaponName: string | null): number {
    switch (weaponName) {
      case 'rifle': return 1;
      case 'pistol': return 2;
      case 'grenade': return 3;
      case 'rocket': return 4;
      default: return 1;
    }
  }

  private setupNetworkListeners(): void {
    // Connection status updates
    this.events.on('network:connected', () => {
      this.connectionStatus.setText('Connected to server');
      this.connectionStatus.setColor('#00ff00');
    });

    this.events.on('network:disconnected', (reason: string) => {
      this.connectionStatus.setText(`Disconnected: ${reason}`);
      this.connectionStatus.setColor('#ff0000');
    });

    this.events.on('network:connectionFailed', () => {
      this.connectionStatus.setText('Connection failed');
      this.connectionStatus.setColor('#ff0000');
    });

    // Game ready event (when authenticated and ready to play)
    this.events.on('network:gameReady', () => {
      this.connectionStatus.setText('Connected to server');
      this.connectionStatus.setColor('#00ff00');
      console.log('GameScene: Game ready event received');
    });

    // Set up network authentication
    this.events.on('network:authenticated', (data: any) => {
      console.log('🎮 GameScene: Authentication successful');
      
      // Set local player ID for proper identification
      const socketId = this.networkSystem.getSocket()?.id;
      if (socketId) {
        this.setLocalPlayerId(socketId);
      }
    });

    // Handle spawn position for late joins
    const socket = this.networkSystem.getSocket();
    if (socket) {
      socket.on('spawn_position', (data: any) => {
        console.log('📍 Received spawn position from backend:', data);
        if (data.position) {
          this.playerPosition = { x: data.position.x, y: data.position.y };
          
          // Update player sprite position and make visible
          if (this.playerSprite) {
            this.playerSprite.setPosition(this.playerPosition.x, this.playerPosition.y);
            this.playerSprite.setVisible(true);
            this.playerSprite.setAlpha(1);
            console.log('✅ Player moved to spawn position:', this.playerPosition);
          }
          
          // Update client prediction with new position
          // Client prediction will use the updated playerPosition on next update
        }
      });
    }
    
    // Game state updates from server
    this.events.on('network:gameState', (gameState: GameState) => {
      this.lastGameStateTime = Date.now();
      
      // DEBUG: Track kill changes to catch double-counting
      const players = Object.values(gameState.players || {});
      const playersWithKills = players.filter((p: any) => p.kills > 0);
      
      // Check if kills changed
      let killsChanged = false;
      players.forEach((p: any) => {
        const prevKills = this.previousKillCounts?.[p.id] || 0;
        if (p.kills !== prevKills) {
          killsChanged = true;
          console.log(`🔴 KILL CHANGE DETECTED: Player ${p.id?.substring(0, 8)} went from ${prevKills} to ${p.kills} kills`);
          if (p.kills - prevKills > 1) {
            console.error(`❌ DOUBLE COUNT BUG: Player gained ${p.kills - prevKills} kills in one update!`);
          }
        }
      });
      
      // Store current kill counts for next comparison
      if (!this.previousKillCounts) this.previousKillCounts = {};
      players.forEach((p: any) => {
        this.previousKillCounts[p.id] = p.kills || 0;
      });
      
      // Log current state if kills changed
      if (killsChanged && playersWithKills.length > 0) {
        console.log('📊 Current kill counts from backend:');
        playersWithKills.forEach((p: any) => {
          console.log(`  ${p.id?.substring(0, 8)} has ${p.kills} kills (team: ${p.team})`);
        });
      }
      
      // Store current game state for kill counter and other systems
      this.currentGameState = gameState;
      
      // Log game state reception
      const wallCount = gameState.walls ? Object.keys(gameState.walls).length : 0;
      const playerCount = Object.keys(gameState.players || {}).length;
      
      // console.log('📊 Processing game state:', {
      //   walls: wallCount,
      //   players: playerCount,
      //   vision: !!gameState.vision,
      //   visiblePlayers: gameState.visiblePlayers ? Object.keys(gameState.visiblePlayers).length : 0
      // });
      
      // Set local player ID for PlayerManager
      const myPlayerId = this.networkSystem.getSocket()?.id;
      if (myPlayerId) {
        this.playerManager.setLocalPlayerId(myPlayerId);
        
        // Check if we need to sync our position and team with backend (for both normal and late joins)
        const shouldSyncWithBackend = this.matchData?.isLateJoin && !this.playerSprite.visible;
        const isFirstGameState = !this.localPlayerId; // First time receiving game state
        
        if (shouldSyncWithBackend || isFirstGameState) {
          try {
            // Try to find our player data in the game state
            let myPlayerData = null;
            
            // Check in visible players (handle both array and object formats)
            if (gameState.visiblePlayers) {
              // Check if it's an array
              if (Array.isArray(gameState.visiblePlayers)) {
                myPlayerData = gameState.visiblePlayers.find((p: any) => p.id === myPlayerId);
              } 
              // Check if it's an object/map
              else if (typeof gameState.visiblePlayers === 'object') {
                myPlayerData = (gameState.visiblePlayers as any)[myPlayerId];
              }
            }
            
            // Check in all players if not found
            if (!myPlayerData && gameState.players) {
              const allPlayers = gameState.players instanceof Map ? 
                gameState.players.get(myPlayerId) : 
                gameState.players[myPlayerId];
              if (allPlayers) {
                myPlayerData = allPlayers;
              }
            }
            
            // If we found our player data, sync position and team
            if (myPlayerData) {
              console.log('📍 Found player data in game state:', myPlayerData);
              
              // Update position if available
              if (myPlayerData.position) {
                this.playerPosition = { x: myPlayerData.position.x, y: myPlayerData.position.y };
                
                // Update player sprite position and make visible
                if (this.playerSprite) {
                  this.playerSprite.setPosition(this.playerPosition.x, this.playerPosition.y);
                  this.playerSprite.setVisible(true);
                  this.playerSprite.setAlpha(1);
                  console.log('✅ Player position synced from game state:', this.playerPosition);
                }
                
                // Reset client prediction to server position
                if (this.clientPrediction) {
                  this.clientPrediction.reset(this.playerPosition);
                  console.log('✅ Client prediction reset to server position');
                }
              }
              
              // Update team color if it doesn't match
              if (myPlayerData.team && this.playerSprite) {
                const currentTexture = this.playerSprite.texture.key;
                const expectedTexture = myPlayerData.team === 'red' ? 'player_red' : 'player_blue';
                
                if (currentTexture !== expectedTexture) {
                  console.log(`🎨 Updating player sprite from ${currentTexture} to ${expectedTexture} (team: ${myPlayerData.team})`);
                  this.playerSprite.setTexture(expectedTexture);
                  
                  // Also update our local loadout to match backend's team assignment
                  if (this.playerLoadout) {
                    this.playerLoadout.team = myPlayerData.team;
                  }
                }
              }
              
              // Store the player ID if this is the first game state
              if (isFirstGameState) {
                this.localPlayerId = myPlayerId;
                console.log('📌 Stored local player ID:', this.localPlayerId);
              }
              
              // Client prediction will use the updated playerPosition on next update
            } else {
              console.log('⚠️ Late join: Could not find player position in game state', {
                myPlayerId,
                hasVisiblePlayers: !!gameState.visiblePlayers,
                visiblePlayersType: Array.isArray(gameState.visiblePlayers) ? 'array' : typeof gameState.visiblePlayers,
                hasPlayers: !!gameState.players,
                playersType: gameState.players instanceof Map ? 'Map' : typeof gameState.players
              });
            }
          } catch (error) {
            console.error('❌ Error processing late join position:', error);
            // Will use fallback spawn position
          }
        }
      }
      

      
      // Debug log game state periodically
      if (Math.random() < 0.05) { // Log 5% of updates
        // Log first visible player structure if available
        if (gameState.visiblePlayers && gameState.visiblePlayers.length > 0) {
  
        }
      }
      
      // Update vision from backend data
      if (gameState.vision) {
        this.visionRenderer.updateVisionFromBackend(gameState.vision);
        
        // Log first time we receive vision data
        if (!(this as any).receivedVisionData) {
          (this as any).receivedVisionData = true;
          
          if (gameState.vision.type === 'polygon') {
            // Polygon vision system active
          } else if (gameState.vision.type === 'tiles' || (gameState.vision as any).visibleTiles) {
            const tiles = gameState.vision.type === 'tiles' 
              ? gameState.vision.visibleTiles 
              : (gameState.vision as any).visibleTiles;
            // Tile vision system active
          }
        }
      } else if (!gameState.vision) {
        // Only warn once
        if (!(this as any).warnedNoVision) {
          (this as any).warnedNoVision = true;
          console.warn('⚠️ No vision data from backend! Make sure backend is sending vision data.');
        }
      }
      
      // Update visible players using filtered data
      if (gameState.visiblePlayers && gameState.visiblePlayers.length > 0) {
        // One-time log when we first get visible players
        if (!(this as any).loggedVisiblePlayers) {
          (this as any).loggedVisiblePlayers = true;
          console.log('🎮 First visible players data received:', {
            count: gameState.visiblePlayers.length,
            firstPlayer: gameState.visiblePlayers[0],
            allPlayerIds: gameState.visiblePlayers.map(p => p.id || 'NO_ID')
          });
        }
        
        // Convert array to object format for PlayerManager
        const playersObj: { [key: string]: any } = {};
        gameState.visiblePlayers.forEach(player => {
          playersObj[player.id] = player;
        });
        this.playerManager.updatePlayers(playersObj);
      } else if (gameState.players) {
        // TEMPORARY WORKAROUND: Use all players until backend implements visibility filtering
        // Convert players object/map to proper format
        const allPlayers = gameState.players instanceof Map ? 
          Object.fromEntries(gameState.players) : 
          gameState.players;
          
        if (!(this as any).warnedWorkaround) {
          (this as any).warnedWorkaround = true;
          console.log('⚠️ Backend not sending visiblePlayers, using ALL players as workaround');
          
          // Log first player structure for debugging
          const firstPlayerId = Object.keys(allPlayers)[0];
          if (firstPlayerId) {
            console.log('📊 First player data structure:', allPlayers[firstPlayerId]);
          }
        }
        
        // Fix player data format
        const fixedPlayers: { [key: string]: any } = {};
        for (const [id, player] of Object.entries(allPlayers)) {
          const p = player as any;
          
          // Skip if no position data at all
          if (!p.transform?.position && !p.position) {
            console.warn(`Player ${id} has no position data, skipping`);
            continue;
          }
          
          // Debug log team data (10% of updates to avoid spam)
          if (Math.random() < 0.1) {
            console.log(`🎨 Player ${id} team data: backend=${p.team} final=${p.team || 'blue'}`);
          }
          
          // Fix position format
          fixedPlayers[id] = {
            ...p,
            position: p.transform?.position || p.position || { x: 0, y: 0 },
            velocity: p.velocity || { x: 0, y: 0 },
            team: p.team || 'blue',  // Changed from 'red' to 'blue' for consistency
            health: p.health !== undefined ? p.health : 100,
            // IMPORTANT: Preserve rotation data for proper player facing direction
            rotation: p.rotation,
            direction: p.direction,
            mouseAngle: p.mouseAngle,
            angle: p.angle
          };
        }
        
        this.playerManager.updatePlayers(fixedPlayers);
      }
      
      // Apply server position to local player
      if (gameState.players && myPlayerId) {
        const players = gameState.players instanceof Map 
          ? gameState.players 
          : gameState.players;
        
        const serverPlayer = players instanceof Map 
          ? players.get(myPlayerId)
          : players[myPlayerId];
        
        if (serverPlayer) {
          // Use client prediction to handle server updates
          this.clientPrediction.onGameStateReceived(serverPlayer);
          
          // Extract server position for backend indicator
          let serverPos = null;
          
          // Format 1: serverPlayer.transform.position
          if ((serverPlayer as any).transform && (serverPlayer as any).transform.position) {
            serverPos = (serverPlayer as any).transform.position;
          }
          // Format 2: serverPlayer.position
          else if (serverPlayer.position) {
            serverPos = serverPlayer.position;
          }
          // Format 3: serverPlayer.x and serverPlayer.y
          else if (typeof (serverPlayer as any).x === 'number' && typeof (serverPlayer as any).y === 'number') {
            serverPos = { x: (serverPlayer as any).x, y: (serverPlayer as any).y };
          }
          
          // Backend indicator removed
          
          // Update our health from game state (authoritative)
          if ((serverPlayer as any).health !== undefined) {
            const newHealth = (serverPlayer as any).health;
            
            // Check if this is a respawn (health went from 0 to positive while dead)
            if (this.isPlayerDead && newHealth > 0) {
              console.log('🔄 Detected respawn through game state (health restored to:', newHealth, ')');
              console.log('🔄 Server position:', serverPlayer.position || serverPlayer);
              
              // Extract position from various possible formats
              let respawnPosition = this.playerPosition;
              if (serverPlayer.position) {
                respawnPosition = serverPlayer.position;
              } else if ((serverPlayer as any).transform?.position) {
                respawnPosition = (serverPlayer as any).transform.position;
              } else if (typeof (serverPlayer as any).x === 'number' && typeof (serverPlayer as any).y === 'number') {
                respawnPosition = { x: (serverPlayer as any).x, y: (serverPlayer as any).y };
              }
              
              console.log('🔄 Using respawn position:', respawnPosition);
              
              // Backend respawned us through game state, not event
              this.handleLocalPlayerRespawn({
                playerId: myPlayerId,
                position: respawnPosition,
                health: newHealth
              });
            }
            
            this.weaponUI.updateHealth(newHealth);
          }
          
          // Update weapon data from game state (authoritative)
          if ((serverPlayer as any).weapons) {
            const weapons = (serverPlayer as any).weapons;
            // Update each weapon type's ammo
            for (const [weaponType, weaponData] of Object.entries(weapons)) {
              const data = weaponData as any;
              if (data.currentAmmo !== undefined && data.reserveAmmo !== undefined) {
                this.weaponUI.updateWeaponData(
                  weaponType, 
                  data.currentAmmo, 
                  data.reserveAmmo, 
                  data.isReloading || false
                );
              }
            }
          }
        }
      }
      
      // Handle smoke zones from game state
      if ((gameState as any).smokeZones && Array.isArray((gameState as any).smokeZones)) {
        this.renderSmokeZones((gameState as any).smokeZones);
      }
    });
    
    // Listen for collision events
    this.events.on('network:collision', (collision: CollisionEvent) => {
      if (collision.playerId === this.networkSystem.getSocket()?.id) {
        // Apply corrected position directly
        this.playerPosition.x = collision.position.x;
        this.playerPosition.y = collision.position.y;
        this.playerSprite.setPosition(collision.position.x, collision.position.y);
        
        // Update weapon position with both offsets
        const shoulderOffset = 8;
        const shoulderAngle = this.playerRotation + Math.PI / 2;
        const shoulderX = Math.cos(shoulderAngle) * shoulderOffset;
        const shoulderY = Math.sin(shoulderAngle) * shoulderOffset;
        
        const forwardOffset = 6;
        const forwardX = Math.cos(this.playerRotation) * forwardOffset;
        const forwardY = Math.sin(this.playerRotation) * forwardOffset;
        
        const weaponX = collision.position.x + shoulderX + forwardX;
        const weaponY = collision.position.y + shoulderY + forwardY;
        this.playerWeapon.setPosition(weaponX, weaponY);
        
        // Reset client prediction to new position
        this.clientPrediction.reset(collision.position);
        
        // Visual feedback for collision
        this.visualEffectsSystem.showImpactEffect(collision.position, 0);
        
        // Add collision indicator
        const collisionMarker = this.add.graphics();
        collisionMarker.lineStyle(2, 0xff00ff, 1);
        collisionMarker.strokeCircle(collision.position.x, collision.position.y, 15);
        collisionMarker.setDepth(200);
        
        // Add text to show what was hit
        const collisionText = this.add.text(collision.position.x, collision.position.y - 20, 
          `COLLISION!`, {
          fontSize: '8px',
          color: '#ff00ff'
        }).setOrigin(0.5).setDepth(201);
        
        // Remove after 2 seconds
        this.time.delayedCall(2000, () => {
          collisionMarker.destroy();
          collisionText.destroy();
        });
        
  
        
        // Optional: Small screen shake
        this.cameras.main.shake(50, 0.002);
      }
    });

    // Player join/leave events - now handled in lifecycle section below

    // Listen for backend position updates
    this.events.on('backend:weapon:fired', (data: any) => {
      if (data.position) {
        // Backend indicator removed
        
        // Also sync our player position when backend sends position data
        this.applyBackendPosition(data.position);
      }
    });
    
    // Listen for flashbang effects
    this.events.on('backend:flashbang:effect', (data: any) => {
      this.handleFlashbangEffect(data);
    });
    
    // Listen for ANY backend event with position data
    this.events.on('backend:player:moved', (data: any) => {
      if (data.position) {
        this.applyBackendPosition(data.position);
      }
    });
    
    this.events.on('backend:position:update', (data: any) => {
      if (data.position) {
        this.applyBackendPosition(data.position);
      }
    });

    // All debug functionality removed except F key fog toggle
    
    // EMERGENCY RESPAWN: R key to force respawn if stuck
    this.input.keyboard?.on('keydown-R', () => {
      if (this.isPlayerDead) {
        console.log('🚨 EMERGENCY RESPAWN: R key pressed while dead');
        
        // Force enable respawn
        (this as any).canRespawn = true;
        
        // Request respawn from backend
        this.requestRespawn();
        
        // If no response in 1 second, force local respawn
        this.time.delayedCall(1000, () => {
          if (this.isPlayerDead) {
            console.log('🚨 EMERGENCY: Backend not responding, forcing local respawn');
            this.handleLocalPlayerRespawn({
              playerId: this.networkSystem.getSocket()?.id,
              position: this.getTeamSpawnPosition(),
              health: 100
            });
          }
        });
      }
    });
    
    // DEBUG: Test match end flow (Development only)
    // SENIOR DEV REVIEW: Using backend debug events instead of local simulation
    if (process.env.NODE_ENV !== 'production') {
      this.input.keyboard?.on('keydown-M', () => {
        console.log('🧪 DEBUG: Requesting backend match end (M key pressed)');
        const socket = this.networkSystem.getSocket();
        if (socket && socket.connected) {
          // Try multiple event names that backend might expect
          const debugData = { 
            reason: 'Frontend M key test',
            timestamp: Date.now()
          };
          
          // Try the documented event name
          socket.emit('debug:trigger_match_end', debugData);
          console.log('📤 Sent debug:trigger_match_end to backend');
          
          // Also try alternative event names the backend might use
          socket.emit('debug:triggerMatchEnd', debugData);
          socket.emit('debug_trigger_match_end', debugData);
          
          // Set a timeout to check if backend responded
          let gotResponse = false;
          
          // Listen for any response
          const responseHandler = () => {
            gotResponse = true;
          };
          socket.once('debug:match_end_triggered', responseHandler);
          socket.once('debug:match_end_failed', responseHandler);
          
          this.time.delayedCall(2000, () => {
            if (!gotResponse) {
              console.warn('⚠️ No response from backend after 2 seconds.');
              console.log('💡 Backend claims to have implemented the handler but is not responding.');
              console.log('💡 Possible issues:');
              console.log('   1. Backend handler not actually deployed');
              console.log('   2. Event name mismatch');
              console.log('   3. Backend handler has a bug');
              console.log('🔍 Trying to force match end via other methods...');
              
              // Try sending a fake high kill count
              socket.emit('player:update', {
                kills: 50,
                timestamp: Date.now()
              });
            }
          });
        } else {
          console.error('❌ Cannot trigger debug match end - not connected to backend');
        }
      });
      
      this.input.keyboard?.on('keydown-N', () => {
        console.log('🧪 DEBUG: Requesting match state info (N key pressed)');
        const socket = this.networkSystem.getSocket();
        if (socket && socket.connected) {
          // Try multiple event names
          socket.emit('debug:request_match_state');
          socket.emit('debug:requestMatchState');
          socket.emit('debug_request_match_state');
          console.log('📤 Sent debug match state requests to backend');
          
          // Also show local state as fallback
          this.time.delayedCall(500, () => {
            if (this.currentGameState) {
              let redKills = 0, blueKills = 0;
              Object.values(this.currentGameState.players || {}).forEach((p: any) => {
                if (p.team === 'red') redKills += p.kills || 0;
                else if (p.team === 'blue') blueKills += p.kills || 0;
              });
              
              console.log('📊 LOCAL State (Frontend View):');
              console.log(`  Kill Score: RED ${redKills}/${this.killTarget} vs BLUE ${blueKills}/${this.killTarget}`);
              console.log(`  Players: ${Object.keys(this.currentGameState.players || {}).length}`);
              console.log(`  Match Ending: ${this.isMatchEnding}`);
              
              // Show individual player data
              Object.values(this.currentGameState.players || {}).forEach((p: any) => {
                if (p.kills > 0 || p.deaths > 0) {
                  console.log(`  Player ${p.id?.substring(0, 8)} (${p.team}): ${p.kills || 0} kills, ${p.deaths || 0} deaths`);
                }
              });
            }
            
            console.log('💡 If no backend response above, backend needs socket.on("debug:request_match_state")');
          });
        } else {
          console.error('❌ Cannot request match state - not connected to backend');
        }
      });
      
      // Listen for debug responses from backend
      const socket = this.networkSystem.getSocket();
      if (socket) {
        socket.on('debug:match_end_triggered', (data: any) => {
          console.log('✅ Backend triggered match end successfully');
          if (data.redKills !== undefined && data.blueKills !== undefined) {
            console.log(`  Final scores - RED: ${data.redKills}, BLUE: ${data.blueKills}`);
          }
        });
        
        socket.on('debug:match_end_failed', (error: any) => {
          console.error('❌ Debug match end failed:', error.reason);
          console.log('  Hint: Match must be in "playing" status');
        });
        
        socket.on('debug:match_state', (state: any) => {
          console.log('📊 Current Match State from Backend:');
          console.log(`  Status: ${state.status}`);
          console.log(`  Kill Score: RED ${state.redKills}/${state.killTarget} vs BLUE ${state.blueKills}/${state.killTarget}`);
          console.log(`  Players: ${state.playerCount}`);
          
          if (state.players && state.players.length > 0) {
            console.log('\n  Player Details:');
            state.players.forEach((p: any) => {
              const status = p.isAlive ? '✅' : '💀';
              console.log(`    ${status} ${p.playerName} (${p.team}): ${p.kills} kills, ${p.deaths} deaths`);
            });
          }
          
          if (state.matchStartTime) {
            const duration = Math.floor((Date.now() - state.matchStartTime) / 1000);
            console.log(`\n  Match Duration: ${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')}`);
          }
        });
      }
    }

    // ===== PLAYER LIFECYCLE EVENT HANDLERS =====
    
    // Handle player death events (new death system)
    this.events.on('backend:player:died', (data: any) => {
      console.log('💀 Player died event received:', data);
      
      const localSocketId = this.networkSystem.getSocket()?.id;
      console.log('💀 Checking death - localSocketId:', localSocketId, 'data.playerId:', data.playerId);
      
      if (data.playerId === localSocketId || data.playerId === this.localPlayerId) {
        console.log('💀 Local player died!');
        this.handleLocalPlayerDeath(data);
      } else {
        console.log(`💀 Other player died: ${data.playerId}`);
        // Handle other player death - show as corpse in PlayerManager
        this.playerManager.handlePlayerDeath(data.playerId, data.position);
      }
    });

    // Handle player respawn events (new respawn system)
    this.events.on('backend:player:respawned', (data: any) => {
      console.log('✨ Player respawned event received:', data);
      
      const localSocketId = this.networkSystem.getSocket()?.id;
      console.log('✨ Checking respawn - localSocketId:', localSocketId, 'data.playerId:', data.playerId, 'this.localPlayerId:', this.localPlayerId);
      
      // Check multiple sources for player ID
      if (data.playerId === localSocketId || data.playerId === this.localPlayerId) {
        console.log('✨ Local player respawned!');
        this.handleLocalPlayerRespawn(data);
      } else {
        console.log(`✨ Other player respawned: ${data.playerId}`);
        // Handle other player respawn in PlayerManager
        this.playerManager.handlePlayerRespawn(data.playerId, data.position, data.invulnerableUntil);
      }
    });

    // REMOVED: Legacy kill event handler was causing double counting
    // The new backend:player:died event handles everything now
    // Commenting out to prevent double kill tracking
    /*
    this.events.on('backend:player:killed', (data: any) => {
      // REMOVED - This was tracking kills locally AND backend was counting
      // causing each kill to count twice
    });
    */

    // Handle new players joining
    this.events.on('network:playerJoined', (data: any) => {
      console.log('👥 New player joined:', data);
      console.log('🔍 DEBUG: Current wall count:', this.wallSliceSprites.size);
      console.log('🔍 DEBUG: Current player position:', this.playerPosition);
      console.log('🔍 DEBUG: Is this private lobby?', this.matchData?.isPrivate);
      
      // Check scene state when player joins
      console.log('🎬 SCENE STATE ON PLAYER JOIN:');
      const activeScenes = this.scene.manager.getScenes(true);
      console.log('  - Active scenes:', activeScenes.map(s => s.scene.key));
      console.log('  - This scene active?', this.scene.isActive());
      console.log('  - This scene visible?', this.scene.isVisible());
      
      // Check if LobbyStateManager is still around
      import('../systems/LobbyStateManager').then(module => {
        if (module.LobbyStateManager) {
          const instance = module.LobbyStateManager.getInstance();
          const state = instance.getState();
          console.log('  - LobbyStateManager state:', state);
          if (state) {
            console.warn('⚠️ LobbyStateManager still has state during gameplay!');
          }
        }
      }).catch(() => {});
      
      // Ensure the new player gets rendered if they're visible
      if (data.playerState) {
        // Convert single player to map format that updatePlayers expects
        const playerMap = new Map();
        playerMap.set(data.playerId || data.id, data.playerState);
        this.playerManager.updatePlayers(playerMap);
      } else if (data.id && data.position) {
        // Fallback: construct player state from raw data
        const playerState = {
          id: data.id,
          position: data.position,
          health: data.health || 100,
          team: data.team || data.loadout?.team || 'blue'  // Try to get team from multiple sources
        };
        console.log(`🎨 New player ${data.id} joined with team: ${playerState.team}`);
        const playerMap = new Map();
        playerMap.set(data.id, playerState);
        this.playerManager.updatePlayers(playerMap);
      } else {
        console.warn('⚠️ Player joined but missing playerState or position data:', data);
      }
      
      // Don't request fresh game state - it can cause issues with walls disappearing
      // and players being reset to spawn positions
      console.log('📝 Note: Not requesting fresh game state after player join to preserve game integrity');
    });

    // Handle players leaving
    this.events.on('network:playerLeft', (data: any) => {
      console.log('👋 Player left:', data);
      
      // Remove the player from view
      if (data.playerId || data.id) {
        this.playerManager.removePlayer(data.playerId || data.id);
      }
    });

    // Handle player damage events
    this.events.on('backend:player:damaged', (data: any) => {
      const localSocketId = this.networkSystem.getSocket()?.id;
      console.log('🩹 Player damaged event:', data);
      
      if (data.playerId === localSocketId || data.playerId === this.localPlayerId) {
        // Local player took damage
        if (data.newHealth !== undefined) {
          this.weaponUI.updateHealth(data.newHealth);
          
          // Check if health reached zero (death)
          if (data.newHealth <= 0 && !this.isPlayerDead) {
            console.log('💀 Local player health reached 0 - triggering death!');
            this.handleLocalPlayerDeath({
              playerId: data.playerId || localSocketId,
              killerId: data.attackerId || 'Unknown',
              damageType: data.damageType || 'damage',
              position: this.playerPosition
            });
          }
        }
        
        // Screen shake for local player damage
        if (data.damage && data.damage > 0) {
          const intensity = Math.min(data.damage / 20, 1); // Scale based on damage
          this.screenShakeSystem.customShake(150, intensity * 0.02, 'damage');
        }
      }
    });

    // Handle player rotation/direction updates (if backend sends them)
    this.events.on('backend:player:rotated', (data: any) => {
      // Update player manager directly with rotation data
      console.log(`🎯 Received rotation update for player ${data.playerId}: ${data.rotation}`);
    });

  }

  /**
   * Handle local player death - show death screen but keep connected
   */
  private handleLocalPlayerDeath(deathData: any): void {
    console.log('💀 handleLocalPlayerDeath called with:', deathData);
    
    // Validate we're not already dead (prevent double death issues)
    if (this.isPlayerDead) {
      console.warn('⚠️ Already dead, forcing death screen refresh');
      // Force cleanup any stuck death state
      this.forceCleanupDeathState();
    }
    
    this.isPlayerDead = true;
    
    // Prevent all input from dead player
    if (this.inputSystem) {
      this.inputSystem.setPlayerDead(true);
      console.log('💀 InputSystem death state set to true');
    }
    
    // Stop client prediction immediately to prevent rubber banding
    if (this.clientPrediction) {
      (this.clientPrediction as any).enabled = false;
      console.log('💀 Client prediction disabled');
    }
    
    // Show death screen with respawn functionality
    this.showDeathScreen(deathData.killerId || 'Unknown', deathData.damageType || 'damage', deathData.position);
    
    // EMERGENCY FALLBACK: Only activate if death screen fails
    // Cancel any existing emergency timer first
    if (this.emergencyRespawnTimer) {
      console.log('🧹 Cancelling previous emergency respawn timer');
      this.emergencyRespawnTimer.destroy();
      this.emergencyRespawnTimer = null;
    }
    
    // Create new emergency timer
    this.emergencyRespawnTimer = this.time.delayedCall(10000, () => {
      if (this.isPlayerDead) {
        console.log('🚨 EMERGENCY: 10 seconds elapsed with no respawn, forcing recovery');
        this.handleLocalPlayerRespawn({
          playerId: this.networkSystem.getSocket()?.id,
          position: this.getTeamSpawnPosition(),
          health: 100
        });
      }
      this.emergencyRespawnTimer = null; // Clear reference after use
    });
  }

  /**
   * Force cleanup all death-related state - used to prevent stuck states
   */
  private forceCleanupDeathState(): void {
    console.log('🧹 Force cleaning up any existing death state');
    
    // Kill ALL death-related tweens
    if ((this as any).deathContainer) {
      console.log('   Found existing death container, removing it');
      this.tweens.killTweensOf((this as any).deathContainer);
      try {
        (this as any).deathContainer.destroy();
      } catch (e) {
        console.warn('⚠️ Error destroying death container:', e);
      }
      (this as any).deathContainer = null;
    }
    
    // Clear all death timers
    if ((this as any).respawnTimer) {
      console.log('   Clearing existing respawn timer');
      (this as any).respawnTimer.remove();
      (this as any).respawnTimer = null;
    }
    
    // Clear emergency respawn timer
    if (this.emergencyRespawnTimer) {
      console.log('   Clearing emergency respawn timer');
      this.emergencyRespawnTimer.destroy();
      this.emergencyRespawnTimer = null;
    }
    
    // Reset flags
    (this as any).canRespawn = false;
  }

  /**
   * Show death screen UI with respawn options
   */
  private showDeathScreen(killerId: string, damageType: string, deathPosition: any): void {
    console.log('💀 showDeathScreen called with:', { killerId, damageType, deathPosition });
    
    // CRITICAL: Force cleanup ANY existing death state first
    this.forceCleanupDeathState();
    
    try {
      // Create death overlay container
      const deathContainer = this.add.container(GAME_CONFIG.GAME_WIDTH / 2, GAME_CONFIG.GAME_HEIGHT / 2);
      deathContainer.setDepth(10000); // Increased depth to ensure it's on top
      deathContainer.setScrollFactor(0); // Make it stay in place regardless of camera
      (this as any).deathContainer = deathContainer; // Store reference for cleanup
      console.log('💀 Death container created at depth 10000');
    
    // Background overlay
    const overlay = this.add.rectangle(0, 0, GAME_CONFIG.GAME_WIDTH, GAME_CONFIG.GAME_HEIGHT, 0x000000, 0.8);
    deathContainer.add(overlay);
    
    // Death message - BIG and BOLD
    const deathText = this.add.text(0, -60, 'YOU DIED', {
      fontSize: '36px',
      color: '#ff0000',
      align: 'center',
      fontStyle: 'bold'
    });
    deathText.setOrigin(0.5);
    deathText.setShadow(2, 2, '#000000', 2, true, true);
    deathContainer.add(deathText);
    
    // Killer info
    const killerText = this.add.text(0, -20, `Killed by ${killerId}`, {
      fontSize: '16px',
      color: '#ffffff',
      align: 'center'
    });
    killerText.setOrigin(0.5);
    deathContainer.add(killerText);
    
    // Respawn instructions (initially hidden)
    const respawnText = this.add.text(0, 20, 'Press SPACE or ENTER to respawn', {
      fontSize: '12px',
      color: '#00ff00',
      align: 'center'
    });
    respawnText.setOrigin(0.5);
    respawnText.setAlpha(0);
    deathContainer.add(respawnText);
    
    // Auto-respawn countdown
    const countdownText = this.add.text(0, 50, '', {
      fontSize: '10px',
      color: '#ffff00',
      align: 'center'
    });
    countdownText.setOrigin(0.5);
    deathContainer.add(countdownText);
    
    // Make death screen visible immediately (no fade for debugging)
    deathContainer.setAlpha(1);
    console.log('💀 Death screen set to visible (alpha 1)');
    
    // Show respawn button after 3 seconds
    this.time.delayedCall(3000, () => {
      console.log('💀 3 second delay complete, enabling respawn');
      
      // Check if death container still exists before tweening
      if ((this as any).deathContainer && respawnText && respawnText.scene) {
        this.tweens.add({
          targets: respawnText,
          alpha: 1,
          duration: 300
        });
      }
      
      // Enable manual respawn regardless of UI state
      (this as any).canRespawn = true;
      console.log('💀 canRespawn set to true');
    });
    
    // Auto-respawn countdown (5 seconds total)
    let timeLeft = 5;
    // Show initial countdown immediately
    countdownText.setText(`Auto-respawn in ${timeLeft}s`);
    
    const countdownTimer = this.time.addEvent({
      delay: 1000,
      repeat: 4,
      callback: () => {
        timeLeft--;
        // Check if death container and countdown text still exist
        if ((this as any).deathContainer && countdownText && countdownText.scene) {
          if (timeLeft > 0) {
            countdownText.setText(`Auto-respawn in ${timeLeft}s`);
          } else {
            countdownText.setText('Respawning...');
            // Auto-respawn if not manually respawned
            if (this.isPlayerDead) {
              console.log('💀 Auto-respawning after 5 second countdown');
              this.requestRespawn();
            }
          }
        } else if (this.isPlayerDead && timeLeft <= 0) {
          // Still trigger respawn even if UI is gone
          console.log('💀 Auto-respawning (UI destroyed but timer expired)');
          this.requestRespawn();
        }
      }
    });
    
    // Store timer reference for cleanup
    (this as any).respawnTimer = countdownTimer;
    
      console.log('💀 Death screen setup complete - should be visible now');
    } catch (error) {
      console.error('❌ Failed to create death screen:', error);
      console.error('Error details:', error);
      // Emergency recovery - force respawn after delay
      this.isPlayerDead = true;
      this.time.delayedCall(5000, () => {
        console.warn('⚠️ Emergency respawn due to death screen failure');
        this.handleLocalPlayerRespawn({
          playerId: this.networkSystem.getSocket()?.id,
          position: this.getTeamSpawnPosition(),
          health: 100
        });
      });
    }
  }

  /**
   * Get team-based spawn position
   */
  private getTeamSpawnPosition(): { x: number, y: number } {
    const team = this.playerLoadout?.team || 'blue';
    return {
      x: team === 'red' ? 50 : 430,  // Red spawns left, blue spawns right
      y: 135  // Middle of the map
    };
  }

  /**
   * Request respawn from backend
   */
  public requestRespawn(): void {
    console.log('🔄 Requesting respawn from backend');
    console.log('   isPlayerDead:', this.isPlayerDead);
    console.log('   canRespawn:', (this as any).canRespawn);
    console.log('   socketId:', this.networkSystem.getSocket()?.id);
    
    // Make sure we're actually dead before requesting respawn
    if (!this.isPlayerDead) {
      console.warn('⚠️ Cannot respawn - player is not dead');
      return;
    }
    
    // Skip cooldown check if force respawning
    if (!(this as any).canRespawn) {
      console.warn('⚠️ Respawn cooldown active, but attempting anyway...');
      // Don't return - try anyway in case backend allows it
    }
    
    console.log('🔄 Sending player:respawn event to backend');
    this.networkSystem.emit('player:respawn');
    
    // Also try alternative event names in case backend expects different format
    this.networkSystem.emit('respawn');
    this.networkSystem.emit('player_respawn');
    
    // Failsafe: If backend doesn't send proper respawn event within 3 seconds,
    // force clear the death screen (backend might just update game state)
    this.time.delayedCall(3000, () => {
      if (this.isPlayerDead) {
        console.warn('⚠️ No backend:player:respawned event received after 3 seconds');
        
        // Check if our health was restored in game state (backend might update without event)
        const currentHealth = (this.weaponUI as any).health || 0;
        console.log('   Current health:', currentHealth);
        
        if (currentHealth > 0) {
          console.log('✅ Health restored to', currentHealth, '- backend updated state without event');
          this.handleLocalPlayerRespawn({
            playerId: this.networkSystem.getSocket()?.id,
            position: this.playerPosition,
            health: currentHealth
          });
        } else {
          console.log('🚨 CRITICAL: Backend not responding, forcing local respawn');
          // Force respawn locally to prevent permanent ghost state
          this.handleLocalPlayerRespawn({
            playerId: this.networkSystem.getSocket()?.id,
            position: this.getTeamSpawnPosition(),
            health: 100
          });
        }
      }
    });
  }

  /**
   * Hide death screen when respawned
   */
  private hideDeathScreen(): void {
    console.log('🎭 hideDeathScreen called');
    const deathContainer = (this as any).deathContainer;
    if (deathContainer) {
      console.log('🎭 Death container found, destroying it');
      
      // Kill any running tweens on it first
      this.tweens.killTweensOf(deathContainer);
      
      // Destroy immediately instead of fading
      deathContainer.destroy();
      (this as any).deathContainer = null;
      console.log('✅ Death screen destroyed');
    } else {
      console.warn('⚠️ No death container to hide');
    }
    
    // Clear respawn timer
    const respawnTimer = (this as any).respawnTimer;
    if (respawnTimer) {
      respawnTimer.remove();
      (this as any).respawnTimer = null;
    }
    
    // Clear respawn flag
    (this as any).canRespawn = false;
  }

  /**
   * Handle local player respawn - restore input and hide death screen
   */
  private handleLocalPlayerRespawn(respawnData: any): void {
    console.log('🔄 handleLocalPlayerRespawn called with:', respawnData);
    
    // CRITICAL: Reset ALL death-related state
    this.isPlayerDead = false;
    (this as any).canRespawn = false; // Reset respawn flag
    
    // Cancel emergency respawn timer if it exists
    if (this.emergencyRespawnTimer) {
      console.log('🧹 Cancelling emergency respawn timer on respawn');
      this.emergencyRespawnTimer.destroy();
      this.emergencyRespawnTimer = null;
    }
    
    // Force cleanup death UI (in case it's stuck)
    this.forceCleanupDeathState();
    
    // Validate and set respawn position
    let finalPosition: { x: number, y: number };
    if (respawnData.position && 
        !(respawnData.position.x === 0 && respawnData.position.y === 0)) {
      finalPosition = { x: respawnData.position.x, y: respawnData.position.y };
      console.log('📍 Using provided respawn position:', finalPosition);
    } else {
      finalPosition = this.getTeamSpawnPosition();
      console.warn('⚠️ Invalid or missing position, using team spawn:', finalPosition);
    }
    
    this.playerPosition = finalPosition;
    
    // Force sprite position update
    if (this.playerSprite) {
      this.playerSprite.setPosition(finalPosition.x, finalPosition.y);
      this.playerSprite.setVisible(true);
      this.playerSprite.setAlpha(1);
    }
    
    // CRITICAL: Hard reset client prediction to prevent rubber banding
    if (this.clientPrediction) {
      this.clientPrediction.reset(finalPosition);
      // Re-enable prediction
      (this.clientPrediction as any).enabled = true;
      console.log('✅ Client prediction reset and re-enabled');
    }
    
    // Force vision system reset if available
    if ((this as any).visionRenderer) {
      // Vision renderer needs to know our new position
      (this as any).visionRenderer.updatePlayerPosition?.(finalPosition);
    }
    
    // Re-enable input
    if (this.inputSystem) {
      this.inputSystem.setPlayerDead(false);
      // Force input state reset to clear any stuck states
      (this.inputSystem as any).lastInputState = null;
      console.log('✅ Input system re-enabled and reset');
    }
    
    // Hide death screen (redundant but safe)
    console.log('🎭 Hiding death screen');
    this.hideDeathScreen();
    
    // Show invulnerability effect if specified
    if (respawnData.invulnerableUntil) {
      this.showInvulnerabilityEffect(respawnData.invulnerableUntil);
    }
    
    // Update player health to full
    if (this.weaponUI) {
      this.weaponUI.updateHealth(100);
    }
    
    console.log('✨ Local player respawned successfully at', finalPosition);
  }

  /**
   * Show invulnerability effect for newly respawned player
   */
  private showInvulnerabilityEffect(invulnerableUntil: number): void {
    const duration = invulnerableUntil - Date.now();
    if (duration <= 0) return;
    
    console.log(`🛡️ Showing invulnerability effect for ${duration}ms`);
    
    // Flash effect on local player sprite
    const flashTween = this.tweens.add({
      targets: this.playerSprite,
      alpha: { from: 1, to: 0.3 },
      duration: 200,
      yoyo: true,
      repeat: Math.floor(duration / 400), // Flash every 400ms
      ease: 'Power2'
    });
    
    // Clean up after invulnerability expires
    this.time.delayedCall(duration, () => {
      if (flashTween.isPlaying()) {
        flashTween.stop();
      }
      this.playerSprite.setAlpha(1);
      console.log('🛡️ Invulnerability effect ended');
    });
  }

  /**
   * Set the local player ID for proper identification
   */
  setLocalPlayerId(playerId: string): void {
    this.localPlayerId = playerId;
    console.log(`🎮 Local player ID set to: ${playerId}`);
    
    // Pass to PlayerManager for proper local player identification
    this.playerManager.setLocalPlayerId(playerId);
  }

  /**
   * Get local player death state
   */
  isLocalPlayerDead(): boolean {
    return this.isPlayerDead;
  }
  
  private applyBackendPosition(serverPos: { x: number, y: number }): void {
    const localPos = this.playerPosition;
    const drift = Math.hypot(serverPos.x - localPos.x, serverPos.y - localPos.y);
    

    
    // Update backend indicator
    // Backend indicator removed
    
    // Apply position correction
    if (drift > 50) {
      // Large drift - snap to server position
      this.playerPosition.x = serverPos.x;
      this.playerPosition.y = serverPos.y;
      this.playerSprite.setPosition(this.playerPosition.x, this.playerPosition.y);
      
      // Update weapon position with both offsets
      const shoulderOffset = 8;
      const shoulderAngle = this.playerRotation + Math.PI / 2;
      const shoulderX = Math.cos(shoulderAngle) * shoulderOffset;
      const shoulderY = Math.sin(shoulderAngle) * shoulderOffset;
      
      const forwardOffset = 6;
      const forwardX = Math.cos(this.playerRotation) * forwardOffset;
      const forwardY = Math.sin(this.playerRotation) * forwardOffset;
      
      const weaponX = this.playerPosition.x + shoulderX + forwardX;
      const weaponY = this.playerPosition.y + shoulderY + forwardY;
      this.playerWeapon.setPosition(weaponX, weaponY);
      
      console.warn('⚠️ Large drift detected, snapping to backend position');
    } else if (drift > 5) {
      // Small drift - smooth correction
      this.playerPosition.x += (serverPos.x - localPos.x) * 0.2;
      this.playerPosition.y += (serverPos.y - localPos.y) * 0.2;
      this.playerSprite.setPosition(this.playerPosition.x, this.playerPosition.y);
      
      // Update weapon position with both offsets
      const shoulderOffset = 8;
      const shoulderAngle = this.playerRotation + Math.PI / 2;
      const shoulderX = Math.cos(shoulderAngle) * shoulderOffset;
      const shoulderY = Math.sin(shoulderAngle) * shoulderOffset;
      
      const forwardOffset = 6;
      const forwardX = Math.cos(this.playerRotation) * forwardOffset;
      const forwardY = Math.sin(this.playerRotation) * forwardOffset;
      
      const weaponX = this.playerPosition.x + shoulderX + forwardX;
      const weaponY = this.playerPosition.y + shoulderY + forwardY;
      this.playerWeapon.setPosition(weaponX, weaponY);
    }
  }

  private updateLocalPlayerWarned = false;
  private movementLogged = false;
  
  private updateLocalPlayer(delta: number): void {
    // Safety checks
    if (!this.inputSystem || !this.clientPrediction) {
      if (!this.updateLocalPlayerWarned) {
        console.warn('⚠️ updateLocalPlayer: Systems not ready');
        this.updateLocalPlayerWarned = true;
      }
      return;
    }
    
    // Get current input state
    const inputState = this.inputSystem.getInputState();
    const movement = this.inputSystem.getMovementDirection();
    const speed = this.inputSystem.getMovementSpeed();
   
    // Debug: Log when movement starts (only once)
    if (!this.movementLogged && (movement.x !== 0 || movement.y !== 0)) {
      console.log('🎮 Movement detected:', movement, 'Speed:', speed);
      this.movementLogged = true;
      
      // Add freeze debug
      console.log('🔍 Pre-movement state check:');
      console.log('  - Frame:', this.frameCount);
      console.log('  - Active scenes:', this.scene.manager.getScenes(true).map(s => s.scene.key));
      console.log('  - Input buffer size:', (this.clientPrediction as any).inputBuffer?.length);
      console.log('  - Wall count:', this.wallSliceSprites.size);
    }
   
    // Apply input through client prediction for server sync
    if (inputState.sequence > 0) { // Only apply if we have a valid sequence
      // Add movement data to inputState for client prediction
      const inputWithMovement = {
        ...inputState,
        movement,
        movementSpeed: speed
      };
      
      try {
        this.clientPrediction.applyInput(inputWithMovement, inputState.sequence);
      } catch (error) {
        console.error('❌ Error applying input to client prediction:', error);
      }
    }
    
    // Update render positions with smooth corrections
    try {
      this.clientPrediction.updateRenderPosition(delta / 1000);
    } catch (error) {
      console.error('❌ Error updating render position:', error);
    }
    
    // No more color changes for movement speed - using real sprite now
  }

  private createFloorBackground(): void {
    // Create single large floor texture covering the entire game area
    const floorBackground = this.assetManager.createFloorTile(
      GAME_CONFIG.GAME_WIDTH / 2, 
      GAME_CONFIG.GAME_HEIGHT / 2
    );
    floorBackground.setDepth(0); // Bottom layer
    floorBackground.setOrigin(0.5, 0.5); // Center origin
    
    // Scale to cover entire game area
    const scaleX = GAME_CONFIG.GAME_WIDTH / floorBackground.width;
    const scaleY = GAME_CONFIG.GAME_HEIGHT / floorBackground.height;
    floorBackground.setScale(scaleX, scaleY);
    
    this.floorSprites.push(floorBackground);
  }

  private createUI(): void {
    // Initialize crosshair
    this.crosshair = this.add.graphics();
    this.crosshair.setDepth(100);

    // TODO: Setup HUD elements when we have proper game state  
    // Health bar will be created in createPhaserUI() method
  }


  
  private updateDynamicCrosshair(): void {
    this.crosshair.clear();
    
    // Get current mouse position
    const pointer = this.input.activePointer;
    const mouseX = pointer.x;
    const mouseY = pointer.y;
    
    // Get weapon accuracy data
    const currentWeapon = this.weaponUI.getCurrentWeaponName() || 'rifle';
    const isADS = this.weaponUI.isAimingDownSights();
    
    // Weapon accuracy configuration (higher value = more spread/less accurate)
    const weaponAccuracy: { [key: string]: { base: number; ads: number } } = {
      // Primary weapons
      rifle: { base: 4, ads: 1.5 },
      smg: { base: 6, ads: 3 },
      shotgun: { base: 12, ads: 6 },
      battlerifle: { base: 3, ads: 1 },
      sniperrifle: { base: 2, ads: 0.5 },
      
      // Secondary weapons
      pistol: { base: 5, ads: 2.5 },
      revolver: { base: 4, ads: 2 },
      suppressedpistol: { base: 5, ads: 2.5 },
      
      // Support weapons
      machinegun: { base: 8, ads: 4 },
      grenadelauncher: { base: 3, ads: 1.5 },
      antimaterialrifle: { base: 1.5, ads: 0.3 },
      
      // Default fallback
      grenade: { base: 0, ads: 0 },
      smokegrenade: { base: 0, ads: 0 },
      flashbang: { base: 0, ads: 0 },
      rocket: { base: 6, ads: 3 }
    };
    
    // Calculate spread distance
    const accuracy = weaponAccuracy[currentWeapon] || weaponAccuracy.rifle;
    const spread = isADS ? accuracy.ads : accuracy.base;
    
    // Color based on ADS state
    const color = isADS ? 0x00ff00 : 0xffffff;
    const alpha = 0.8;
    
    // Draw center pixel
    this.crosshair.fillStyle(color, alpha);
    this.crosshair.fillRect(mouseX - 0.5, mouseY - 0.5, 1, 1);
    
    // Draw cardinal direction pixels
    if (spread > 0) {
      // Top pixel
      this.crosshair.fillRect(mouseX - 0.5, mouseY - spread - 0.5, 1, 1);
      // Bottom pixel  
      this.crosshair.fillRect(mouseX - 0.5, mouseY + spread - 0.5, 1, 1);
      // Left pixel
      this.crosshair.fillRect(mouseX - spread - 0.5, mouseY - 0.5, 1, 1);
      // Right pixel
      this.crosshair.fillRect(mouseX + spread - 0.5, mouseY - 0.5, 1, 1);
    }
  }

  private createHealthBar(current: number, max: number): string {
    const percent = Math.max(0, Math.min(1, current / max)); // Clamp between 0 and 1
    const barLength = 10;
    const filled = Math.max(0, Math.floor(percent * barLength));
    const empty = Math.max(0, barLength - filled);
    
    if (percent > 0.7) {
      return '🟩'.repeat(filled) + '⬜'.repeat(empty);
    } else if (percent > 0.3) {
      return '🟨'.repeat(filled) + '⬜'.repeat(empty);
    } else if (percent > 0) {
      return '🟥'.repeat(filled) + '⬜'.repeat(empty);
    } else {
      return '⬛'.repeat(barLength);
    }
  }

  shutdown(): void {
    // Reset match state flags
    this.isMatchEnding = false;
    this.matchStartTime = 0;
    
    // Clean up emergency respawn timer
    if (this.emergencyRespawnTimer) {
      console.log('🧹 Cleaning up emergency respawn timer on shutdown');
      this.emergencyRespawnTimer.destroy();
      this.emergencyRespawnTimer = null;
    }
    
    // Clean up socket listeners
    const socket = this.networkSystem?.getSocket();
    if (socket) {
      if ((this as any).matchEndedHandler) {
        socket.off('match_ended', (this as any).matchEndedHandler);
      }
      // Clean up spawn position listener
      socket.off('spawn_position');
    }
    
    // Clean up event listeners first
    this.events.off('update');
    this.input.off('pointermove');
    
    // Clean up UI elements
    if (this.mouseText) {
      this.mouseText.destroy();
      this.mouseText = undefined;
    }
    
    // Clean up systems
    if (this.inputSystem) {
      this.inputSystem.destroy();
    }
    
    // DO NOT destroy NetworkSystem - it's a singleton that should persist!
    // The NetworkSystemSingleton manages its lifecycle
    
    if (this.visualEffectsSystem) {
      this.visualEffectsSystem.destroy();
    }
    if (this.destructionRenderer) {
      this.destructionRenderer.destroy();
    }
    if (this.weaponUI) {
      this.weaponUI.destroy();
    }
    if (this.visionRenderer) {
      this.visionRenderer.destroy();
    }
    if (this.playerManager) {
      this.playerManager.destroy();
    }
    if (this.screenShakeSystem) {
      this.screenShakeSystem.destroy();
    }
    
    // Clean up sprites
    this.wallSliceSprites.forEach(sprite => sprite.destroy());
    this.wallSliceSprites.clear();
    
    this.floorSprites.forEach(sprite => sprite.destroy());
    this.floorSprites.length = 0;
  }



  private setupAudioListeners(): void {
    // Listen for weapon firing
    this.events.on('weapon:fire', (data: any) => {
      // Play weapon fire sound
      fireWeapon(data.weaponType, data.position);
    });
    
    // Listen for weapon throwing
    this.events.on('weapon:throw', (data: any) => {
      // Play throw sound
      throwWeapon(data.weaponType);
    });
  }

  /**
   * Initialize the audio system for the game
   */
  private async initializeAudio(): Promise<void> {
    try {
      console.log('Initializing game audio...');
      
      // Initialize the test audio system first (works without files)
      await audioTest.initialize();
      
             // Make both systems available globally for testing
       (window as any).audioTest = audioTest;
       (window as any).audioManager = audioManager;
       
       // Add easy test functions
       (window as any).testGameAudio = () => {
         console.log('🎮 Testing game audio...');
         setTimeout(() => audioTest.playTestSound('click'), 100);
         setTimeout(() => audioTest.playTestSound('shoot'), 600);
         setTimeout(() => audioTest.playTestSound('explosion'), 1100);
         setTimeout(() => audioTest.playTestSound('beep'), 1600);
       };
       
       // Add weapon test function
       (window as any).testWeapons = () => {
         console.log('🔫 Testing weapon integration...');
         setTimeout(() => {
           console.log('Testing pistol...');
           fireWeapon('pistol');
         }, 100);
         setTimeout(() => {
           console.log('Testing rifle...');
           fireWeapon('rifle');
         }, 1000);
         setTimeout(() => {
           console.log('Testing rocket launcher...');
           fireWeapon('rocketlauncher');
         }, 2000);
         setTimeout(() => {
           console.log('Testing UI click...');
           playUIClick();
         }, 3000);
       };
       
       console.log('✅ Audio test system ready!');
       console.log('🎵 Try these commands in console:');
       console.log('   testGameAudio()    // Test basic sounds');
       console.log('   testWeapons()      // Test weapon integration');
       console.log('   audioTest.playTestSound("shoot")');
       
       // Initialize real audio manager but skip file loading
       try {
         await audioManager.initialize();
         await audioManager.loadAllSounds();
         console.log('✅ Audio manager ready (synthetic sounds only)');
       } catch (fileError) {
         console.log('ℹ️  Audio manager failed to initialize');
       }
      
    } catch (error) {
      console.error('❌ Failed to initialize audio:', error);
    }
  }

  /**
   * Setup match lifecycle event listeners for new lobby system
   */
  private setupMatchLifecycleListeners(): void {
    const socket = this.networkSystem.getSocket();
    if (!socket) return;

    console.log('🎯 Setting up match lifecycle listeners');

    // Store the handler so we can remove it later
    (this as any).matchEndedHandler = (data: any) => {
      console.log('🏁 Match ended event received:', data);
      
      // Validate we haven't already transitioned
      if (this.isMatchEnding) {
        console.log('⚠️ Already handling match end, ignoring duplicate');
        return;
      }
      
      // Backend sends match data directly
      const matchResults = data;
      
      // Validate essential data exists
      if (!matchResults.winnerTeam) {
        console.error('❌ Invalid match end data - missing winnerTeam');
        console.log('Received data:', data);
        return;
      }
      
      // Log what we received for debugging
      console.log('📊 Match Results:', {
        winner: matchResults.winnerTeam,
        score: `RED ${matchResults.redKills} - ${matchResults.blueKills} BLUE`,
        duration: matchResults.duration,
        playerCount: matchResults.playerStats?.length || 0
      });
      
      this.isMatchEnding = true;
      
      // Clean state before transition
      this.cleanupForMatchEnd();
      
      // Reset lobby state to prevent stuck lobbies
      const lobbyStateManager = LobbyStateManager.getInstance();
      lobbyStateManager.handleMatchEnd();
      
      // Pass complete match results to the results scene
      SceneManager.transition(this, 'MatchResultsScene', { matchResults });
    };
    
    socket.on('match_ended', (this as any).matchEndedHandler);

    // Match starting countdown (if applicable)
    socket.on('match_starting', (data: any) => {
      console.log('⏱️ Match starting:', data);
      // Could show countdown overlay if needed
    });

    // Kill target reached notification
    socket.on('kill_target_reached', (data: any) => {
      console.log('🎯 Kill target reached:', data);
      // Match should end soon, no action needed
    });
  }

  /**
   * Create debug UI showing available test keys
   */
  private createDebugUI(): void {
    const debugContainer = this.add.container(10, GAME_CONFIG.GAME_HEIGHT - 80);
    debugContainer.setDepth(95);
    debugContainer.setScrollFactor(0);
    
    // Background
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.7);
    bg.fillRect(0, 0, 200, 70);
    debugContainer.add(bg);
    
    // Title
    const title = this.add.text(5, 5, '🧪 DEBUG CONTROLS', {
      fontSize: '10px',
      color: '#ffff00',
      fontFamily: 'monospace',
      fontStyle: 'bold'
    });
    debugContainer.add(title);
    
    // Instructions
    const instructions = [
      'M - Test match end (50 kills)',
      'N - Simulate backend event', 
      'F - Toggle fog of war'
    ];
    
    instructions.forEach((text, i) => {
      const line = this.add.text(5, 20 + (i * 12), text, {
        fontSize: '9px',
        color: '#00ff00',
        fontFamily: 'monospace'
      });
      debugContainer.add(line);
    });
    
    // Make it semi-transparent and pulsing to indicate debug mode
    this.tweens.add({
      targets: debugContainer,
      alpha: { from: 0.8, to: 1 },
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }
  
  /**
   * Create kill counter HUD for match progress
   */
  private createKillCounterHUD(): void {
    // Only create if we have a valid kill target
    if (!this.killTarget || this.killTarget <= 0) return;

    console.log('🎯 Creating kill counter HUD with target:', this.killTarget);

    // Create container for kill counter
    this.killCounterContainer = this.add.container(GAME_CONFIG.GAME_WIDTH / 2, 20);
    this.killCounterContainer.setDepth(1000); // High depth to stay on top

    // Background panel
    const background = this.add.graphics();
    background.fillStyle(0x000000, 0.8);
    background.lineStyle(1, 0x444444);
    background.fillRect(-100, -15, 200, 30);
    background.strokeRect(-100, -15, 200, 30);

    // Title
    const title = this.add.text(0, -8, `RACE TO ${this.killTarget} KILLS!`, {
      fontSize: '8px',
      color: '#ffffff',
      fontFamily: 'monospace',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Team scores (will be updated dynamically)
    const redScoreText = this.add.text(-60, 5, 'RED: 0', {
      fontSize: '8px',
      color: '#ff4444',
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    const vsText = this.add.text(0, 5, 'VS', {
      fontSize: '6px',
      color: '#888888',
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    const blueScoreText = this.add.text(60, 5, 'BLUE: 0', {
      fontSize: '8px',
      color: '#4444ff',
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    // Add to container
    this.killCounterContainer.add([background, title, redScoreText, vsText, blueScoreText]);

    // Store references for updating
    this.killCounterContainer.setData('redScoreText', redScoreText);
    this.killCounterContainer.setData('blueScoreText', blueScoreText);
  }

  /**
   * Update kill counter with current team scores
   */
  private updateKillCounter(gameState: any): void {
    if (!this.killCounterContainer || !gameState.players) return;

    // Debug: Log first player to see available fields
    const players = Object.values(gameState.players);
    if (players.length > 0 && !this.killCounterDebugLogged) {
      console.log('📊 Sample player data from game state:', players[0]);
      console.log('📊 Available player fields:', Object.keys(players[0] as any));
      this.killCounterDebugLogged = true;
    }

    // Calculate team kill counts
    let redKills = 0;
    let blueKills = 0;

    Object.values(gameState.players).forEach((player: any) => {
      // Validate data types for production safety
      if (typeof player.kills !== 'number') {
        console.error(`⚠️ Invalid kills value for player ${player.id}:`, player.kills);
        return; // Skip this player
      }
      
      // Backend now correctly counts kills (no double-counting)
      const playerKills = player.kills;
      
      if (player.team === 'red') {
        redKills += playerKills;
      } else if (player.team === 'blue') {
        blueKills += playerKills;
      }
    });

    // DEBUG: Log team totals (throttled to avoid spam)
    if (!this.lastKillLogTime || Date.now() - this.lastKillLogTime > 1000) {
      console.log(`📊 KILL TOTALS - RED: ${redKills}, BLUE: ${blueKills}`);
      
      // Also log individual player kills for debugging
      Object.values(gameState.players).forEach((player: any) => {
        if (player.kills > 0) {
          console.log(`  👤 ${player.id?.substring(0, 8)} (${player.team}): ${player.kills} kills`);
        }
      });
      
      this.lastKillLogTime = Date.now();
    }

    // Update display texts
    const redScoreText = this.killCounterContainer.getData('redScoreText');
    const blueScoreText = this.killCounterContainer.getData('blueScoreText');

    if (redScoreText) {
      redScoreText.setText(`RED: ${redKills}/${this.killTarget}`);
    }
    if (blueScoreText) {
      blueScoreText.setText(`BLUE: ${blueKills}/${this.killTarget}`);
    }

    // Check for match end condition - DISABLED: Let backend handle this via match_ended event
    // Client-side detection commented out to prevent duplicate transitions
    // The backend will send 'match_ended' event when kill target is reached
    /*
    if (redKills >= this.killTarget || blueKills >= this.killTarget) {
      this.handleMatchEnd(redKills, blueKills, gameState.players);
      return;
    }
    */
    
        // SENIOR DEV REVIEW: Match end is now backend-authoritative
    // We only log and provide visual feedback, no client-side transitions
    
    // Log when target is reached (backend will handle match end)
    if (redKills >= this.killTarget || blueKills >= this.killTarget) {
      console.log(`🎯 Kill target reached! RED: ${redKills}/${this.killTarget}, BLUE: ${blueKills}/${this.killTarget}`);
      console.log('⏳ Waiting for backend match_ended event...');
    }
    
    // Visual feedback when approaching target (Phaser tween for UI effect)
    if (redKills >= this.killTarget - 5 || blueKills >= this.killTarget - 5) {
      // Flash effect when getting close - pure visual, no logic
      if (this.killCounterContainer && this.killCounterContainer.scene) {
        this.tweens.add({
          targets: this.killCounterContainer,
          alpha: 0.7,
          duration: 500,
          yoyo: true,
          repeat: 1,
          ease: 'Power2'
        });
      }
    }
  }

  /**
   * Clean up game state before match end transition
   * LESSONS FROM RESPAWN: Proper state cleanup prevents issues
   */
  private cleanupForMatchEnd(): void {
    console.log('🧹 Cleaning up for match end transition');
    
    // Stop accepting input
    if (this.inputSystem) {
      // Disable input during match end
      (this.inputSystem as any).enabled = false;
    }
    
    // Clear any death screens
    if (this.isPlayerDead) {
      this.hideDeathScreen();
    }
    
    // Stop vision updates
    if (this.visionRenderer) {
      // Don't destroy, just pause updates
      (this.visionRenderer as any).pauseUpdates = true;
    }
    
    // Clear any active effects
    if (this.visualEffectsSystem) {
      this.visualEffectsSystem.clearAllEffects();
    }
    
    // Reset timers
    if ((this as any).respawnTimer) {
      (this as any).respawnTimer.remove();
      (this as any).respawnTimer = null;
    }
  }
  
  /**
   * Handle match end when kill target is reached
   * CLIENT-SIDE ONLY - Should wait for backend confirmation
   */
  private handleMatchEnd(redKills: number, blueKills: number, players: any): void {
    // Prevent duplicate match end calls
    if (this.isMatchEnding) {
      console.log('⚠️ Match end already in progress, ignoring duplicate call');
      return;
    }
    
    console.log('🏁 Client-side match end detected!', { redKills, blueKills, target: this.killTarget });
    // NOTE: This method is currently disabled in favor of backend event
    this.isMatchEnding = true;

    // Determine winner
    const winnerTeam = redKills >= this.killTarget ? 'red' : 'blue';
    
    // Calculate match duration properly
    const matchDuration = this.matchStartTime > 0 ? 
      Date.now() - this.matchStartTime : 
      Date.now() - (this.lastGameStateTime - 30000); // Fallback to estimate
    
    // Process player statistics
    const playerStats: any[] = [];
    Object.values(players).forEach((player: any) => {
      playerStats.push({
        playerId: player.id || 'Unknown',
        playerName: player.name || player.id || 'Unknown',  // Add playerName field
        team: player.team || 'blue',
        kills: player.kills || 0,
        deaths: player.deaths || 0,
        damageDealt: player.damageDealt || 0,
        isLocalPlayer: player.id === this.localPlayerId
      });
    });

    // Sort players by kills (descending)
    playerStats.sort((a, b) => b.kills - a.kills);

    // Create match results object
    const matchResults = {
      winnerTeam,
      redKills,
      blueKills,
      duration: matchDuration,
      players: playerStats,
      killTarget: this.killTarget
    };

    console.log('🏁 Transitioning to MatchResultsScene with:', matchResults);
    
    // Cleanup before transition
    this.cleanupForMatchEnd();
    
    // Use SceneManager for safe transition
    console.log('🎬 Transitioning to MatchResultsScene with data:', matchResults);
    SceneManager.transition(this, 'MatchResultsScene', { matchResults });
  }


  


  // Development method to create a test environment
  private createTestEnvironment(): void {
    console.log('🧪 FORCE TEST MODE: Creating complete test environment with map');
    
    // Create the map background if it doesn't exist
    if (!this.backgroundSprite) {
      this.backgroundSprite = this.add.tileSprite(0, 0, GAME_CONFIG.GAME_WIDTH, GAME_CONFIG.GAME_HEIGHT, 'mapfloor');
      this.backgroundSprite.setOrigin(0, 0);
      this.backgroundSprite.setDepth(-1000);
      console.log('🧪 TEST MODE: Created map background');
    }

    // Create a proper test map with walls via DestructionRenderer
    if (this.destructionRenderer) {
      // Create a simple box arena with some internal walls
      const testWalls: any = {};
      
      // Outer boundaries
      for (let x = 0; x < GAME_CONFIG.GAME_WIDTH; x += 10) {
        testWalls[`wall_top_${x}`] = {
          id: `wall_top_${x}`,
          x: x,
          y: 0,
          type: 'concrete',
          material: 'concrete',
          width: 10,
          height: 10,
          health: 200,
          destructionMask: Array(100).fill(1)
        };
        testWalls[`wall_bottom_${x}`] = {
          id: `wall_bottom_${x}`,
          x: x,
          y: GAME_CONFIG.GAME_HEIGHT - 10,
          type: 'concrete',
          material: 'concrete',
          width: 10,
          height: 10,
          health: 200,
          destructionMask: Array(100).fill(1)
        };
      }
      
      for (let y = 10; y < GAME_CONFIG.GAME_HEIGHT - 10; y += 10) {
        testWalls[`wall_left_${y}`] = {
          id: `wall_left_${y}`,
          x: 0,
          y: y,
          type: 'concrete',
          material: 'concrete',
          width: 10,
          height: 10,
          health: 200,
          destructionMask: Array(100).fill(1)
        };
        testWalls[`wall_right_${y}`] = {
          id: `wall_right_${y}`,
          x: GAME_CONFIG.GAME_WIDTH - 10,
          y: y,
          type: 'concrete',
          material: 'concrete',
          width: 10,
          height: 10,
          health: 200,
          destructionMask: Array(100).fill(1)
        };
      }
      
      // Add some internal walls for cover
      const internalWalls = [
        { x: 100, y: 80, w: 10, h: 40, type: 'wood' },
        { x: 200, y: 120, w: 40, h: 10, type: 'wood' },
        { x: 300, y: 100, w: 10, h: 60, type: 'concrete' },
        { x: 150, y: 180, w: 60, h: 10, type: 'wood' },
        { x: 250, y: 50, w: 10, h: 40, type: 'concrete' }
      ];
      
      internalWalls.forEach((wall, i) => {
        for (let x = 0; x < wall.w; x += 10) {
          for (let y = 0; y < wall.h; y += 10) {
            const id = `wall_internal_${i}_${x}_${y}`;
            testWalls[id] = {
              id: id,
              x: wall.x + x,
              y: wall.y + y,
              type: wall.type,
              material: wall.type,
              width: 10,
              height: 10,
              health: wall.type === 'wood' ? 100 : 200,
              destructionMask: Array(100).fill(1)
            };
          }
        }
      });
      
      // Send walls to destruction renderer
      this.destructionRenderer.updateWallsFromGameState(testWalls);
      console.log(`🧪 TEST MODE: Created ${Object.keys(testWalls).length} test walls`);
    }
    
    // Create a minimal test player
    const testPlayer = {
      id: 'test-player-' + Date.now(),
      position: { x: 240, y: 135 }, // Center of screen
      rotation: 0,
      scale: { x: 1, y: 1 },
      velocity: { x: 0, y: 0 },
      team: this.playerLoadout?.team || 'blue',
      health: 100,
      isLocal: true
    };

    // Set local player ID
    this.playerManager.setLocalPlayerId(testPlayer.id);
    
    // Add to player manager via the proper method
    this.events.emit('network:playerJoined', testPlayer);

    // Create minimal game state with proper map data
    const testGameState = {
      timestamp: Date.now(),
      players: [testPlayer],
      visiblePlayers: [testPlayer],
      projectiles: [],
      destructionUpdates: [],
      vision: null,
      map: {
        width: GAME_CONFIG.GAME_WIDTH,
        height: GAME_CONFIG.GAME_HEIGHT,
        walls: [
          { x: 100, y: 100, width: 20, height: 60 },
          { x: 300, y: 150, width: 20, height: 60 },
          { x: 200, y: 200, width: 60, height: 20 }
        ]
      }
    };

    // Process this as if it came from backend
    this.events.emit('network:gameState', testGameState);

    // Force enable input system (InputSystem doesn't have setEnabled method)
    if (this.inputSystem) {
      console.log('🧪 TEST MODE: Input system already initialized and ready');
      // The input system is automatically active once initialized
    }

    console.log('🧪 TEST MODE: Complete game environment created');
    console.log('🧪 You should now see the map and be able to move around with WASD');
    console.log('🧪 This includes map background, walls, and player movement');
    console.log('🧪 This bypasses all backend dependencies for testing');
  }
  
  // Render smoke zones from game state
  private renderSmokeZones(smokeZones: any[]): void {
    // Clear previous smoke graphics
    this.smokeZoneGraphics.clear();
    
    // Iterate through each smoke zone
    for (const smoke of smokeZones) {
      const age = Date.now() - smoke.createdAt;
      
      // Skip if expired - adjusted for 15 seconds
      const smokeDuration = smoke.duration || 15000; // Default to 15 seconds
      if (age > smokeDuration) continue;
      
      // Calculate current radius with smoother expansion
      let currentRadius = smoke.radius;
      const expansionTime = smoke.expansionTime || 2000; // 2 seconds to expand
      if (age < expansionTime) {
        // Smooth easing for expansion
        const expansionProgress = this.easeOutCubic(age / expansionTime);
        currentRadius = 10 + (smoke.maxRadius - 10) * expansionProgress;
      } else {
        currentRadius = smoke.maxRadius || 60;
      }
      
      // Calculate opacity with better fade timing for 15 seconds
      let opacity = smoke.density || 0.9;
      const timeLeft = smokeDuration - age;
      
      // Fade in during first second
      if (age < 1000) {
        opacity *= age / 1000;
      }
      // Fade out during last 3 seconds
      else if (timeLeft < 3000) {
        opacity *= timeLeft / 3000;
      }
      
      // Animated time-based offset for swirling effect
      const timeOffset = age * 0.0005; // Slow rotation
      
      // Draw main circular smoke cloud with gradient effect
      // Center is denser, edges are lighter
      const layers = 5; // Multiple layers for depth
      for (let layer = layers - 1; layer >= 0; layer--) {
        const layerScale = 1 - (layer * 0.15); // Each layer is smaller
        const layerOpacity = opacity * (0.3 + (layer * 0.14)); // Outer layers more transparent
        const layerRadius = currentRadius * (1 + (layer * 0.08)); // Outer layers slightly larger
        
        // Animated offset for this layer
        const layerAngle = timeOffset * (1 + layer * 0.2);
        const offsetX = Math.cos(layerAngle) * (layer * 2);
        const offsetY = Math.sin(layerAngle) * (layer * 2);
        
        // Gradient colors from light gray to darker gray
        const grayValue = 0x80 + (layer * 0x10); // Lighter on outside
        const color = (grayValue << 16) | (grayValue << 8) | grayValue;
        
        this.smokeZoneGraphics.fillStyle(color, layerOpacity);
        this.smokeZoneGraphics.fillCircle(
          smoke.position.x + offsetX,
          smoke.position.y + offsetY,
          layerRadius * layerScale
        );
      }
      
      // Add animated wispy circles around the edge for organic look
      const wisps = 6;
      for (let i = 0; i < wisps; i++) {
        const wispAngle = (Math.PI * 2 * i) / wisps + timeOffset;
        const wispDist = currentRadius * 0.6;
        const wispX = smoke.position.x + Math.cos(wispAngle) * wispDist;
        const wispY = smoke.position.y + Math.sin(wispAngle) * wispDist;
        
        // Animated size pulse
        const sizePulse = 1 + Math.sin(age * 0.002 + i) * 0.1;
        const wispRadius = currentRadius * 0.4 * sizePulse;
        
        this.smokeZoneGraphics.fillStyle(0xAAAAAA, opacity * 0.3);
        this.smokeZoneGraphics.fillCircle(wispX, wispY, wispRadius);
      }
      
      // Create or update smoke particles for this zone
      if (!this.smokeParticles.has(smoke.id)) {
        this.createSmokeParticles(smoke);
      }
      this.updateSmokeParticles(smoke);
    }
    
    // Clean up particles for expired smoke zones
    const activeZoneIds = new Set(smokeZones.map(z => z.id));
    for (const [zoneId, particles] of this.smokeParticles.entries()) {
      if (!activeZoneIds.has(zoneId)) {
        // Fade out and remove particles
        particles.forEach(p => {
          if (p.sprite && !p.sprite.scene) return; // Already destroyed
          p.sprite?.destroy();
        });
        this.smokeParticles.delete(zoneId);
      }
    }
  }
  
  // Handle flashbang effect from backend
  private handleFlashbangEffect(data: any): void {
    const myPlayerId = this.networkSystem.getSocket()?.id;
    if (!myPlayerId) return;
    
    // Find if local player was affected
    const myEffect = data.affectedPlayers.find((p: any) => p.playerId === myPlayerId);
    
    if (myEffect) {
      console.log('⚡ Local player flashbanged!', myEffect);
      this.applyFlashbangEffect(myEffect);
    }
  }
  
  // Apply flashbang visual and audio effects
  private applyFlashbangEffect(effect: any): void {
    // Prevent multiple simultaneous flashbangs
    if (this.flashbangActive) return;
    this.flashbangActive = true;
    
    const phases = effect.phases;
    
    // PHASE 1: BLIND (white screen)
    this.flashbangOverlay.setAlpha(effect.intensity * 0.95);
    this.flashbangOverlay.setVisible(true);
    
    // Camera shake based on intensity
    if (effect.intensity > 0.5) {
      this.cameras.main.shake(500, 0.01 * effect.intensity);
    }
    
    // Play ringing sound (if audio system available)
    this.playFlashbangAudio(effect.intensity);
    
    // PHASE 2: DISORIENTED (partial vision, blur)
    this.time.delayedCall(phases.blindDuration, () => {
      // Reduce white overlay opacity
      this.tweens.add({
        targets: this.flashbangOverlay,
        alpha: effect.intensity * 0.5,
        duration: 300,
        ease: 'Power2'
      });
      
      // Add blur effect if possible
      // Note: Phaser doesn't have built-in blur, but we can simulate with alpha
      this.cameras.main.setAlpha(0.7);
    });
    
    // PHASE 3: RECOVERING (slight impairment)
    this.time.delayedCall(phases.blindDuration + phases.disorientedDuration, () => {
      // Further reduce overlay
      this.tweens.add({
        targets: this.flashbangOverlay,
        alpha: effect.intensity * 0.2,
        duration: 500,
        ease: 'Power2'
      });
      
      // Restore camera alpha
      this.cameras.main.setAlpha(0.9);
    });
    
    // PHASE 4: NORMAL (remove all effects)
    this.time.delayedCall(effect.duration, () => {
      // Fade out completely
      this.tweens.add({
        targets: this.flashbangOverlay,
        alpha: 0,
        duration: 500,
        ease: 'Power2',
        onComplete: () => {
          this.flashbangOverlay.setVisible(false);
          this.flashbangActive = false;
        }
      });
      
      // Restore camera
      this.cameras.main.setAlpha(1);
      
      // Restore audio volume
      this.restoreAudioVolume();
    });
  }
  
  // Play flashbang audio effects
  private playFlashbangAudio(intensity: number): void {
    // Reduce game volume
    if (audioManager) {
      // Store original volume (default to 1 if not previously stored)
      if ((this as any).originalAudioVolume === undefined) {
        (this as any).originalAudioVolume = 1;
      }
      
      // Set reduced volume
      audioManager.setMasterVolume((this as any).originalAudioVolume * (1 - intensity * 0.8));
    }
    
    // TODO: Play ringing sound when audio file is available
    // audioManager.playSound('flashbang_ringing', { volume: intensity * 0.7 });
  }
  
  // Restore audio volume after flashbang
  private restoreAudioVolume(): void {
    if (audioManager && (this as any).originalAudioVolume !== undefined) {
      // Gradually restore volume
      const targetVolume = (this as any).originalAudioVolume;
      let currentVolume = (this as any).originalAudioVolume * 0.2; // Start from reduced volume
      
      const restoreInterval = setInterval(() => {
        currentVolume = Math.min(targetVolume, currentVolume + 0.02);
        audioManager.setMasterVolume(currentVolume);
        
        if (currentVolume >= targetVolume) {
          clearInterval(restoreInterval);
          delete (this as any).originalAudioVolume;
        }
      }, 100);
    }
  }
  
  // Easing function for smooth animations
  private easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
  }
  
  // Create smoke particles for a smoke zone
  private createSmokeParticles(smoke: any): void {
    const particles: any[] = [];
    
    // Create more particles for better effect
    for (let i = 0; i < 15; i++) {
      const particle = this.add.graphics();
      particle.setDepth(44);
      
      // Random starting position in a circle
      const angle = (Math.PI * 2 * i) / 15 + Math.random() * 0.5;
      const dist = Math.random() * 15;
      const x = smoke.position.x + Math.cos(angle) * dist;
      const y = smoke.position.y + Math.sin(angle) * dist;
      
      particle.x = x;
      particle.y = y;
      
      // Draw initial particle
      const initialOpacity = 0.2 + Math.random() * 0.15;
      particle.fillStyle(0xC0C0C0, initialOpacity);
      particle.fillCircle(0, 0, 4 + Math.random() * 3);
      
      particles.push({
        sprite: particle,
        vx: (Math.random() - 0.5) * 0.2, // Slower drift
        vy: (Math.random() - 0.5) * 0.2 - 0.1, // Slight upward bias
        baseSize: 4 + Math.random() * 3,
        growthRate: 0.08 + Math.random() * 0.12,
        rotationSpeed: (Math.random() - 0.5) * 0.001,
        angle: angle,
        originalDist: dist
      });
    }
    
    this.smokeParticles.set(smoke.id, particles);
  }
  
  // Update smoke particles animation
  private updateSmokeParticles(smoke: any): void {
    const particles = this.smokeParticles.get(smoke.id);
    if (!particles) return;
    
    const age = Date.now() - smoke.createdAt;
    const smokeDuration = smoke.duration || 15000; // 15 seconds
    const expansionTime = smoke.expansionTime || 2000;
    const expansionProgress = Math.min(1, age / expansionTime);
    
    // Calculate opacity based on smoke lifetime
    let baseOpacity = smoke.density || 0.9;
    const timeLeft = smokeDuration - age;
    
    // Fade in/out timing for 15 seconds
    if (age < 1000) {
      baseOpacity *= age / 1000;
    } else if (timeLeft < 3000) {
      baseOpacity *= timeLeft / 3000;
    }
    
    particles.forEach((p, index) => {
      if (!p.sprite || !p.sprite.scene) return;
      
      // Circular drift with slight turbulence
      p.angle += p.rotationSpeed;
      
      // Update position with drift and rotation
      p.sprite.x += p.vx + Math.cos(p.angle) * 0.05;
      p.sprite.y += p.vy + Math.sin(p.angle) * 0.05;
      
      // Grow particles over time
      const growthFactor = 1 + expansionProgress * p.growthRate * 2;
      const size = p.baseSize * growthFactor;
      
      // Particle opacity based on position and age
      const distFromCenter = Math.sqrt(
        Math.pow(p.sprite.x - smoke.position.x, 2) + 
        Math.pow(p.sprite.y - smoke.position.y, 2)
      );
      const distanceFade = 1 - (distFromCenter / (smoke.maxRadius * 1.2));
      const particleOpacity = baseOpacity * 0.3 * Math.max(0, distanceFade);
      
      // Redraw particle with updated properties
      p.sprite.clear();
      p.sprite.fillStyle(0xB8B8B8, particleOpacity);
      p.sprite.fillCircle(0, 0, size);
      
      // Keep particles within reasonable bounds and respawn if too far
      if (distFromCenter > smoke.maxRadius * 0.9) {
        // Respawn particle near center
        const newAngle = Math.random() * Math.PI * 2;
        const newDist = Math.random() * 20;
        p.sprite.x = smoke.position.x + Math.cos(newAngle) * newDist;
        p.sprite.y = smoke.position.y + Math.sin(newAngle) * newDist;
        p.angle = newAngle;
      }
    });
  }
} 
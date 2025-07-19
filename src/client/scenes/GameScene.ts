import { InputSystem } from '../systems/InputSystem';
import { NetworkSystem } from '../systems/NetworkSystem';
import NetworkSystemSingleton from '../systems/NetworkSystemSingleton';
import { VisualEffectsSystem } from '../systems/VisualEffectsSystem';
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
  private playerSprite!: Phaser.GameObjects.Sprite; // Changed from Rectangle to Sprite
  private playerWeapon!: Phaser.GameObjects.Sprite; // Add weapon sprite
  // Player state tracking
  private playerPosition: { x: number; y: number } = { x: 240, y: 135 };
  private lastGameStateTime: number = 0;
  // Server indicator debug functionality removed
  private isPlayerDead: boolean = false; // Track if local player is dead
  private localPlayerId: string | null = null; // Track local player ID
  private playerRotation: number = 0;
  private connectionStatus!: Phaser.GameObjects.Text;
  
  // Phaser UI elements
  private healthBar!: Phaser.GameObjects.Graphics;
  private crosshair!: Phaser.GameObjects.Graphics;
  private ammoText!: Phaser.GameObjects.Text;
  private weaponText!: Phaser.GameObjects.Text;
  private grenadeChargeBar!: Phaser.GameObjects.Graphics;
  private wallGraphics!: Phaser.GameObjects.Graphics;
  private wallSliceSprites: Map<string, Phaser.GameObjects.Sprite> = new Map(); // Back to regular Sprite
  private floorSprites: Phaser.GameObjects.Sprite[] = [];
  private debugOverlay!: Phaser.GameObjects.Text;
  // Server position indicator visibility flag


  constructor() {
    super({ key: 'GameScene' });
    this.playerPosition = { x: 240, y: 135 }; // Center of 480x270
  }

  init(data: any): void {
    // NetworkSystem singleton will be retrieved in create()
    console.log('GameScene: Initializing');
    
    // Get configured loadout from registry
    const playerLoadout = this.game.registry.get('playerLoadout');
    if (!playerLoadout) {
      console.error('GameScene: No player loadout configured! Returning to ConfigureScene.');
      this.scene.start('ConfigureScene');
      return;
    }
    
    console.log('GameScene: Using configured loadout:', playerLoadout);
  }

  create(): void {
    // Initialize AssetManager first
    this.assetManager = new AssetManager(this);
    
    // Create floor background using actual floor texture
    this.createFloorBackground();

    // Get configured loadout for weapon system
    const playerLoadout = this.game.registry.get('playerLoadout');
    
    // Initialize systems first (before using them)
    this.inputSystem = new InputSystem(this);
    
    // Configure InputSystem with player's weapon loadout
    if (playerLoadout) {
      this.inputSystem.setLoadout(playerLoadout);
    }
    
    // Get NetworkSystem singleton (will update scene reference)
    this.networkSystem = NetworkSystemSingleton.getInstance(this);
    
    this.visualEffectsSystem = new VisualEffectsSystem(this);
    this.destructionRenderer = new DestructionRenderer(this);
    this.weaponUI = new WeaponUI(this);
    this.clientPrediction = new ClientPrediction(this);
    this.visionRenderer = new VisionRenderer(this);
    this.playerManager = new PlayerManager(this);
    this.screenShakeSystem = new ScreenShakeSystem(this);
    
    // Connect VisionRenderer to PlayerManager for partial visibility
    this.playerManager.setVisionRenderer(this.visionRenderer);
    
    // Connect WeaponUI to InputSystem for auto-reload functionality
    this.inputSystem.setWeaponUI(this.weaponUI);
    
    // Initialize audio system
    this.initializeAudio();
    
    // Set up audio event listeners
    this.setupAudioListeners();
    
    // Create local player sprite with configured loadout
    const teamColor = playerLoadout?.team || 'blue'; // Fallback to blue if no team configured
    
    // Debug log to verify team assignment
    console.log(`🎨 Creating local player with team: ${teamColor} (from loadout: ${playerLoadout?.team})`);
    
    this.playerSprite = this.assetManager.createPlayer(
      this.playerPosition.x,
      this.playerPosition.y,
      teamColor
    );
    this.playerSprite.setDepth(21); // Above other players
    this.playerSprite.setRotation(Math.PI / 2); // Start with 90-degree clockwise rotation
    
    // Create weapon sprite for local player using configured primary weapon
    const initialWeapon = playerLoadout?.primary || 'smg'; // Fallback to SMG if no primary configured
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
    
    // Set up client prediction callback
    this.clientPrediction.setPositionCallback((pos) => {
      this.playerPosition.x = pos.x;
      this.playerPosition.y = pos.y;
      this.playerSprite.setPosition(pos.x, pos.y); // Update sprite position
      
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
    
    // Add coordinate debug visualization
    this.addCoordinateDebug();
    
    // Send player join event with loadout when scene starts
    if (this.networkSystem && this.networkSystem.isAuthenticated() && playerLoadout) {
      console.log('🎮 GameScene: Sending player:join with loadout');
      this.networkSystem.emit('player:join', {
        loadout: playerLoadout,
        timestamp: Date.now()
      });
      
      // Failsafe: Send again after 1 second in case the first one was too early
      this.time.delayedCall(1000, () => {
        if (this.networkSystem && this.networkSystem.isAuthenticated()) {
          console.log('🎮 GameScene: Sending player:join again (failsafe)');
          this.networkSystem.emit('player:join', {
            loadout: playerLoadout,
            timestamp: Date.now()
          });
        }
      });
    }

    // Add debug instructions to UI
    const debugText = this.add.text(5, GAME_CONFIG.GAME_HEIGHT - 20, 
      'Debug: P - toggle pos, B - bullets, N - network, L - loadout, J - join', {
      fontSize: '7px',
      color: '#666666'
    }).setOrigin(0, 1);
    
    // Start game loop
    console.log('GameScene created successfully');
  }

  update(time: number, delta: number): void {
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
    this.playerSprite.setRotation(this.playerRotation + Math.PI / 2);
    
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

    // Update UI elements
    this.updatePhaserUI();
    
    // Update debug overlay
    if (this.debugOverlay) {
      const timeSinceLastState = this.lastGameStateTime > 0 
        ? ((Date.now() - this.lastGameStateTime) / 1000).toFixed(1) 
        : 'Never';
      const color = this.lastGameStateTime > 0 && (Date.now() - this.lastGameStateTime) < 5000 
        ? '#00ff00' 
        : '#ff0000';
      
      const fogEnabled = (this.visionRenderer as any).fogLayer?.visible ?? true;
      const fogStatusDisplay = fogEnabled ? 'ENABLED' : 'DISABLED';
      this.debugOverlay.setText(`Last Game State: ${timeSinceLastState}s ago | Fog: ${fogStatusDisplay}`);
      this.debugOverlay.setColor(color);
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

    // Create weapon text
    this.weaponText = this.add.text(10, GAME_CONFIG.GAME_HEIGHT - 20, '1-RIFLE', {
      fontSize: '8px',
      color: '#ffffff'
    });
    this.weaponText.setOrigin(0, 0);
    this.weaponText.setDepth(100);

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

    // Update crosshair
    this.crosshair.clear();
    const centerX = GAME_CONFIG.GAME_WIDTH / 2;
    const centerY = GAME_CONFIG.GAME_HEIGHT / 2;
    const isADS = this.weaponUI.isAimingDownSights();
    const size = isADS ? 2 : 4;
    
    this.crosshair.lineStyle(1, isADS ? 0x00ff00 : 0xffffff, 0.8);
    this.crosshair.beginPath();
    this.crosshair.moveTo(centerX - size, centerY);
    this.crosshair.lineTo(centerX + size, centerY);
    this.crosshair.moveTo(centerX, centerY - size);
    this.crosshair.lineTo(centerX, centerY + size);
    this.crosshair.strokePath();
    
    // Center dot
    this.crosshair.fillStyle(isADS ? 0x00ff00 : 0xffffff);
    this.crosshair.fillRect(centerX - 0.5, centerY - 0.5, 1, 1);

    // Update ammo text
    const ammo = this.weaponUI.getCurrentWeaponAmmo();
    if (ammo.isReloading) {
      this.ammoText.setText('RELOADING...');
      this.ammoText.setColor('#ffff00');
    } else {
      this.ammoText.setText(`${ammo.current}/${ammo.reserve}`);
      this.ammoText.setColor('#ffffff');
    }

    // Update weapon text
    const currentWeapon = this.weaponUI.getCurrentWeaponName();
    const weaponIndex = this.getWeaponIndex(currentWeapon);
    const weaponDisplay = ['', '1-RIFLE', '2-PISTOL', '3-GRENADE', '4-ROCKET'][weaponIndex];
    this.weaponText.setText(weaponDisplay);

    // Update grenade charge
    const grenadeCharge = this.weaponUI.getGrenadeCharge();
    this.grenadeChargeBar.clear();
    
    if (grenadeCharge > 0) {
      const barWidth = 40;
      const barHeight = 4;
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

    // Update walls using DestructionRenderer
    this.updateWallsFromDestructionRenderer();
  }

  private updateWallsFromDestructionRenderer(): void {
    // Clear any previous graphics overlays (for debug mode)
    this.wallGraphics.clear();
    
    // Get walls from DestructionRenderer - only include boundary walls if debug mode is on
    const showBoundaryWalls = (this as any).showBoundaryWalls || false;
    const walls = this.destructionRenderer.getWallsData(showBoundaryWalls);
    
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
      console.log('🎮 GameScene: Authentication successful, preparing to join game');
      
      // Set local player ID for proper identification
      const socketId = this.networkSystem.getSocket()?.id;
      if (socketId) {
        this.setLocalPlayerId(socketId);
      }
      
      // Wait a moment for the backend to be ready, then send player:join
      this.time.delayedCall(500, () => {
        const loadout = this.game.registry.get('playerLoadout');
        if (loadout) {
          console.log('🎮 GameScene: Sending player:join with loadout');
          this.networkSystem.emit('player:join', {
            loadout: loadout,
            timestamp: Date.now()
          });
          
          // Failsafe: Send again after another delay
          this.time.delayedCall(1000, () => {
            console.log('🎮 GameScene: Sending player:join again (failsafe)');
            this.networkSystem.emit('player:join', {
              loadout: loadout,
              timestamp: Date.now()
            });
          });
        } else {
          console.error('❌ No loadout found when trying to join game!');
        }
      });
    });

    // Game state updates from server
    this.events.on('network:gameState', (gameState: GameState) => {
      this.lastGameStateTime = Date.now();
      
      // Set local player ID for PlayerManager
      const myPlayerId = this.networkSystem.getSocket()?.id;
      if (myPlayerId) {
        this.playerManager.setLocalPlayerId(myPlayerId);
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
            this.weaponUI.updateHealth((serverPlayer as any).health);
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

    // ===== PLAYER LIFECYCLE EVENT HANDLERS =====
    
    // Handle player death events (new death system)
    this.events.on('backend:player:died', (data: any) => {
      console.log('💀 Player died event received:', data);
      
      const localSocketId = this.networkSystem.getSocket()?.id;
      if (data.playerId === localSocketId) {
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
      if (data.playerId === localSocketId) {
        console.log('✨ Local player respawned!');
        this.handleLocalPlayerRespawn(data);
      } else {
        console.log(`✨ Other player respawned: ${data.playerId}`);
        // Handle other player respawn in PlayerManager
        this.playerManager.handlePlayerRespawn(data.playerId, data.position, data.invulnerableUntil);
      }
    });

    // LEGACY: Handle local player death from kill events (keep for compatibility)
    this.events.on('backend:player:killed', (data: any) => {
      console.log('💀 Player killed event received (legacy):', data);
      
      // Check if it's the local player who died
      const localSocketId = this.networkSystem.getSocket()?.id;
      if (data.playerId === localSocketId) {
        console.log('💀 Local player has died (legacy)!');
        this.handleLocalPlayerDeath(data);
      } else {
        console.log(`💀 Other player died (legacy): ${data.playerId}`);
        // Handle other player death (remove from view, etc.)
        this.playerManager.removePlayer(data.playerId);
      }
    });

    // Handle new players joining
    this.events.on('network:playerJoined', (data: any) => {
      console.log('👥 New player joined:', data);
      
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
      
      // Failsafe: Force a game state update after a short delay to catch any missed players
      this.time.delayedCall(500, () => {
        console.log('🔄 Requesting fresh game state after player join');
        this.networkSystem.emit('request:gamestate');
      });
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
      
      if (data.playerId === localSocketId) {
        // Local player took damage
        if (data.newHealth !== undefined) {
          this.weaponUI.updateHealth(data.newHealth);
          
          // Check if health reached zero (death)
          if (data.newHealth <= 0) {
            this.isPlayerDead = true;
            console.log('💀 Local player health reached 0 - marking as dead');
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
    this.isPlayerDead = true;
    
    // Prevent all input from dead player
    if (this.inputSystem) {
      this.inputSystem.setPlayerDead(true);
    }
    
    // Show death screen with respawn functionality
    this.showDeathScreen(deathData.killerId || 'Unknown', deathData.damageType || 'damage', deathData.position);
  }

  /**
   * Show death screen UI with respawn options
   */
  private showDeathScreen(killerId: string, damageType: string, deathPosition: any): void {
    // Create death overlay container
    const deathContainer = this.add.container(GAME_CONFIG.GAME_WIDTH / 2, GAME_CONFIG.GAME_HEIGHT / 2);
    deathContainer.setDepth(1000);
    (this as any).deathContainer = deathContainer; // Store reference for cleanup
    
    // Background overlay
    const overlay = this.add.rectangle(0, 0, GAME_CONFIG.GAME_WIDTH, GAME_CONFIG.GAME_HEIGHT, 0x000000, 0.7);
    deathContainer.add(overlay);
    
    // Death message
    const deathText = this.add.text(0, -60, 'YOU DIED', {
      fontSize: '24px',
      color: '#ff0000',
      align: 'center'
    });
    deathText.setOrigin(0.5);
    deathContainer.add(deathText);
    
    // Killer info
    const killerText = this.add.text(0, -20, `Killed by ${killerId}`, {
      fontSize: '14px',
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
    
    // Fade in death screen
    deathContainer.setAlpha(0);
    this.tweens.add({
      targets: deathContainer,
      alpha: 1,
      duration: 500,
      ease: 'Power2'
    });
    
    // Show respawn button after 3 seconds
    this.time.delayedCall(3000, () => {
      this.tweens.add({
        targets: respawnText,
        alpha: 1,
        duration: 300
      });
      
      // Enable manual respawn
      (this as any).canRespawn = true;
    });
    
    // Auto-respawn countdown (5 seconds total)
    let timeLeft = 5;
    const countdownTimer = this.time.addEvent({
      delay: 1000,
      repeat: 4,
      callback: () => {
        timeLeft--;
        if (timeLeft > 0) {
          countdownText.setText(`Auto-respawn in ${timeLeft}s`);
        } else {
          countdownText.setText('');
          // Auto-respawn if not manually respawned
          if (this.isPlayerDead) {
            this.requestRespawn();
          }
        }
      }
    });
    
    // Store timer reference for cleanup
    (this as any).respawnTimer = countdownTimer;
  }

  /**
   * Request respawn from backend
   */
  private requestRespawn(): void {
    console.log('🔄 Requesting respawn');
    this.networkSystem.emit('player:respawn');
  }

  /**
   * Hide death screen when respawned
   */
  private hideDeathScreen(): void {
    const deathContainer = (this as any).deathContainer;
    if (deathContainer) {
      this.tweens.add({
        targets: deathContainer,
        alpha: 0,
        duration: 300,
        onComplete: () => {
          deathContainer.destroy();
          (this as any).deathContainer = null;
        }
      });
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
    this.isPlayerDead = false;
    
    // Restore input for alive player
    if (this.inputSystem) {
      this.inputSystem.setPlayerDead(false);
    }
    
    // Hide death screen
    this.hideDeathScreen();
    
    // Show invulnerability effect if specified
    if (respawnData.invulnerableUntil) {
      this.showInvulnerabilityEffect(respawnData.invulnerableUntil);
    }
    
    // Update player health to full
    if (this.weaponUI) {
      this.weaponUI.updateHealth(100);
    }
    
    console.log('✨ Local player respawned successfully');
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

  private updateLocalPlayer(delta: number): void {
    // Get current input state
    const inputState = this.inputSystem.getInputState();
    const movement = this.inputSystem.getMovementDirection();
    const speed = this.inputSystem.getMovementSpeed();
   
    // Apply input through client prediction for server sync
    if (inputState.sequence > 0) { // Only apply if we have a valid sequence
      // Add movement data to inputState for client prediction
      const inputWithMovement = {
        ...inputState,
        movement,
        movementSpeed: speed
      };
      this.clientPrediction.applyInput(inputWithMovement, inputState.sequence);
    }
    
    // Update render positions with smooth corrections
    this.clientPrediction.updateRenderPosition(delta / 1000);
    
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
    // Create input state display for debugging - moved to bottom left
    const inputText = this.add.text(5, GAME_CONFIG.GAME_HEIGHT - 5, '', {
      fontSize: '8px',
      color: '#ffffff',
      lineSpacing: -1  // Slightly tighter line spacing
    });
    inputText.setOrigin(0, 1);
    inputText.setDepth(100);
    
    // Debug overlay for game state tracking
    this.debugOverlay = this.add.text(GAME_CONFIG.GAME_WIDTH - 5, GAME_CONFIG.GAME_HEIGHT - 5, 
      'Last Game State: Never', {
      fontSize: '8px',
      color: '#ffff00'
    }).setOrigin(1, 1).setDepth(1000);

    // Update input display every frame
    this.events.on('update', () => {
      if (this.inputSystem && this.visualEffectsSystem && this.weaponUI) {
        const inputState = this.inputSystem.getInputState();
        const direction = this.inputSystem.getMovementDirection();
        const speed = this.inputSystem.getMovementSpeed();
        const currentWeapon = this.inputSystem.getCurrentWeapon();
        const grenadeCharge = this.inputSystem.getGrenadeChargeLevel();
        const isADS = this.inputSystem.isAimingDownSights();
        const effectCounts = this.visualEffectsSystem.getEffectCounts();
        
        inputText.setText([
          `Pos: ${this.playerPosition.x.toFixed(0)},${this.playerPosition.y.toFixed(0)} | Move: ${(speed * 100).toFixed(0)}%`,
          `Wpn: ${currentWeapon || 'None'} ${isADS ? 'ADS' : ''} | Gren: ${grenadeCharge}/5`,
          `FX: F${effectCounts.muzzleFlashes} E${effectCounts.explosions} H${effectCounts.hitMarkers} P${effectCounts.particles}`,
          `Keys: F=Toggle Fog`
        ].join('\n'));
      }
    });

    // Toggle fog visibility for debugging - toggles both layers
    this.input.keyboard!.on('keydown-F', () => {
      const fogLayer = (this.visionRenderer as any).fogLayer;
      const desatLayer = (this.visionRenderer as any).desaturationLayer;
      if (fogLayer && desatLayer) {
        const newVisibility = !fogLayer.visible;
        fogLayer.setVisible(newVisibility);
        desatLayer.setVisible(newVisibility);
        console.log(`🌫️ Fog layers toggled - visible: ${newVisibility}`);
      }
    });

    // Debug functionality removed - only fog toggle (F key) remains

    // All debug functionality removed except F key fog toggle

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
    // Clean up systems
    if (this.inputSystem) {
      this.inputSystem.destroy();
    }
    
    // DO NOT destroy NetworkSystem - it's a singleton that should persist!
    // The NetworkSystemSingleton manages its lifecycle
    console.log('GameScene: Shutting down - NetworkSystem singleton preserved');
    
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

  private addCoordinateDebug(): void {
    // Draw origin point
    this.add.circle(0, 0, 3, 0xff0000);
    this.add.text(0, 0, '(0,0)', { fontSize: '5px', color: '#ff0000' }).setOrigin(0.5);
    
    // Draw game bounds (480x270)
    const bounds = this.add.rectangle(240, 135, 480, 270);
    bounds.setStrokeStyle(1, 0xffffff, 0.2);
    
    // Grid lines removed - no more green lines on the floor
    
    // Show mouse world position on move - top right corner
    const mouseText = this.add.text(GAME_CONFIG.GAME_WIDTH - 5, 15, '', { fontSize: '8px', color: '#ffff00' });
    mouseText.setOrigin(1, 0);
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      mouseText.setText(`Mouse: (${worldPoint.x.toFixed(0)}, ${worldPoint.y.toFixed(0)})`);
    });
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
} 
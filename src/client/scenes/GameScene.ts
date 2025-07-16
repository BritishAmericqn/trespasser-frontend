import { InputSystem } from '../systems/InputSystem';
import { NetworkSystem } from '../systems/NetworkSystem';
import { VisualEffectsSystem } from '../systems/VisualEffectsSystem';
import { DestructionRenderer } from '../systems/DestructionRenderer';
import { WeaponUI } from '../ui/WeaponUI';
import { ClientPrediction } from '../systems/ClientPrediction';
import { VisionRenderer } from '../systems/VisionRenderer';
import { PlayerManager } from '../systems/PlayerManager';
import { GAME_CONFIG } from '../../../shared/constants/index';
import { GameState, CollisionEvent, Vector2, PolygonVision } from '../../../shared/types/index';

export class GameScene extends Phaser.Scene {
  private inputSystem!: InputSystem;
  private networkSystem!: NetworkSystem;
  private visualEffectsSystem!: VisualEffectsSystem;
  private destructionRenderer!: DestructionRenderer;
  private weaponUI!: WeaponUI;
  private clientPrediction!: ClientPrediction;
  private visionRenderer!: VisionRenderer;
  private playerManager!: PlayerManager;
  private player!: Phaser.GameObjects.Rectangle;
  private playerPosition: { x: number; y: number };
  private playerRotation: number = 0;
  private connectionStatus!: Phaser.GameObjects.Text;
  
  // Phaser UI elements
  private healthBar!: Phaser.GameObjects.Graphics;
  private crosshair!: Phaser.GameObjects.Graphics;
  private ammoText!: Phaser.GameObjects.Text;
  private weaponText!: Phaser.GameObjects.Text;
  private grenadeChargeBar!: Phaser.GameObjects.Graphics;
  private wallGraphics!: Phaser.GameObjects.Graphics;
  private debugOverlay!: Phaser.GameObjects.Text;
  private lastGameStateTime: number = 0;

  constructor() {
    super({ key: 'GameScene' });
    this.playerPosition = { 
      x: GAME_CONFIG.GAME_WIDTH / 2, 
      y: GAME_CONFIG.GAME_HEIGHT / 2 
    };
  }

  create(): void {

    
    // Create background
    this.add.rectangle(0, 0, GAME_CONFIG.GAME_WIDTH, GAME_CONFIG.GAME_HEIGHT, 0x2d2d2d)
      .setOrigin(0, 0);

    // Initialize systems first (before using them)
    this.inputSystem = new InputSystem(this);
    this.networkSystem = new NetworkSystem(this);
    this.visualEffectsSystem = new VisualEffectsSystem(this);
    this.destructionRenderer = new DestructionRenderer(this);
    this.weaponUI = new WeaponUI(this);
    this.clientPrediction = new ClientPrediction();
    this.visionRenderer = new VisionRenderer(this);
    this.playerManager = new PlayerManager(this);
    
    // Connect VisionRenderer to PlayerManager for partial visibility
    this.playerManager.setVisionRenderer(this.visionRenderer);
    
    // Create player sprite (simple colored square)
    this.player = this.add.rectangle(
      this.playerPosition.x,
      this.playerPosition.y,
      20,
      20,
      0x00ff00
    );
    
    // Initialize client prediction with starting position
    this.clientPrediction.reset(this.playerPosition);
    
    // Create backend position indicator (red outline square)
    const backendIndicator = this.add.rectangle(
      this.playerPosition.x,
      this.playerPosition.y,
      22,
      22
    );
    backendIndicator.setStrokeStyle(2, 0xff0000);
    backendIndicator.setDepth(5);
    
    // Store reference for updating
    (this as any).backendIndicator = backendIndicator;

    // Create connection status text
    this.connectionStatus = this.add.text(GAME_CONFIG.GAME_WIDTH - 5, 5, 'Connecting...', {
      fontSize: '8px',
      color: '#ffffff'
    }).setOrigin(1, 0);

    this.inputSystem.initialize();
    this.networkSystem.initialize();
    this.visualEffectsSystem.initialize();
    this.destructionRenderer.initialize();
    this.weaponUI.initialize();
    
    // Set up client prediction callback
    this.clientPrediction.setPositionCallback((pos) => {
      this.playerPosition.x = pos.x;
      this.playerPosition.y = pos.y;
      this.player.setPosition(pos.x, pos.y);
    });

    // Create UI elements using Phaser
    this.createPhaserUI();

    // Create test walls
    this.createTestWalls();

    // Set up network event listeners
    this.setupNetworkListeners();

    // Create debug UI elements
    this.createUI();
    
    // Add coordinate debug visualization
    this.addCoordinateDebug();
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

    // Vision is now updated from backend game state only
    // No local vision calculation needed!

    // Update systems
    this.inputSystem.update(delta);
    this.networkSystem.update(delta);
    this.visualEffectsSystem.update(delta);
    this.destructionRenderer.update(delta);
    this.weaponUI.update(delta);

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
      this.debugOverlay.setText(`Last Game State: ${timeSinceLastState}s ago`);
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
    
    // Create game bounds indicator (always visible)
    const boundsGraphics = this.add.graphics();
    boundsGraphics.setDepth(4);
    boundsGraphics.lineStyle(1, 0x00ff00, 0.3);
    boundsGraphics.strokeRect(0, 0, GAME_CONFIG.GAME_WIDTH, GAME_CONFIG.GAME_HEIGHT);
    boundsGraphics.fillStyle(0x00ff00, 0.1);
    
    // Add corner markers
    const cornerSize = 10;
    boundsGraphics.fillRect(0, 0, cornerSize, cornerSize); // Top-left
    boundsGraphics.fillRect(GAME_CONFIG.GAME_WIDTH - cornerSize, 0, cornerSize, cornerSize); // Top-right
    boundsGraphics.fillRect(0, GAME_CONFIG.GAME_HEIGHT - cornerSize, cornerSize, cornerSize); // Bottom-left
    boundsGraphics.fillRect(GAME_CONFIG.GAME_WIDTH - cornerSize, GAME_CONFIG.GAME_HEIGHT - cornerSize, cornerSize, cornerSize); // Bottom-right
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
    this.wallGraphics.clear();
    
    // Get walls from DestructionRenderer - only include boundary walls if debug mode is on
    const showBoundaryWalls = (this as any).showBoundaryWalls || false;
    const walls = this.destructionRenderer.getWallsData(showBoundaryWalls);
    
    walls.forEach(wall => {
      
      // Check if this is a 10x10 pillar (special case)
      const isPillar = wall.width === 10 && wall.height === 10;
      
      // Render each slice based on orientation
      for (let i = 0; i < 5; i++) {
        const sliceHealth = wall.sliceHealth[i];
        const isDestroyed = wall.destructionMask[i] === 1;
        
        let sliceX: number, sliceY: number, sliceWidth: number, sliceHeight: number;
        
        if (isPillar) {
          // Special case: 10x10 pillars have 2px tall horizontal slices
          sliceWidth = wall.width;
          sliceHeight = 2;
          sliceX = wall.position.x;
          sliceY = wall.position.y + (i * sliceHeight);
        } else if (wall.orientation === 'horizontal') {
          // Horizontal wall: vertical slices (divide width by 5)
          sliceWidth = wall.width / 5;
          sliceHeight = wall.height;
          sliceX = wall.position.x + (i * sliceWidth);
          sliceY = wall.position.y;
        } else {
          // Vertical wall: horizontal slices (divide height by 5)
          sliceWidth = wall.width;
          sliceHeight = wall.height / 5;
          sliceX = wall.position.x;
          sliceY = wall.position.y + (i * sliceHeight);
        }
        
        // Skip rendering destroyed slices completely - they should be invisible
        if (isDestroyed) {
          // Only show destroyed slices if debug mode is enabled
          const showEnhanced = (this as any).showDestroyedSlices;
          if (showEnhanced) {
            // Enhanced visualization for debugging only
            this.wallGraphics.fillStyle(0xff0000, 0.4);
            this.wallGraphics.fillRect(sliceX, sliceY, sliceWidth, sliceHeight);
            this.wallGraphics.lineStyle(1, 0xffff00, 0.8);
            this.wallGraphics.strokeRect(sliceX, sliceY, sliceWidth, sliceHeight);
          }
          // Skip rendering - destroyed slices should be completely invisible
          continue;
        }
        
        // Determine damage state
        const healthPercent = sliceHealth / wall.maxHealth;
        const baseColor = this.getMaterialColor(wall.material);
        
        // Apply damage darkening or glass transparency
        let alpha = 1.0;
        
        // Special handling for glass material
        if (wall.material === 'glass' && healthPercent < 0.5) {
          alpha = 0.3 + (healthPercent * 0.7);
        } else if (healthPercent <= 0.25) {
          alpha = 0.6; // Critical damage
        } else if (healthPercent <= 0.75) {
          alpha = 0.8; // Damaged
        }
        
        // Draw slice
        this.wallGraphics.fillStyle(baseColor, alpha);
        this.wallGraphics.fillRect(sliceX, sliceY, sliceWidth, sliceHeight);
        
        // Add damage cracks for visual feedback
        if (healthPercent < 0.75) {
          this.wallGraphics.lineStyle(1, 0x000000, 0.5);
          const numCracks = Math.floor((1 - healthPercent) * 3);
          for (let j = 0; j < numCracks; j++) {
            const x1 = sliceX + Math.random() * sliceWidth;
            const y1 = sliceY + Math.random() * sliceHeight;
            const x2 = x1 + (Math.random() - 0.5) * 6;
            const y2 = y1 + (Math.random() - 0.5) * 6;
            this.wallGraphics.beginPath();
            this.wallGraphics.moveTo(x1, y1);
            this.wallGraphics.lineTo(x2, y2);
            this.wallGraphics.strokePath();
          }
        }
      }
      
      // Draw wall border - only for boundary walls
      const isBoundaryWall = wall.position.x < 0 || wall.position.y < 0 || 
                            wall.position.x >= GAME_CONFIG.GAME_WIDTH || 
                            wall.position.y >= GAME_CONFIG.GAME_HEIGHT;
      
      if (isBoundaryWall) {
        // Draw boundary walls with a distinctive red border
        this.wallGraphics.lineStyle(2, 0xff0000, 0.8);
        this.wallGraphics.strokeRect(wall.position.x, wall.position.y, wall.width, wall.height);
      }
      // Remove the gray outline for normal walls
      
      // Add visual indicator for boundary walls
      if (isBoundaryWall) {
        // Draw diagonal lines to indicate boundary wall
        this.wallGraphics.lineStyle(1, 0xff0000, 0.3);
        this.wallGraphics.beginPath();
        this.wallGraphics.moveTo(wall.position.x, wall.position.y);
        this.wallGraphics.lineTo(wall.position.x + wall.width, wall.position.y + wall.height);
        this.wallGraphics.moveTo(wall.position.x + wall.width, wall.position.y);
        this.wallGraphics.lineTo(wall.position.x, wall.position.y + wall.height);
        this.wallGraphics.strokePath();
      }
    });
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
          
          // Fix position format
          fixedPlayers[id] = {
            ...p,
            position: p.transform?.position || p.position || { x: 0, y: 0 },
            velocity: p.velocity || { x: 0, y: 0 },
            team: p.team || 'red',
            health: p.health !== undefined ? p.health : 100
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
          
          // Update backend indicator
          if (serverPos) {
            const backendIndicator = (this as any).backendIndicator;
            if (backendIndicator) {
              backendIndicator.setPosition(serverPos.x, serverPos.y);
            }
          }
          
          // Update our health from game state (authoritative)
          if ((serverPlayer as any).health !== undefined) {
            this.weaponUI.updateHealth((serverPlayer as any).health);
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
        this.player.setPosition(collision.position.x, collision.position.y);
        
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

    // Player join/leave events
    this.events.on('network:playerJoined', (playerData: any) => {

    });

    this.events.on('network:playerLeft', (playerData: any) => {

    });

    // Listen for backend position updates
    this.events.on('backend:weapon:fired', (data: any) => {
      if (data.position) {
        const backendIndicator = (this as any).backendIndicator;
        if (backendIndicator) {
          backendIndicator.setPosition(data.position.x, data.position.y);
        }
        
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
  }
  
  private applyBackendPosition(serverPos: { x: number, y: number }): void {
    const localPos = this.playerPosition;
    const drift = Math.hypot(serverPos.x - localPos.x, serverPos.y - localPos.y);
    

    
    // Update backend indicator
    const backendIndicator = (this as any).backendIndicator;
    if (backendIndicator) {
      backendIndicator.setPosition(serverPos.x, serverPos.y);
    }
    
    // Apply position correction
    if (drift > 50) {
      // Large drift - snap to server position
      this.playerPosition.x = serverPos.x;
      this.playerPosition.y = serverPos.y;
      this.player.setPosition(this.playerPosition.x, this.playerPosition.y);
      console.warn('⚠️ Large drift detected, snapping to backend position');
    } else if (drift > 5) {
      // Small drift - smooth correction
      this.playerPosition.x += (serverPos.x - localPos.x) * 0.2;
      this.playerPosition.y += (serverPos.y - localPos.y) * 0.2;
      this.player.setPosition(this.playerPosition.x, this.playerPosition.y);
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
    
    // Change player color based on movement speed multiplier
    if (speed === 0.5) {
      this.player.setFillStyle(0x0000ff); // Blue for sneaking
    } else if (speed === 1.5) {
      this.player.setFillStyle(0xff0000); // Red for running
    } else {
      this.player.setFillStyle(0x00ff00); // Green for normal
    }
  }

  private createTestWalls(): void {
    // NOTE: Test walls are now disabled - backend should be the only source
    
    // this.destructionRenderer.addTestWalls();
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
          `FX: F${effectCounts.muzzleFlashes} H${effectCounts.hitMarkers} P${effectCounts.particles}`
        ].join('\n'));
      }
    });

    // Toggle fog visibility for debugging - ONLY debug key kept
    this.input.keyboard!.on('keydown-F', () => {
      const fogLayer = (this.visionRenderer as any).fogLayer;
      if (fogLayer) {
        fogLayer.setVisible(!fogLayer.visible);
        console.log(`🌫️ Fog layer toggled - visible: ${fogLayer.visible}, depth: ${fogLayer.depth}`);
      }
    });
    
    // Debug vertical walls - Press V key
    this.input.keyboard!.on('keydown-V', () => {
      console.log('🔍 WALL DEBUG (Backend-compliant)');
      console.log('=================================');
      const walls = this.destructionRenderer.getWallsData(false);
      
      walls.forEach(wall => {
        const maskPattern = wall.destructionMask.join('');
        const visibleSlices = wall.destructionMask.map((d, i) => d === 0 ? i : null).filter(i => i !== null);
        const isPillar = wall.width === 10 && wall.height === 10;
        
        console.log(`Wall ${wall.id}:`, {
          position: `(${wall.position.x}, ${wall.position.y})`,
          size: `${wall.width}x${wall.height}`,
          orientation: wall.orientation,
          isPillar: isPillar,
          destructionMask: maskPattern,
          visibleSlices: visibleSlices,
          material: wall.material,
          slicePositions: wall.destructionMask.map((d, i) => {
            if (isPillar) {
              return {
                slice: i,
                y: wall.position.y + (i * 2),
                height: 2,
                destroyed: d === 1
              };
            } else if (wall.orientation === 'horizontal') {
              return {
                slice: i,
                x: wall.position.x + (i * wall.width / 5),
                width: wall.width / 5,
                destroyed: d === 1
              };
            } else {
              return {
                slice: i,
                y: wall.position.y + (i * wall.height / 5),
                height: wall.height / 5,
                destroyed: d === 1
              };
            }
          })
        });
      });
      
      if (walls.length === 0) {
        console.log('No walls found!');
      }
    });




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
    if (this.networkSystem) {
      this.networkSystem.destroy();
    }
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
  }

  private addCoordinateDebug(): void {
    // Draw origin point
    this.add.circle(0, 0, 3, 0xff0000);
    this.add.text(0, 0, '(0,0)', { fontSize: '5px', color: '#ff0000' }).setOrigin(0.5);
    
    // Draw game bounds (480x270)
    const bounds = this.add.rectangle(240, 135, 480, 270);
    bounds.setStrokeStyle(1, 0xffffff, 0.2);
    
    // Draw grid lines every 50 pixels
    const gridAlpha = 0.1;
    const gridColor = 0x00ff00;
    
    // Vertical lines
    for (let x = 0; x <= 480; x += 50) {
      this.add.line(0, 0, x, 0, x, 270, gridColor, gridAlpha).setOrigin(0);
    }
    
    // Horizontal lines
    for (let y = 0; y <= 270; y += 50) {
      this.add.line(0, 0, 0, y, 480, y, gridColor, gridAlpha).setOrigin(0);
    }
    
    // Remove coordinate labels - too cluttered at this resolution
    
    // Show mouse world position on move - top right corner
    const mouseText = this.add.text(GAME_CONFIG.GAME_WIDTH - 5, 15, '', { fontSize: '8px', color: '#ffff00' });
    mouseText.setOrigin(1, 0);
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      mouseText.setText(`Mouse: (${worldPoint.x.toFixed(0)}, ${worldPoint.y.toFixed(0)})`);
    });
    
    // Debug: Show player rotation - removed to reduce clutter
  }
} 
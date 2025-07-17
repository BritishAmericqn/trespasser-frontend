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

import { AssetManager } from '../utils/AssetManager';

export class GameScene extends Phaser.Scene {
  private inputSystem!: InputSystem;
  private networkSystem!: NetworkSystem;
  private visualEffectsSystem!: VisualEffectsSystem;
  private destructionRenderer!: DestructionRenderer;
  private weaponUI!: WeaponUI;
  private clientPrediction!: ClientPrediction;
  private visionRenderer!: VisionRenderer;
  private playerManager!: PlayerManager;
  private assetManager!: AssetManager;
  private playerSprite!: Phaser.GameObjects.Sprite; // Changed from Rectangle to Sprite
  private playerWeapon!: Phaser.GameObjects.Sprite; // Add weapon sprite
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
  private wallSliceSprites: Map<string, Phaser.GameObjects.Sprite> = new Map(); // Back to regular Sprite
  private floorSprites: Phaser.GameObjects.Sprite[] = [];
  private debugOverlay!: Phaser.GameObjects.Text;
  private lastGameStateTime: number = 0;
  // Server position indicator visibility flag
  private showServerIndicator: boolean = false;


  constructor() {
    super({ key: 'GameScene' });
    this.playerPosition = { x: 240, y: 135 }; // Center of 480x270
  }

  create(): void {
    // Initialize AssetManager first
    this.assetManager = new AssetManager(this);
    
    // Create floor background using actual floor texture
    this.createFloorBackground();

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
    
    // Create player sprite using actual sprite assets
    this.playerSprite = this.assetManager.createPlayer(
      this.playerPosition.x,
      this.playerPosition.y,
      'blue' // Default team, will be updated from backend
    );
    this.playerSprite.setDepth(21); // Above other players
    this.playerSprite.setRotation(Math.PI / 2); // Start with 90-degree clockwise rotation
    
    // Create weapon sprite for local player
    this.playerWeapon = this.assetManager.createWeapon(
      this.playerPosition.x,
      this.playerPosition.y,
      'rifle', // Default weapon
      0 // Initial facing angle
    );
    this.playerWeapon.setDepth(20); // Just below player
    
    // Initialize client prediction with starting position
    this.clientPrediction.reset(this.playerPosition);
    
    // Create backend position indicator (red outline square) - HIDDEN by default
    const backendIndicator = this.add.rectangle(
      this.playerPosition.x,
      this.playerPosition.y,
      22,
      22
    );
    backendIndicator.setStrokeStyle(2, 0xff0000);
    backendIndicator.setDepth(5);
    backendIndicator.setVisible(this.showServerIndicator); // Hidden by default
    
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
          sliceY = wall.position.y + (i * sliceHeight) + sliceHeight / 2;
        } else if (wall.orientation === 'horizontal') {
          // Horizontal wall: vertical slices (divide width by 5)
          sliceWidth = wall.width / 5;
          sliceHeight = wall.height;
          sliceX = wall.position.x + (i * sliceWidth) + sliceWidth / 2;
          sliceY = wall.position.y + sliceHeight / 2;
        } else {
          // Vertical wall: horizontal slices (divide height by 5)
          sliceWidth = wall.width;
          sliceHeight = wall.height / 5;
          sliceX = wall.position.x + sliceWidth / 2;
          sliceY = wall.position.y + (i * sliceHeight) + sliceHeight / 2;
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
          `FX: F${effectCounts.muzzleFlashes} E${effectCounts.explosions} H${effectCounts.hitMarkers} P${effectCounts.particles}`,
          `Keys: F=Toggle Fog | O=Server Pos | V=Debug Vision`
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

    // Toggle server position indicator with 'O' key
    this.input.keyboard!.on('keydown-O', () => {
      this.showServerIndicator = !this.showServerIndicator;
      const backendIndicator = (this as any).backendIndicator;
      if (backendIndicator) {
        backendIndicator.setVisible(this.showServerIndicator);
        console.log(`🔴 Server position indicator: ${this.showServerIndicator ? 'visible' : 'hidden'}`);
      }
    });

    // Test explosion animation - click to explode (for testing assets)
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) {
        const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        this.visualEffectsSystem.showExplosionEffect(worldPoint, 40);
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
} 
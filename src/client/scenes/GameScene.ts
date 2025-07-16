import { InputSystem } from '../systems/InputSystem';
import { NetworkSystem } from '../systems/NetworkSystem';
import { VisualEffectsSystem } from '../systems/VisualEffectsSystem';
import { DestructionRenderer } from '../systems/DestructionRenderer';
import { WeaponUI } from '../ui/WeaponUI';
import { ClientPrediction } from '../systems/ClientPrediction';
import { VisionRenderer } from '../systems/VisionRenderer';
import { PlayerManager } from '../systems/PlayerManager';
import { GAME_CONFIG } from '../../../shared/constants/index';
import { GameState, CollisionEvent } from '../../../shared/types/index';

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
  private wallDebugText!: Phaser.GameObjects.Text;
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
    
    // Get walls from DestructionRenderer and render them
    const walls = this.destructionRenderer.getWallsData();
    
    walls.forEach(wall => {
      const sliceWidth = wall.width / 5;
      
      // Render each slice
      for (let i = 0; i < 5; i++) {
        const sliceX = wall.position.x + (i * sliceWidth);
        const sliceHealth = wall.sliceHealth[i];
        const isDestroyed = wall.destructionMask[i] === 1;
        
        if (isDestroyed) {
          // Don't render destroyed slices
          continue;
        }
        
        // Determine damage state
        const healthPercent = sliceHealth / wall.maxHealth;
        const baseColor = this.getMaterialColor(wall.material);
        
        // Apply damage darkening
        let alpha = 1.0;
        if (healthPercent <= 0.25) {
          alpha = 0.6; // Critical damage
        } else if (healthPercent <= 0.75) {
          alpha = 0.8; // Damaged
        }
        
        // Draw slice
        this.wallGraphics.fillStyle(baseColor, alpha);
        this.wallGraphics.fillRect(sliceX, wall.position.y, sliceWidth, wall.height);
        
        // Add damage cracks for visual feedback
        if (healthPercent < 0.75) {
          this.wallGraphics.lineStyle(1, 0x000000, 0.5);
          const numCracks = Math.floor((1 - healthPercent) * 3);
          for (let j = 0; j < numCracks; j++) {
            const x1 = sliceX + Math.random() * sliceWidth;
            const y1 = wall.position.y + Math.random() * wall.height;
            const x2 = x1 + (Math.random() - 0.5) * 6;
            const y2 = y1 + (Math.random() - 0.5) * 6;
            this.wallGraphics.beginPath();
            this.wallGraphics.moveTo(x1, y1);
            this.wallGraphics.lineTo(x2, y2);
            this.wallGraphics.strokePath();
          }
        }
      }
      
      // Draw wall border
      this.wallGraphics.lineStyle(1, 0x333333);
      this.wallGraphics.strokeRect(wall.position.x, wall.position.y, wall.width, wall.height);
    });
  }

  private getMaterialColor(material: string): number {
    switch (material) {
      case 'concrete': return 0x808080;
      case 'wood': return 0x8B4513;
      case 'metal': return 0xC0C0C0;
      case 'glass': return 0xE6E6FA;
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
        console.log('📥 Game state received:', {
          hasPlayers: !!gameState.players,
          hasVisiblePlayers: !!gameState.visiblePlayers,
          visiblePlayersCount: gameState.visiblePlayers?.length || 0,
          hasVision: !!gameState.vision,
          visionTiles: gameState.vision?.visibleTiles?.length || 0,
          myId: myPlayerId,
          timestamp: gameState.timestamp
        });
        
        // Log first visible player structure if available
        if (gameState.visiblePlayers && gameState.visiblePlayers.length > 0) {
          console.log('First visible player structure:', JSON.stringify(gameState.visiblePlayers[0], null, 2));
        }
      }
      
      // Update vision from backend data
      if (gameState.vision && gameState.vision.visibleTiles) {
        this.visionRenderer.updateVisionFromBackend(gameState.vision.visibleTiles);
        
        // Log first time we receive vision data
        if (!(this as any).receivedVisionData) {
          (this as any).receivedVisionData = true;
          console.log('✅ Vision system now using backend data!', {
            tileCount: gameState.vision.visibleTiles.length,
            position: gameState.vision.position,
            viewAngle: gameState.vision.viewAngle,
            sampleTiles: gameState.vision.visibleTiles.slice(0, 10),
            tileRange: `${Math.min(...gameState.vision.visibleTiles)} - ${Math.max(...gameState.vision.visibleTiles)}`
          });
        }
      } else if (!gameState.vision) {
        // Only warn once
        if (!(this as any).warnedNoVision) {
          (this as any).warnedNoVision = true;
          console.warn('⚠️ No vision data from backend! Make sure backend is sending vision data.');
        }
      }
      
      // Update visible players using filtered data
      if (gameState.visiblePlayers) {
        // One-time log when we first get visible players
        if (gameState.visiblePlayers.length > 0 && !(this as any).loggedVisiblePlayers) {
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
        // Fallback to old format
        if (!(this as any).warnedOldFormat) {
          (this as any).warnedOldFormat = true;
          console.log('⚠️ Using old players format (not visiblePlayers). First player:', 
            gameState.players instanceof Map ? 
              Array.from(gameState.players.values())[0] : 
              Object.values(gameState.players)[0]
          );
        }
        this.playerManager.updatePlayers(gameState.players);
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
        
        // Optional: Small screen shake
        this.cameras.main.shake(50, 0.002);
      }
    });

    // Player join/leave events
    this.events.on('network:playerJoined', (playerData: any) => {
      console.log('Player joined:', playerData);
    });

    this.events.on('network:playerLeft', (playerData: any) => {
      console.log('Player left:', playerData);
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
    // Add test walls to the DestructionRenderer
    this.destructionRenderer.addTestWalls();

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

    // Add test effect triggers
    this.input.keyboard!.on('keydown-H', () => {
      // Test hit marker at random position
      const testPos = { 
        x: 100 + Math.random() * 280, 
        y: 50 + Math.random() * 170 
      };
      this.visualEffectsSystem.showHitMarker(testPos);

    });

    // Debug: Show connection status
    this.input.keyboard!.on('keydown-C', () => {
      const isConnected = this.networkSystem.isSocketConnected();
      console.log(`🔌 CONNECTION STATUS: ${isConnected ? 'CONNECTED' : 'DISCONNECTED'}`);
      console.log(`🎮 Player position: ${this.playerPosition.x}, ${this.playerPosition.y}`);
      console.log(`🔫 Current weapon: ${this.inputSystem.getCurrentWeapon()}`);
      console.log(`📡 Backend URL: ${GAME_CONFIG.SERVER_URL}`);
      
      if (isConnected) {
        console.log('✅ Ready to receive backend events!');
      } else {
        console.log('❌ Not connected to backend - start backend server first');
      }
    });

    // Toggle vision debug visualization
    this.input.keyboard!.on('keydown-V', () => {
      this.visionRenderer.toggleDebug();
      console.log(`👁️ Vision debug toggled`);
    });
    
    // Toggle fog visibility for debugging
    this.input.keyboard!.on('keydown-F', () => {
      const fogLayer = (this.visionRenderer as any).fogLayer;
      if (fogLayer) {
        fogLayer.setVisible(!fogLayer.visible);
        console.log(`🌫️ Fog layer toggled - visible: ${fogLayer.visible}, depth: ${fogLayer.depth}`);
      }
    });
    
    // Test vision with hardcoded tiles - Press T key
    this.input.keyboard!.on('keydown-T', () => {
      console.log('🧪 Testing vision with sample tiles...');
      // Create a test pattern of visible tiles around center
      const testTiles: number[] = [];
      const centerX = 30; // Center of 60-wide grid
      const centerY = 17; // Center of 34-high grid
      
      // Create a 7x7 square of visible tiles (larger to be visible with smaller tiles)
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          const tileX = centerX + dx;
          const tileY = centerY + dy;
          const tileIndex = tileY * 60 + tileX;  // Updated formula for 60-wide grid
          testTiles.push(tileIndex);
        }
      }
      
      console.log('Test tiles:', testTiles);
      this.visionRenderer.updateVisionFromBackend(testTiles);
    });

    this.input.keyboard!.on('keydown-M', () => {
      // Test miss effect at random position
      const testPos = { 
        x: 100 + Math.random() * 280, 
        y: 50 + Math.random() * 170 
      };
      this.visualEffectsSystem.showImpactEffect(testPos, Math.random() * Math.PI * 2);

    });

    this.input.keyboard!.on('keydown-B', () => {
      // Test wall damage effect and actual damage
      const testPos = { 
        x: 130 + Math.random() * 30, 
        y: 107 + Math.random() * 8 
      };
      this.visualEffectsSystem.showWallDamageEffect(testPos, 'concrete');
      
      // Also simulate actual wall damage
      const wallIds = ['wall_1', 'wall_2', 'wall_3', 'wall_4'];
      const randomWallId = wallIds[Math.floor(Math.random() * wallIds.length)];
      this.destructionRenderer.simulateWallDamage(randomWallId, 25);
      
      console.log('🧱 TEST: Wall damage effect and simulation triggered');
    });

    this.input.keyboard!.on('keydown-E', () => {
      // Test explosion effect
      const testPos = { 
        x: 100 + Math.random() * 280, 
        y: 50 + Math.random() * 170 
      };
      this.visualEffectsSystem.showExplosionEffect(testPos, 30);
      console.log('💥 TEST: Explosion effect triggered');
    });

    this.input.keyboard!.on('keydown-P', () => {
      // Debug position information
      console.log('🎯 POSITION DEBUG SNAPSHOT:', {
        gameScenePos: this.playerPosition,
        playerRectPos: { x: this.player.x, y: this.player.y },
        gameConfig: {
          width: GAME_CONFIG.GAME_WIDTH,
          height: GAME_CONFIG.GAME_HEIGHT,
          center: { 
            x: GAME_CONFIG.GAME_WIDTH / 2, 
            y: GAME_CONFIG.GAME_HEIGHT / 2 
          }
        },
        bounds: {
          minX: 10,
          maxX: GAME_CONFIG.GAME_WIDTH - 10,
          minY: 10,
          maxY: GAME_CONFIG.GAME_HEIGHT - 10
        }
      });
      
      // Force emit a test weapon fire to see what gets sent
      console.log('🔫 Emitting test weapon fire event...');
      const testFire = {
        weaponType: 'rifle',
        position: this.playerPosition,
        targetPosition: { x: this.playerPosition.x + 100, y: this.playerPosition.y },
        direction: 0,
        isADS: false,
        timestamp: Date.now(),
        sequence: 999
      };
      console.log('📤 Test fire event data:', testFire);
      this.events.emit('weapon:fire', testFire);
    });

    this.input.keyboard!.on('keydown-D', () => {
      // Debug: Show wall boundaries
      console.log('🧱 WALL DEBUG - Client-side wall positions:');
      const wallsData = this.destructionRenderer.getWallsData();
      wallsData.forEach(wall => {
        console.log(`Wall ${wall.id}:`, {
          position: wall.position,
          size: { width: wall.width, height: wall.height },
          bounds: {
            left: wall.position.x,
            right: wall.position.x + wall.width,
            top: wall.position.y,
            bottom: wall.position.y + wall.height
          },
          destroyed: wall.destructionMask
        });
      });
    });

    // Create wall debug display - smaller and repositioned
    this.wallDebugText = this.add.text(5, 20, '', {
      fontSize: '8px',
      color: '#00ff00',
      lineSpacing: -1  // Slightly tighter line spacing
    }).setDepth(100);
    
    // Update wall debug info every frame
    this.events.on('update', () => {
      this.updateWallDebugDisplay();
    });
  }

  private updateWallDebugDisplay(): void {
    if (!this.wallDebugText || !this.destructionRenderer) return;
    
    const wallsData = this.destructionRenderer.getWallsDebugInfo();
    const lines: string[] = ['WALLS:'];
    
    wallsData.forEach((wall: any) => {
      const hp = ((wall.currentHealth / wall.maxHealth) * 100).toFixed(0);
      const status = wall.currentHealth <= 0 ? 'X' : 'OK';
      
      lines.push(`${wall.id}: ${hp}% ${status}`);
      
      // Show damaged slices only
      const damagedSlices = wall.slices.filter((s: any) => s.health < wall.sliceMaxHealth);
      if (damagedSlices.length > 0) {
        const sliceInfo = damagedSlices.map((s: any) => `S${s.index}:${s.health}`).join(' ');
        lines.push(` ${sliceInfo}`);
      }
    });
    
    // Compact weapon damage info
    lines.push('DMG: R25 P35 G100 X150');
    
    this.wallDebugText.setText(lines.join('\n'));
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
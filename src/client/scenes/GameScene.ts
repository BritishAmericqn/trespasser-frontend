import { InputSystem } from '../systems/InputSystem';
import { NetworkSystem } from '../systems/NetworkSystem';
import { VisualEffectsSystem } from '../systems/VisualEffectsSystem';
import { DestructionRenderer } from '../systems/DestructionRenderer';
import { WeaponUI } from '../ui/WeaponUI';
import { ClientPrediction } from '../systems/ClientPrediction';
import { GAME_CONFIG } from '../../../shared/constants/index';

export class GameScene extends Phaser.Scene {
  private inputSystem!: InputSystem;
  private networkSystem!: NetworkSystem;
  private visualEffectsSystem!: VisualEffectsSystem;
  private destructionRenderer!: DestructionRenderer;
  private weaponUI!: WeaponUI;
  private clientPrediction!: ClientPrediction;
  private player!: Phaser.GameObjects.Rectangle;
  private playerPosition: { x: number; y: number };
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
    console.log('GameScene created');
    
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
    this.connectionStatus = this.add.text(10, 10, 'Connecting...', {
      fontSize: '12px',
      color: '#ffffff'
    });

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
    this.events.on('network:gameState', (gameState: any) => {
      this.lastGameStateTime = Date.now();
      
      // Apply server position to local player
      if (gameState.players && this.networkSystem.getSocket()) {
        const myPlayerId = this.networkSystem.getSocket()?.id;
        if (!myPlayerId) return;
        
        const serverPlayer = gameState.players[myPlayerId];
        
        if (serverPlayer) {
          // Use client prediction to handle server updates
          this.clientPrediction.onGameStateReceived(serverPlayer);
          
          // Extract server position for backend indicator
          let serverPos = null;
          
          // Format 1: serverPlayer.transform.position
          if (serverPlayer.transform && serverPlayer.transform.position) {
            serverPos = serverPlayer.transform.position;
          }
          // Format 2: serverPlayer.position
          else if (serverPlayer.position) {
            serverPos = serverPlayer.position;
          }
          // Format 3: serverPlayer.x and serverPlayer.y
          else if (typeof serverPlayer.x === 'number' && typeof serverPlayer.y === 'number') {
            serverPos = { x: serverPlayer.x, y: serverPlayer.y };
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
          console.log('📍 Backend position indicator updated:', data.position);
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
    
    console.log('📍 Applying backend position:', {
      server: serverPos,
      local: localPos,
      drift: drift.toFixed(2)
    });
    
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
    
    // Apply input through client prediction
    if (inputState.sequence > 0) { // Only apply if we have a valid sequence
      this.clientPrediction.applyInput(inputState, inputState.sequence);
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
    console.log('Test walls added to DestructionRenderer');
  }

  private createUI(): void {
    // Create input state display for debugging
    const inputText = this.add.text(10, 30, '', {
      fontSize: '10px',
      color: '#ffffff'
    });
    inputText.setDepth(100);
    
    // Debug overlay for game state tracking
    this.debugOverlay = this.add.text(GAME_CONFIG.GAME_WIDTH - 10, GAME_CONFIG.GAME_HEIGHT - 10, 
      'Last Game State: Never', {
      fontSize: '10px',
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
          `Position: ${this.playerPosition.x.toFixed(0)}, ${this.playerPosition.y.toFixed(0)}`,
          `Movement: ${direction.x.toFixed(2)}, ${direction.y.toFixed(2)} (${(speed * 100).toFixed(0)}%)`,
          `Mouse: ${inputState.mouse.x.toFixed(0)}, ${inputState.mouse.y.toFixed(0)}`,
          `Weapon: ${currentWeapon || 'None'} ${isADS ? '[ADS]' : ''}`,
          `Keys: R:${inputState.keys.r} G:${inputState.keys.g} 1:${inputState.keys['1']} 2:${inputState.keys['2']}`,
          `Grenade Charge: ${grenadeCharge}/5`,
          `Effects: Flash:${effectCounts.muzzleFlashes} Hit:${effectCounts.hitMarkers} Particles:${effectCounts.particles} Trails:${effectCounts.bulletTrails}`,
          `Walls: ${this.destructionRenderer.getWallCount()}`
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
      console.log('🎯 TEST: Hit marker triggered');
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

    this.input.keyboard!.on('keydown-M', () => {
      // Test miss effect at random position
      const testPos = { 
        x: 100 + Math.random() * 280, 
        y: 50 + Math.random() * 170 
      };
      this.visualEffectsSystem.showImpactEffect(testPos, Math.random() * Math.PI * 2);
      console.log('💥 TEST: Miss effect triggered');
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

    // S - Request sync from backend
    this.input.keyboard!.on('keydown-S', () => {
      console.log('🔄 Requesting position sync from backend...');
      this.networkSystem.emit('player:requestSync', {
        currentPosition: this.playerPosition,
        timestamp: Date.now()
      });
    });
    
    // D - Debug client prediction
    this.input.keyboard!.on('keydown-D', () => {
      const debugInfo = this.clientPrediction.getDebugInfo();
      console.log('🎯 CLIENT PREDICTION DEBUG:', {
        ...debugInfo,
        drift: Math.hypot(
          debugInfo.renderPosition.x - debugInfo.serverPosition.x,
          debugInfo.renderPosition.y - debugInfo.serverPosition.y
        ).toFixed(2) + 'px'
      });
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

    // Create controls legend
    this.add.text(10, GAME_CONFIG.GAME_HEIGHT - 200, [
      'Controls:',
      '🔵 Ctrl = Sneak (50%)',
      '🟢 WASD = Walk (100%)',
      '🔴 Shift+Forward = Run (150%)',
      '🔫 Left Click = Fire (trails stop at walls, explosives explode)',
      '🎯 Right Click = ADS',
      '🔄 R = Reload',
      '💣 G = Grenade (Hold)',
      '🔀 1-4 = Weapon Switch',
      '',
      'Debug:',
      '📊 D = Client Prediction Debug',
      '📍 S = Request Position Sync',
      '',
      'Position Indicators:',
      '🟩 Green Square = Your Position',
      '🟥 Red Outline = Backend Position',
      '',
      'Test Effects:',
      '🎯 H = Hit Marker',
      '💥 M = Miss Sparks',
      '🧱 B = Wall Damage',
      '💥 E = Explosion',
      '🔌 C = Connection Status'
    ].join('\n'), {
      fontSize: '10px',
      color: '#cccccc'
    }).setDepth(100);
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
  }

  private addCoordinateDebug(): void {
    // Draw origin point
    this.add.circle(0, 0, 5, 0xff0000);
    this.add.text(0, 0, '(0,0)', { fontSize: '10px', color: '#ff0000' }).setOrigin(0.5);
    
    // Draw game bounds (480x270)
    const bounds = this.add.rectangle(240, 135, 480, 270);
    bounds.setStrokeStyle(2, 0xffffff, 0.3);
    
    // Draw grid lines every 50 pixels
    const gridAlpha = 0.2;
    const gridColor = 0x00ff00;
    
    // Vertical lines
    for (let x = 0; x <= 480; x += 50) {
      this.add.line(0, 0, x, 0, x, 270, gridColor, gridAlpha).setOrigin(0);
    }
    
    // Horizontal lines
    for (let y = 0; y <= 270; y += 50) {
      this.add.line(0, 0, 0, y, 480, y, gridColor, gridAlpha).setOrigin(0);
    }
    
    // Add coordinate labels at key points
    this.add.text(240, 10, '(240, 0)', { fontSize: '8px', color: '#00ff00' }).setOrigin(0.5);
    this.add.text(240, 260, '(240, 270)', { fontSize: '8px', color: '#00ff00' }).setOrigin(0.5);
    this.add.text(10, 135, '(0, 135)', { fontSize: '8px', color: '#00ff00' }).setOrigin(0, 0.5);
    this.add.text(470, 135, '(480, 135)', { fontSize: '8px', color: '#00ff00' }).setOrigin(1, 0.5);
    
    // Show mouse world position on move
    const mouseText = this.add.text(10, 10, '', { fontSize: '10px', color: '#ffff00' });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      mouseText.setText(`Mouse: (${worldPoint.x.toFixed(0)}, ${worldPoint.y.toFixed(0)})`);
    });
    
    // Debug: Show player rotation
    const rotationText = this.add.text(10, 20, '', { fontSize: '10px', color: '#ffff00' });
    this.events.on('update', () => {
      if (this.inputSystem) {
        const rotation = (this.inputSystem as any).playerRotation; // Access private property for debug
        const degrees = (rotation * 180 / Math.PI).toFixed(1);
        rotationText.setText(`Rotation: ${degrees}°`);
      }
    });
  }
} 
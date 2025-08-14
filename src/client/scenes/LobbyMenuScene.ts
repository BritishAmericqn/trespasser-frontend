import { GAME_CONFIG } from '../../../shared/constants/index';
import { NetworkSystem } from '../systems/NetworkSystem';
import NetworkSystemSingleton from '../systems/NetworkSystemSingleton';

export class LobbyMenuScene extends Phaser.Scene {
  private networkSystem!: NetworkSystem;
  private wallPositions: Array<{x: number, y: number, width: number, height: number}> = [];
  
  // UI Elements
  private mainContainer!: Phaser.GameObjects.Container;
  private statusText!: Phaser.GameObjects.Text;
  private errorText!: Phaser.GameObjects.Text;
  
  // Button elements
  private findMatchButton!: Phaser.GameObjects.Text;
  private privateButton!: Phaser.GameObjects.Text;
  private joinLobbyButton!: Phaser.GameObjects.Text;
  
  // State
  private isConnected: boolean = false;
  private isAuthenticated: boolean = false;

  constructor() {
    super({ key: 'LobbyMenuScene' });
  }

  create(): void {
    // Create atmospheric background from main menu
    this.createAtmosphericBackground();
    
    // Create dark semi-transparent overlay for readability
    const overlay = this.add.rectangle(0, 0, GAME_CONFIG.GAME_WIDTH, GAME_CONFIG.GAME_HEIGHT, 0x111111, 0.85)
      .setOrigin(0, 0);
    overlay.setDepth(1);

    // Get NetworkSystem singleton
    const isFirstTime = !NetworkSystemSingleton.hasInstance();
    this.networkSystem = NetworkSystemSingleton.getInstance(this);
    
    if (isFirstTime) {
      this.networkSystem.initialize();
    }
    
    // Setup network event listeners
    this.setupNetworkListeners();
    
    // Create the main UI
    this.createUI();
    
    // Check connection status
    this.checkConnectionStatus();
  }

  private setupNetworkListeners(): void {
    // Connection events
    this.events.on('network:authenticated', () => {
      this.isAuthenticated = true;
      this.updateConnectionStatus();
    });
    
    this.events.on('network:connectionError', (error: string) => {
      this.showError(error);
    });
    
    // Lobby events (new multi-lobby system)
    this.networkSystem.getSocket()?.on('lobby_joined', (data: any) => {
      console.log('🏢 Lobby joined:', data);
      this.scene.start('LobbyWaitingScene', { lobbyData: data });
    });
    
    this.networkSystem.getSocket()?.on('matchmaking_failed', (data: any) => {
      console.error('❌ Matchmaking failed:', data.reason);
      this.showError(`Matchmaking failed: ${data.reason}`);
      this.enableButtons();
    });
    
    this.networkSystem.getSocket()?.on('private_lobby_created', (data: any) => {
      console.log('🔒 Private lobby created:', data);
      this.scene.start('LobbyWaitingScene', { lobbyData: data, isPrivate: true });
    });
    
    this.networkSystem.getSocket()?.on('lobby_creation_failed', (data: any) => {
      this.showError(`Failed to create lobby: ${data.reason}`);
      this.enableButtons();
    });
    
    this.networkSystem.getSocket()?.on('lobby_join_failed', (data: any) => {
      this.showError(`Failed to join lobby: ${data.reason}`);
      this.enableButtons();
    });
  }

  private createUI(): void {
    // Title moved down and positioned inside the container area
    const title = this.add.text(GAME_CONFIG.GAME_WIDTH / 2, 50, 'TRESPASSER', {
      fontSize: '32px',
      color: '#00ff00',
      fontStyle: 'bold',
      fontFamily: 'monospace',
      shadow: { offsetX: 2, offsetY: 2, color: '#004400', blur: 4, stroke: true, fill: true }
    }).setOrigin(0.5);
    title.setDepth(3);

    // Subtitle positioned better within the UI space
    const subtitle = this.add.text(GAME_CONFIG.GAME_WIDTH / 2, 75, 'LOBBY SYSTEM', {
      fontSize: '12px',
      color: '#cccccc',
      fontFamily: 'monospace'
    }).setOrigin(0.5);
    subtitle.setDepth(3);

    // Main container for buttons - moved down to give title space
    this.mainContainer = this.add.container(GAME_CONFIG.GAME_WIDTH / 2, GAME_CONFIG.GAME_HEIGHT / 2 + 20);
    this.mainContainer.setDepth(3);

    // Menu border with proper depth - wider box, not taller
    const menuBorder = this.add.graphics();
    menuBorder.lineStyle(1, 0x444444);
    menuBorder.strokeRect(-280, -60, 560, 120); // Wider box, proper height
    menuBorder.setDepth(2);

    // Fixed button dimensions
    const buttonWidth = 200;
    const primaryHeight = 24;
    const secondaryHeight = 20;

    // Find Match button with fixed-width background - more breathing room
    const findMatchBg = this.add.graphics();
    findMatchBg.fillStyle(0x006600);
    findMatchBg.fillRect(-buttonWidth/2, -35 - primaryHeight/2, buttonWidth, primaryHeight);
    this.findMatchButton = this.add.text(0, -35, '▶ DEATHMATCH', {
      fontSize: '14px',
      color: '#ffffff',
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    // Private Lobby button with fixed-width background - more spacing
    const privateBg = this.add.graphics();
    privateBg.fillStyle(0x444444);
    privateBg.fillRect(-buttonWidth/2, -5 - secondaryHeight/2, buttonWidth, secondaryHeight);
    this.privateButton = this.add.text(0, -5, '🔒 PRIVATE', {
      fontSize: '12px',
      color: '#ffffff',
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    // Join Lobby button with fixed-width background - better spacing
    const joinBg = this.add.graphics();
    joinBg.fillStyle(0x444444);
    joinBg.fillRect(-buttonWidth/2, 25 - secondaryHeight/2, buttonWidth, secondaryHeight);
    this.joinLobbyButton = this.add.text(0, 25, '🎮 JOIN', {
      fontSize: '12px',
      color: '#ffffff',
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    // Setup button interactions
    this.setupButton(this.findMatchButton, '#006600', '#008800', () => this.findMatch());
    this.setupButton(this.privateButton, '#444444', '#666666', () => this.createPrivateLobby());
    this.setupButton(this.joinLobbyButton, '#444444', '#666666', () => this.joinLobbyById());

    // Add to container (backgrounds first, then text)
    this.mainContainer.add([menuBorder, findMatchBg, this.findMatchButton, privateBg, this.privateButton, joinBg, this.joinLobbyButton]);

    // Status text - positioned below the adjusted container
    this.statusText = this.add.text(GAME_CONFIG.GAME_WIDTH / 2, GAME_CONFIG.GAME_HEIGHT / 2 + 100, 'Connecting...', {
      fontSize: '10px',
      color: '#888888',
      fontFamily: 'monospace'
    }).setOrigin(0.5);
    this.statusText.setDepth(3);

    // Error text - positioned below status
    this.errorText = this.add.text(GAME_CONFIG.GAME_WIDTH / 2, GAME_CONFIG.GAME_HEIGHT / 2 + 115, '', {
      fontSize: '9px',
      color: '#ff4444',
      align: 'center',
      wordWrap: { width: 280 },
      fontFamily: 'monospace'
    }).setOrigin(0.5);
    this.errorText.setDepth(3);

    // Back button to settings/config
    const backButton = this.add.text(60, GAME_CONFIG.GAME_HEIGHT - 20, 'SETTINGS', {
      fontSize: '10px',
      color: '#ffffff',
      backgroundColor: '#333333',
      padding: { x: 15, y: 5 },
      fontFamily: 'monospace'
    }).setOrigin(0.5);
    backButton.setDepth(3);

    this.setupButton(backButton, '#333333', '#555555', () => {
      this.scene.start('MenuScene');
    });

    // Instructions at bottom
    const instructions = this.add.text(GAME_CONFIG.GAME_WIDTH / 2, GAME_CONFIG.GAME_HEIGHT - 10, 
      'New Multi-Lobby System: Find matches, create private lobbies, or join by ID', {
      fontSize: '8px',
      color: '#888888',
      align: 'center',
      fontFamily: 'monospace'
    }).setOrigin(0.5);
    instructions.setDepth(3);

    // Initially disable buttons until connected
    this.disableButtons();
  }

  private setupButton(button: Phaser.GameObjects.Text, normalColor: string, hoverColor: string, callback: () => void): void {
    button.setInteractive({ useHandCursor: true });
    
    button.on('pointerover', () => {
      if (button.getData('enabled') !== false) {
        button.setStyle({ backgroundColor: hoverColor });
        this.tweens.add({
          targets: button,
          scaleX: 1.02,
          scaleY: 1.02,
          duration: 100,
          ease: 'Power2'
        });
      }
    });
    
    button.on('pointerout', () => {
      if (button.getData('enabled') !== false) {
        button.setStyle({ backgroundColor: normalColor });
        this.tweens.add({
          targets: button,
          scaleX: 1,
          scaleY: 1,
          duration: 100,
          ease: 'Power2'
        });
      }
    });
    
    button.on('pointerdown', () => {
      if (button.getData('enabled') !== false) {
        // Button press animation
        this.tweens.add({
          targets: button,
          scaleX: 0.98,
          scaleY: 0.98,
          duration: 50,
          yoyo: true,
          ease: 'Power2',
          onComplete: callback
        });
      }
    });
  }

  private checkConnectionStatus(): void {
    const socket = this.networkSystem.getSocket();
    if (socket?.connected) {
      this.isConnected = true;
      this.isAuthenticated = true; // Assume authenticated if connected
      this.updateConnectionStatus();
    } else {
      // Show connection status and fallback option
      this.showConnectionFallback();
    }
  }

  private async connectToPublicServer(): Promise<void> {
    this.statusText.setText('🌐 Connecting to public server...');
    this.statusText.setColor('#ffaa00');
    this.disableButtons();
    
    try {
      // Get default public server URL
      const publicServerUrl = this.getDefaultServerUrl();
      console.log('🚀 Auto-connecting to public server:', publicServerUrl);
      
      // Connect without password (public server)
      await this.networkSystem.connectToServer(publicServerUrl, '');
      
    } catch (error) {
      console.error('❌ Auto-connection failed:', error);
      this.showConnectionFallback();
    }
  }

  private showConnectionFallback(): void {
    this.statusText.setText('⚠️ Not connected - Is the backend server running?');
    this.statusText.setColor('#ff4444');
    
    // Add helpful debug info
    const debugText = this.add.text(GAME_CONFIG.GAME_WIDTH / 2, GAME_CONFIG.GAME_HEIGHT / 2 + 85, 
      'Expected: Backend at http://localhost:3000\nCheck backend server status and try again', {
      fontSize: '8px',
      color: '#888888',
      align: 'center',
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    // Add retry auto-connect button (more prominent)
    const retryButton = this.add.text(GAME_CONFIG.GAME_WIDTH / 2 - 100, GAME_CONFIG.GAME_HEIGHT / 2 + 120, 'RETRY AUTO-CONNECT', {
      fontSize: '11px',
      color: '#ffffff',
      backgroundColor: '#006600',
      padding: { x: 15, y: 8 },
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    // Add manual connection button
    const manualButton = this.add.text(GAME_CONFIG.GAME_WIDTH / 2 + 100, GAME_CONFIG.GAME_HEIGHT / 2 + 120, 'MANUAL CONNECTION', {
      fontSize: '11px',
      color: '#ffffff',
      backgroundColor: '#666600',
      padding: { x: 15, y: 8 },
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    this.setupButton(retryButton, '#006600', '#008800', () => {
      // Clear previous UI elements
      debugText.destroy();
      retryButton.destroy();
      manualButton.destroy();
      this.connectToPublicServer();
    });
    
    this.setupButton(manualButton, '#666600', '#888800', () => {
      this.scene.start('ServerConnectionSceneText');
    });
  }

  private getDefaultServerUrl(): string {
    // Use environment variable if available (for production)
    const envBackendUrl = import.meta.env.VITE_BACKEND_URL;
    if (envBackendUrl) {
      return envBackendUrl;
    }
    
    // Fallback to localhost for development
    return 'http://localhost:3000';
  }

  private updateConnectionStatus(): void {
    if (this.isAuthenticated) {
      this.statusText.setText('✓ Connected and authenticated - Ready for matchmaking');
      this.statusText.setColor('#00aa00');
      this.enableButtons();
    } else if (this.isConnected) {
      this.statusText.setText('Connected - Authenticating...');
      this.statusText.setColor('#ffaa00');
    } else {
      this.statusText.setText('Connecting...');
      this.statusText.setColor('#888888');
    }
  }

  private enableButtons(): void {
    this.findMatchButton.setAlpha(1);
    this.privateButton.setAlpha(1);
    this.joinLobbyButton.setAlpha(1);
    
    this.findMatchButton.setData('enabled', true);
    this.privateButton.setData('enabled', true);
    this.joinLobbyButton.setData('enabled', true);
  }

  private disableButtons(): void {
    this.findMatchButton.setAlpha(0.5);
    this.privateButton.setAlpha(0.5);
    this.joinLobbyButton.setAlpha(0.5);
    
    this.findMatchButton.setData('enabled', false);
    this.privateButton.setData('enabled', false);
    this.joinLobbyButton.setData('enabled', false);
  }

  private findMatch(): void {
    console.log('🎯 Finding deathmatch...');
    this.clearError();
    this.disableButtons();
    
    // Emit find_match event to backend
    const socket = this.networkSystem.getSocket();
    if (socket) {
      socket.emit('find_match', { 
        gameMode: 'deathmatch',
        isPrivate: false 
      });
      
      // Show finding match status
      this.statusText.setText('🔍 Finding match...');
      this.statusText.setColor('#ffaa00');
      
      // Switch to matchmaking scene for loading animation
      this.scene.start('MatchmakingScene', { gameMode: 'deathmatch' });
    } else {
      this.showError('Not connected to server');
      this.enableButtons();
    }
  }

  private createPrivateLobby(): void {
    console.log('🔒 Creating private lobby...');
    this.clearError();
    
    // 🔒 NEW: Prompt for password for private lobby security
    const password = prompt('Enter password for private lobby (leave empty for no password):') || '';
    
    const socket = this.networkSystem.getSocket();
    if (socket) {
      socket.emit('create_private_lobby', {
        gameMode: 'deathmatch',
        password: password.trim(), // Use the password entered by user
        maxPlayers: 8
      });
      
      const passwordText = password.trim() ? ' (password protected)' : ' (no password)';
      this.statusText.setText(`🔒 Creating private lobby${passwordText}...`);
      this.statusText.setColor('#ffaa00');
      this.disableButtons();
    } else {
      this.showError('Not connected to server');
    }
  }

  private joinLobbyById(): void {
    console.log('🎮 Join lobby by ID...');
    this.clearError();
    
    // 🔒 NEW: Prompt for lobby ID and password
    const lobbyId = prompt('Enter Lobby ID:');
    if (!lobbyId || !lobbyId.trim()) {
      this.showError('Lobby ID is required');
      return;
    }
    
    const password = prompt('Enter lobby password (leave empty if no password):') || '';
    
    const socket = this.networkSystem.getSocket();
    if (socket) {
      socket.emit('join_lobby', {
        lobbyId: lobbyId.trim(),
        password: password.trim()
      });
      
      this.statusText.setText('🔍 Joining lobby...');
      this.statusText.setColor('#ffaa00');
      this.disableButtons();
    } else {
      this.showError('Not connected to server');
    }
  }

  private showError(message: string): void {
    this.errorText.setText(message);
    this.errorText.setVisible(true);
    
    // Auto-hide error after 5 seconds
    this.time.delayedCall(5000, () => {
      this.clearError();
    });
  }

  private clearError(): void {
    this.errorText.setText('');
    this.errorText.setVisible(false);
  }

  shutdown(): void {
    // Clean up event listeners
    this.events.off('network:authenticated');
    this.events.off('network:connectionError');
    
    // NetworkSystem is a singleton, preserve it
  }

  private createAtmosphericBackground(): void {
    // Very dark base layer
    const darkOverlay = this.add.graphics();
    darkOverlay.fillStyle(0x050505, 0.95);
    darkOverlay.fillRect(0, 0, GAME_CONFIG.GAME_WIDTH, GAME_CONFIG.GAME_HEIGHT);
    darkOverlay.setDepth(-1000);

    // Store wall positions for occlusion
    this.wallPositions = [];

    // Create wall silhouettes
    this.createWallSilhouettes();

    // Create muzzle flash effects
    this.createMuzzleFlashEffects();
  }

  private createWallSilhouettes(): void {
    const wallGraphics = this.add.graphics();
    wallGraphics.fillStyle(0x0f0f0f, 0.9);

    // Create simple wall network for background
    const walls = [
      {x: 60, y: 0, width: 12, height: 140},
      {x: 120, y: 30, width: 12, height: 160},
      {x: 180, y: 0, width: 12, height: 100},
      {x: 240, y: 80, width: 12, height: 190},
      {x: 300, y: 0, width: 12, height: 120},
      {x: 360, y: 50, width: 12, height: 180},
      {x: 420, y: 0, width: 12, height: 150},
      {x: 0, y: 60, width: 180, height: 12},
      {x: 200, y: 120, width: 200, height: 12},
      {x: 120, y: 180, width: 250, height: 12},
      {x: 0, y: 240, width: 160, height: 12},
      {x: 280, y: 200, width: 200, height: 12}
    ];

    wallGraphics.setDepth(-20);

    walls.forEach(wall => {
      wallGraphics.fillRect(wall.x, wall.y, wall.width, wall.height);
      this.wallPositions.push(wall);
    });
  }

  private createMuzzleFlashEffects(): void {
    // Strategic muzzle flash positions with shooting directions
    const flashPositions = [
      { x: 90, y: 110, angle: 45 },    // Shooting northeast
      { x: 150, y: 45, angle: 170 },   // Shooting south
      { x: 210, y: 160, angle: -30 },  // Shooting northwest
      { x: 330, y: 90, angle: 225 },   // Shooting southwest
      { x: 390, y: 210, angle: -90 },  // Shooting north
      { x: 270, y: 140, angle: 0 },    // Shooting east
      { x: 130, y: 200, angle: -45 },  // Shooting northeast
      { x: 410, y: 80, angle: 160 },   // Shooting south-southwest
      { x: 70, y: 180, angle: 20 },    // Shooting east-northeast
      { x: 320, y: 50, angle: 135 }    // Shooting southeast
    ];

    flashPositions.forEach((pos, index) => {
      // Stagger the initial flashes
      this.time.delayedCall(index * 400 + Math.random() * 800, () => {
        this.createDirectionalMuzzleFlash(pos.x, pos.y, pos.angle);
      });
    });
  }

  private createDirectionalMuzzleFlash(x: number, y: number, angle: number): void {
    // Create cone-shaped directional flash
    const flashContainer = this.add.container(x, y);
    flashContainer.setDepth(-10);
    
    // Convert angle to radians
    const angleRad = Phaser.Math.DegToRad(angle);
    
    // Create the cone flash graphics
    const coneGraphics = this.add.graphics();
    
    // Multiple gradient layers for the cone (narrower spread for gun-like effect)
    const layers = [
      { distance: 80, spread: 25, alpha: 0.08, color: 0x881100 },  // Outer glow
      { distance: 65, spread: 22, alpha: 0.12, color: 0xdd4411 },  
      { distance: 50, spread: 20, alpha: 0.2, color: 0xff7722 },
      { distance: 35, spread: 18, alpha: 0.35, color: 0xffaa44 },
      { distance: 20, spread: 15, alpha: 0.5, color: 0xffdd88 },
      { distance: 10, spread: 12, alpha: 0.7, color: 0xffffcc }    // Inner bright
    ];
    
    layers.forEach(layer => {
      // Draw cone shape
      coneGraphics.fillStyle(layer.color, layer.alpha);
      coneGraphics.beginPath();
      coneGraphics.moveTo(0, 0);
      
      // Create cone arc
      const startAngle = angleRad - Phaser.Math.DegToRad(layer.spread);
      const endAngle = angleRad + Phaser.Math.DegToRad(layer.spread);
      
      // Draw cone edges with more points for smoother curve
      const steps = 20;
      for (let i = 0; i <= steps; i++) {
        const currentAngle = startAngle + (endAngle - startAngle) * (i / steps);
        const px = Math.cos(currentAngle) * layer.distance;
        const py = Math.sin(currentAngle) * layer.distance;
        coneGraphics.lineTo(px, py);
      }
      
      coneGraphics.closePath();
      coneGraphics.fillPath();
    });
    
    flashContainer.add(coneGraphics);
    
    // Add bright muzzle core
    const core = this.add.graphics();
    core.fillStyle(0xffffff, 0.9);
    core.fillCircle(0, 0, 6);
    flashContainer.add(core);
    
    // Illuminate with proper directional occlusion
    this.illuminateDirectionalFlash(x, y, angle, 80, 25);
    
    // Animate the flash with recoil effect
    this.tweens.add({
      targets: flashContainer,
      alpha: 0.2,
      duration: 60,
      yoyo: true,
      repeat: 1,
      onComplete: () => {
        // Fade out
        this.tweens.add({
          targets: flashContainer,
          alpha: 0,
          scaleX: 1.1,
          scaleY: 0.9, // Compress for recoil
          duration: 120,
          onComplete: () => {
            flashContainer.destroy();
            
            // Schedule next flash with slight angle variation
            this.time.delayedCall(2000 + Math.random() * 4000, () => {
              if (this.scene.isActive()) {
                const angleVariation = (Math.random() - 0.5) * 15; // ±7.5 degrees
                this.createDirectionalMuzzleFlash(x, y, angle + angleVariation);
              }
            });
          }
        });
      }
    });
  }
  
  private illuminateDirectionalFlash(flashX: number, flashY: number, angle: number, maxDistance: number, spread: number): void {
    const illumination = this.add.graphics();
    illumination.setDepth(-5);
    
    // Convert angle to radians
    const angleRad = Phaser.Math.DegToRad(angle);
    
    // Cast rays in a cone pattern
    const rayCount = 32; // More rays for better precision
    const startAngle = angleRad - Phaser.Math.DegToRad(spread);
    const endAngle = angleRad + Phaser.Math.DegToRad(spread);
    
    const visibilityPoints: Array<{x: number, y: number}> = [];
    
    // Cast rays within the cone
    for (let i = 0; i <= rayCount; i++) {
      const currentAngle = startAngle + (endAngle - startAngle) * (i / rayCount);
      const dx = Math.cos(currentAngle);
      const dy = Math.sin(currentAngle);
      
      // Find where this ray hits a wall or reaches max distance
      let hitDistance = maxDistance;
      
      for (const wall of this.wallPositions) {
        const intersection = this.rayIntersectWall(flashX, flashY, dx, dy, wall);
        if (intersection && intersection.distance < hitDistance && intersection.distance > 0) {
          hitDistance = intersection.distance;
        }
      }
      
      // Add the visibility point
      visibilityPoints.push({
        x: flashX + dx * hitDistance,
        y: flashY + dy * hitDistance
      });
    }
    
    // Draw the light cone gradient
    this.renderDirectionalLightGradient(illumination, flashX, flashY, maxDistance, visibilityPoints);
    
    // Fade out
    this.tweens.add({
      targets: illumination,
      alpha: 0,
      duration: 200,
      onComplete: () => illumination.destroy()
    });
  }

  private rayIntersectWall(rayX: number, rayY: number, rayDx: number, rayDy: number, wall: {x: number, y: number, width: number, height: number}) {
    // Check ray intersection with all four edges of the wall
    const edges = [
      {x1: wall.x, y1: wall.y, x2: wall.x + wall.width, y2: wall.y}, // top
      {x1: wall.x + wall.width, y1: wall.y, x2: wall.x + wall.width, y2: wall.y + wall.height}, // right
      {x1: wall.x + wall.width, y1: wall.y + wall.height, x2: wall.x, y2: wall.y + wall.height}, // bottom
      {x1: wall.x, y1: wall.y + wall.height, x2: wall.x, y2: wall.y} // left
    ];
    
    let nearestIntersection: {distance: number, x: number, y: number} | null = null;
    
    for (const edge of edges) {
      const intersection = this.rayIntersectLine(rayX, rayY, rayDx, rayDy, edge.x1, edge.y1, edge.x2, edge.y2);
      if (intersection && (!nearestIntersection || intersection.distance < nearestIntersection.distance)) {
        nearestIntersection = intersection;
      }
    }
    
    return nearestIntersection;
  }

  private rayIntersectLine(rayX: number, rayY: number, rayDx: number, rayDy: number, x1: number, y1: number, x2: number, y2: number) {
    // Ray-line intersection using parametric form
    const denominator = rayDx * (y2 - y1) - rayDy * (x2 - x1);
    if (Math.abs(denominator) < 0.0001) return null; // Parallel
    
    const t = ((x1 - rayX) * (y2 - y1) - (y1 - rayY) * (x2 - x1)) / denominator;
    const u = ((x1 - rayX) * rayDy - (y1 - rayY) * rayDx) / denominator;
    
    if (t >= 0 && u >= 0 && u <= 1) {
      const distance = t;
      return {
        distance: distance,
        x: rayX + rayDx * distance,
        y: rayY + rayDy * distance
      };
    }
    
    return null;
  }
  
  private renderDirectionalLightGradient(graphics: Phaser.GameObjects.Graphics, lightX: number, lightY: number, maxDistance: number, polygon: Array<{x: number, y: number}>): void {
    if (polygon.length < 3) return;
    
    // Add origin point to create complete cone
    const fullPolygon = [{ x: lightX, y: lightY }, ...polygon];
    
    // Create gradient rings within the cone
    const rings = 5;
    for (let ring = rings; ring >= 1; ring--) {
      const ringDistance = (ring / rings) * maxDistance;
      const alpha = (1 - ring / rings) * 0.25; // Subtler lighting
      
      // Color gradient
      const t = ring / rings;
      const red = Math.floor(255 * (0.9 + 0.1 * t));
      const green = Math.floor(255 * (0.7 - 0.2 * t));
      const blue = Math.floor(255 * (0.2 - 0.2 * t));
      const color = (red << 16) | (green << 8) | blue;
      
      graphics.fillStyle(color, alpha);
      graphics.beginPath();
      graphics.moveTo(lightX, lightY);
      
      for (let i = 0; i < polygon.length; i++) {
        const dist = Math.sqrt((polygon[i].x - lightX) ** 2 + (polygon[i].y - lightY) ** 2);
        if (dist <= ringDistance) {
          graphics.lineTo(polygon[i].x, polygon[i].y);
        } else {
          // Interpolate to ring distance
          const ratio = ringDistance / dist;
          const x = lightX + (polygon[i].x - lightX) * ratio;
          const y = lightY + (polygon[i].y - lightY) * ratio;
          graphics.lineTo(x, y);
        }
      }
      
      graphics.closePath();
      graphics.fillPath();
    }
  }
}

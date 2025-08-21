import { GAME_CONFIG } from '../../../shared/constants/index';
import { NetworkSystem } from '../systems/NetworkSystem';
import NetworkSystemSingleton from '../systems/NetworkSystemSingleton';

export class MenuScene extends Phaser.Scene {
  // UI elements
  private connectionContainer!: Phaser.GameObjects.Container;
  private wallPositions: Array<{x: number, y: number, width: number, height: number}> = [];

  constructor() {
    super({ key: 'MenuScene' });
  }

  create(): void {
    // Create atmospheric background FIRST
    this.createAtmosphericBackground();

    // Create main menu UI AFTER background
    this.createConnectionUI();
    
    // 🚀 NEW: Auto-connect to public server in background
    this.autoConnectToPublicServer();
  }



  private createConnectionUI(): void {
    // Main container
    this.connectionContainer = this.add.container(GAME_CONFIG.GAME_WIDTH / 2, GAME_CONFIG.GAME_HEIGHT / 2);

    // Enhanced title with glow effect (moved up for bigger container)
    const title = this.add.text(0, -90, 'TRESPASSER', {
      fontSize: '36px',
      color: '#00ff00',
      fontStyle: 'bold',
      fontFamily: 'monospace',
      shadow: { offsetX: 2, offsetY: 2, color: '#004400', blur: 4, stroke: true, fill: true }
    }).setOrigin(0.5);

    // Animated subtitle (moved up and made slightly larger)
    const subtitle = this.add.text(0, -55, 'Destructible 2D Multiplayer Shooter', {
      fontSize: '12px',
      color: '#cccccc',
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    // Version info (moved up)
    const version = this.add.text(0, -35, 'v0.1.0 ALPHA', {
      fontSize: '9px',
      color: '#666666',
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    // Menu border decoration (much bigger to use more screen space)
    const menuBorder = this.add.graphics();
    menuBorder.lineStyle(1, 0x444444);
    menuBorder.strokeRect(-200, -120, 400, 240);
    
    // Add subtle transparent background so flashes show through
    const menuBackground = this.add.graphics();
    menuBackground.fillStyle(0x111111, 0.65); // More transparent to show effects
    menuBackground.fillRect(-200, -120, 400, 240);

    // Create uniform buttons with fixed width rectangles
    const buttonWidth = 200;
    const primaryHeight = 24;
    const secondaryHeight = 20;

    // Play Now button (immediate deathmatch with minimal clicks) - moved to top
    const directButtonBg = this.add.graphics();
    directButtonBg.fillStyle(0x006600); // Green background for immediate action
    directButtonBg.fillRect(-buttonWidth/2, -5 - primaryHeight/2, buttonWidth, primaryHeight);
    const playNowButton = this.add.text(0, -5, 'QUICKPLAY', {
      fontSize: '14px',
      color: '#ffffff',
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    this.setupButton(playNowButton, '#006600', '#008800', () => {
      this.playNowAction();
    });

    // Public Match button (no password required!) - moved to second position
    const lobbyButtonBg = this.add.graphics();
    lobbyButtonBg.fillStyle(0x006600);
    lobbyButtonBg.fillRect(-buttonWidth/2, 25 - secondaryHeight/2, buttonWidth, secondaryHeight);
    const lobbySystemButton = this.add.text(0, 25, 'PLAY', {
      fontSize: '12px',
      color: '#ffffff',
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    this.setupButton(lobbySystemButton, '#006600', '#008800', () => {
      this.scene.start('LobbyMenuScene');
    });

    // Configure button (fixed width rectangle)
    const configButtonBg = this.add.graphics();
    configButtonBg.fillStyle(0x333333);
    configButtonBg.fillRect(-buttonWidth/2, 50 - secondaryHeight/2, buttonWidth, secondaryHeight);
    const configureButton = this.add.text(0, 50, 'LOADOUT', {
      fontSize: '12px',
      color: '#ffffff',
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    this.setupButton(configureButton, '#333333', '#555555', () => {
      this.scene.start('ConfigureScene');
    });

    // Settings button (fixed width rectangle)
    const settingsButtonBg = this.add.graphics();
    settingsButtonBg.fillStyle(0x444444);
    settingsButtonBg.fillRect(-buttonWidth/2, 75 - secondaryHeight/2, buttonWidth, secondaryHeight);
    const settingsButton = this.add.text(0, 75, 'CONFIG', {
      fontSize: '12px',
      color: '#ffffff',
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    this.setupButton(settingsButton, '#444444', '#666666', () => {
      this.openSettingsModal();
    });

    // 🧪 HIDDEN TEST MODE: Hold Shift+T+E+S+T for 2 seconds to activate
    let testSequence = '';
    let testTimer: number | null = null;
    
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      if (event.shiftKey && event.key.toLowerCase() === 't') {
        testSequence = 't';
        testTimer = window.setTimeout(() => {
          if (testSequence === 'test') {
            console.log('🧪 SECRET TEST MODE: Launching direct test game');
            this.launchTestMode();
          }
          testSequence = '';
        }, 2000);
      } else if (testSequence === 't' && event.key.toLowerCase() === 'e') {
        testSequence = 'te';
      } else if (testSequence === 'te' && event.key.toLowerCase() === 's') {
        testSequence = 'tes';
      } else if (testSequence === 'tes' && event.key.toLowerCase() === 't') {
        testSequence = 'test';
      } else {
        testSequence = '';
        if (testTimer) {
          clearTimeout(testTimer);
          testTimer = null;
        }
      }
    });

    // Set UI container depth to be on top but allow background effects to show
    this.connectionContainer.setDepth(100);

    // Add all elements to container (background first, then border, then content)
    this.connectionContainer.add([
      menuBackground, menuBorder, title, subtitle, version,
      directButtonBg, playNowButton,
      lobbyButtonBg, lobbySystemButton,
      configButtonBg, configureButton,
      settingsButtonBg, settingsButton
    ]);

    // Loadout status display (enhanced)
    const loadoutStatus = this.add.text(0, 105, '', {
      fontSize: '9px',
      color: '#888888',
      align: 'center',
      fontFamily: 'monospace'
    }).setOrigin(0.5);
    
    // Check if loadout is configured
    const savedLoadout = this.game.registry.get('playerLoadout');
    if (savedLoadout) {
      const primary = savedLoadout.primary || 'None';
      const team = savedLoadout.team || 'None';
      loadoutStatus.setText(`✓ ${team.toUpperCase()} team, ${primary.toUpperCase()}`);
      loadoutStatus.setColor('#00aa00');
    } else {
      loadoutStatus.setText('⚠ No loadout configured');
      loadoutStatus.setColor('#ffaa00');
    }

    // Add all elements to container
    this.connectionContainer.add([
      menuBorder, title, subtitle, version, playNowButton, lobbySystemButton, configureButton, settingsButton, loadoutStatus
    ]);

    // Instructions at bottom
    this.add.text(GAME_CONFIG.GAME_WIDTH / 2, GAME_CONFIG.GAME_HEIGHT - 10, 
      'Controls: WASD - Move, Ctrl - Sneak, Shift+W - Run, Mouse - Aim', {
      fontSize: '8px',
      color: '#888888',
      align: 'center',
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    // Add subtle pulsing animation to title
    this.tweens.add({
      targets: title,
      scaleX: 1.05,
      scaleY: 1.05,
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
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
    });
  }

  private openSettingsModal(): void {
    // Create a simple in-game settings overlay
    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.8);
    overlay.fillRect(0, 0, GAME_CONFIG.GAME_WIDTH, GAME_CONFIG.GAME_HEIGHT);
    overlay.setDepth(1000);

    const settingsContainer = this.add.container(GAME_CONFIG.GAME_WIDTH / 2, GAME_CONFIG.GAME_HEIGHT / 2);
    settingsContainer.setDepth(1001);

    // Settings panel background
    const panelBg = this.add.graphics();
    panelBg.fillStyle(0x222222);
    panelBg.lineStyle(2, 0x444444);
    panelBg.fillRect(-150, -100, 300, 200);
    panelBg.strokeRect(-150, -100, 300, 200);

    // Settings title
    const settingsTitle = this.add.text(0, -80, 'SETTINGS', {
      fontSize: '16px',
      color: '#00ff00',
      fontStyle: 'bold',
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    // Graphics quality setting
    const graphicsLabel = this.add.text(-120, -40, 'Graphics Quality:', {
      fontSize: '10px',
      color: '#ffffff',
      fontFamily: 'monospace'
    });

    const currentQuality = localStorage.getItem('graphics_quality') || 'medium';
    const qualityButton = this.add.text(20, -40, currentQuality.toUpperCase(), {
      fontSize: '10px',
      color: '#ffffff',
      backgroundColor: '#333333',
      padding: { x: 10, y: 4 },
      fontFamily: 'monospace'
    });

    this.setupButton(qualityButton, '#333333', '#555555', () => {
      const qualities = ['low', 'medium', 'high'];
      const currentIndex = qualities.indexOf(currentQuality);
      const nextQuality = qualities[(currentIndex + 1) % qualities.length];
      qualityButton.setText(nextQuality.toUpperCase());
      localStorage.setItem('graphics_quality', nextQuality);
    });

    // Audio volume setting
    const audioLabel = this.add.text(-120, -10, 'Master Volume:', {
      fontSize: '10px',
      color: '#ffffff',
      fontFamily: 'monospace'
    });

    const currentVolume = localStorage.getItem('master_volume') || '100';
    const volumeText = this.add.text(20, -10, `${currentVolume}%`, {
      fontSize: '10px',
      color: '#ffffff',
      backgroundColor: '#333333',
      padding: { x: 10, y: 4 },
      fontFamily: 'monospace'
    });

    // FPS Counter toggle
    const fpsLabel = this.add.text(-120, 20, 'Show FPS:', {
      fontSize: '10px',
      color: '#ffffff',
      fontFamily: 'monospace'
    });

    const showFps = localStorage.getItem('show_fps') === 'true';
    const fpsButton = this.add.text(20, 20, showFps ? 'ON' : 'OFF', {
      fontSize: '10px',
      color: '#ffffff',
      backgroundColor: showFps ? '#006600' : '#333333',
      padding: { x: 10, y: 4 },
      fontFamily: 'monospace'
    });

    this.setupButton(fpsButton, showFps ? '#006600' : '#333333', showFps ? '#008800' : '#555555', () => {
      const newState = !showFps;
      fpsButton.setText(newState ? 'ON' : 'OFF');
      fpsButton.setStyle({ backgroundColor: newState ? '#006600' : '#333333' });
      localStorage.setItem('show_fps', newState.toString());
    });

    // Close button
    const closeButton = this.add.text(0, 70, 'CLOSE', {
      fontSize: '12px',
      color: '#ffffff',
      backgroundColor: '#666666',
      padding: { x: 20, y: 8 },
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    this.setupButton(closeButton, '#666666', '#888888', () => {
      overlay.destroy();
      settingsContainer.destroy();
    });

    settingsContainer.add([
      panelBg, settingsTitle, graphicsLabel, qualityButton, 
      audioLabel, volumeText, fpsLabel, fpsButton, closeButton
    ]);
  }

  private createAtmosphericBackground(): void {
    // Very dark base layer - almost black for dramatic effect
    const darkOverlay = this.add.graphics();
    darkOverlay.fillStyle(0x050505, 0.95);
    darkOverlay.fillRect(0, 0, GAME_CONFIG.GAME_WIDTH, GAME_CONFIG.GAME_HEIGHT);
    darkOverlay.setDepth(-1000); // Put background at the very bottom

    // Store wall positions for occlusion calculations
    this.wallPositions = [];

    // Create more extensive wall network
    this.createWallSilhouettes();

    // Create dynamic muzzle flash effects with wall occlusion
    this.createMuzzleFlashEffects();

    // Add bullet trails that interact with walls
    this.createBulletTrails();
  }

  private createWallSilhouettes(): void {
    const wallGraphics = this.add.graphics();
    wallGraphics.fillStyle(0x0f0f0f, 0.9); // Much darker - barely visible

    // Create extensive wall network like a real combat zone
    const walls = [
      // Vertical walls
      {x: 60, y: 0, width: 12, height: 140},
      {x: 120, y: 30, width: 12, height: 160},
      {x: 180, y: 0, width: 12, height: 100},
      {x: 240, y: 80, width: 12, height: 190},
      {x: 300, y: 0, width: 12, height: 120},
      {x: 360, y: 50, width: 12, height: 180},
      {x: 420, y: 0, width: 12, height: 150},
      
      // Horizontal walls
      {x: 0, y: 60, width: 180, height: 12},
      {x: 200, y: 120, width: 200, height: 12},
      {x: 120, y: 180, width: 250, height: 12},
      {x: 0, y: 240, width: 160, height: 12},
      {x: 280, y: 200, width: 200, height: 12},
      
      // Corner pieces and fragments
      {x: 100, y: 40, width: 20, height: 20},
      {x: 320, y: 140, width: 20, height: 20},
      {x: 160, y: 220, width: 20, height: 20},
      {x: 400, y: 180, width: 20, height: 20},
      
      // Destroyed wall chunks (darker)
      {x: 65, y: 80, width: 8, height: 8},
      {x: 125, y: 140, width: 8, height: 8},
      {x: 185, y: 50, width: 8, height: 8},
      {x: 305, y: 70, width: 8, height: 8},
      {x: 365, y: 190, width: 8, height: 8}
    ];

    // Set wall graphics depth behind UI but visible
    wallGraphics.setDepth(-20);

    // Draw all walls and store positions for occlusion
    walls.forEach(wall => {
      wallGraphics.fillRect(wall.x, wall.y, wall.width, wall.height);
      this.wallPositions.push(wall);
    });

    // Debug: log wall positions
    console.log('Wall positions stored:', this.wallPositions.length);

    // Add some rubble and debris (even darker)
    wallGraphics.fillStyle(0x080808, 0.6);
    for (let i = 0; i < 15; i++) {
      const x = Math.random() * GAME_CONFIG.GAME_WIDTH;
      const y = Math.random() * GAME_CONFIG.GAME_HEIGHT;
      wallGraphics.fillRect(x, y, 3 + Math.random() * 5, 3 + Math.random() * 5);
    }
  }

  private createMuzzleFlashEffects(): void {
    // Strategic muzzle flash positions with shooting directions (angles in degrees)
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
      let hitWall: any = null;
      let hitPoint: {x: number, y: number} | null = null;
      
      for (const wall of this.wallPositions) {
        const intersection = this.rayIntersectWall(flashX, flashY, dx, dy, wall);
        if (intersection && intersection.distance < hitDistance && intersection.distance > 0) {
          hitDistance = intersection.distance;
          hitWall = wall;
          hitPoint = { x: intersection.x, y: intersection.y };
        }
      }
      
      // Add the visibility point
      visibilityPoints.push({
        x: flashX + dx * hitDistance,
        y: flashY + dy * hitDistance
      });
      
      // If we hit a wall, illuminate only the visible portion
      if (hitWall && hitPoint) {
        this.illuminateWallSegment(illumination, flashX, flashY, hitWall, hitPoint, hitDistance, maxDistance);
      }
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
  
  private illuminateWallSegment(graphics: Phaser.GameObjects.Graphics, lightX: number, lightY: number, wall: any, hitPoint: {x: number, y: number}, distance: number, maxDistance: number): void {
    // Calculate which part of the wall edge to illuminate
    const intensity = Math.max(0, 1 - (distance / maxDistance));
    
    // Determine illumination radius on the wall based on distance
    const illuminationRadius = 15 * (1 - distance / maxDistance);
    
    // Only illuminate the portion of the wall near the hit point
    const edges = [
      {x1: wall.x, y1: wall.y, x2: wall.x + wall.width, y2: wall.y}, // top
      {x1: wall.x + wall.width, y1: wall.y, x2: wall.x + wall.width, y2: wall.y + wall.height}, // right
      {x1: wall.x + wall.width, y1: wall.y + wall.height, x2: wall.x, y2: wall.y + wall.height}, // bottom
      {x1: wall.x, y1: wall.y + wall.height, x2: wall.x, y2: wall.y} // left
    ];
    
    edges.forEach(edge => {
      // Check if hit point is near this edge
      const distToEdge = this.pointToLineDistance(hitPoint.x, hitPoint.y, edge.x1, edge.y1, edge.x2, edge.y2);
      
      if (distToEdge < 5) { // Hit point is on this edge
        // Calculate the segment of the edge to illuminate
        const edgeLength = Math.sqrt((edge.x2 - edge.x1) ** 2 + (edge.y2 - edge.y1) ** 2);
        const t = this.projectPointOnLine(hitPoint.x, hitPoint.y, edge.x1, edge.y1, edge.x2, edge.y2);
        
        // Only illuminate portion of edge near hit point
        const startT = Math.max(0, t - illuminationRadius / edgeLength);
        const endT = Math.min(1, t + illuminationRadius / edgeLength);
        
        const startX = edge.x1 + (edge.x2 - edge.x1) * startT;
        const startY = edge.y1 + (edge.y2 - edge.y1) * startT;
        const endX = edge.x1 + (edge.x2 - edge.x1) * endT;
        const endY = edge.y1 + (edge.y2 - edge.y1) * endT;
        
        // Draw the illuminated segment
        graphics.lineStyle(2, 0xffaa44, intensity * 0.6);
        graphics.beginPath();
        graphics.moveTo(startX, startY);
        graphics.lineTo(endX, endY);
        graphics.strokePath();
      }
    });
  }
  
  private pointToLineDistance(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;
    
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    
    if (lenSq !== 0) param = dot / lenSq;
    
    let xx, yy;
    
    if (param < 0) {
      xx = x1;
      yy = y1;
    } else if (param > 1) {
      xx = x2;
      yy = y2;
    } else {
      xx = x1 + param * C;
      yy = y1 + param * D;
    }
    
    const dx = px - xx;
    const dy = py - yy;
    
    return Math.sqrt(dx * dx + dy * dy);
  }
  
  private projectPointOnLine(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    
    if (lenSq === 0) return 0;
    
    return ((px - x1) * dx + (py - y1) * dy) / lenSq;
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

  private illuminateWithOcclusion(flashX: number, flashY: number, radius: number): void {
    console.log('Creating ray-cast illumination at:', flashX, flashY);
    
    const illumination = this.add.graphics();
    illumination.setDepth(-5);
    
    // Create visibility polygon using ray casting
    const visibilityPolygon = this.calculateVisibilityPolygon(flashX, flashY, radius);
    
    // Fill the visible area with light gradient
    this.renderLightGradient(illumination, flashX, flashY, radius, visibilityPolygon);
    
    // Illuminate wall edges that are visible
    this.illuminateVisibleWallEdges(illumination, flashX, flashY, radius, visibilityPolygon);
    
    // Fade out the illumination
    this.tweens.add({
      targets: illumination,
      alpha: 0,
      duration: 300,
      onComplete: () => illumination.destroy()
    });
  }

  private calculateVisibilityPolygon(lightX: number, lightY: number, maxRadius: number): Array<{x: number, y: number}> {
    // Get all wall corners and boundaries within light radius
    const obstacles: Array<{x: number, y: number}> = [];
    
    this.wallPositions.forEach(wall => {
      const distance = this.getDistanceToWall(lightX, lightY, wall);
      if (distance < maxRadius) {
        // Add all four corners of the wall
        obstacles.push({x: wall.x, y: wall.y});
        obstacles.push({x: wall.x + wall.width, y: wall.y});
        obstacles.push({x: wall.x + wall.width, y: wall.y + wall.height});
        obstacles.push({x: wall.x, y: wall.y + wall.height});
      }
    });
    
    // Add boundary points at max radius
    const rayCount = 64; // Number of rays to cast
    const boundaryPoints: Array<{x: number, y: number}> = [];
    
    for (let i = 0; i < rayCount; i++) {
      const angle = (i / rayCount) * Math.PI * 2;
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      
      // Cast ray and find nearest intersection
      let nearestDistance = maxRadius;
      
      // Check intersection with walls
      for (const wall of this.wallPositions) {
        const intersection = this.rayIntersectWall(lightX, lightY, dx, dy, wall);
        if (intersection && intersection.distance < nearestDistance) {
          nearestDistance = intersection.distance;
        }
      }
      
      // Add the point where the ray ends
      boundaryPoints.push({
        x: lightX + dx * nearestDistance,
        y: lightY + dy * nearestDistance
      });
    }
    
    return boundaryPoints;
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

  private renderLightGradient(graphics: Phaser.GameObjects.Graphics, lightX: number, lightY: number, radius: number, polygon: Array<{x: number, y: number}>) {
    if (polygon.length < 3) return;
    
    // Create multiple gradient rings within the visibility polygon
    const rings = 6;
    for (let ring = rings; ring >= 1; ring--) {
      const ringRadius = (ring / rings) * radius;
      const alpha = (1 - ring / rings) * 0.4;
      
      // Create color gradient from yellow to red
      const t = ring / rings;
      const red = Math.floor(255 * (0.8 + 0.2 * t));
      const green = Math.floor(255 * (0.8 - 0.3 * t));
      const blue = Math.floor(255 * (0.3 - 0.3 * t));
      const color = (red << 16) | (green << 8) | blue;
      
      graphics.fillStyle(color, alpha);
      graphics.beginPath();
      graphics.moveTo(polygon[0].x, polygon[0].y);
      
      for (let i = 1; i < polygon.length; i++) {
        // Only include points within this ring's radius
        const dist = Math.sqrt((polygon[i].x - lightX) ** 2 + (polygon[i].y - lightY) ** 2);
        if (dist <= ringRadius) {
          graphics.lineTo(polygon[i].x, polygon[i].y);
        }
      }
      
      graphics.closePath();
      graphics.fillPath();
    }
  }

  private illuminateVisibleWallEdges(graphics: Phaser.GameObjects.Graphics, lightX: number, lightY: number, radius: number, polygon: Array<{x: number, y: number}>) {
    // Only illuminate the parts of walls that are actually visible in the polygon
    this.wallPositions.forEach(wall => {
      const distance = this.getDistanceToWall(lightX, lightY, wall);
      if (distance < radius) {
        // Check which parts of the wall are within the visibility polygon
        const wallEdges = [
          {x1: wall.x, y1: wall.y, x2: wall.x + wall.width, y2: wall.y}, // top
          {x1: wall.x + wall.width, y1: wall.y, x2: wall.x + wall.width, y2: wall.y + wall.height}, // right
          {x1: wall.x + wall.width, y1: wall.y + wall.height, x2: wall.x, y2: wall.y + wall.height}, // bottom
          {x1: wall.x, y1: wall.y + wall.height, x2: wall.x, y2: wall.y} // left
        ];
        
        wallEdges.forEach(edge => {
          // Check if this edge is illuminated
          const midX = (edge.x1 + edge.x2) / 2;
          const midY = (edge.y1 + edge.y2) / 2;
          
          if (this.isPointInPolygon(midX, midY, polygon)) {
            const intensity = Math.max(0, 1 - distance / radius);
            graphics.lineStyle(2, 0xffaa44, intensity * 0.8);
            graphics.beginPath();
            graphics.moveTo(edge.x1, edge.y1);
            graphics.lineTo(edge.x2, edge.y2);
            graphics.strokePath();
          }
        });
      }
    });
  }

  private isPointInPolygon(x: number, y: number, polygon: Array<{x: number, y: number}>): boolean {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      if (((polygon[i].y > y) !== (polygon[j].y > y)) &&
          (x < (polygon[j].x - polygon[i].x) * (y - polygon[i].y) / (polygon[j].y - polygon[i].y) + polygon[i].x)) {
        inside = !inside;
      }
    }
    return inside;
  }

  private isLightPathBlocked(lightX: number, lightY: number, targetX: number, targetY: number): boolean {
    // Check if any wall blocks the light path using line intersection
    for (const wall of this.wallPositions) {
      if (this.lineIntersectsRect(lightX, lightY, targetX, targetY, wall)) {
        return true;
      }
    }
    return false;
  }

  private lineIntersectsRect(x1: number, y1: number, x2: number, y2: number, rect: {x: number, y: number, width: number, height: number}): boolean {
    // Check if line segment intersects with rectangle (wall)
    const left = rect.x;
    const right = rect.x + rect.width;
    const top = rect.y;
    const bottom = rect.y + rect.height;
    
    // Check intersection with each edge of the rectangle
    return this.lineIntersectsLine(x1, y1, x2, y2, left, top, right, top) ||      // top edge
           this.lineIntersectsLine(x1, y1, x2, y2, right, top, right, bottom) ||   // right edge
           this.lineIntersectsLine(x1, y1, x2, y2, right, bottom, left, bottom) || // bottom edge
           this.lineIntersectsLine(x1, y1, x2, y2, left, bottom, left, top);       // left edge
  }

  private lineIntersectsLine(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, x4: number, y4: number): boolean {
    // Line intersection algorithm
    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (Math.abs(denom) < 0.0001) return false; // Lines are parallel
    
    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;
    
    return t >= 0 && t <= 1 && u >= 0 && u <= 1;
  }

  private isPointInsideWall(x: number, y: number): boolean {
    // Check if point is inside any wall
    for (const wall of this.wallPositions) {
      if (x >= wall.x && x <= wall.x + wall.width && 
          y >= wall.y && y <= wall.y + wall.height) {
        return true;
      }
    }
    return false;
  }

  private illuminateWallSurfaces(flashX: number, flashY: number, radius: number, illumination: Phaser.GameObjects.Graphics): void {
    // Illuminate wall surfaces that face the light source
    this.wallPositions.forEach(wall => {
      const distance = this.getDistanceToWall(flashX, flashY, wall);
      if (distance < radius) {
        // Check if wall surface is visible from light source
        const wallCenterX = wall.x + wall.width / 2;
        const wallCenterY = wall.y + wall.height / 2;
        
        if (!this.isLightPathBlocked(flashX, flashY, wallCenterX, wallCenterY)) {
          const intensity = Math.max(0, 1 - (distance / radius));
          const lightColor = 0xffaa44;
          const lightAlpha = intensity * 0.3;
          
          // Illuminate the wall surface
          illumination.fillStyle(lightColor, lightAlpha);
          illumination.fillRect(wall.x, wall.y, wall.width, wall.height);
          
          // Add edge highlighting for walls directly facing the light
          illumination.lineStyle(1, lightColor, lightAlpha * 1.5);
          illumination.strokeRect(wall.x, wall.y, wall.width, wall.height);
        }
      }
    });
  }

  private getCircleRectIntersection(circleX: number, circleY: number, radius: number, rect: {x: number, y: number, width: number, height: number}) {
    // Calculate bounding box of circle
    const circleLeft = circleX - radius;
    const circleRight = circleX + radius;
    const circleTop = circleY - radius;
    const circleBottom = circleY + radius;
    
    // Check if circle bounding box intersects with rectangle
    const intersects = !(circleRight < rect.x || 
                        circleLeft > rect.x + rect.width || 
                        circleBottom < rect.y || 
                        circleTop > rect.y + rect.height);
    
    return {
      intersects,
      left: circleLeft,
      right: circleRight,
      top: circleTop,
      bottom: circleBottom
    };
  }

  private getDistanceToWall(x: number, y: number, wall: {x: number, y: number, width: number, height: number}): number {
    // Calculate distance from point to rectangle
    const dx = Math.max(wall.x - x, 0, x - (wall.x + wall.width));
    const dy = Math.max(wall.y - y, 0, y - (wall.y + wall.height));
    return Math.sqrt(dx * dx + dy * dy);
  }

  private createBulletTrails(): void {
    // Create occasional bullet trails across the screen
    this.time.addEvent({
      delay: 2000,
      callback: () => {
        if (Math.random() < 0.25) { // 25% chance each interval
          this.createBulletTrail();
        }
      },
      loop: true
    });
  }

  private createBulletTrail(): void {
    // Random start position
    const startX = Math.random() * GAME_CONFIG.GAME_WIDTH;
    const startY = Math.random() * GAME_CONFIG.GAME_HEIGHT;
    
    // Random direction and length
    const angle = Math.random() * Math.PI * 2;
    const length = 15 + Math.random() * 25;

    const endX = startX + Math.cos(angle) * length;
    const endY = startY + Math.sin(angle) * length;

    // Create subtle bullet trail - behind UI but visible
    const trail = this.add.graphics();
    trail.setDepth(-15); // Behind UI but visible
    trail.lineStyle(1, 0xffff99, 0.3);
    trail.beginPath();
    trail.moveTo(startX, startY);
    trail.lineTo(endX, endY);
    trail.strokePath();

    // Quick fade out
    this.tweens.add({
      targets: trail,
      alpha: 0,
      duration: 200,
      onComplete: () => trail.destroy()
    });
  }

  // 🚀 NEW: Auto-connect to public server in background
  private async autoConnectToPublicServer(): Promise<void> {
    try {
      // Get or create NetworkSystem singleton
      const networkSystem = NetworkSystemSingleton.getInstance(this);
      
      // Check if already connected or connecting
      if (networkSystem.isSocketConnected()) {
        if (networkSystem.isAuthenticated()) {
          console.log('✅ Already connected and authenticated to server');
        } else {
          console.log('✅ Already connected to server, waiting for authentication');
        }
        return;
      }
      
      // Get default public server URL
      const publicServerUrl = this.getDefaultServerUrl();
      console.log('🌐 Auto-connecting to public server from main menu:', publicServerUrl);
      
      // Add a small delay to ensure the scene is fully loaded
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Connect without password (public server)
      await networkSystem.connectToServer(publicServerUrl, '');
      console.log('✅ Auto-connection successful from main menu');
      
    } catch (error) {
      console.error('❌ Auto-connection failed from main menu:', error);
      // Don't show error to user on main menu - they can still use manual connection
    }
  }

  private getDefaultServerUrl(): string {
    // Use environment variable if available (for production)
    const envBackendUrl = import.meta.env.VITE_BACKEND_URL;
    console.log('🔍 DEBUG: VITE_BACKEND_URL =', envBackendUrl);
    
    if (envBackendUrl) {
      console.log('🔍 DEBUG: Using environment URL:', envBackendUrl);
      return envBackendUrl;
    }
    
    // Check if we're on production domain
    const hostname = window.location.hostname;
    if (hostname === 'trespass.gg' || hostname === 'www.trespass.gg') {
      // PRODUCTION FALLBACK - Update this with your actual Railway URL!
      const productionUrl = 'https://trespasser-backend-production.up.railway.app';
      console.warn('⚠️ No VITE_BACKEND_URL set, using production fallback:', productionUrl);
      console.warn('⚠️ Please set VITE_BACKEND_URL in Vercel environment variables!');
      return productionUrl;
    }
    
    // Fallback to localhost for development
    const localUrl = 'http://localhost:3000';
    console.log('🔍 DEBUG: Using localhost fallback:', localUrl);
    return localUrl;
  }

  // 🧪 SECRET TEST MODE: Launch game directly with test loadout
  private launchTestMode(): void {
    console.log('🧪 LAUNCHING TEST MODE: Bypassing all connections');
    
    // Set a default test loadout
    const testLoadout = {
      team: 'blue',
      primary: 'rifle',
      secondary: 'pistol',
      support: []
    };
    
    // Store in game registry
    this.game.registry.set('playerLoadout', testLoadout);
    this.game.registry.set('testMode', true);
    
    // Go to configure scene for test mode
    console.log('Test mode: Going to ConfigureScene with test loadout');
    this.scene.start('ConfigureScene');
  }

  // 🚀 PLAY NOW: Immediate deathmatch action with minimal clicks
  private playNowAction(): void {
    console.log('🚀 PLAY NOW: Immediate deathmatch action');
    
    // Set flag in registry to indicate this is a "play now" flow
    this.game.registry.set('playNowMode', true);
    
    // Go directly to ConfigureScene - it will handle the immediate matchmaking
    console.log('🚀 PLAY NOW: Going to ConfigureScene for immediate loadout and game');
    this.scene.start('ConfigureScene');
  }
} 
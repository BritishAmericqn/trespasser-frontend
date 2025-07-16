import { PlayerState, Vector2 } from '../../../shared/types/index';

interface LastSeenData {
  position: Vector2;
  timestamp: number;
  fadeStarted: boolean;
  sprite?: Phaser.GameObjects.Container;
}

interface PlayerSprite {
  container: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Rectangle;
  nameText: Phaser.GameObjects.Text;
  healthBar: Phaser.GameObjects.Graphics;
  directionIndicator: Phaser.GameObjects.Graphics;
  team: 'red' | 'blue';
  lastUpdate: number;
}

export class PlayerManager {
  private scene: Phaser.Scene;
  private visiblePlayers: Map<string, PlayerSprite> = new Map();
  private lastSeenPositions: Map<string, LastSeenData> = new Map();
  private localPlayerId: string | null = null;
  
  // Visual constants
  private readonly PLAYER_SIZE = 16;
  private readonly FADE_IN_DURATION = 200; // ms
  private readonly FADE_OUT_DURATION = 300; // ms
  private readonly GHOST_DURATION = 2000; // ms before ghost starts fading
  private readonly GHOST_FADE_DURATION = 1000; // ms for ghost to fade out
  
  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }
  
  setLocalPlayerId(id: string): void {
    this.localPlayerId = id;
  }
  
  updatePlayers(serverPlayers: Map<string, PlayerState> | { [key: string]: PlayerState }): void {
    // Convert object to Map if needed
    const playersMap = serverPlayers instanceof Map 
      ? serverPlayers 
      : new Map(Object.entries(serverPlayers));
    
    // Track which players are still visible
    const stillVisibleIds = new Set<string>();
    
    // Update or add visible players
    for (const [id, state] of playersMap) {
      // Skip local player (handled separately)
      if (id === this.localPlayerId) continue;
      
      // Validate player state - check both position and transform properties
      let position = state.position;
      
      // Backend might be sending transform instead of position
      if (!position && state.transform) {
        position = state.transform;
      }
      
      if (!state || !position || typeof position.x !== 'number' || typeof position.y !== 'number') {
        console.warn(`Invalid player state for ${id}:`, state);
        continue;
      }
      
      // Update state to use the correct position
      state.position = position;
      
      stillVisibleIds.add(id);
      
      if (this.visiblePlayers.has(id)) {
        this.updatePlayer(id, state);
      } else {
        this.handlePlayerAppear(id, state);
      }
    }
    
    // Remove players no longer visible
    for (const [id, sprite] of this.visiblePlayers) {
      if (!stillVisibleIds.has(id)) {
        this.handlePlayerDisappear(id, sprite);
      }
    }
    
    // Update ghost sprites
    this.updateGhostSprites();
  }
  
  private handlePlayerAppear(id: string, state: PlayerState): void {
    // Remove from last seen if they were there
    const lastSeen = this.lastSeenPositions.get(id);
    if (lastSeen && lastSeen.sprite) {
      lastSeen.sprite.destroy();
      this.lastSeenPositions.delete(id);
    }
    
    // Create player sprite
    const sprite = this.createPlayerSprite(state);
    this.visiblePlayers.set(id, sprite);
    
    // Fade in animation
    sprite.container.setAlpha(0);
    this.scene.tweens.add({
      targets: sprite.container,
      alpha: 1,
      duration: this.FADE_IN_DURATION,
      ease: 'Power2'
    });
  }
  
  private handlePlayerDisappear(id: string, sprite: PlayerSprite): void {
    // Store last seen position
    this.lastSeenPositions.set(id, {
      position: { 
        x: sprite.container.x, 
        y: sprite.container.y 
      },
      timestamp: Date.now(),
      fadeStarted: false
    });
    
    // Fade out and remove
    this.scene.tweens.add({
      targets: sprite.container,
      alpha: 0,
      duration: this.FADE_OUT_DURATION,
      ease: 'Power2',
      onComplete: () => {
        sprite.container.destroy();
        this.visiblePlayers.delete(id);
        
        // Create ghost marker
        this.createGhostMarker(id);
      }
    });
  }
  
  private updatePlayer(id: string, state: PlayerState): void {
    const sprite = this.visiblePlayers.get(id);
    if (!sprite) return;
    
    // Update position (could add interpolation here)
    sprite.container.setPosition(state.position.x, state.position.y);
    
    // Update rotation based on velocity or angle if available
    if (state.velocity && (state.velocity.x !== 0 || state.velocity.y !== 0)) {
      const angle = Math.atan2(state.velocity.y, state.velocity.x);
      sprite.directionIndicator.setRotation(angle);
    }
    
    // Update health bar
    this.updateHealthBar(sprite.healthBar, state.health, 100);
    
    // Update color based on health
    const healthPercent = state.health / 100;
    if (healthPercent < 0.3) {
      sprite.body.setStrokeStyle(2, 0xff0000); // Red outline when low health
    } else {
      sprite.body.setStrokeStyle(1, 0x000000); // Normal outline
    }
    
    sprite.lastUpdate = Date.now();
  }
  
  private createPlayerSprite(state: PlayerState): PlayerSprite {
    const container = this.scene.add.container(state.position.x, state.position.y);
    container.setDepth(20);
    
    // Player body
    const teamColor = state.team === 'red' ? 0xff4444 : 0x4444ff;
    const body = this.scene.add.rectangle(0, 0, this.PLAYER_SIZE, this.PLAYER_SIZE, teamColor);
    body.setStrokeStyle(1, 0x000000);
    container.add(body);
    
    // Direction indicator (small triangle)
    const directionIndicator = this.scene.add.graphics();
    directionIndicator.fillStyle(0xffffff, 0.8);
    directionIndicator.beginPath();
    directionIndicator.moveTo(this.PLAYER_SIZE / 2, 0);
    directionIndicator.lineTo(this.PLAYER_SIZE / 2 + 4, -2);
    directionIndicator.lineTo(this.PLAYER_SIZE / 2 + 4, 2);
    directionIndicator.closePath();
    directionIndicator.fillPath();
    container.add(directionIndicator);
    
    // Player name (small text above)
    const nameText = this.scene.add.text(0, -this.PLAYER_SIZE - 8, `P${state.id.slice(-4)}`, {
      fontSize: '6px',
      color: '#ffffff'
    });
    nameText.setOrigin(0.5, 0.5);
    container.add(nameText);
    
    // Health bar
    const healthBar = this.scene.add.graphics();
    container.add(healthBar);
    this.updateHealthBar(healthBar, state.health, 100);
    
    return {
      container,
      body,
      nameText,
      healthBar,
      directionIndicator,
      team: state.team,
      lastUpdate: Date.now()
    };
  }
  
  private createGhostMarker(id: string): void {
    const lastSeen = this.lastSeenPositions.get(id);
    if (!lastSeen) return;
    
    const container = this.scene.add.container(lastSeen.position.x, lastSeen.position.y);
    container.setDepth(15); // Below actual players
    container.setAlpha(0.5);
    
    // Ghost body (outline only)
    const ghost = this.scene.add.rectangle(0, 0, this.PLAYER_SIZE, this.PLAYER_SIZE);
    ghost.setStrokeStyle(1, 0x888888, 0.5);
    container.add(ghost);
    
    // Question mark
    const questionMark = this.scene.add.text(0, 0, '?', {
      fontSize: '10px',
      color: '#888888'
    });
    questionMark.setOrigin(0.5, 0.5);
    container.add(questionMark);
    
    // Footprint icon (optional, simple version)
    const footprint = this.scene.add.graphics();
    footprint.fillStyle(0x888888, 0.3);
    footprint.fillCircle(-3, 8, 2);
    footprint.fillCircle(3, 8, 2);
    container.add(footprint);
    
    lastSeen.sprite = container;
  }
  
  private updateGhostSprites(): void {
    const now = Date.now();
    
    for (const [id, lastSeen] of this.lastSeenPositions) {
      if (!lastSeen.sprite) continue;
      
      const timeSinceSeen = now - lastSeen.timestamp;
      
      // Start fading after GHOST_DURATION
      if (timeSinceSeen > this.GHOST_DURATION && !lastSeen.fadeStarted) {
        lastSeen.fadeStarted = true;
        
        this.scene.tweens.add({
          targets: lastSeen.sprite,
          alpha: 0,
          duration: this.GHOST_FADE_DURATION,
          ease: 'Power2',
          onComplete: () => {
            lastSeen.sprite?.destroy();
            this.lastSeenPositions.delete(id);
          }
        });
      }
    }
  }
  
  private updateHealthBar(graphics: Phaser.GameObjects.Graphics, current: number, max: number): void {
    graphics.clear();
    
    const barWidth = 20;
    const barHeight = 3;
    const barY = -this.PLAYER_SIZE - 4;
    
    // Background
    graphics.fillStyle(0x333333, 0.8);
    graphics.fillRect(-barWidth / 2, barY, barWidth, barHeight);
    
    // Health fill
    const healthPercent = Math.max(0, Math.min(1, current / max));
    const healthColor = healthPercent > 0.6 ? 0x00ff00 : healthPercent > 0.3 ? 0xffff00 : 0xff0000;
    graphics.fillStyle(healthColor, 0.9);
    graphics.fillRect(-barWidth / 2, barY, barWidth * healthPercent, barHeight);
    
    // Border
    graphics.lineStyle(1, 0x000000, 0.5);
    graphics.strokeRect(-barWidth / 2, barY, barWidth, barHeight);
  }
  
  // Get interpolated positions for smooth rendering
  getInterpolatedPositions(): Map<string, Vector2> {
    const positions = new Map<string, Vector2>();
    
    for (const [id, sprite] of this.visiblePlayers) {
      positions.set(id, {
        x: sprite.container.x,
        y: sprite.container.y
      });
    }
    
    return positions;
  }
  
  destroy(): void {
    // Clean up all sprites
    for (const [, sprite] of this.visiblePlayers) {
      sprite.container.destroy();
    }
    this.visiblePlayers.clear();
    
    for (const [, lastSeen] of this.lastSeenPositions) {
      if (lastSeen.sprite) {
        lastSeen.sprite.destroy();
      }
    }
    this.lastSeenPositions.clear();
  }
} 
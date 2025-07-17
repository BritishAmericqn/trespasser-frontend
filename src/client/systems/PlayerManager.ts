import { PlayerState, Vector2 } from '../../../shared/types/index';
import { VisionRenderer } from './VisionRenderer';

interface LastSeenData {
  position: Vector2;
  timestamp: number;
  fadeStarted: boolean;
  sprite?: Phaser.GameObjects.Container;
}

interface PlayerSprite {
  container: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Sprite;
  weapon: Phaser.GameObjects.Sprite; // Add weapon sprite
  directionIndicator: Phaser.GameObjects.Graphics;
  team: 'red' | 'blue';
  lastUpdate: number;
  maskGraphics?: Phaser.GameObjects.Graphics;
  mask?: Phaser.Display.Masks.GeometryMask;
}

import { AssetManager } from '../utils/AssetManager';

export class PlayerManager {
  private scene: Phaser.Scene;
  private visiblePlayers: Map<string, PlayerSprite> = new Map();
  private lastSeenPositions: Map<string, LastSeenData> = new Map();
  private localPlayerId: string | null = null;
  private visionRenderer: VisionRenderer | null = null;
  private partialVisibilityEnabled: boolean = true; // Enable by default
  private assetManager: AssetManager;
  
  // Visual constants
  private readonly PLAYER_SIZE = 16;
  private readonly FADE_IN_DURATION = 200; // ms
  private readonly FADE_OUT_DURATION = 300; // ms
  private readonly GHOST_DURATION = 2000; // ms before ghost starts fading
  private readonly GHOST_FADE_DURATION = 1000; // ms for ghost to fade out
  
  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.assetManager = new AssetManager(scene);
  }
  
  setLocalPlayerId(id: string): void {
    this.localPlayerId = id;
  }
  
  setVisionRenderer(visionRenderer: VisionRenderer): void {
    this.visionRenderer = visionRenderer;
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
      
      // Validate player state - be flexible about position format
      let position = null;
      
      // Try multiple position formats
      if (state.position && typeof state.position.x === 'number') {
        position = state.position;
      } else if ((state as any).transform?.position && typeof (state as any).transform.position.x === 'number') {
        position = (state as any).transform.position;
      } else if ((state as any).x !== undefined && (state as any).y !== undefined) {
        position = { x: (state as any).x, y: (state as any).y };
      }
      
      if (!position || typeof position.x !== 'number' || typeof position.y !== 'number') {
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
    
    // Update visibility masks for all players
    this.updateVisibilityMasks();
    
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
    // Clean up mask before storing position
    if (sprite.mask) {
      sprite.container.clearMask();
      sprite.mask.destroy();
      sprite.mask = undefined;
    }
    
    if (sprite.maskGraphics) {
      sprite.maskGraphics.destroy();
      sprite.maskGraphics = undefined;
    }
    
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
    let playerAngle = 0;
    if (state.velocity && (state.velocity.x !== 0 || state.velocity.y !== 0)) {
      playerAngle = Math.atan2(state.velocity.y, state.velocity.x);
    } else if (state.angle !== undefined) {
      playerAngle = state.angle;
    }
    
    // Rotate player sprite and weapon to face direction
    sprite.body.setRotation(playerAngle + Math.PI / 2); // Player rotated 90 degrees clockwise
    sprite.directionIndicator.setRotation(playerAngle); // Direction indicator stays normal
    
    // Update weapon position and rotation for shoulder mounting
    const shoulderOffset = 8; // Distance from center to shoulder
    const shoulderAngle = playerAngle + Math.PI / 2; // 90 degrees clockwise for right side
    const shoulderX = Math.cos(shoulderAngle) * shoulderOffset;
    const shoulderY = Math.sin(shoulderAngle) * shoulderOffset;
    
    // Add forward offset (ahead of player)
    const forwardOffset = 6; // Distance ahead of player
    const forwardX = Math.cos(playerAngle) * forwardOffset;
    const forwardY = Math.sin(playerAngle) * forwardOffset;
    
    // Combine both offsets (relative to container)
    const weaponX = shoulderX + forwardX;
    const weaponY = shoulderY + forwardY;
    
    sprite.weapon.setPosition(weaponX, weaponY); // Position relative to container
    sprite.weapon.setRotation(playerAngle + Math.PI); // Weapon flipped 180 degrees (barrel away)
    
    // Update weapon type if it changed
    if (state.weaponType && state.weaponType !== (sprite.weapon as any).weaponType) {
      // Destroy old weapon and create new one
      const oldWeapon = sprite.weapon;
      sprite.container.remove(oldWeapon);
      oldWeapon.destroy();
      
      // Create new weapon at shoulder position
      sprite.weapon = this.assetManager.createWeapon(0, 0, state.weaponType, playerAngle);
      sprite.weapon.setPosition(weaponX, weaponY); // Override position from createWeapon
      sprite.weapon.setRotation(playerAngle + Math.PI); // Apply 180-degree flip
      sprite.weapon.setDepth(19); // Just below player
      sprite.container.add(sprite.weapon);
      (sprite.weapon as any).weaponType = state.weaponType; // Store for comparison
    }
    
    // Update color based on health for visual feedback (subtle)
    const healthPercent = state.health / 100;
    if (healthPercent < 0.3) {
      sprite.body.setAlpha(0.7); // Slightly faded when low health
    } else {
      sprite.body.setAlpha(1); // Full opacity when healthy
    }
    
    sprite.lastUpdate = Date.now();
  }
  
  private createPlayerSprite(state: PlayerState): PlayerSprite {
    const container = this.scene.add.container(state.position.x, state.position.y);
    container.setDepth(20);
    
    // Use real player sprite (right-handed)
    const body = this.assetManager.createPlayer(0, 0, state.team);
    container.add(body);
    
    // Calculate initial rotation
    let playerAngle = 0;
    if (state.velocity && (state.velocity.x !== 0 || state.velocity.y !== 0)) {
      playerAngle = Math.atan2(state.velocity.y, state.velocity.x);
    } else if (state.angle !== undefined) {
      playerAngle = state.angle;
    }
    
    // Create weapon sprite at shoulder position
    const weaponType = state.weaponType || 'rifle';
    const shoulderOffset = 8; // Distance from center to shoulder
    const shoulderAngle = playerAngle + Math.PI / 2; // 90 degrees clockwise for right side
    const shoulderX = Math.cos(shoulderAngle) * shoulderOffset;
    const shoulderY = Math.sin(shoulderAngle) * shoulderOffset;
    
    // Add forward offset (ahead of player)
    const forwardOffset = 6; // Distance ahead of player
    const forwardX = Math.cos(playerAngle) * forwardOffset;
    const forwardY = Math.sin(playerAngle) * forwardOffset;
    
    // Combine both offsets (relative to container)
    const weaponX = shoulderX + forwardX;
    const weaponY = shoulderY + forwardY;
    
    const weapon = this.assetManager.createWeapon(0, 0, weaponType, playerAngle);
    weapon.setPosition(weaponX, weaponY); // Override position from createWeapon
    weapon.setRotation(playerAngle + Math.PI); // Apply 180-degree flip
    weapon.setDepth(19); // Just below player
    container.add(weapon);
    (weapon as any).weaponType = weaponType; // Store for comparison
    
    // Apply correct rotations from the start
    body.setRotation(playerAngle + Math.PI / 2); // Player rotated 90 degrees clockwise
    
    // Direction indicator (small triangle) - adjust for sprite size
    const directionIndicator = this.scene.add.graphics();
    directionIndicator.fillStyle(0xffffff, 0.9);
    directionIndicator.beginPath();
    directionIndicator.moveTo(this.PLAYER_SIZE, 0);
    directionIndicator.lineTo(this.PLAYER_SIZE + 6, -3);
    directionIndicator.lineTo(this.PLAYER_SIZE + 6, 3);
    directionIndicator.closePath();
    directionIndicator.fillPath();
    
    // Add subtle black outline to direction indicator
    directionIndicator.lineStyle(1, 0x000000, 0.8);
    directionIndicator.strokePath();
    directionIndicator.setRotation(playerAngle); // Direction indicator stays normal
    
    container.add(directionIndicator);
    
    return {
      container,
      body,
      weapon,
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
    container.setAlpha(0.3);
    
    // Ghost body (outline only) - subtle indicator
    const ghost = this.scene.add.rectangle(0, 0, this.PLAYER_SIZE * 0.8, this.PLAYER_SIZE * 0.8);
    ghost.setStrokeStyle(1, 0x666666, 0.3);
    container.add(ghost);
    
    // Simple dot in center - minimal visual hint
    const dot = this.scene.add.circle(0, 0, 2, 0x666666, 0.4);
    container.add(dot);
    
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
  
  private updateVisibilityMasks(): void {
    if (!this.visionRenderer || !this.partialVisibilityEnabled) return;
    
    const polygon = this.visionRenderer.getCurrentPolygon();
    
    // If no polygon, remove all masks
    if (!polygon || polygon.length < 3) {
      for (const [id, sprite] of this.visiblePlayers) {
        if (sprite.mask) {
          sprite.container.clearMask();
          sprite.mask.destroy();
          sprite.mask = undefined;
          
          if (sprite.maskGraphics) {
            sprite.maskGraphics.destroy();
            sprite.maskGraphics = undefined;
          }
        }
      }
      return;
    }
    
    // Apply or update masks for all enemy players
    for (const [id, sprite] of this.visiblePlayers) {
      // Skip local player - they should always be fully visible
      if (id === this.localPlayerId) {
        if (sprite.mask) {
          sprite.container.clearMask();
          sprite.mask.destroy();
          sprite.mask = undefined;
          
          if (sprite.maskGraphics) {
            sprite.maskGraphics.destroy();
            sprite.maskGraphics = undefined;
          }
        }
        continue;
      }
      
      // Create or update mask graphics
      if (!sprite.maskGraphics) {
        sprite.maskGraphics = this.scene.make.graphics({ x: 0, y: 0 }, false);
      } else {
        sprite.maskGraphics.clear();
      }
      
      // Draw the visibility polygon
      sprite.maskGraphics.fillStyle(0xffffff, 1);
      sprite.maskGraphics.beginPath();
      sprite.maskGraphics.moveTo(polygon[0].x, polygon[0].y);
      
      for (let i = 1; i < polygon.length; i++) {
        sprite.maskGraphics.lineTo(polygon[i].x, polygon[i].y);
      }
      
      sprite.maskGraphics.closePath();
      sprite.maskGraphics.fillPath();
      
      // Create or update geometry mask
      if (!sprite.mask) {
        sprite.mask = sprite.maskGraphics.createGeometryMask();
        sprite.container.setMask(sprite.mask);
      }
    }
  }
  
  private clearAllMasks(): void {
    for (const [id, sprite] of this.visiblePlayers) {
      if (sprite.mask) {
        sprite.container.clearMask();
        sprite.mask.destroy();
        sprite.mask = undefined;
        
        if (sprite.maskGraphics) {
          sprite.maskGraphics.destroy();
          sprite.maskGraphics = undefined;
        }
      }
    }
  }
  
  destroy(): void {
    // Clean up all sprites and their masks
    for (const [, sprite] of this.visiblePlayers) {
      if (sprite.mask) {
        sprite.container.clearMask();
        sprite.mask.destroy();
      }
      
      if (sprite.maskGraphics) {
        sprite.maskGraphics.destroy();
      }
      
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
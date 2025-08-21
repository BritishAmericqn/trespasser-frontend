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
  private playerTeamCache: Map<string, 'red' | 'blue'> = new Map();
  
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

  /**
   * Remove a specific player (for when they leave or die)
   */
  removePlayer(playerId: string): void {
    console.log(`👋 Removing player: ${playerId}`);
    
    // Remove from visible players
    const sprite = this.visiblePlayers.get(playerId);
    if (sprite) {
      // Clean up mask
      if (sprite.mask) {
        sprite.container.clearMask();
        sprite.mask.destroy();
      }
      if (sprite.maskGraphics) {
        sprite.maskGraphics.destroy();
      }
      
      // Destroy sprite
      sprite.container.destroy();
      this.visiblePlayers.delete(playerId);
    }
    
    // Remove from last seen positions
    const lastSeen = this.lastSeenPositions.get(playerId);
    if (lastSeen && lastSeen.sprite) {
      lastSeen.sprite.destroy();
      this.lastSeenPositions.delete(playerId);
    }
    
    // Clear team cache for this player
    this.playerTeamCache.delete(playerId);
    
    console.log(`✅ Player ${playerId} removed from PlayerManager`);
  }

  /**
   * Debug method to check current player visibility
   */
  debugPlayerVisibility(): void {
    console.log('👁️ PLAYER VISIBILITY DEBUG:');
    console.log(`- Visible players: ${this.visiblePlayers.size}`);
    console.log(`- Last seen players: ${this.lastSeenPositions.size}`);
    console.log(`- Vision renderer active: ${!!this.visionRenderer}`);
    console.log(`- Partial visibility masks: ${this.partialVisibilityEnabled ? 'ENABLED' : 'DISABLED'}`);
    
    for (const [id, sprite] of this.visiblePlayers) {
      const pos = { x: sprite.container.x, y: sprite.container.y };
      const hasMask = !!sprite.mask;
      const alpha = sprite.container.alpha;
      console.log(`  - Player ${id}: pos(${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}) alpha=${alpha} mask=${hasMask}`);
    }
    
    for (const [id, lastSeen] of this.lastSeenPositions) {
      console.log(`  - Ghost ${id}: pos(${lastSeen.position.x.toFixed(1)}, ${lastSeen.position.y.toFixed(1)})`);
    }
  }

  /**
   * Toggle partial visibility masks (for debugging)
   */
  togglePartialVisibility(): boolean {
    this.partialVisibilityEnabled = !this.partialVisibilityEnabled;
    console.log(`👁️ Partial visibility masks: ${this.partialVisibilityEnabled ? 'ENABLED' : 'DISABLED'}`);
    
    if (!this.partialVisibilityEnabled) {
      // Remove all masks
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
    } else {
      // Re-apply masks
      this.updateVisibilityMasks();
    }
    
    return this.partialVisibilityEnabled;
  }
  
  updatePlayers(serverPlayers: Map<string, PlayerState> | { [key: string]: PlayerState }): void {
    // Convert object to Map if needed
    const playersMap = serverPlayers instanceof Map 
      ? serverPlayers 
      : new Map(Object.entries(serverPlayers));
    
    // Debug log player count
    // Only log occasionally to reduce spam
    if (Math.random() < 0.005) { // 0.5% chance
      const playerCount = Array.from(playersMap.keys()).filter(id => id !== this.localPlayerId).length;
      if (playerCount > 0) {
        console.log(`👥 PlayerManager sample: ${playerCount} other players`);
      }
    }
    
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
      
      // REVERTED: Just add all players for now - vision check was breaking everything
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
    console.log(`👤 Player ${id} appearing at position (${state.position.x}, ${state.position.y})`);
    
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
    
    // Check if team has changed (should be rare but handle it)
    if (state.team && state.team !== sprite.team) {
      console.log(`🔄 Player ${id} team changed from ${sprite.team} to ${state.team}`);
      
      // Update the sprite texture to match new team
      const newTexture = state.team === 'red' ? 'player_red' : 'player_blue';
      sprite.body.setTexture(newTexture);
      sprite.team = state.team;
      
      // Update cache
      this.playerTeamCache.set(id, state.team);
    }

    // Update position (could add interpolation here)
    sprite.container.setPosition(state.position.x, state.position.y);
    
    // Handle alive/dead state from backend
    const isAlive = (state as any).isAlive !== false; // Default to alive if not specified
    const wasDead = (sprite as any).isDead || false;
    
    if (!isAlive && !wasDead) {
      // Player just died
      this.handlePlayerDeath(id, state.position);
    } else if (isAlive && wasDead) {
      // Player just respawned
      const invulnerableUntil = (state as any).invulnerableUntil;
      this.handlePlayerRespawn(id, state.position, invulnerableUntil);
    }
    
    // Skip rotation/weapon updates for dead players
    if (!isAlive) {
      sprite.lastUpdate = Date.now();
      return;
    }

    // Debug log to see what rotation data we're getting
    // if (Math.random() < 0.05) { // Log 5% of updates to avoid spam
    //   console.log(`🎯 Player ${id} state:`, {
    //     rotation: (state as any).rotation,
    //     direction: (state as any).direction,
    //     mouseAngle: (state as any).mouseAngle,
    //     angle: state.angle,
    //     velocity: state.velocity
    //   });
    // }
    
    // Use exact rotation from backend if available
    let playerAngle = 0;
    
    // Priority 1: Use exact rotation/direction field
    if ((state as any).rotation !== undefined) {
      playerAngle = (state as any).rotation;
    } else if ((state as any).direction !== undefined) {
      playerAngle = (state as any).direction;
    } else if ((state as any).mouseAngle !== undefined) {
      playerAngle = (state as any).mouseAngle;
    }
    // Fallback: Calculate from velocity
    else if (state.velocity && (state.velocity.x !== 0 || state.velocity.y !== 0)) {
      playerAngle = Math.atan2(state.velocity.y, state.velocity.x);
    } else if (state.angle !== undefined) {
      playerAngle = state.angle;
    }
    
    // Rotate player sprite and weapon to face direction
    sprite.body.setRotation(playerAngle + Math.PI / 2); // Player rotated 90 degrees clockwise
    
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
    
    // Validate and log team assignment - Try multiple sources for team data
    let team: 'red' | 'blue' = 'blue';
    const playerId = (state as any).id;
    
    // Priority 1: Direct team field
    if (state.team) {
      team = state.team;
    }
    // Priority 2: Check loadout for team data
    else if ((state as any).loadout?.team) {
      team = (state as any).loadout.team;
      console.log(`🎨 Using team from loadout for player ${playerId}: ${team}`);
    }
    // Priority 3: Check cache from previous updates
    else if (playerId && this.playerTeamCache.has(playerId)) {
      team = this.playerTeamCache.get(playerId)!;
      console.log(`📋 Using cached team for player ${playerId}: ${team}`);
    }
    // Priority 4: Try to infer from spawn position (temporary workaround)
    else if (state.position) {
      // Red team typically spawns on left (x < 240), blue on right (x >= 240)
      team = state.position.x < 240 ? 'red' : 'blue';
      console.warn(`⚠️ Player ${playerId} missing team data, inferring ${team} from position (x=${state.position.x})`);
    }
    else {
      console.error(`❌ Player ${playerId} has no team data or position to infer from, defaulting to blue`);
    }
    
    // Store team in cache for future use
    if (playerId) {
      this.playerTeamCache.set(playerId, team);
    }
    
    // Team assignment occurs silently
    
    // Use real player sprite (right-handed)
    const body = this.assetManager.createPlayer(0, 0, team);
    
    // Calculate initial rotation
    let playerAngle = 0;
    
    // Priority 1: Use exact rotation/direction field
    if ((state as any).rotation !== undefined) {
      playerAngle = (state as any).rotation;
    } else if ((state as any).direction !== undefined) {
      playerAngle = (state as any).direction;
    } else if ((state as any).mouseAngle !== undefined) {
      playerAngle = (state as any).mouseAngle;
    }
    // Fallback: Calculate from velocity
    else if (state.velocity && (state.velocity.x !== 0 || state.velocity.y !== 0)) {
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
    
    // Apply correct rotations from the start
    body.setRotation(playerAngle + Math.PI / 2); // Player rotated 90 degrees clockwise
    
    // Direction indicator removed - no longer needed
    
    container.add(body);
    container.add(weapon);
    container.setDepth(20);
    
    return {
      container,
      body,
      weapon,
      team: team,
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

  /**
   * Handle player death - show as corpse/ghost
   */
  handlePlayerDeath(playerId: string, deathPosition?: any): void {
    console.log(`💀 Handling death for player: ${playerId}`);
    
    const sprite = this.visiblePlayers.get(playerId);
    if (sprite) {
      // Mark as dead and update visual appearance
      (sprite as any).isDead = true;
      
      // Show as corpse - semi-transparent with gray tint
      sprite.body.setAlpha(0.5);
      sprite.body.setTint(0x666666);
      
      // Hide weapon
      sprite.weapon.setVisible(false);
      
      // Optional: Play death animation if available
      // sprite.body.play('death');
      
      console.log(`💀 Player ${playerId} shown as corpse`);
    }
  }

  /**
   * Handle player respawn - restore normal appearance and add invulnerability effect
   */
  handlePlayerRespawn(playerId: string, respawnPosition: any, invulnerableUntil?: number): void {
    console.log(`✨ Handling respawn for player: ${playerId}`);
    
    const sprite = this.visiblePlayers.get(playerId);
    if (sprite) {
      // Mark as alive and restore normal appearance
      (sprite as any).isDead = false;
      
      // Restore normal appearance
      sprite.body.setAlpha(1.0);
      sprite.body.setTint(0xFFFFFF);
      
      // Show weapon again
      sprite.weapon.setVisible(true);
      
      // Update position if provided
      if (respawnPosition) {
        sprite.container.setPosition(respawnPosition.x, respawnPosition.y);
      }
      
      // Add invulnerability effect if specified
      if (invulnerableUntil && Date.now() < invulnerableUntil) {
        this.showInvulnerabilityEffect(sprite, invulnerableUntil);
      }
      
      console.log(`✨ Player ${playerId} respawned with normal appearance`);
    }
  }

  /**
   * Show invulnerability effect on player sprite
   */
  private showInvulnerabilityEffect(sprite: PlayerSprite, invulnerableUntil: number): void {
    const duration = invulnerableUntil - Date.now();
    if (duration <= 0) return;
    
    console.log(`🛡️ Showing invulnerability effect on player for ${duration}ms`);
    
    // Flash effect
    const flashTween = this.scene.tweens.add({
      targets: sprite.body,
      alpha: { from: 1, to: 0.3 },
      duration: 200,
      yoyo: true,
      repeat: Math.floor(duration / 400),
      ease: 'Power2'
    });
    
    // Clean up after invulnerability expires
    this.scene.time.delayedCall(duration, () => {
      if (flashTween.isPlaying()) {
        flashTween.stop();
      }
      sprite.body.setAlpha(1);
    });
  }

  /**
   * Clear all players during game restart to prevent identity conflicts
   */
  clearAllPlayers(): void {
    console.log('🧹 PlayerManager: Clearing all players for restart');
    
    // Remove all visible player sprites
    for (const [id, sprite] of this.visiblePlayers) {
      console.log(`🗑️ Removing player sprite: ${id}`);
      if (sprite.container) {
        sprite.container.destroy();
      }
    }
    this.visiblePlayers.clear();
    
    // Clear ghost data (handled through lastSeenPositions)
    console.log('🗑️ Clearing ghost/last seen position data');
    
    // Clear last seen positions
    this.lastSeenPositions.clear();
    
    // Reset local player ID (will be re-established after restart)
    console.log(`🔄 Resetting local player ID from: ${this.localPlayerId}`);
    this.localPlayerId = null;
    
    console.log('✅ PlayerManager: All players cleared');
  }
} 
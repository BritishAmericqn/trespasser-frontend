/**
 * Bulletproof Respawn Manager
 * Handles all respawn logic with automatic retries and fallbacks
 * Guarantees player will respawn no matter what
 */

import { Scene } from 'phaser';

interface RespawnData {
  playerId: string;
  position: { x: number; y: number };
  health: number;
  team?: string;
  invulnerableUntil?: number;
  forced?: boolean;
}

export class RespawnManager {
  private scene: any; // GameScene type
  private isRespawning: boolean = false;
  private respawnRequestTime: number = 0;
  private respawnAttempts: number = 0;
  private maxRespawnAttempts: number = 3;
  private respawnTimeout: any = null;
  private emergencyTimeout: any = null;
  
  // Track state to prevent issues
  private lastRespawnTime: number = 0;
  private respawnCooldown: number = 1000; // Prevent spam
  
  constructor(scene: any) {
    this.scene = scene;
    console.log('🛡️ RespawnManager initialized - bulletproof respawn system active');
  }
  
  /**
   * Request respawn with automatic retries and fallbacks
   */
  public requestRespawn(): void {
    // Prevent duplicate requests
    if (this.isRespawning) {
      console.log('⚠️ Respawn already in progress, ignoring duplicate request');
      return;
    }
    
    // Check cooldown to prevent spam
    const now = Date.now();
    if (now - this.lastRespawnTime < this.respawnCooldown) {
      console.log('⚠️ Respawn on cooldown, please wait');
      return;
    }
    
    // Validate scene is active
    if (!this.scene || !this.scene.scene.isActive()) {
      console.error('❌ Cannot respawn - scene not active');
      return;
    }
    
    // Validate player is actually dead
    if (!this.scene.isPlayerDead) {
      console.log('⚠️ Cannot respawn - player not dead');
      return;
    }
    
    this.isRespawning = true;
    this.respawnRequestTime = now;
    this.respawnAttempts++;
    
    console.log(`🔄 RESPAWN ATTEMPT ${this.respawnAttempts}/${this.maxRespawnAttempts}`);
    console.log('   Player ID:', this.getPlayerId());
    console.log('   Team:', this.scene.playerLoadout?.team || 'unknown');
    
    // Send respawn request to backend
    const socket = this.scene.networkSystem?.getSocket();
    if (socket && socket.connected) {
      console.log('📤 Sending respawn request to backend (multiple event names for compatibility)');
      
      // Send multiple event variants for compatibility
      socket.emit('player:respawn');
      socket.emit('respawn');
      socket.emit('player_respawn');
      socket.emit('request_respawn');
      
      // Set timeout for backend response (2 seconds)
      this.respawnTimeout = setTimeout(() => {
        this.handleRespawnTimeout();
      }, 2000);
      
      // Set emergency timeout (5 seconds) as final fallback
      this.emergencyTimeout = setTimeout(() => {
        console.error('🚨 EMERGENCY: No respawn after 5 seconds - forcing local respawn');
        this.forceLocalRespawn();
      }, 5000);
      
    } else {
      // No connection - force local respawn immediately
      console.warn('⚠️ No backend connection - forcing local respawn');
      this.forceLocalRespawn();
    }
  }
  
  /**
   * Handle successful respawn from backend
   */
  public handleRespawnSuccess(data: RespawnData): void {
    console.log('✅ RESPAWN SUCCESS - Backend responded:', data);
    
    // Prevent processing if not respawning
    if (!this.isRespawning && !this.scene.isPlayerDead) {
      console.log('⚠️ Respawn success received but not needed');
      return;
    }
    
    // Clear all pending timeouts
    this.clearAllTimeouts();
    
    // Execute respawn
    this.executeRespawn(data);
    
    // Reset state
    this.isRespawning = false;
    this.respawnAttempts = 0;
    this.lastRespawnTime = Date.now();
  }
  
  /**
   * Handle respawn timeout - retry or fallback
   */
  private handleRespawnTimeout(): void {
    console.warn(`⚠️ Respawn timeout - attempt ${this.respawnAttempts} failed`);
    
    // Clear timeout references
    this.respawnTimeout = null;
    
    if (this.respawnAttempts < this.maxRespawnAttempts) {
      // Retry
      console.log('🔄 Retrying respawn...');
      this.isRespawning = false;
      this.requestRespawn();
    } else {
      // Max attempts reached - force local respawn
      console.error('❌ Max respawn attempts reached - forcing local respawn');
      this.forceLocalRespawn();
    }
  }
  
  /**
   * Force local respawn without backend
   */
  public forceLocalRespawn(): void {
    console.log('🚨 FORCING LOCAL RESPAWN - bypassing backend');
    
    // Clear all timeouts
    this.clearAllTimeouts();
    
    // Validate scene still active
    if (!this.scene || !this.scene.scene.isActive()) {
      console.error('❌ Cannot force respawn - scene destroyed');
      return;
    }
    
    // Create respawn data locally
    const data: RespawnData = {
      playerId: this.getPlayerId(),
      position: this.getTeamSpawnPosition(),
      health: 100,
      team: this.scene.playerLoadout?.team || 'blue',
      invulnerableUntil: Date.now() + 3000,
      forced: true
    };
    
    console.log('📍 Force respawn data:', data);
    
    // Execute respawn
    this.executeRespawn(data);
    
    // Reset state
    this.isRespawning = false;
    this.respawnAttempts = 0;
    this.lastRespawnTime = Date.now();
    
    // Notify backend of forced respawn (if connected)
    const socket = this.scene.networkSystem?.getSocket();
    if (socket && socket.connected) {
      console.log('📤 Notifying backend of forced respawn');
      socket.emit('player:force_respawned', data);
      socket.emit('force_respawn', data);
    }
  }
  
  /**
   * Execute the actual respawn - complete state reset
   */
  private executeRespawn(data: RespawnData): void {
    console.group('🎮 EXECUTING RESPAWN');
    console.log('Data:', data);
    
    try {
      // Safety check - scene must be active
      if (!this.scene || !this.scene.scene.isActive()) {
        console.error('❌ Scene not active, aborting respawn');
        console.groupEnd();
        return;
      }
      
      // 1. CRITICAL: Clear death state first
      console.log('1️⃣ Clearing death state');
      this.scene.isPlayerDead = false;
      (this.scene as any).canRespawn = false;
      
      // 2. Hide death screen immediately
      console.log('2️⃣ Hiding death screen');
      this.hideDeathScreen();
      
      // 3. Validate and set position
      console.log('3️⃣ Setting position');
      const position = this.validatePosition(data.position);
      this.scene.playerPosition = position;
      console.log('   Position set to:', position);
      
      // 4. Reset player sprite completely
      console.log('4️⃣ Resetting player sprite');
      if (this.scene.playerSprite) {
        this.scene.playerSprite.setPosition(position.x, position.y);
        this.scene.playerSprite.setVisible(true);
        this.scene.playerSprite.setAlpha(1);
        this.scene.playerSprite.clearTint();
        this.scene.playerSprite.setScale(1);
        
        // CRITICAL: Restore correct team texture from loadout
        if (this.scene.playerLoadout?.team) {
          const correctTexture = this.scene.playerLoadout.team === 'red' ? 'player_red' : 'player_blue';
          if (this.scene.playerSprite.texture.key !== correctTexture) {
            console.log(`🎨 Restoring team texture on respawn: ${correctTexture} (team: ${this.scene.playerLoadout.team})`);
            this.scene.playerSprite.setTexture(correctTexture);
          }
        }
        
        console.log('   Sprite reset at:', position, 'with team:', this.scene.playerLoadout?.team);
      } else {
        console.warn('⚠️ No player sprite found');
      }
      
      // 5. Reset client prediction
      console.log('5️⃣ Resetting client prediction');
      if (this.scene.clientPrediction) {
        this.scene.clientPrediction.reset(position);
        (this.scene.clientPrediction as any).enabled = true;
        console.log('   Client prediction reset and enabled');
      }
      
      // 6. Re-enable input system
      console.log('6️⃣ Re-enabling input system');
      if (this.scene.inputSystem) {
        this.scene.inputSystem.setPlayerDead(false);
        // Clear any stuck input state
        (this.scene.inputSystem as any).lastInputState = null;
        (this.scene.inputSystem as any).respawnKeyWasPressed = false;
        (this.scene.inputSystem as any).lastRespawnRequest = 0;
        console.log('   Input system re-enabled');
      }
      
      // 7. Reset vision system
      console.log('7️⃣ Vision system will update with next game state');
      // Vision renderer will automatically update with next game state
      
      // 8. Update PlayerManager
      console.log('8️⃣ Updating PlayerManager');
      if (this.scene.playerManager) {
        this.scene.playerManager.handlePlayerRespawn(
          data.playerId,
          position,
          data.invulnerableUntil
        );
        console.log('   PlayerManager updated');
      }
      
      // 9. Reset health in UI
      console.log('9️⃣ Resetting health UI');
      if (this.scene.weaponUI) {
        this.scene.weaponUI.updateHealth(data.health || 100);
        console.log('   Health UI updated to:', data.health || 100);
      }
      
      // 10. Show invulnerability effect
      if (data.invulnerableUntil && Date.now() < data.invulnerableUntil) {
        console.log('🔟 Adding invulnerability effect');
        if (this.scene.showInvulnerabilityEffect) {
          this.scene.showInvulnerabilityEffect(data.invulnerableUntil);
        }
      }
      
      // 11. Clear any emergency timers
      console.log('1️⃣1️⃣ Clearing emergency timers');
      if (this.scene.emergencyRespawnTimer) {
        this.scene.emergencyRespawnTimer.destroy();
        this.scene.emergencyRespawnTimer = null;
      }
      
      // 12. Reset camera zoom and effects only - camera position stays fixed
      console.log('1️⃣2️⃣ Resetting camera zoom and effects');
      if (this.scene.cameras && this.scene.cameras.main) {
        const camera = this.scene.cameras.main;
        
        // Reset zoom to default (1.0)
        camera.setZoom(1);
        
        // Reset any alpha effects
        camera.setAlpha(1);
        
        // Clear any effects
        camera.resetFX();
        
        console.log('   Camera zoom and effects reset');
      }
      
      console.log('✅ RESPAWN COMPLETE - Player fully restored at:', position);
      
      // Log final state for debugging
      this.logRespawnState('POST-RESPAWN');
      
    } catch (error) {
      console.error('❌ ERROR DURING RESPAWN:', error);
      console.error('Stack:', (error as Error).stack);
      
      // Emergency fallback - at least clear death state
      this.scene.isPlayerDead = false;
      if (this.scene.inputSystem) {
        this.scene.inputSystem.setPlayerDead(false);
      }
    }
    
    console.groupEnd();
  }
  
  /**
   * Hide death screen completely
   */
  private hideDeathScreen(): void {
    try {
      // Clear death container
      const deathContainer = (this.scene as any).deathContainer;
      if (deathContainer) {
        console.log('🎭 Destroying death container');
        this.scene.tweens.killTweensOf(deathContainer);
        deathContainer.destroy();
        (this.scene as any).deathContainer = null;
      }
      
      // Clear respawn timer
      const respawnTimer = (this.scene as any).respawnTimer;
      if (respawnTimer) {
        respawnTimer.remove();
        (this.scene as any).respawnTimer = null;
      }
      
      // Clear any death-related tweens
      if (this.scene.tweens) {
        // Kill tweens on common death UI elements
        const deathElements = ['deathText', 'respawnText', 'killInfoText'];
        deathElements.forEach(element => {
          if ((this.scene as any)[element]) {
            this.scene.tweens.killTweensOf((this.scene as any)[element]);
          }
        });
      }
      
    } catch (error) {
      console.error('Error hiding death screen:', error);
    }
  }
  
  /**
   * Validate respawn position
   */
  private validatePosition(position: any): {x: number, y: number} {
    // Check if position exists and is valid
    if (position && 
        typeof position.x === 'number' && 
        typeof position.y === 'number' &&
        !(position.x === 0 && position.y === 0) &&
        position.x >= 0 && position.x <= 480 &&
        position.y >= 0 && position.y <= 270) {
      return {x: position.x, y: position.y};
    }
    
    // Invalid position - use team spawn
    console.warn('⚠️ Invalid respawn position:', position, '- using team spawn');
    return this.getTeamSpawnPosition();
  }
  
  /**
   * Get team-based spawn position
   */
  private getTeamSpawnPosition(): {x: number, y: number} {
    const team = this.scene.playerLoadout?.team || 'blue';
    return {
      x: team === 'red' ? 50 : 430,  // Red spawns left, blue spawns right
      y: 135  // Middle of the map
    };
  }
  
  /**
   * Get current player ID
   */
  private getPlayerId(): string {
    const socketId = this.scene.networkSystem?.getSocket()?.id;
    if (socketId) {
      // Update stored ID if different
      if (this.scene.localPlayerId !== socketId) {
        console.log('📝 Updating localPlayerId from', this.scene.localPlayerId, 'to', socketId);
        this.scene.localPlayerId = socketId;
      }
      return socketId;
    }
    return this.scene.localPlayerId || 'unknown';
  }
  
  /**
   * Clear all timeouts
   */
  private clearAllTimeouts(): void {
    if (this.respawnTimeout) {
      clearTimeout(this.respawnTimeout);
      this.respawnTimeout = null;
    }
    if (this.emergencyTimeout) {
      clearTimeout(this.emergencyTimeout);
      this.emergencyTimeout = null;
    }
  }
  
  /**
   * Log respawn state for debugging
   */
  private logRespawnState(context: string): void {
    if (!this.scene) return;
    
    console.group(`📊 Respawn State: ${context}`);
    console.log('isPlayerDead:', this.scene.isPlayerDead);
    console.log('canRespawn:', (this.scene as any).canRespawn);
    console.log('playerPosition:', this.scene.playerPosition);
    console.log('sprite visible:', this.scene.playerSprite?.visible);
    console.log('sprite position:', {
      x: this.scene.playerSprite?.x,
      y: this.scene.playerSprite?.y
    });
    console.log('inputSystem dead:', this.scene.inputSystem?.isPlayerDeadState());
    console.log('clientPrediction enabled:', (this.scene.clientPrediction as any)?.enabled);
    console.log('socketId:', this.scene.networkSystem?.getSocket()?.id);
    console.log('localPlayerId:', this.scene.localPlayerId);
    console.log('isRespawning:', this.isRespawning);
    console.log('respawnAttempts:', this.respawnAttempts);
    console.groupEnd();
  }
  
  /**
   * Cleanup
   */
  public destroy(): void {
    console.log('🧹 RespawnManager cleanup');
    this.clearAllTimeouts();
    this.isRespawning = false;
    this.respawnAttempts = 0;
    this.scene = null;
  }
}

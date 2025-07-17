import { IGameSystem } from '../../../shared/interfaces/IGameSystem';
import { AssetManager } from '../utils/AssetManager';

interface BulletTrail {
  line: Phaser.GameObjects.Graphics;
  startTime: number;
  duration: number;
  startAlpha: number;
}

interface MuzzleFlashData {
  sprite: Phaser.GameObjects.Sprite;
  playerId: string;
  weaponType: string;
  startTime: number;
}

interface Projectile {
  id: string;
  type: 'rocket' | 'grenade';
  position: { x: number; y: number };
  velocity: { x: number; y: number };
  trail: Phaser.GameObjects.Graphics;
  sprite?: Phaser.GameObjects.Sprite | Phaser.GameObjects.Container; // Visual representation (for grenade)
  rotation?: number; // Current rotation (for spinning)
  spinSpeed?: number; // Rotation speed based on velocity
  startTime: number;
  lifetime: number;
  lastSmokeTime?: number; // Track when we last spawned smoke
}

interface PendingShot {
  sequence: number;
  weaponType: string;
  startPosition: { x: number; y: number };
  timestamp: number;
}

export class VisualEffectsSystem implements IGameSystem {
  private scene: Phaser.Scene;
  private assetManager: AssetManager;
  private muzzleFlashes: MuzzleFlashData[] = [];
  private explosions: Phaser.GameObjects.Sprite[] = [];
  private hitMarkers: Phaser.GameObjects.Graphics[] = [];
  private particles: Phaser.GameObjects.Graphics[] = [];
  private bulletTrails: BulletTrail[] = [];
  private projectiles: Map<string, Projectile> = new Map();
  private pendingShots: Map<string, PendingShot> = new Map(); // Track shots waiting for backend response

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.assetManager = new AssetManager(scene);
  }

  initialize(): void {
    this.setupBackendEventListeners();
    this.setupLocalEventListeners();

  }

  update(deltaTime: number): void {
    // Update muzzle flashes (they auto-destroy via tweens, so just clean up destroyed ones)
    for (let i = this.muzzleFlashes.length - 1; i >= 0; i--) {
      const flash = this.muzzleFlashes[i];
      if (!flash.sprite.active) {
        this.muzzleFlashes.splice(i, 1);
      } else {
        // Update angle based on current player position and cursor
        const gameScene = this.scene as any;
        const localPlayerId = gameScene.networkSystem?.getSocket()?.id;
        
        // Only update angle for local player's muzzle flashes
        if (flash.playerId === localPlayerId && gameScene.playerPosition && gameScene.inputSystem) {
          // Get current mouse position from input system
          const inputState = gameScene.inputSystem.getInputState();
          
          // Calculate new angle from player to cursor
          const angle = Math.atan2(
            inputState.mouse.y - gameScene.playerPosition.y,
            inputState.mouse.x - gameScene.playerPosition.x
          );
          
          // Update muzzle flash rotation
          flash.sprite.setRotation(angle);
          
          // Also update position to follow player movement
          const shoulderOffset = 8;
          const shoulderAngle = angle + Math.PI / 2;
          const shoulderX = gameScene.playerPosition.x + Math.cos(shoulderAngle) * shoulderOffset;
          const shoulderY = gameScene.playerPosition.y + Math.sin(shoulderAngle) * shoulderOffset;
          
          const forwardOffset = 6;
          const forwardX = Math.cos(angle) * forwardOffset;
          const forwardY = Math.sin(angle) * forwardOffset;
          
          const weaponLength = 16;
          const barrelX = shoulderX + forwardX + Math.cos(angle) * weaponLength;
          const barrelY = shoulderY + forwardY + Math.sin(angle) * weaponLength;
          
          flash.sprite.setPosition(barrelX, barrelY);
        }
      }
    }

    // Update explosions (they auto-destroy via animation complete, so just clean up)
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const explosion = this.explosions[i];
      if (!explosion.active) {
        this.explosions.splice(i, 1);
      }
    }

    // Update hit markers
    this.updateHitMarkers();

    // Update particles
    this.updateParticles();

    // Update bullet trails
    this.updateBulletTrails();

    // Update projectiles
    this.updateProjectiles(deltaTime);
  }

  destroy(): void {
    this.muzzleFlashes.forEach(flash => flash.sprite.destroy()); // Destroy sprite
    this.muzzleFlashes = [];
    
    this.explosions.forEach(explosion => explosion.destroy());
    this.explosions = [];
    
    this.hitMarkers.forEach(marker => marker.destroy());
    this.hitMarkers = [];
    
    this.particles.forEach(particle => particle.destroy());
    this.particles = [];
    
    this.bulletTrails.forEach(trail => trail.line.destroy());
    this.bulletTrails = [];
    
    this.projectiles.forEach(projectile => {
      projectile.trail.destroy();
      if (projectile.sprite) {
        projectile.sprite.destroy();
      }
    });
    this.projectiles.clear();

    this.pendingShots.clear();
    
    this.removeBackendEventListeners();
    this.removeLocalEventListeners();
  }

  private setupBackendEventListeners(): void {
    // Listen for weapon events from backend
    this.scene.events.on('backend:weapon:fired', (data: any) => {
      // Show muzzle flash for OTHER players only to avoid doubles
      const gameScene = this.scene as any;
      const localPlayerId = gameScene.networkSystem?.getSocket()?.id;
      
      if (data.playerId && data.playerId !== localPlayerId) {
        // This is another player firing - show their muzzle flash
        this.showMuzzleFlash(data.position, data.direction, data.weaponType, data.playerId);
        console.log(`📡 Showing muzzle flash for other player: ${data.playerId}`);
      } else {
        console.log(`📡 Backend weapon:fired event received for local player ${data.weaponType || 'unknown'} - skipping to avoid double`);
      }
    });

    this.scene.events.on('backend:weapon:hit', (data: any) => {
      console.log(`🎯 Backend weapon hit at (${data.position?.x}, ${data.position?.y})`);
      
      if (data.position) {
        this.showHitMarker(data.position);
        
        // Debug: log what we're looking for
        console.log(`🔍 Looking for pending shot: playerId=${data.playerId}, weaponType=${data.weaponType}`);
        console.log(`🔍 Current pending shots:`, Array.from(this.pendingShots.keys()));
        
        // Find the pending shot to get start position - try exact weapon type first
        let pendingKey = `${data.playerId}_${data.weaponType}`;
        let pendingShot = this.pendingShots.get(pendingKey);
        
        // Fallback: try without weapon type if backend didn't send it
        if (!pendingShot && !data.weaponType) {
          // Try all weapon types
          const weaponTypes = ['rifle', 'pistol', 'rocket', 'grenade'];
          for (const weapon of weaponTypes) {
            pendingKey = `${data.playerId}_${weapon}`;
            pendingShot = this.pendingShots.get(pendingKey);
            if (pendingShot) {
              console.log(`🔍 Found pending shot with fallback weapon type: ${weapon}`);
              break;
            }
          }
        }
        
        if (pendingShot) {
          // Show trail from firing position to actual hit position
          this.showBulletTrail(pendingShot.startPosition, data.position, pendingShot.weaponType || data.weaponType);
          this.pendingShots.delete(pendingKey);
          console.log(`🎯 Bullet trail: ${pendingShot.weaponType || data.weaponType} hit target`);
        } else if (data.startPosition) {
          // Fallback to provided start position
          this.showBulletTrail(data.startPosition, data.position, data.weaponType || 'rifle');
          console.log(`🎯 Bullet trail: using fallback start position for ${data.weaponType || 'rifle'}`);
        }
      }
    });

    this.scene.events.on('backend:weapon:miss', (data: any) => {
      console.log(`🎯 Backend weapon miss for player ${data.playerId} with weapon ${data.weaponType}`);
      console.log(`🔍 Current pending shots:`, Array.from(this.pendingShots.keys()));
      
      // Find the pending shot for this player - try exact weapon type first
      let pendingKey = `${data.playerId}_${data.weaponType}`;
      let pendingShot = this.pendingShots.get(pendingKey);
      
      // Fallback: try without weapon type if backend didn't send it
      if (!pendingShot && !data.weaponType) {
        // Try all weapon types
        const weaponTypes = ['rifle', 'pistol', 'rocket', 'grenade'];
        for (const weapon of weaponTypes) {
          pendingKey = `${data.playerId}_${weapon}`;
          pendingShot = this.pendingShots.get(pendingKey);
          if (pendingShot) {
            console.log(`🔍 Found pending shot with fallback weapon type: ${weapon}`);
            break;
          }
        }
      }
      
      if (pendingShot) {
        let hitPosition: { x: number; y: number };
        
        if (data.position) {
          // Use exact position provided by backend
          hitPosition = data.position;
        } else {
          // Calculate hit point based on direction from backend
          const maxRange = 500;
          hitPosition = {
            x: pendingShot.startPosition.x + Math.cos(data.direction) * maxRange,
            y: pendingShot.startPosition.y + Math.sin(data.direction) * maxRange
          };
        }
        
        // Show the trail from start to calculated end
        this.showBulletTrail(pendingShot.startPosition, hitPosition, pendingShot.weaponType || data.weaponType || 'rifle');
        this.pendingShots.delete(pendingKey);
        
        // Show impact effect at the hit position
        this.showImpactEffect(hitPosition, data.direction);
        console.log(`🎯 Bullet trail: ${pendingShot.weaponType || data.weaponType} missed target`);
      } else if (data.position) {
        // Fallback: just show impact effect at the position provided
        this.showImpactEffect(data.position, data.direction);
        console.log(`🎯 No pending shot found, showing impact effect only`);
      }
    });

    this.scene.events.on('backend:wall:damaged', (data: any) => {
      console.log(`🎯 Backend wall damaged at (${data.position?.x}, ${data.position?.y}) by ${data.playerId}`);
      
      if (data.position) {
        this.showWallDamageEffect(data.position, data.material || 'concrete');
        this.showHitMarker(data.position);
        
        // Show trail to actual wall hit position
        if (data.playerId) {
          console.log(`🔍 Looking for wall damage pending shot: playerId=${data.playerId}, weaponType=${data.weaponType}`);
          
          // Try exact weapon type first
          let pendingKey = `${data.playerId}_${data.weaponType}`;
          let pendingShot = this.pendingShots.get(pendingKey);
          
          // Fallback: try without weapon type if backend didn't send it
          if (!pendingShot && !data.weaponType) {
            // Try all weapon types
            const weaponTypes = ['rifle', 'pistol', 'rocket', 'grenade'];
            for (const weapon of weaponTypes) {
              pendingKey = `${data.playerId}_${weapon}`;
              pendingShot = this.pendingShots.get(pendingKey);
              if (pendingShot) {
                console.log(`🔍 Found pending shot with fallback weapon type: ${weapon}`);
                break;
              }
            }
          }
          
          if (pendingShot) {
            this.showBulletTrail(pendingShot.startPosition, data.position, pendingShot.weaponType || data.weaponType || 'rifle');
            this.pendingShots.delete(pendingKey);
            console.log(`🎯 Bullet trail: ${pendingShot.weaponType || data.weaponType} hit wall ${data.wallId}`);
          } else {
            console.log(`🎯 No pending shot found for wall hit by ${data.playerId} with ${data.weaponType}`);
          }
        }
      }
    });

    // Handle projectile creation and updates
    this.scene.events.on('backend:projectile:created', (data: any) => {

      this.createProjectile(data);
    });

    this.scene.events.on('backend:projectile:updated', (data: any) => {
      this.updateProjectilePosition(data.id, data.position);
    });

    this.scene.events.on('backend:projectile:exploded', (data: any) => {
      this.handleProjectileExplosion(data.id, data.position, data.radius);
    });

    this.scene.events.on('backend:explosion:created', (data: any) => {
      // Show authoritative explosion (overrides client prediction)
      this.showExplosionEffect(data.position, data.radius);
      
      // Show wall damage for all affected walls
      if (data.damagedWalls) {
        data.damagedWalls.forEach((wall: any) => {
          this.showWallDamageEffect(wall.position, wall.material || 'concrete');
        });
      }
    });
  }

  private setupLocalEventListeners(): void {
    // Listen for local weapon firing for immediate feedback
    this.scene.events.on('weapon:fire', (data: any) => {
      this.showMuzzleFlash(data.position, data.direction, data.weaponType);
      
      // Store pending shot info for backend response matching
      const socket = (this.scene as any).networkSystem?.getSocket();
      if (socket && socket.id) {
        const pendingKey = `${socket.id}_${data.weaponType}`;
        this.pendingShots.set(pendingKey, {
          sequence: data.sequence,
          weaponType: data.weaponType,
          startPosition: { ...data.position },
          timestamp: data.timestamp
        });
        
        console.log(`📝 Stored pending shot: ${pendingKey} for ${data.weaponType}`);

        // Clean up old pending shots after 1 second
        this.scene.time.delayedCall(1000, () => {
          if (this.pendingShots.has(pendingKey)) {
            console.log(`🗑️ Cleaning up expired pending shot: ${pendingKey}`);
            this.pendingShots.delete(pendingKey);
          }
        });
      }
      
      // Handle different weapon types differently
      if (data.weaponType === 'grenade' || data.weaponType === 'rocket') {
        // For projectiles, don't show immediate trail - wait for backend projectile creation
        // Just show the launch effect
  
        
      } else {
        // For hitscan weapons (rifle, pistol), NO immediate trail - wait for backend response
        // This provides accurate trails that include weapon inaccuracy and backend hit detection
        if (data.weaponType === 'rifle' || data.weaponType === 'pistol') {
          console.log(`🎯 Fired ${data.weaponType} - waiting for backend hit result`);
        } else if (data.weaponType) {
          console.log(`🎯 Fired unknown weapon type: ${data.weaponType}`);
        }
      }
    });
  }

  private removeBackendEventListeners(): void {
    this.scene.events.off('backend:weapon:fired');
    this.scene.events.off('backend:weapon:hit');
    this.scene.events.off('backend:weapon:miss');
    this.scene.events.off('backend:wall:damaged');
    this.scene.events.off('backend:explosion:created');
    this.scene.events.off('backend:projectile:created');
    this.scene.events.off('backend:projectile:updated');
    this.scene.events.off('backend:projectile:exploded');
  }

  private removeLocalEventListeners(): void {
    this.scene.events.off('weapon:fire');
  }

  private updateHitMarkers(): void {
    // Update hit markers (simple fade out)
    for (let i = this.hitMarkers.length - 1; i >= 0; i--) {
      const marker = this.hitMarkers[i];
      const currentAlpha = marker.alpha;
      
      if (currentAlpha <= 0) {
        marker.destroy();
        this.hitMarkers.splice(i, 1);
      } else {
        marker.setAlpha(currentAlpha - 0.02); // Fade out over time
      }
    }
  }

  private updateParticles(): void {
    // Update particles (simple fade and movement)
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i];
      const currentAlpha = particle.alpha;
      
      if (currentAlpha <= 0) {
        particle.destroy();
        this.particles.splice(i, 1);
      } else {
        particle.setAlpha(currentAlpha - 0.01); // Fade out over time
        // Simple gravity effect
        particle.y += 0.5;
      }
    }
  }

  // Public methods for creating effects
  
  showMuzzleFlash(position: { x: number; y: number }, direction: number, weaponType: string = 'rifle', playerId?: string): void {
    const flash = this.assetManager.showMuzzleFlash(position.x, position.y, direction, weaponType);
    if (flash) {
      // Get player ID - use provided ID or default to local player
      const gameScene = this.scene as any;
      const actualPlayerId = playerId || gameScene.networkSystem?.getSocket()?.id || 'unknown';
      
      this.muzzleFlashes.push({
        sprite: flash,
        playerId: actualPlayerId,
        weaponType: weaponType,
        startTime: Date.now()
      });
    }
  }

  showHitMarker(position: { x: number; y: number }): void {
    const marker = this.scene.add.graphics();
    marker.setDepth(60);
    marker.lineStyle(2, 0xFF0000, 1);
    
    // Draw X mark
    const size = 4;
    marker.beginPath();
    marker.moveTo(position.x - size, position.y - size);
    marker.lineTo(position.x + size, position.y + size);
    marker.moveTo(position.x + size, position.y - size);
    marker.lineTo(position.x - size, position.y + size);
    marker.strokePath();
    
    this.hitMarkers.push(marker);

  }

  showImpactEffect(position: { x: number; y: number }, direction: number): void {
    // Only show subtle impact effect for missed shots
    // No yellow particles - just a small puff of dust
    const dust = this.scene.add.graphics();
    dust.setDepth(35); // Behind most effects
    dust.fillStyle(0x999999, 0.3); // Gray dust, low opacity
    dust.fillCircle(position.x, position.y, 2);
    
    // Fade out quickly
    this.scene.tweens.add({
      targets: dust,
      alpha: 0,
      scaleX: 1.5,
      scaleY: 1.5,
      duration: 200,
      ease: 'Power2',
      onComplete: () => {
        dust.destroy();
      }
    });
    
    console.log(`💥 Impact effect created at (${position.x.toFixed(1)}, ${position.y.toFixed(1)})`);
  }

  showWallDamageEffect(position: { x: number; y: number }, material: string = 'concrete'): void {
    // Create debris particles
    const debrisCount = 8;
    const colors = this.getDebrisColors(material);
    
    for (let i = 0; i < debrisCount; i++) {
      const debris = this.scene.add.graphics();
      debris.setDepth(55);
      debris.fillStyle(colors[Math.floor(Math.random() * colors.length)]);
      debris.fillRect(0, 0, 1, 1);
      
      // Position with random offset
      debris.x = position.x + (Math.random() - 0.5) * 15;
      debris.y = position.y + (Math.random() - 0.5) * 15;
      
      this.particles.push(debris);
    }
    
    
  }

  showExplosionEffect(position: { x: number; y: number }, radius: number): void {
    // Use real explosion animation
    const explosion = this.assetManager.showExplosion(position.x, position.y);
    this.explosions.push(explosion);
    
    // Add some particle debris for extra impact
    const particleCount = Math.min(12, Math.floor(radius / 3));
    
    for (let i = 0; i < particleCount; i++) {
      const particle = this.scene.add.graphics();
      particle.setDepth(55);
      
      // Alternate between orange and red debris
      const color = i % 2 === 0 ? 0xFF8000 : 0xFF0000;
      particle.fillStyle(color);
      particle.fillRect(0, 0, 2, 2);
      
      // Position in circle around explosion center
      const angle = (Math.PI * 2 * i) / particleCount;
      const distance = Math.random() * radius * 0.7;
      particle.x = position.x + Math.cos(angle) * distance;
      particle.y = position.y + Math.sin(angle) * distance;
      
      this.particles.push(particle);
    }
  }

  private getDebrisColors(material: string): number[] {
    switch (material) {
      case 'concrete':
        return [0x808080, 0xA0A0A0, 0x909090];
      case 'wood':
        return [0x8B4513, 0xA0522D, 0xCD853F];
      case 'metal':
        return [0xC0C0C0, 0x808080, 0x696969];
      case 'glass':
        return [0xE6E6FA, 0xF0F8FF, 0xFFFFFF];
      default:
        return [0x808080, 0xA0A0A0, 0x909090];
    }
  }

  private updateBulletTrails(): void {
    const currentTime = Date.now();
    
    for (let i = this.bulletTrails.length - 1; i >= 0; i--) {
      const trail = this.bulletTrails[i];
      const elapsed = currentTime - trail.startTime;
      
      if (elapsed >= trail.duration) {
        // Trail has expired
        trail.line.destroy();
        this.bulletTrails.splice(i, 1);
      } else {
        // Update alpha for fade effect
        const progress = elapsed / trail.duration;
        const alpha = trail.startAlpha * (1 - progress);
        trail.line.setAlpha(alpha);
      }
    }
  }

  private calculateBulletHitPoint(startPos: { x: number; y: number }, targetPos: { x: number; y: number }): { x: number; y: number } {
    // Enhanced ray-casting collision detection with walls
    // This is client-side prediction; backend will provide authoritative results
    
    // Get wall data from DestructionRenderer (via scene)
    const scene = this.scene as any;
    const wallsData = scene.destructionRenderer?.getWallsData(false) || [];
    
    // Debug: Log wall count
    if (wallsData.length === 0) {
      console.log('🎯 No walls found for collision detection, bullet goes to cursor');
      return targetPos;
    }
    
    // Calculate ray direction
    const dx = targetPos.x - startPos.x;
    const dy = targetPos.y - startPos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance === 0) return startPos;
    
    const dirX = dx / distance;
    const dirY = dy / distance;
    
    // Use smaller step size for more precise collision detection
    const stepSize = 0.5; // Check every 0.5 pixels for precision
    let currentX = startPos.x;
    let currentY = startPos.y;
    
    // Also check the maximum range (500 pixels)
    const maxRange = Math.min(distance, 500);
    
    for (let step = 0; step < maxRange; step += stepSize) {
      currentX += dirX * stepSize;
      currentY += dirY * stepSize;
      
      // Check collision with walls
      for (const wall of wallsData) {
        if (this.isPointInWall(currentX, currentY, wall)) {
          // Hit a wall - find the exact edge for precision
          const edgePoint = this.findWallEdge(startPos, { x: currentX, y: currentY }, wall);
          console.log(`🎯 Bullet hit wall at (${edgePoint.x.toFixed(1)}, ${edgePoint.y.toFixed(1)}) - stopped before cursor`);
          return edgePoint;
        }
      }
      
      // Check if we're outside game bounds
      if (currentX < 0 || currentX > 480 || currentY < 0 || currentY > 320) {
        console.log(`🎯 Bullet hit game boundary at (${currentX.toFixed(1)}, ${currentY.toFixed(1)})`);
        return { x: currentX, y: currentY };
      }
    }
    
    // No collision found, bullet travels to maximum range or target
    const finalPoint = distance > 500 ? {
      x: startPos.x + dirX * 500,
      y: startPos.y + dirY * 500
    } : targetPos;
    
    console.log(`🎯 Bullet reached end point at (${finalPoint.x.toFixed(1)}, ${finalPoint.y.toFixed(1)}) - no collision`);
    return finalPoint;
  }

  private isPointInWall(x: number, y: number, wall: any): boolean {
    // Check if point is inside wall bounds
    if (x < wall.position.x || x > wall.position.x + wall.width ||
        y < wall.position.y || y > wall.position.y + wall.height) {
      return false;
    }
    
    // Calculate which slice was hit based on wall orientation
    let sliceIndex: number;
    if (wall.orientation === 'horizontal' || wall.width > wall.height) {
      // Horizontal wall: check vertical slice
      const relativeX = x - wall.position.x;
      sliceIndex = Math.floor((relativeX / wall.width) * 5);
    } else {
      // Vertical wall: check horizontal slice
      const relativeY = y - wall.position.y;
      sliceIndex = Math.floor((relativeY / wall.height) * 5);
    }
    
    // Clamp slice index to valid range
    sliceIndex = Math.min(4, Math.max(0, sliceIndex));
    
    // Check if the wall slice is not destroyed
    return wall.destructionMask[sliceIndex] === 0; // 0 means not destroyed
  }

  private findWallEdge(startPos: { x: number; y: number }, hitPos: { x: number; y: number }, wall: any): { x: number; y: number } {
    // Binary search to find the exact edge where the bullet first hits the wall
    let low = 0;
    let high = 1;
    const dx = hitPos.x - startPos.x;
    const dy = hitPos.y - startPos.y;
    
    // Binary search for precise edge
    for (let i = 0; i < 10; i++) { // 10 iterations gives us good precision
      const mid = (low + high) / 2;
      const testX = startPos.x + dx * mid;
      const testY = startPos.y + dy * mid;
      
      if (this.isPointInWall(testX, testY, wall)) {
        high = mid; // Hit point is earlier in the ray
      } else {
        low = mid; // Hit point is later in the ray
      }
    }
    
    // Return the point just before hitting the wall
    const edgeRatio = (low + high) / 2;
    return {
      x: startPos.x + dx * edgeRatio,
      y: startPos.y + dy * edgeRatio
    };
  }

  private isTargetDifferentFromMouse(hitPoint: { x: number; y: number }, mousePos: { x: number; y: number }): boolean {
    // Check if bullet hit something before reaching mouse position
    const distance = Math.sqrt(
      Math.pow(hitPoint.x - mousePos.x, 2) + 
      Math.pow(hitPoint.y - mousePos.y, 2)
    );
    
    // If hit point is more than 5 pixels away from mouse, it hit something
    return distance > 5;
  }

  showBulletTrail(startPos: { x: number; y: number }, endPos: { x: number; y: number }, weaponType: string = 'rifle'): void {
    const trail = this.scene.add.graphics();
    trail.setDepth(40);
    
    // Different trail styles for different weapons
    let color = 0xFFFFFF;
    let width = 1;
    let duration = 300; // milliseconds
    let alpha = 1.0;
    
    switch (weaponType) {
      case 'rifle':
        color = 0xFFD700; // Gold
        width = 1;
        duration = 250;
        alpha = 1.0;
        break;
      case 'pistol':
        color = 0xFFFFFF; // White
        width = 0.5;
        duration = 200;
        alpha = 1.0;
        break;
      case 'grenade':
        color = 0x808080; // Gray (matching projectile trail)
        width = 1; // Thin line
        duration = 400;
        alpha = 0.3; // Low opacity like projectile trail
        break;
      case 'rocket':
        color = 0xFF0000; // Red
        width = 3;
        duration = 500;
        alpha = 1.0;
        break;
    }
    
    trail.lineStyle(width, color, alpha);
    trail.beginPath();
    trail.moveTo(startPos.x, startPos.y);
    trail.lineTo(endPos.x, endPos.y);
    trail.strokePath();
    
    this.bulletTrails.push({
      line: trail,
      startTime: Date.now(),
      duration: duration,
      startAlpha: 1.0
    });
    

  }

  // Debug methods
  
  getEffectCounts(): { muzzleFlashes: number; explosions: number; hitMarkers: number; particles: number; bulletTrails: number } {
    return {
      muzzleFlashes: this.muzzleFlashes.length,
      explosions: this.explosions.length,
      hitMarkers: this.hitMarkers.length,
      particles: this.particles.length,
      bulletTrails: this.bulletTrails.length
    };
  }

  clearAllEffects(): void {
    // Clear muzzle flashes
    this.muzzleFlashes.forEach(flash => flash.sprite.destroy()); // Destroy sprite
    this.muzzleFlashes = [];
    
    // Clear explosions
    this.explosions.forEach(explosion => explosion.destroy());
    this.explosions = [];
    
    // Clear hit markers
    this.hitMarkers.forEach(marker => marker.destroy());
    this.hitMarkers = [];
    
    // Clear particles
    this.particles.forEach(particle => particle.destroy());
    this.particles = [];
    
    // Clear bullet trails
    this.bulletTrails.forEach(trail => trail.line.destroy());
    this.bulletTrails = [];
    
    // Clear projectiles
    this.projectiles.forEach(projectile => {
      projectile.trail.destroy();
      if (projectile.sprite) {
        projectile.sprite.destroy();
      }
    });
    this.projectiles.clear();

    this.pendingShots.clear();
  }

  private createProjectile(data: any): void {
    const projectile: Projectile = {
      id: data.id,
      type: data.type,
      position: { x: data.position.x, y: data.position.y },
      velocity: { x: data.velocity?.x || 0, y: data.velocity?.y || 0 },
      trail: this.scene.add.graphics(),
      startTime: Date.now(),
      lifetime: data.lifetime || 5000 // Default 5 seconds
    };
    
    projectile.trail.setDepth(40);
    
    // Create visual sprite for grenade
    if (projectile.type === 'grenade') {
      // Create the grenade sprite
      const grenadeSprite = this.scene.add.sprite(data.position.x, data.position.y, 'fraggrenade');
      grenadeSprite.setDepth(45); // Above trails but below UI
      grenadeSprite.setScale(0.8); // Scale down slightly for game size
      grenadeSprite.setOrigin(0.5, 0.5); // Center origin for rotation
      
      projectile.sprite = grenadeSprite;
      projectile.rotation = 0;
      
      // Calculate spin speed based on velocity magnitude
      const speed = Math.sqrt(projectile.velocity.x * projectile.velocity.x + 
                            projectile.velocity.y * projectile.velocity.y);
      // Spin faster when thrown harder, but cap it
      projectile.spinSpeed = Math.min(speed * 0.02, 10); // Radians per update
      
      console.log(`💣 Created grenade projectile ${data.id} with spin speed ${projectile.spinSpeed.toFixed(2)}`);
    }
    
    this.projectiles.set(projectile.id, projectile);
  }

  private updateProjectilePosition(id: string, position: { x: number; y: number }): void {
    const projectile = this.projectiles.get(id);
    if (projectile) {
      const oldPos = { ...projectile.position };
      projectile.position = { ...position };
      
      // Update sprite position and rotation for grenades
      if (projectile.sprite && projectile.type === 'grenade') {
        projectile.sprite.setPosition(position.x, position.y);
        
        // Update rotation with slowing spin over time
        if (projectile.rotation !== undefined && projectile.spinSpeed !== undefined) {
          const elapsed = (Date.now() - projectile.startTime) / 1000; // seconds
          // Slow down spin over time (air resistance)
          const dampingFactor = Math.max(0.1, 1 - elapsed * 0.3); // Reduce by 30% per second, min 10%
          const currentSpinSpeed = projectile.spinSpeed * dampingFactor;
          
          projectile.rotation += currentSpinSpeed;
          projectile.sprite.setRotation(projectile.rotation);
        }
      }
      
      // Draw trail segment from old position to new position
      this.drawProjectileTrailSegment(projectile, oldPos, position);
    }
  }

  private drawProjectileTrailSegment(projectile: Projectile, fromPos: { x: number; y: number }, toPos: { x: number; y: number }): void {
    // Different trail styles for different projectile types
    if (projectile.type === 'rocket') {
      // For rockets, primarily use smoke particles, no harsh line
      const now = Date.now();
      if (!projectile.lastSmokeTime || now - projectile.lastSmokeTime > 25) { // More frequent smoke
        // Add multiple smoke particles for denser trail
        for (let i = 0; i < 2; i++) {
          this.addRocketSmokeParticle(toPos);
        }
        projectile.lastSmokeTime = now;
      }
      
      // Very faint connecting line
      projectile.trail.lineStyle(1, 0xCCCCCC, 0.1); // Thin light gray line with very low opacity
      projectile.trail.beginPath();
      projectile.trail.moveTo(fromPos.x, fromPos.y);
      projectile.trail.lineTo(toPos.x, toPos.y);
      projectile.trail.strokePath();
    } else if (projectile.type === 'grenade') {
      // Grenade trail - thin gray line
      projectile.trail.lineStyle(1, 0x808080, 0.3);
      projectile.trail.beginPath();
      projectile.trail.moveTo(fromPos.x, fromPos.y);
      projectile.trail.lineTo(toPos.x, toPos.y);
      projectile.trail.strokePath();
    }
  }

  private addRocketSmokeParticle(position: { x: number; y: number }): void {
    const smoke = this.scene.add.graphics();
    smoke.setDepth(35); // Behind the trail
    
    // Create a larger, more visible smoke puff
    const size = 2 + Math.random() * 2; // Variable size smoke particles
    smoke.fillStyle(0x999999, 0.6); // Lighter gray, more opaque initially
    smoke.fillCircle(0, 0, size);
    
    // Set initial position with small random offset
    smoke.x = position.x + (Math.random() - 0.5) * 3;
    smoke.y = position.y + (Math.random() - 0.5) * 3;
    
    // Add some random drift motion
    const driftX = (Math.random() - 0.5) * 15;
    const driftY = (Math.random() - 0.5) * 10; // Random drift in all directions
    
    // Fade out, expand, and drift the smoke
    this.scene.tweens.add({
      targets: smoke,
      alpha: 0,
      scaleX: 4,
      scaleY: 4,
      x: smoke.x + driftX,
      y: smoke.y + driftY,
      duration: 800,
      ease: 'Power2',
      onComplete: () => {
        smoke.destroy();
      }
    });
  }

  private handleProjectileExplosion(id: string, position: { x: number; y: number }, radius: number): void {
    const projectile = this.projectiles.get(id);
    if (projectile) {
      // Destroy grenade sprite if it exists
      if (projectile.sprite) {
        projectile.sprite.destroy();
      }
      
      // Fade out the trail
      this.scene.tweens.add({
        targets: projectile.trail,
        alpha: 0,
        duration: 200,
        onComplete: () => {
          projectile.trail.destroy();
          this.projectiles.delete(id);
        }
      });
      
      // Show explosion at the final position
      const explosionRadius = projectile.type === 'rocket' ? radius || 50 : radius || 40;
      this.showExplosionEffect(position, explosionRadius);
      
      console.log(`💥 ${projectile.type} exploded at (${position.x.toFixed(1)}, ${position.y.toFixed(1)})`);
    }
  }

  private updateProjectiles(deltaTime: number): void {
    const currentTime = Date.now();
    
    this.projectiles.forEach((projectile, id) => {
      const elapsed = currentTime - projectile.startTime;
      
      // Check if projectile has expired
      if (elapsed >= projectile.lifetime) {
        // Projectile timed out - remove it
        if (projectile.sprite) {
          projectile.sprite.destroy();
        }
        this.scene.tweens.add({
          targets: projectile.trail,
          alpha: 0,
          duration: 200,
          onComplete: () => {
            projectile.trail.destroy();
            this.projectiles.delete(id);
          }
        });
      } else {
        // Update trail fade based on age
        const fadeStart = projectile.lifetime * 0.7; // Start fading at 70% lifetime
        if (elapsed > fadeStart) {
          const fadeProgress = (elapsed - fadeStart) / (projectile.lifetime - fadeStart);
          projectile.trail.setAlpha(1 - fadeProgress * 0.5); // Fade to 50% alpha
        }
      }
    });
  }
} 
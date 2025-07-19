import { IGameSystem } from '../../../shared/interfaces/IGameSystem';
import { AssetManager } from '../utils/AssetManager';
import { GAME_CONFIG } from '../../../shared/constants/index';

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
  type: 'rocket' | 'grenade' | 'grenadelauncher' | 'smokegrenade' | 'flashbang';
  position: { x: number; y: number };
  velocity: { x: number; y: number };
  trail: Phaser.GameObjects.Graphics;
  sprite?: Phaser.GameObjects.Sprite | Phaser.GameObjects.Container; // Visual representation
  rotation?: number; // Current rotation (for spinning)
  spinSpeed?: number; // Rotation speed based on velocity
  startTime: number;
  lifetime: number;
  lastSmokeTime?: number; // Track when we last spawned smoke
  smokeEffect?: Phaser.GameObjects.Graphics; // For smoke grenade cloud
  flashEffect?: Phaser.GameObjects.Rectangle; // For flashbang screen effect
}

interface PendingShot {
  sequence: number;
  weaponType: string;
  startPosition: { x: number; y: number };
  timestamp: number;
  pelletIndex?: number; // Added for shotgun pellets
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
      const socket = (this.scene as any).networkSystem?.getSocket();
      const localPlayerId = socket?.id;
      
      if (data.playerId !== localPlayerId) {
        // This is another player firing - show their muzzle flash AND store pending shot
        this.showMuzzleFlash(data.position, data.direction, data.weaponType, data.playerId);
        
        // IMPORTANT: Store pending shot for other players too so we can show their trails
        if (socket) {
          // Handle shotgun specially - store multiple pending shots for pellets
          if (data.weaponType === 'shotgun') {
            // Store 8 pending shots for shotgun pellets (shotgun always fires 8 pellets)
            for (let pelletIndex = 0; pelletIndex < 8; pelletIndex++) {
              const pendingKey = `${data.playerId}_${data.weaponType}_pellet_${pelletIndex}`;
              this.pendingShots.set(pendingKey, {
                sequence: data.sequence,
                weaponType: data.weaponType,
                startPosition: { ...data.position },
                timestamp: data.timestamp || Date.now(),
                pelletIndex: pelletIndex
              });
            }
            
            // Clean up old pending shots after 2 seconds (longer for shotgun)
            this.scene.time.delayedCall(2000, () => {
              for (let pelletIndex = 0; pelletIndex < 8; pelletIndex++) {
                const pendingKey = `${data.playerId}_${data.weaponType}_pellet_${pelletIndex}`;
                if (this.pendingShots.has(pendingKey)) {
                  this.pendingShots.delete(pendingKey);
                }
              }
            });
            
          } else {
            // Regular weapons - use sequence number to handle multiple shots
            const pendingKey = `${data.playerId}_${data.weaponType}_${data.sequence || Date.now()}`;
            this.pendingShots.set(pendingKey, {
              sequence: data.sequence,
              weaponType: data.weaponType,
              startPosition: { ...data.position },
              timestamp: data.timestamp || Date.now()
            });

            // Clean up old pending shots after 1 second
            this.scene.time.delayedCall(1000, () => {
              if (this.pendingShots.has(pendingKey)) {
                this.pendingShots.delete(pendingKey);
              }
            });
          }
        }
      } else {
        // Backend weapon:fired event received for local player - skipping to avoid double
      }
    });

    this.scene.events.on('backend:weapon:hit', (data: any) => {
      
      if (data.position) {
        this.showHitMarker(data.position);
        
        let pendingShot: any = null;
        let pendingKey = '';
        
        // Special handling for shotgun - find any available pellet
        if (data.weaponType === 'shotgun') {
          // Look for any available shotgun pellet
          for (let pelletIndex = 0; pelletIndex < 8; pelletIndex++) {
            const pelletKey = `${data.playerId}_shotgun_pellet_${pelletIndex}`;
            if (this.pendingShots.has(pelletKey)) {
              pendingKey = pelletKey;
              pendingShot = this.pendingShots.get(pelletKey);
              break;
            }
          }
        } else {
          // Regular weapons - find by searching through all pending shots
          // Look for shots from this player with this weapon type
          for (const [key, shot] of this.pendingShots) {
            if (key.startsWith(`${data.playerId}_${data.weaponType}_`)) {
              pendingKey = key;
              pendingShot = shot;
              break; // Use the first matching shot (oldest)
            }
          }
          
          // Debug log for tracking misses only
          if (!pendingShot && Math.random() < 0.3) {
            console.log(`❌ No pending shot found for hit: player=${data.playerId} weapon=${data.weaponType}`);
            console.log(`   Available keys:`, Array.from(this.pendingShots.keys()));
          }
          
          // Fallback: try without weapon type if backend didn't send it
          if (!pendingShot && !data.weaponType) {
            // Try all weapon types
            const weaponTypes = ['rifle', 'pistol', 'rocket', 'grenade', 'smg', 'shotgun', 
                                'battlerifle', 'sniperrifle', 'revolver', 'suppressedpistol',
                                'grenadelauncher', 'machinegun', 'antimaterialrifle'];
            for (const weapon of weaponTypes) {
              for (const [key, shot] of this.pendingShots) {
                if (key.startsWith(`${data.playerId}_${weapon}_`)) {
                  pendingKey = key;
                  pendingShot = shot;
                  break;
                }
              }
              if (pendingShot) break;
            }
          }
        }
        
        if (pendingShot) {
          // Show trail from firing position to actual hit position
          this.showBulletTrail(pendingShot.startPosition, data.position, pendingShot.weaponType || data.weaponType);
          this.pendingShots.delete(pendingKey);
        } else if (data.startPosition) {
          // Fallback to provided start position
          this.showBulletTrail(data.startPosition, data.position, data.weaponType || 'rifle');
        }
      }
    });

    this.scene.events.on('backend:weapon:miss', (data: any) => {
      
      let pendingShot: any = null;
      let pendingKey = '';
      
      // Special handling for shotgun - find any available pellet
      if (data.weaponType === 'shotgun') {
        // Look for any available shotgun pellet
        for (let pelletIndex = 0; pelletIndex < 8; pelletIndex++) {
          const pelletKey = `${data.playerId}_shotgun_pellet_${pelletIndex}`;
          if (this.pendingShots.has(pelletKey)) {
            pendingKey = pelletKey;
            pendingShot = this.pendingShots.get(pelletKey);
            break;
          }
        }
      } else {
        // Regular weapons - find by searching through all pending shots
        // Look for shots from this player with this weapon type
        for (const [key, shot] of this.pendingShots) {
          if (key.startsWith(`${data.playerId}_${data.weaponType}_`)) {
            pendingKey = key;
            pendingShot = shot;
            break; // Use the first matching shot (oldest)
          }
        }
        
        // Fallback: try without weapon type if backend didn't send it
        if (!pendingShot && !data.weaponType) {
          // Try all weapon types
          const weaponTypes = ['rifle', 'pistol', 'rocket', 'grenade', 'smg', 'shotgun', 
                              'battlerifle', 'sniperrifle', 'revolver', 'suppressedpistol',
                              'grenadelauncher', 'machinegun', 'antimaterialrifle'];
          for (const weapon of weaponTypes) {
            for (const [key, shot] of this.pendingShots) {
              if (key.startsWith(`${data.playerId}_${weapon}_`)) {
                pendingKey = key;
                pendingShot = shot;
                break;
              }
            }
            if (pendingShot) break;
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
      } else if (data.position) {
        // Fallback: just show impact effect at the position provided
        this.showImpactEffect(data.position, data.direction);
      }
    });

    this.scene.events.on('backend:wall:damaged', (data: any) => {
      
      if (data.position) {
        this.showWallDamageEffect(data.position, data.material || 'concrete');
        this.showHitMarker(data.position);
        
        // Show trail to actual wall hit position
        if (data.playerId) {
          
          let pendingShot: any = null;
          let pendingKey = '';
          
          // Special handling for shotgun - find any available pellet
          if (data.weaponType === 'shotgun') {
            // Look for any available shotgun pellet
            for (let pelletIndex = 0; pelletIndex < 8; pelletIndex++) {
              const pelletKey = `${data.playerId}_shotgun_pellet_${pelletIndex}`;
              if (this.pendingShots.has(pelletKey)) {
                pendingKey = pelletKey;
                pendingShot = this.pendingShots.get(pelletKey);
                break;
              }
            }
          } else {
            // Regular weapons - find by searching through all pending shots
            // Look for shots from this player with this weapon type
            for (const [key, shot] of this.pendingShots) {
              if (key.startsWith(`${data.playerId}_${data.weaponType}_`)) {
                pendingKey = key;
                pendingShot = shot;
                break; // Use the first matching shot (oldest)
              }
            }
            
            // Fallback: try without weapon type if backend didn't send it
            if (!pendingShot && !data.weaponType) {
              // Try all weapon types
              const weaponTypes = ['rifle', 'pistol', 'rocket', 'grenade', 'smg', 'shotgun', 
                                  'battlerifle', 'sniperrifle', 'revolver', 'suppressedpistol',
                                  'grenadelauncher', 'machinegun', 'antimaterialrifle'];
              for (const weapon of weaponTypes) {
                for (const [key, shot] of this.pendingShots) {
                  if (key.startsWith(`${data.playerId}_${weapon}_`)) {
                    pendingKey = key;
                    pendingShot = shot;
                    break;
                  }
                }
                if (pendingShot) break;
              }
            }
          }
          
          if (pendingShot) {
            this.showBulletTrail(pendingShot.startPosition, data.position, pendingShot.weaponType || data.weaponType || 'rifle');
            this.pendingShots.delete(pendingKey);
          } else {
            // No pending shot found for wall hit by player
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
        
        // Handle shotgun specially - store multiple pending shots for pellets
        if (data.weaponType === 'shotgun') {
          // Store 8 pending shots for shotgun pellets (shotgun always fires 8 pellets)
          for (let pelletIndex = 0; pelletIndex < 8; pelletIndex++) {
            const pendingKey = `${socket.id}_${data.weaponType}_pellet_${pelletIndex}`;
            this.pendingShots.set(pendingKey, {
              sequence: data.sequence,
              weaponType: data.weaponType,
              startPosition: { ...data.position },
              timestamp: data.timestamp,
              pelletIndex: pelletIndex
            });
          }
          
          // Clean up old pending shots after 2 seconds (longer for shotgun)
          this.scene.time.delayedCall(2000, () => {
            for (let pelletIndex = 0; pelletIndex < 8; pelletIndex++) {
              const pendingKey = `${socket.id}_${data.weaponType}_pellet_${pelletIndex}`;
              if (this.pendingShots.has(pendingKey)) {
                this.pendingShots.delete(pendingKey);
              }
            }
          });
          
        } else {
          // Regular weapons - use sequence number to handle multiple shots
          const pendingKey = `${socket.id}_${data.weaponType}_${data.sequence || Date.now()}`;
          this.pendingShots.set(pendingKey, {
            sequence: data.sequence,
            weaponType: data.weaponType,
            startPosition: { ...data.position },
            timestamp: data.timestamp
          });
          
          // Debug log for tracking (only log 10% to avoid spam)
          if (Math.random() < 0.1) {
            console.log(`📝 Stored local pending shot: ${pendingKey}`);
          }

          // Clean up old pending shots after 1 second
          this.scene.time.delayedCall(1000, () => {
            if (this.pendingShots.has(pendingKey)) {
              this.pendingShots.delete(pendingKey);
            }
          });
        }
      }
      
      // Handle different weapon types differently
      const projectileWeapons = ['grenade', 'rocket', 'rocketlauncher', 'grenadelauncher', 
                                 'smokegrenade', 'flashbang'];
      if (projectileWeapons.includes(data.weaponType)) {
        // For projectiles, don't show immediate trail - wait for backend projectile creation
        // Just show the launch effect
  
        
      } else {
        // For hitscan weapons, NO immediate trail - wait for backend response
        // This provides accurate trails that include weapon inaccuracy and backend hit detection
        const hitscanWeapons = ['rifle', 'pistol', 'smg', 'shotgun', 'battlerifle', 
                                'sniperrifle', 'revolver', 'suppressedpistol', 
                                'machinegun', 'antimaterialrifle'];
        if (hitscanWeapons.includes(data.weaponType)) {
        } else if (data.weaponType) {
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
    
    // Emit explosion event for screen shake system
    this.scene.events.emit('explosion:effect', {
      position: position,
      radius: radius,
      weaponType: radius > 45 ? 'rocket' : 'grenade' // Determine weapon type by radius
    });
    
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
          return edgePoint;
        }
      }
      
      // Check if we're outside game bounds
      if (currentX < 0 || currentX > 480 || currentY < 0 || currentY > 320) {
        return { x: currentX, y: currentY };
      }
    }
    
    // No collision found, bullet travels to maximum range or target
    const finalPoint = distance > 500 ? {
      x: startPos.x + dirX * 500,
      y: startPos.y + dirY * 500
    } : targetPos;
    
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

  showSmokeEffect(position: { x: number; y: number }, radius: number): void {
    // Create smoke cloud that expands and persists
    const smokeCloud = this.scene.add.graphics();
    smokeCloud.setDepth(45); // Above most effects but below UI
    
    // Initial small smoke
    smokeCloud.fillStyle(0xCCCCCC, 0.8);
    smokeCloud.fillCircle(position.x, position.y, 5);
    
    // Expand the smoke cloud over time
    this.scene.tweens.add({
      targets: smokeCloud,
      scaleX: radius / 5,
      scaleY: radius / 5,
      alpha: 0.6,
      duration: 1000,
      ease: 'Power2',
      onComplete: () => {
        // Keep smoke persisting for several seconds
        this.scene.time.delayedCall(8000, () => {
          // Fade out slowly
          this.scene.tweens.add({
            targets: smokeCloud,
            alpha: 0,
            duration: 2000,
            onComplete: () => {
              smokeCloud.destroy();
            }
          });
        });
      }
    });
    
    // Add swirling smoke particles for effect
    for (let i = 0; i < 8; i++) {
      const particle = this.scene.add.graphics();
      particle.setDepth(44);
      particle.fillStyle(0xDDDDDD, 0.5);
      particle.fillCircle(0, 0, 3);
      
      // Random position within initial area
      const angle = (Math.PI * 2 * i) / 8;
      const distance = 10 + Math.random() * 10;
      particle.x = position.x + Math.cos(angle) * distance;
      particle.y = position.y + Math.sin(angle) * distance;
      
      // Drift outward
      const driftAngle = angle + (Math.random() - 0.5) * 0.5;
      const driftDistance = radius * 0.8;
      
      this.scene.tweens.add({
        targets: particle,
        x: position.x + Math.cos(driftAngle) * driftDistance,
        y: position.y + Math.sin(driftAngle) * driftDistance,
        alpha: 0,
        scale: 3,
        duration: 3000,
        ease: 'Power2',
        onComplete: () => {
          particle.destroy();
        }
      });
    }
  }

  showFlashbangEffect(position: { x: number; y: number }, radius: number): void {
    const gameScene = this.scene as any;
    const localPlayerId = gameScene.networkSystem?.getSocket()?.id;
    const playerPos = gameScene.playerPosition;
    
    if (!playerPos || !localPlayerId) return;
    
    // Calculate distance from player to flashbang
    const distance = Math.sqrt(
      Math.pow(position.x - playerPos.x, 2) + 
      Math.pow(position.y - playerPos.y, 2)
    );
    
    // Only flash if within radius
    if (distance <= radius) {
      // Create white flash overlay
      const flash = this.scene.add.rectangle(
        this.scene.cameras.main.centerX,
        this.scene.cameras.main.centerY,
        GAME_CONFIG.GAME_WIDTH,
        GAME_CONFIG.GAME_HEIGHT,
        0xFFFFFF
      );
      flash.setScrollFactor(0); // UI layer
      flash.setDepth(100); // Above everything
      
      // Intensity based on distance (closer = stronger)
      const intensity = 1 - (distance / radius);
      flash.setAlpha(Math.min(0.95, intensity));
      
      // Quick flash then fade
      this.scene.tweens.add({
        targets: flash,
        alpha: 0,
        duration: 2500 * intensity, // Longer fade for closer flashes
        ease: 'Power2',
        onComplete: () => {
          flash.destroy();
        }
      });
      
      // Add slight disorientation (screen shake)
      if (intensity > 0.5) {
        this.scene.cameras.main.shake(1000 * intensity, 0.01 * intensity);
      }
      
      // Show flash particles at detonation point
      for (let i = 0; i < 6; i++) {
        const particle = this.scene.add.graphics();
        particle.setDepth(60);
        particle.fillStyle(0xFFFF00, 0.8);
        particle.fillCircle(0, 0, 2);
        
        const angle = (Math.PI * 2 * i) / 6;
        particle.x = position.x;
        particle.y = position.y;
        
        this.scene.tweens.add({
          targets: particle,
          x: position.x + Math.cos(angle) * 30,
          y: position.y + Math.sin(angle) * 30,
          alpha: 0,
          scale: 2,
          duration: 300,
          ease: 'Power2',
          onComplete: () => {
            particle.destroy();
          }
        });
      }
    }
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
      // Primary weapons
      case 'rifle':
        color = 0xFFD700; // Gold
        width = 1;
        duration = 250;
        alpha = 1.0;
        break;
      case 'smg':
        color = 0xFFEE88; // Light yellow
        width = 0.7;
        duration = 180;
        alpha = 0.9;
        break;
      case 'shotgun':
        // Shotgun has multiple pellets, each trail should be thin
        color = 0xFFAA00; // Orange
        width = 0.4;
        duration = 150;
        alpha = 0.8;
        break;
      case 'battlerifle':
        color = 0xFFCC00; // Deep gold
        width = 1.2;
        duration = 280;
        alpha = 1.0;
        break;
      case 'sniperrifle':
        color = 0xFFFFFF; // Pure white
        width = 1.5;
        duration = 350;
        alpha = 1.0;
        break;
        
      // Secondary weapons  
      case 'pistol':
        color = 0xFFFFFF; // White
        width = 0.5;
        duration = 200;
        alpha = 1.0;
        break;
      case 'revolver':
        color = 0xFFBB00; // Orange-yellow
        width = 0.8;
        duration = 220;
        alpha = 1.0;
        break;
      case 'suppressedpistol':
        color = 0xCCCCCC; // Light gray (subsonic)
        width = 0.3;
        duration = 100;
        alpha = 0.5;
        break;
        
      // Support weapons
      case 'machinegun':
        color = 0xFFDD00; // Yellow
        width = 1.1;
        duration = 240;
        alpha = 1.0;
        break;
      case 'antimaterialrifle':
        color = 0xFFFFFF; // Pure white
        width = 2.0; // Thick trail
        duration = 400;
        alpha = 1.0;
        break;
      case 'grenade':
      case 'grenadelauncher':
        color = 0x808080; // Gray (matching projectile trail)
        width = 1; // Thin line
        duration = 400;
        alpha = 0.3; // Low opacity like projectile trail
        break;
      case 'rocket':
      case 'rocketlauncher':
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
    
    // Create visual sprite based on projectile type
    let textureKey: string | null = null;
    let logEmoji = '💣';
    
    switch (projectile.type) {
      case 'grenade':
        textureKey = 'fraggrenade';
        logEmoji = '💣';
        break;
      case 'smokegrenade':
        textureKey = 'weapon_smokegrenade';
        logEmoji = '🌫️';
        break;
      case 'flashbang':
        textureKey = 'weapon_flashbang';
        logEmoji = '💥';
        break;
      case 'grenadelauncher':
        textureKey = 'fraggrenade'; // Uses same sprite as grenade
        logEmoji = '💣';
        break;
    }
    
    if (textureKey) {
      // Create the projectile sprite
      const projSprite = this.scene.add.sprite(data.position.x, data.position.y, textureKey);
      projSprite.setDepth(45); // Above trails but below UI
      projSprite.setScale(0.8); // Scale down slightly for game size
      projSprite.setOrigin(0.5, 0.5); // Center origin for rotation
      
      projectile.sprite = projSprite;
      projectile.rotation = 0;
      
      // Calculate spin speed based on velocity magnitude
      const speed = Math.sqrt(projectile.velocity.x * projectile.velocity.x + 
                            projectile.velocity.y * projectile.velocity.y);
      // Spin faster when thrown harder, but cap it
      projectile.spinSpeed = Math.min(speed * 0.02, 10); // Radians per update
      
    }
    
    this.projectiles.set(projectile.id, projectile);
  }

  private updateProjectilePosition(id: string, position: { x: number; y: number }): void {
    const projectile = this.projectiles.get(id);
    if (projectile) {
      const oldPos = { ...projectile.position };
      projectile.position = { ...position };
      
      // Update sprite position and rotation for thrown projectiles
      if (projectile.sprite) {
        projectile.sprite.setPosition(position.x, position.y);
        
        // Update rotation with slowing spin over time (for grenades and flashbangs)
        if (projectile.rotation !== undefined && projectile.spinSpeed !== undefined &&
            (projectile.type === 'grenade' || projectile.type === 'grenadelauncher' || 
             projectile.type === 'flashbang' || projectile.type === 'smokegrenade')) {
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
    switch (projectile.type) {
      case 'rocket':
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
        break;
        
      case 'grenade':
      case 'grenadelauncher':
        // Grenade trail - thin gray line
        projectile.trail.lineStyle(1, 0x808080, 0.3);
        projectile.trail.beginPath();
        projectile.trail.moveTo(fromPos.x, fromPos.y);
        projectile.trail.lineTo(toPos.x, toPos.y);
        projectile.trail.strokePath();
        break;
        
      case 'smokegrenade':
        // Smoke grenade - faint white trail
        projectile.trail.lineStyle(0.8, 0xFFFFFF, 0.2);
        projectile.trail.beginPath();
        projectile.trail.moveTo(fromPos.x, fromPos.y);
        projectile.trail.lineTo(toPos.x, toPos.y);
        projectile.trail.strokePath();
        break;
        
      case 'flashbang':
        // Flashbang - faint yellow trail
        projectile.trail.lineStyle(0.8, 0xFFFF00, 0.2);
        projectile.trail.beginPath();
        projectile.trail.moveTo(fromPos.x, fromPos.y);
        projectile.trail.lineTo(toPos.x, toPos.y);
        projectile.trail.strokePath();
        break;
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
      // Destroy projectile sprite if it exists
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
      
      // Show appropriate effect based on projectile type
      switch (projectile.type) {
        case 'rocket':
          this.showExplosionEffect(position, radius || 50);
          break;
          
        case 'grenade':
        case 'grenadelauncher':
          this.showExplosionEffect(position, radius || 40);
          break;
          
        case 'smokegrenade':
          this.showSmokeEffect(position, radius || 60);
          break;
          
        case 'flashbang':
          this.showFlashbangEffect(position, radius || 100);
          break;
      }
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
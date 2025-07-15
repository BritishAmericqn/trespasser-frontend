import { IGameSystem } from '../../../shared/interfaces/IGameSystem';
import { PhaserMuzzleFlash } from '../effects/PhaserMuzzleFlash';

interface BulletTrail {
  line: Phaser.GameObjects.Graphics;
  startTime: number;
  duration: number;
  startAlpha: number;
}

interface Projectile {
  id: string;
  type: 'rocket' | 'grenade';
  position: { x: number; y: number };
  velocity: { x: number; y: number };
  trail: Phaser.GameObjects.Graphics;
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
  private muzzleFlashes: PhaserMuzzleFlash[] = [];
  private hitMarkers: Phaser.GameObjects.Graphics[] = [];
  private particles: Phaser.GameObjects.Graphics[] = [];
  private bulletTrails: BulletTrail[] = [];
  private projectiles: Map<string, Projectile> = new Map();
  private pendingShots: Map<string, PendingShot> = new Map(); // Track shots waiting for backend response

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  initialize(): void {
    this.setupBackendEventListeners();
    this.setupLocalEventListeners();

  }

  update(deltaTime: number): void {
    // Update muzzle flashes
    for (let i = this.muzzleFlashes.length - 1; i >= 0; i--) {
      const flash = this.muzzleFlashes[i];
      if (!flash.update()) {
        flash.destroy();
        this.muzzleFlashes.splice(i, 1);
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
    this.muzzleFlashes.forEach(flash => flash.destroy());
    this.muzzleFlashes = [];
    
    this.hitMarkers.forEach(marker => marker.destroy());
    this.hitMarkers = [];
    
    this.particles.forEach(particle => particle.destroy());
    this.particles = [];
    
    this.bulletTrails.forEach(trail => trail.line.destroy());
    this.bulletTrails = [];
    
    this.projectiles.forEach(projectile => projectile.trail.destroy());
    this.projectiles.clear();

    this.pendingShots.clear();
    
    this.removeBackendEventListeners();
    this.removeLocalEventListeners();
  }

  private setupBackendEventListeners(): void {
    // Listen for weapon events from backend
    this.scene.events.on('backend:weapon:fired', (data: any) => {
      // For now, just show muzzle flash since backend doesn't send hit data properly
      if (data.position) {
        this.showMuzzleFlash(data.position, data.direction);
      }
    });

    this.scene.events.on('backend:weapon:hit', (data: any) => {
      console.log(`🎯 HIT: Player at (${data.position?.x},${data.position?.y})`);
      this.showHitMarker(data.position);
      
      // Update trail to actual hit position if we have the data
      if (data.startPosition && data.position) {
        this.showBulletTrail(data.startPosition, data.position, data.weaponType);
      }
    });

    this.scene.events.on('backend:weapon:miss', (data: any) => {
      console.log(`🔥 BACKEND EVENT RECEIVED: weapon:miss`, data);
      
      // Find the pending shot for this player
      let pendingShot: PendingShot | undefined;
      let pendingKey: string | undefined;
      
      // Try to find a matching pending shot
      for (const [key, shot] of this.pendingShots.entries()) {
        if (key.startsWith(data.playerId)) {
          pendingShot = shot;
          pendingKey = key;
          break;
        }
      }
      
      if (pendingShot && pendingKey) {
        // Calculate hit point based on direction from backend
        const maxRange = 500;
        const hitX = pendingShot.startPosition.x + Math.cos(data.direction) * maxRange;
        const hitY = pendingShot.startPosition.y + Math.sin(data.direction) * maxRange;
        const hitPosition = { x: hitX, y: hitY };
        
        // Show the trail from start to calculated end
        this.showBulletTrail(pendingShot.startPosition, hitPosition, pendingShot.weaponType);
        this.pendingShots.delete(pendingKey);
        
        // Show impact effect at the calculated position
        this.showImpactEffect(hitPosition, data.direction);
      } else if (data.position) {
        // Fallback: just show impact effect at the position provided
        this.showImpactEffect(data.position, data.direction);
      }
    });

    this.scene.events.on('backend:wall:damaged', (data: any) => {
      if (data.wallId && data.position) {
        console.log(`🧱 WALL DAMAGED: ${data.wallId} at (${data.position.x},${data.position.y})`);
      }
      this.showWallDamageEffect(data.position, data.material || 'concrete');
      this.showHitMarker(data.position);
      
      // Show trail to actual wall hit position
      if (data.playerId) {
        const pendingKey = `${data.playerId}_${data.weaponType || 'rifle'}`;
        const pendingShot = this.pendingShots.get(pendingKey);
        
        if (pendingShot && data.position) {
          this.showBulletTrail(pendingShot.startPosition, data.position, pendingShot.weaponType);
          this.pendingShots.delete(pendingKey);
        }
      }
    });

    // Handle projectile creation and updates
    this.scene.events.on('backend:projectile:created', (data: any) => {
      console.log(`🚀 PROJECTILE CREATED: ${data.type} at (${data.position.x},${data.position.y})`);
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
      this.showMuzzleFlash(data.position, data.direction);
      
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

        // Clean up old pending shots after 1 second
        this.scene.time.delayedCall(1000, () => {
          this.pendingShots.delete(pendingKey);
        });
      }
      
      // Handle different weapon types differently
      if (data.weaponType === 'grenade' || data.weaponType === 'rocket') {
        // For projectiles, don't show immediate trail - wait for backend projectile creation
        // Just show the launch effect
        console.log(`🚀 ${data.weaponType} LAUNCHED from (${data.position.x},${data.position.y})`);
        
      } else {
        // For hitscan weapons, show a temporary trail for immediate feedback
        // This will be replaced/updated when backend responds
        const tempHitPoint = this.calculateBulletHitPoint(data.position, data.targetPosition);
        
        // Create a temporary faded trail
        const tempTrail = this.scene.add.graphics();
        tempTrail.setDepth(39); // Slightly behind real trails
        tempTrail.lineStyle(1, 0xFFFFFF, 0.3); // Faded white line
        tempTrail.beginPath();
        tempTrail.moveTo(data.position.x, data.position.y);
        tempTrail.lineTo(tempHitPoint.x, tempHitPoint.y);
        tempTrail.strokePath();
        
        // Fade out the temporary trail
        this.scene.tweens.add({
          targets: tempTrail,
          alpha: 0,
          duration: 500,
          onComplete: () => {
            tempTrail.destroy();
          }
        });
        
        console.log(`🔫 ${data.weaponType} FIRED - showing temporary trail, waiting for backend confirmation`);
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
  
  showMuzzleFlash(position: { x: number; y: number }, direction: number): void {
    const flash = new PhaserMuzzleFlash(this.scene, position, direction);
    this.muzzleFlashes.push(flash);
    console.log(`🔥 Muzzle flash created at (${position.x}, ${position.y})`);
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
    console.log(`🎯 Hit marker created at (${position.x}, ${position.y})`);
  }

  showImpactEffect(position: { x: number; y: number }, direction: number): void {
    // Create impact sparks
    for (let i = 0; i < 5; i++) {
      const spark = this.scene.add.graphics();
      spark.setDepth(55);
      spark.fillStyle(0xFFD700); // Gold color
      spark.fillRect(position.x - 0.5, position.y - 0.5, 1, 1);
      
      // Add slight random offset
      spark.x += (Math.random() - 0.5) * 10;
      spark.y += (Math.random() - 0.5) * 10;
      
      this.particles.push(spark);
    }
    
    console.log(`💥 Impact effect created at (${position.x}, ${position.y})`);
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
    
    console.log(`🧱 Wall damage effect created at (${position.x}, ${position.y}) - ${material}`);
  }

  showExplosionEffect(position: { x: number; y: number }, radius: number): void {
    // Create explosion particles
    const particleCount = Math.min(20, Math.floor(radius / 2));
    
    for (let i = 0; i < particleCount; i++) {
      const particle = this.scene.add.graphics();
      particle.setDepth(55);
      
      // Alternate between orange and red
      const color = i % 2 === 0 ? 0xFF8000 : 0xFF0000;
      particle.fillStyle(color);
      particle.fillRect(0, 0, 2, 2);
      
      // Position in circle around explosion center
      const angle = (Math.PI * 2 * i) / particleCount;
      const distance = Math.random() * radius;
      particle.x = position.x + Math.cos(angle) * distance;
      particle.y = position.y + Math.sin(angle) * distance;
      
      this.particles.push(particle);
    }
    
    // Create explosion flash (temporary bright circle)
    const flash = this.scene.add.graphics();
    flash.setDepth(60);
    flash.fillStyle(0xFFFFFF, 0.8);
    flash.fillCircle(position.x, position.y, radius * 0.3);
    
    // Fade out the flash quickly
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 100,
      onComplete: () => {
        flash.destroy();
      }
    });
    
    console.log(`💥 Explosion effect created at (${position.x}, ${position.y}) - radius: ${radius}`);
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
    // Simple ray-casting collision detection with walls
    // This is client-side prediction; backend will provide authoritative results
    
    // Get wall data from DestructionRenderer (via scene)
    const scene = this.scene as any;
    const wallsData = scene.destructionRenderer?.getWallsData() || [];
    
    // Calculate ray direction
    const dx = targetPos.x - startPos.x;
    const dy = targetPos.y - startPos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance === 0) return startPos;
    
    const dirX = dx / distance;
    const dirY = dy / distance;
    
    // Cast ray and check for wall intersections
    const stepSize = 2; // Check every 2 pixels
    let currentX = startPos.x;
    let currentY = startPos.y;
    
    for (let step = 0; step < distance; step += stepSize) {
      currentX += dirX * stepSize;
      currentY += dirY * stepSize;
      
      // Check collision with walls
      for (const wall of wallsData) {
        if (this.isPointInWall(currentX, currentY, wall)) {
          // Hit a wall, log debug info
          console.log(`🎯 CLIENT HIT DETECTION: Wall ${wall.id} hit at (${currentX.toFixed(1)}, ${currentY.toFixed(1)})`);
          console.log(`   Wall bounds: x:${wall.position.x}-${wall.position.x + wall.width}, y:${wall.position.y}-${wall.position.y + wall.height}`);
          return { x: currentX, y: currentY };
        }
      }
    }
    
    // No collision, return target position
    return targetPos;
  }

  private isPointInWall(x: number, y: number, wall: any): boolean {
    // Check if point is inside wall bounds
    if (x < wall.position.x || x > wall.position.x + wall.width ||
        y < wall.position.y || y > wall.position.y + wall.height) {
      return false;
    }
    
    // Check if the wall slice at this position is not destroyed
    const sliceIndex = Math.floor((x - wall.position.x) / (wall.width / 5));
    if (sliceIndex >= 0 && sliceIndex < 5) {
      return wall.destructionMask[sliceIndex] === 0; // 0 means not destroyed
    }
    
    return false;
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
    
    switch (weaponType) {
      case 'rifle':
        color = 0xFFD700; // Gold
        width = 1;
        duration = 250;
        break;
      case 'pistol':
        color = 0xFFFFFF; // White
        width = 0.5;
        duration = 200;
        break;
      case 'grenade':
        color = 0xFF4500; // Orange red
        width = 2;
        duration = 400;
        break;
      case 'rocket':
        color = 0xFF0000; // Red
        width = 3;
        duration = 500;
        break;
    }
    
    trail.lineStyle(width, color, 1);
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
    
    console.log(`🚀 Bullet trail created from (${startPos.x}, ${startPos.y}) to (${endPos.x}, ${endPos.y}) - ${weaponType}`);
  }

  // Debug methods
  
  getEffectCounts(): { muzzleFlashes: number; hitMarkers: number; particles: number; bulletTrails: number } {
    return {
      muzzleFlashes: this.muzzleFlashes.length,
      hitMarkers: this.hitMarkers.length,
      particles: this.particles.length,
      bulletTrails: this.bulletTrails.length
    };
  }

  clearAllEffects(): void {
    // Clear muzzle flashes
    this.muzzleFlashes.forEach(flash => flash.destroy());
    this.muzzleFlashes = [];
    
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
    this.projectiles.forEach(projectile => projectile.trail.destroy());
    this.projectiles.clear();

    this.pendingShots.clear();
    
    console.log('All visual effects cleared');
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
    this.projectiles.set(projectile.id, projectile);
    
    console.log(`🚀 Projectile ${projectile.type} (${projectile.id}) created at (${projectile.position.x.toFixed(1)}, ${projectile.position.y.toFixed(1)})`);
  }

  private updateProjectilePosition(id: string, position: { x: number; y: number }): void {
    const projectile = this.projectiles.get(id);
    if (projectile) {
      const oldPos = { ...projectile.position };
      projectile.position = { ...position };
      
      // Draw trail segment from old position to new position
      this.drawProjectileTrailSegment(projectile, oldPos, position);
    }
  }

  private drawProjectileTrailSegment(projectile: Projectile, fromPos: { x: number; y: number }, toPos: { x: number; y: number }): void {
    // Different trail styles for different projectile types
    let color = 0xFFFFFF;
    let width = 2;
    
    switch (projectile.type) {
      case 'rocket':
        color = 0xFF0000; // Red trail with smoke
        width = 3;
        break;
      case 'grenade':
        color = 0xFF4500; // Orange trail
        width = 2;
        break;
    }
    
    // Draw the trail segment
    projectile.trail.lineStyle(width, color, 0.8);
    projectile.trail.beginPath();
    projectile.trail.moveTo(fromPos.x, fromPos.y);
    projectile.trail.lineTo(toPos.x, toPos.y);
    projectile.trail.strokePath();
    
    // Add smoke particles for rockets (throttled)
    if (projectile.type === 'rocket') {
      const now = Date.now();
      if (!projectile.lastSmokeTime || now - projectile.lastSmokeTime > 50) { // Every 50ms
        this.addRocketSmokeParticle(toPos);
        projectile.lastSmokeTime = now;
      }
    }
  }

  private addRocketSmokeParticle(position: { x: number; y: number }): void {
    const smoke = this.scene.add.graphics();
    smoke.setDepth(35); // Behind the trail
    smoke.fillStyle(0x808080, 0.4); // Gray smoke, more transparent
    smoke.fillCircle(0, 0, 1.5); // Smaller smoke particle
    
    // Set initial position with small random offset
    smoke.x = position.x + (Math.random() - 0.5) * 2;
    smoke.y = position.y + (Math.random() - 0.5) * 2;
    
    // Add some random drift motion
    const driftX = (Math.random() - 0.5) * 20;
    const driftY = Math.random() * 10 + 5; // Mostly downward drift
    
    // Fade out, expand, and drift the smoke
    this.scene.tweens.add({
      targets: smoke,
      alpha: 0,
      scaleX: 3,
      scaleY: 3,
      x: smoke.x + driftX,
      y: smoke.y + driftY,
      duration: 1000,
      ease: 'Power2',
      onComplete: () => {
        smoke.destroy();
      }
    });
  }

  private handleProjectileExplosion(id: string, position: { x: number; y: number }, radius: number): void {
    const projectile = this.projectiles.get(id);
    if (projectile) {
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
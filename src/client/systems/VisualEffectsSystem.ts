import { IGameSystem } from '../../../shared/interfaces/IGameSystem';
import { PhaserMuzzleFlash } from '../effects/PhaserMuzzleFlash';

interface BulletTrail {
  line: Phaser.GameObjects.Graphics;
  startTime: number;
  duration: number;
  startAlpha: number;
}

export class VisualEffectsSystem implements IGameSystem {
  private scene: Phaser.Scene;
  private muzzleFlashes: PhaserMuzzleFlash[] = [];
  private hitMarkers: Phaser.GameObjects.Graphics[] = [];
  private particles: Phaser.GameObjects.Graphics[] = [];
  private bulletTrails: BulletTrail[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  initialize(): void {
    this.setupBackendEventListeners();
    this.setupLocalEventListeners();
    console.log('VisualEffectsSystem initialized with Phaser rendering');
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
    
    this.removeBackendEventListeners();
    this.removeLocalEventListeners();
  }

  private setupBackendEventListeners(): void {
    // Listen for weapon events from backend
    this.scene.events.on('backend:weapon:fired', (data: any) => {
      console.log('🔥 FRONTEND: Processing weapon:fired event', data);
      console.log('📍 BACKEND POSITION DATA:', {
        backendPlayerPos: data.position,
        backendStartPos: data.startPosition,
        backendHitPos: data.hitPosition,
        weaponType: data.weaponType
      });
      this.showMuzzleFlash(data.position, data.direction);
      
      // Show bullet trail to where it actually hit (from backend)
      if (data.startPosition && data.hitPosition) {
        this.showBulletTrail(data.startPosition, data.hitPosition, data.weaponType);
      }
    });

    this.scene.events.on('backend:weapon:hit', (data: any) => {
      console.log('🎯 FRONTEND: Processing weapon:hit event', data);
      this.showHitMarker(data.position);
      
      // Show bullet trail to hit point
      if (data.startPosition && data.hitPosition) {
        this.showBulletTrail(data.startPosition, data.hitPosition, data.weaponType);
      }
    });

    this.scene.events.on('backend:weapon:miss', (data: any) => {
      console.log('💥 FRONTEND: Processing weapon:miss event', data);
      this.showImpactEffect(data.position, data.direction);
      
      // Show bullet trail to miss point
      if (data.startPosition && data.hitPosition) {
        this.showBulletTrail(data.startPosition, data.hitPosition, data.weaponType);
      }
    });

    this.scene.events.on('backend:wall:damaged', (data: any) => {
      console.log('🧱 FRONTEND: Processing wall:damaged event', data);
      this.showWallDamageEffect(data.position, data.material || 'concrete');
      // Also show hit marker for wall hits
      this.showHitMarker(data.position);
      
      // Show bullet trail to wall hit point
      if (data.startPosition && data.hitPosition) {
        this.showBulletTrail(data.startPosition, data.hitPosition, data.weaponType);
      }
    });

    this.scene.events.on('backend:explosion:created', (data: any) => {
      console.log('💥 FRONTEND: Processing explosion:created event', data);
      
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
      
      // Handle different weapon types differently
      if (data.weaponType === 'grenade' || data.weaponType === 'rocket') {
        // Explosives: Show trail and explosion on impact
        const hitPoint = this.calculateBulletHitPoint(data.position, data.targetPosition);
        this.showBulletTrail(data.position, hitPoint, data.weaponType);
        
        // Show immediate explosion effect (client-side prediction)
        const explosionRadius = data.weaponType === 'rocket' ? 50 : 40;
        this.showExplosionEffect(hitPoint, explosionRadius);
        
        // Show wall damage if it hit a wall
        const hitWall = this.isTargetDifferentFromMouse(hitPoint, data.targetPosition);
        if (hitWall) {
          this.showWallDamageEffect(hitPoint, 'concrete');
          console.log(`💥 ${data.weaponType} hit wall and exploded at client-side collision detection`);
        } else {
          console.log(`💥 ${data.weaponType} exploded at target position`);
        }
        
      } else {
        // Hitscan weapons: Show trail and impact effects
        const hitPoint = this.calculateBulletHitPoint(data.position, data.targetPosition);
        this.showBulletTrail(data.position, hitPoint, data.weaponType);
        
        // If bullet hit a wall, show wall damage effect
        const hitWall = this.isTargetDifferentFromMouse(hitPoint, data.targetPosition);
        if (hitWall) {
          this.showWallDamageEffect(hitPoint, 'concrete');
          console.log('🧱 Bullet hit wall at client-side collision detection');
          console.log('🧱 Hit details:', {
            firePosition: data.position,
            targetPosition: data.targetPosition,
            actualHitPoint: hitPoint,
            distance: Math.hypot(hitPoint.x - data.position.x, hitPoint.y - data.position.y)
          });
        }
      }
      
      console.log('🔥 Local weapon effects triggered');
    });
  }

  private removeBackendEventListeners(): void {
    this.scene.events.off('backend:weapon:fired');
    this.scene.events.off('backend:weapon:hit');
    this.scene.events.off('backend:weapon:miss');
    this.scene.events.off('backend:wall:damaged');
    this.scene.events.off('backend:explosion:created');
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
          // Hit a wall, return the hit point
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
    
    console.log('All visual effects cleared');
  }
} 
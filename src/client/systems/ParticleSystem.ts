import { IGameSystem } from '../../../shared/interfaces/IGameSystem';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  gravity: number;
}

export class ParticleSystem implements IGameSystem {
  private scene: Phaser.Scene;
  private particles: Particle[] = [];
  private maxParticles: number = 500;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  initialize(): void {

  }

  update(deltaTime: number): void {
    const dt = deltaTime / 1000; // Convert to seconds
    
    // Update existing particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i];
      
      // Update position
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      
      // Apply gravity
      particle.vy += particle.gravity * dt;
      
      // Update life
      particle.life -= dt;
      
      // Remove dead particles
      if (particle.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  destroy(): void {
    this.particles = [];
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    
    for (const particle of this.particles) {
      const alpha = particle.life / particle.maxLife;
      
      ctx.globalAlpha = alpha;
      ctx.fillStyle = particle.color;
      
      // Draw particle as small square
      ctx.fillRect(
        particle.x - particle.size / 2,
        particle.y - particle.size / 2,
        particle.size,
        particle.size
      );
    }
    
    ctx.restore();
  }

  // Spawn debris particles for wall destruction
  spawnDebris(position: { x: number; y: number }, material: string = 'concrete'): void {
    const count = 8;
    const colors = this.getDebrisColors(material);
    
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) break;
      
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const speed = 20 + Math.random() * 30;
      
      const particle: Particle = {
        x: position.x + (Math.random() - 0.5) * 10,
        y: position.y + (Math.random() - 0.5) * 10,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.5 + Math.random() * 0.5,
        maxLife: 1.0,
        size: 1,
        color: colors[Math.floor(Math.random() * colors.length)],
        gravity: 100
      };
      
      this.particles.push(particle);
    }
  }

  // Spawn impact particles for bullet hits
  spawnImpact(position: { x: number; y: number }, direction: number): void {
    const count = 5;
    
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) break;
      
      const angle = direction + Math.PI + (Math.random() - 0.5) * 1.0;
      const speed = 10 + Math.random() * 20;
      
      const particle: Particle = {
        x: position.x,
        y: position.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.2 + Math.random() * 0.3,
        maxLife: 0.5,
        size: 1,
        color: '#FFD700', // Gold sparks
        gravity: 50
      };
      
      this.particles.push(particle);
    }
  }

  // Spawn explosion particles
  spawnExplosion(position: { x: number; y: number }, radius: number): void {
    const count = Math.min(20, Math.floor(radius / 2));
    
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) break;
      
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.3;
      const speed = 30 + Math.random() * 50;
      
      const particle: Particle = {
        x: position.x,
        y: position.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.5 + Math.random() * 0.5,
        maxLife: 1.0,
        size: 2,
        color: i % 2 === 0 ? '#FF8000' : '#FF0000', // Orange and red
        gravity: 80
      };
      
      this.particles.push(particle);
    }
  }

  private getDebrisColors(material: string): string[] {
    switch (material) {
      case 'concrete':
        return ['#808080', '#A0A0A0', '#909090'];
      case 'wood':
        return ['#8B4513', '#A0522D', '#CD853F'];
      case 'metal':
        return ['#C0C0C0', '#808080', '#696969'];
      case 'glass':
        return ['#E6E6FA', '#F0F8FF', '#FFFFFF'];
      default:
        return ['#808080', '#A0A0A0', '#909090'];
    }
  }

  getParticleCount(): number {
    return this.particles.length;
  }
} 
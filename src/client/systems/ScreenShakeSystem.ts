import { IGameSystem } from '../../../shared/interfaces/IGameSystem';
import { GAME_CONFIG } from '../../../shared/constants/index';

export class ScreenShakeSystem implements IGameSystem {
  private scene: Phaser.Scene;
  private camera: Phaser.Cameras.Scene2D.Camera;
  private isEnabled: boolean;
  private activeShakes: Set<string> = new Set(); // Track active shake IDs to prevent stacking

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.camera = scene.cameras.main;
    this.isEnabled = GAME_CONFIG.SCREEN_SHAKE.ENABLED;
    this.setupEventListeners();
  }

  initialize(): void {
    // System is ready to receive shake events
  }

  update(_deltaTime: number): void {
    // Camera shake is handled automatically by Phaser
    // This method exists for IGameSystem compliance
  }

  destroy(): void {
    this.removeEventListeners();
    this.activeShakes.clear();
  }

  private setupEventListeners(): void {
    // Listen for weapon fire events
    this.scene.events.on('weapon:fire', (data: any) => {
      this.shakeFromWeaponFire(data.weaponType, data.position);
    });

    // Listen for explosion events
    this.scene.events.on('backend:explosion:created', (data: any) => {
      this.shakeFromExplosion(data.weaponType || 'grenade', data.position, data.radius);
    });

    // Listen for local explosion effects (client prediction)
    this.scene.events.on('explosion:effect', (data: any) => {
      this.shakeFromExplosion(data.weaponType || 'grenade', data.position, data.radius);
    });

    // Listen for player damage events
    this.scene.events.on('backend:player:damaged', (data: any) => {
      // Only shake if it's the local player taking damage
      const gameScene = this.scene as any;
      const localPlayerId = gameScene.networkSystem?.getSocket()?.id;
      if (data.playerId === localPlayerId) {
        this.shakeFromDamage();
      }
    });

    // Listen for wall collision events
    this.scene.events.on('network:collision', (_data: any) => {
      this.shakeFromWallCollision();
    });
  }

  private removeEventListeners(): void {
    this.scene.events.off('weapon:fire');
    this.scene.events.off('backend:explosion:created');
    this.scene.events.off('explosion:effect');
    this.scene.events.off('backend:player:damaged');
    this.scene.events.off('network:collision');
  }

  /**
   * Shake camera from weapon fire
   */
  public shakeFromWeaponFire(weaponType: string, _position?: { x: number; y: number }): void {
    if (!this.isEnabled) return;

    const config = GAME_CONFIG.SCREEN_SHAKE.WEAPONS[weaponType as keyof typeof GAME_CONFIG.SCREEN_SHAKE.WEAPONS];
    if (!config) return;

    const shakeId = `weapon_${weaponType}_${Date.now()}`;
    this.executeShake(shakeId, config.duration, config.intensity);
  }

  /**
   * Shake camera from explosion with distance-based intensity
   */
  public shakeFromExplosion(explosionType: string, explosionPosition: { x: number; y: number }, _radius: number = 50): void {
    if (!this.isEnabled) return;

    const config = GAME_CONFIG.SCREEN_SHAKE.EXPLOSIONS[explosionType as keyof typeof GAME_CONFIG.SCREEN_SHAKE.EXPLOSIONS];
    if (!config) return;

    // Get player position for distance calculation
    const gameScene = this.scene as any;
    const playerPos = gameScene.playerPosition;
    if (!playerPos) {
      // Fallback to full intensity if player position unknown
      this.executeShake(`explosion_${explosionType}_${Date.now()}`, config.baseDuration, config.baseIntensity);
      return;
    }

    // Calculate distance from player to explosion
    const distance = Math.sqrt(
      Math.pow(explosionPosition.x - playerPos.x, 2) + 
      Math.pow(explosionPosition.y - playerPos.y, 2)
    );

    // Calculate intensity based on distance (closer = more intense)
    const maxDistance = config.maxDistance;
    const distanceRatio = Math.max(0, 1 - (distance / maxDistance));
    
    if (distanceRatio <= 0) return; // Too far away for shake

    const adjustedIntensity = config.baseIntensity * distanceRatio;
    const adjustedDuration = config.baseDuration * Math.max(0.3, distanceRatio); // Minimum 30% duration

    const shakeId = `explosion_${explosionType}_${Date.now()}`;
    this.executeShake(shakeId, adjustedDuration, adjustedIntensity);

    console.log(`💥 Screen shake: ${explosionType} at distance ${distance.toFixed(0)}px, intensity ${(adjustedIntensity * 1000).toFixed(1)}`);
  }

  /**
   * Shake camera when player takes damage
   */
  public shakeFromDamage(): void {
    if (!this.isEnabled) return;

    const config = GAME_CONFIG.SCREEN_SHAKE.HIT_TAKEN;
    const shakeId = `damage_${Date.now()}`;
    this.executeShake(shakeId, config.duration, config.intensity);
  }

  /**
   * Shake camera when player collides with wall
   */
  public shakeFromWallCollision(): void {
    if (!this.isEnabled) return;

    const config = GAME_CONFIG.SCREEN_SHAKE.WALL_COLLISION;
    const shakeId = `collision_${Date.now()}`;
    this.executeShake(shakeId, config.duration, config.intensity);
  }

  /**
   * Execute camera shake with given parameters
   */
  private executeShake(shakeId: string, duration: number, intensity: number): void {
    // Prevent duplicate shakes of the same type within a short time
    if (this.activeShakes.has(shakeId)) return;

    this.activeShakes.add(shakeId);

    // Execute the shake using Phaser's built-in camera shake
    this.camera.shake(duration, intensity);

    // Clean up the shake ID after duration + small buffer
    this.scene.time.delayedCall(duration + 50, () => {
      this.activeShakes.delete(shakeId);
    });
  }

  /**
   * Toggle screen shake on/off (for user preference)
   */
  public toggleEnabled(): boolean {
    this.isEnabled = !this.isEnabled;
    console.log(`📳 Screen shake: ${this.isEnabled ? 'ENABLED' : 'DISABLED'}`);
    return this.isEnabled;
  }

  /**
   * Set screen shake enabled state
   */
  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    console.log(`📳 Screen shake: ${this.isEnabled ? 'ENABLED' : 'DISABLED'}`);
  }

  /**
   * Check if screen shake is enabled
   */
  public getEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Manually trigger a custom shake (for testing or special effects)
   */
  public customShake(duration: number, intensity: number, label: string = 'custom'): void {
    if (!this.isEnabled) return;
    
    const shakeId = `${label}_${Date.now()}`;
    this.executeShake(shakeId, duration, intensity);
  }
} 
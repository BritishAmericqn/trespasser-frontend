import { IGameSystem } from '../../../shared/interfaces/IGameSystem';
import { GAME_CONFIG } from '../../../shared/constants/index';

interface WeaponData {
  currentAmmo: number;
  reserveAmmo: number;
  isReloading: boolean;
}

interface PlayerWeapons {
  rifle: WeaponData;
  pistol: WeaponData;
  grenade: WeaponData;
  rocket: WeaponData;
}

export class WeaponUI implements IGameSystem {
  private scene: Phaser.Scene;
  private health: number = 100;
  private maxHealth: number = 100;
  private currentWeapon: string = 'rifle';
  private weapons: PlayerWeapons = {
    rifle: { currentAmmo: 30, reserveAmmo: 90, isReloading: false },
    pistol: { currentAmmo: 12, reserveAmmo: 60, isReloading: false },
    grenade: { currentAmmo: 1, reserveAmmo: 3, isReloading: false },
    rocket: { currentAmmo: 1, reserveAmmo: 4, isReloading: false }
  };
  private grenadeCharge: number = 0;
  private isADS: boolean = false;
  private lastDamageTime: number = 0;
  private damageFlashDuration: number = 300; // ms

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  initialize(): void {
    this.setupEventListeners();

  }

  update(deltaTime: number): void {
    // No regular updates needed for UI
  }

  destroy(): void {
    this.removeEventListeners();
  }

  render(ctx: CanvasRenderingContext2D): void {
    // Render all UI elements
    this.renderAmmoCounter(ctx);
    this.renderWeaponIndicator(ctx);
    this.renderHealthBar(ctx);
    this.renderCrosshair(ctx);
    
    if (this.grenadeCharge > 0) {
      this.renderChargeBar(ctx);
    }
  }

  private setupEventListeners(): void {
    // Listen for weapon switching
    this.scene.events.on('backend:weapon:switched', (data: any) => {
      this.currentWeapon = data.toWeapon;
    });

    // Listen for weapon reloading
    this.scene.events.on('backend:weapon:reloaded', (data: any) => {
      if (data.weaponType in this.weapons) {
        const weapon = this.weapons[data.weaponType as keyof PlayerWeapons];
        weapon.isReloading = false;
        // Backend will update ammo counts via game state
      }
    });

    // Listen for player damage
    this.scene.events.on('backend:player:damaged', (data: any) => {
      this.health = data.newHealth;
      this.lastDamageTime = Date.now();
    });

    // Listen for grenade charge updates (from InputSystem)
    this.scene.events.on('grenade:charge:update', (chargeLevel: number) => {
      this.grenadeCharge = chargeLevel;
    });

    // Listen for ADS toggle
    this.scene.events.on('ads:toggle', (data: any) => {
      this.isADS = data.isADS;
    });

    // Listen for local ammo decrease (for immediate feedback)
    this.scene.events.on('weapon:ammo:decrease', (data: any) => {
      this.decreaseAmmo(data.weaponType, data.amount);
      console.log(`📉 Ammo decreased for ${data.weaponType}: ${this.weapons[data.weaponType as keyof PlayerWeapons]?.currentAmmo || 0}`);
    });

    // Listen for weapon switching (from InputSystem)
    this.scene.events.on('weapon:switch', (data: any) => {
      this.currentWeapon = data.toWeapon;
    });
  }

  private removeEventListeners(): void {
    this.scene.events.off('backend:weapon:switched');
    this.scene.events.off('backend:weapon:reloaded');
    this.scene.events.off('backend:player:damaged');
    this.scene.events.off('grenade:charge:update');
    this.scene.events.off('ads:toggle');
    this.scene.events.off('weapon:ammo:decrease');
    this.scene.events.off('weapon:switch');
  }

  private renderAmmoCounter(ctx: CanvasRenderingContext2D): void {
    const weapon = this.weapons[this.currentWeapon as keyof PlayerWeapons];
    if (!weapon) return;

    const x = GAME_CONFIG.GAME_WIDTH - 60;
    const y = GAME_CONFIG.GAME_HEIGHT - 20;

    ctx.save();
    ctx.font = '8px monospace';
    ctx.fillStyle = weapon.isReloading ? '#FFFF00' : '#FFFFFF';
    ctx.textAlign = 'right';
    
    if (weapon.isReloading) {
      ctx.fillText('RELOADING...', x, y);
    } else {
      ctx.fillText(`${weapon.currentAmmo}/${weapon.reserveAmmo}`, x, y);
    }
    
    ctx.restore();
  }

  private renderWeaponIndicator(ctx: CanvasRenderingContext2D): void {
    const x = 10;
    const y = GAME_CONFIG.GAME_HEIGHT - 20;

    ctx.save();
    ctx.font = '8px monospace';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'left';
    
    // Show weapon name with key number
    const weaponSlots = ['', '1-RIFLE', '2-PISTOL', '3-GRENADE', '4-ROCKET'];
    const weaponIndex = this.getWeaponIndex(this.currentWeapon);
    const displayText = weaponSlots[weaponIndex] || this.currentWeapon.toUpperCase();
    
    ctx.fillText(displayText, x, y);
    
    ctx.restore();
  }

  private renderHealthBar(ctx: CanvasRenderingContext2D): void {
    const width = 60;
    const height = 6;
    const x = 10;
    const y = 10;

    ctx.save();
    
    // Background
    ctx.fillStyle = '#333333';
    ctx.fillRect(x, y, width, height);
    
    // Health fill
    const healthPercent = this.health / this.maxHealth;
    let healthColor = '#00FF00'; // Green
    
    if (healthPercent < 0.3) {
      healthColor = '#FF0000'; // Red
    } else if (healthPercent < 0.6) {
      healthColor = '#FFFF00'; // Yellow
    }
    
    // Flash effect when damaged
    const timeSinceDamage = Date.now() - this.lastDamageTime;
    if (timeSinceDamage < this.damageFlashDuration) {
      const flashIntensity = 1 - (timeSinceDamage / this.damageFlashDuration);
      ctx.globalAlpha = 0.5 + (flashIntensity * 0.5);
      ctx.fillStyle = '#FF0000';
      ctx.fillRect(x, y, width, height);
      ctx.globalAlpha = 1;
    }
    
    ctx.fillStyle = healthColor;
    ctx.fillRect(x, y, width * healthPercent, height);
    
    // Border
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, width, height);
    
    // Health text
    ctx.font = '6px monospace';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.fillText(`${this.health}`, x + width / 2, y + height + 8);
    
    ctx.restore();
  }

  private renderCrosshair(ctx: CanvasRenderingContext2D): void {
    const centerX = GAME_CONFIG.GAME_WIDTH / 2;
    const centerY = GAME_CONFIG.GAME_HEIGHT / 2;
    const size = this.isADS ? 2 : 4; // Smaller crosshair when ADS
    
    ctx.save();
    ctx.strokeStyle = this.isADS ? '#00FF00' : '#FFFFFF';
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.8;
    
    // Draw cross
    ctx.beginPath();
    ctx.moveTo(centerX - size, centerY);
    ctx.lineTo(centerX + size, centerY);
    ctx.moveTo(centerX, centerY - size);
    ctx.lineTo(centerX, centerY + size);
    ctx.stroke();
    
    // Draw center dot
    ctx.fillStyle = this.isADS ? '#00FF00' : '#FFFFFF';
    ctx.fillRect(centerX - 0.5, centerY - 0.5, 1, 1);
    
    ctx.restore();
  }

  private renderChargeBar(ctx: CanvasRenderingContext2D): void {
    const width = 40;
    const height = 4;
    const x = GAME_CONFIG.GAME_WIDTH / 2 - width / 2;
    const y = GAME_CONFIG.GAME_HEIGHT / 2 - 30;

    ctx.save();
    
    // Background
    ctx.fillStyle = '#333333';
    ctx.fillRect(x, y, width, height);
    
    // Charge fill
    const chargePercent = this.grenadeCharge / 5;
    ctx.fillStyle = chargePercent > 0.8 ? '#FF0000' : '#FFFF00';
    ctx.fillRect(x, y, width * chargePercent, height);
    
    // Border
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, width, height);
    
    // Charge level text
    ctx.font = '6px monospace';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.fillText(`CHARGE: ${this.grenadeCharge}`, x + width / 2, y - 4);
    
    ctx.restore();
  }

  private getWeaponIndex(weaponName: string): number {
    switch (weaponName) {
      case 'rifle': return 1;
      case 'pistol': return 2;
      case 'grenade': return 3;
      case 'rocket': return 4;
      default: return 1;
    }
  }

  // Public methods for updating UI state
  
  updateWeaponData(weaponType: string, currentAmmo: number, reserveAmmo: number, isReloading: boolean = false): void {
    if (weaponType in this.weapons) {
      const weapon = this.weapons[weaponType as keyof PlayerWeapons];
      weapon.currentAmmo = currentAmmo;
      weapon.reserveAmmo = reserveAmmo;
      weapon.isReloading = isReloading;
    }
  }

  updateHealth(newHealth: number): void {
    this.health = Math.max(0, Math.min(this.maxHealth, newHealth));
  }

  updateGrenadeCharge(chargeLevel: number): void {
    this.grenadeCharge = Math.max(0, Math.min(5, chargeLevel));
  }

  updateCurrentWeapon(weaponType: string): void {
    this.currentWeapon = weaponType;
  }

  updateADS(isADS: boolean): void {
    this.isADS = isADS;
  }

  // Getter methods for GameScene
  
  getCurrentWeaponAmmo(): { current: number; reserve: number; isReloading: boolean } {
    const weapon = this.weapons[this.currentWeapon as keyof PlayerWeapons];
    if (!weapon) return { current: 0, reserve: 0, isReloading: false };
    return {
      current: weapon.currentAmmo,
      reserve: weapon.reserveAmmo,
      isReloading: weapon.isReloading
    };
  }

  getCurrentWeaponName(): string {
    return this.currentWeapon;
  }

  getHealth(): number {
    return this.health;
  }

  getGrenadeCharge(): number {
    return this.grenadeCharge;
  }

  isAimingDownSights(): boolean {
    return this.isADS;
  }

  // Method to decrease ammo when firing (for local feedback)
  decreaseAmmo(weaponType: string, amount: number = 1): void {
    if (weaponType in this.weapons) {
      const weapon = this.weapons[weaponType as keyof PlayerWeapons];
      weapon.currentAmmo = Math.max(0, weapon.currentAmmo - amount);
    }
  }

  // Debug methods
  
  getUIState(): any {
    return {
      health: this.health,
      currentWeapon: this.currentWeapon,
      weapons: this.weapons,
      grenadeCharge: this.grenadeCharge,
      isADS: this.isADS
    };
  }
} 
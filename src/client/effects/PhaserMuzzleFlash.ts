export class PhaserMuzzleFlash {
  private graphic: Phaser.GameObjects.Graphics;
  private position: { x: number; y: number };
  private rotation: number;
  private startTime: number;
  private duration: number = 100; // ms
  private size: number = 4; // pixels
  private isActive: boolean = true;

  constructor(scene: Phaser.Scene, position: { x: number; y: number }, rotation: number) {
    this.position = { ...position };
    this.rotation = rotation;
    this.startTime = Date.now();
    
    // Create Phaser graphics object
    this.graphic = scene.add.graphics();
    this.graphic.setDepth(50);
  }

  update(): boolean {
    const elapsed = Date.now() - this.startTime;
    this.isActive = elapsed < this.duration;
    
    if (this.isActive) {
      // Update visual
      this.graphic.clear();
      
      const alpha = 1 - (elapsed / this.duration);
      this.graphic.setAlpha(alpha);
      
      // Flash color - yellow to orange
      const color = elapsed < 50 ? 0xFFFF00 : 0xFF8000;
      this.graphic.fillStyle(color);
      
      // Position flash at weapon muzzle
      const flashX = this.position.x + Math.cos(this.rotation) * 12;
      const flashY = this.position.y + Math.sin(this.rotation) * 12;
      
      // Draw 4x4 pixel flash
      this.graphic.fillRect(
        flashX - this.size / 2,
        flashY - this.size / 2,
        this.size,
        this.size
      );
    } else {
      // Hide when finished
      this.graphic.setVisible(false);
    }
    
    return this.isActive;
  }

  destroy(): void {
    if (this.graphic) {
      this.graphic.destroy();
    }
  }

  isFinished(): boolean {
    return !this.isActive;
  }
} 
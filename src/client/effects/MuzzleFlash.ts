export class MuzzleFlash {
  private position: { x: number; y: number };
  private rotation: number;
  private startTime: number;
  private duration: number = 100; // ms
  private size: number = 4; // pixels
  private isActive: boolean = true;

  constructor(position: { x: number; y: number }, rotation: number) {
    this.position = { ...position };
    this.rotation = rotation;
    this.startTime = Date.now();
  }

  update(): boolean {
    const elapsed = Date.now() - this.startTime;
    this.isActive = elapsed < this.duration;
    return this.isActive;
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (!this.isActive) return;

    const elapsed = Date.now() - this.startTime;
    const alpha = 1 - (elapsed / this.duration);
    
    ctx.save();
    ctx.globalAlpha = alpha;
    
    // Flash color - yellow to orange
    ctx.fillStyle = elapsed < 50 ? '#FFFF00' : '#FF8000';
    
    // Position flash at weapon muzzle
    const flashX = this.position.x + Math.cos(this.rotation) * 12; // 12 pixels from center
    const flashY = this.position.y + Math.sin(this.rotation) * 12;
    
    // Draw 4x4 pixel flash
    ctx.fillRect(
      flashX - this.size / 2,
      flashY - this.size / 2,
      this.size,
      this.size
    );
    
    ctx.restore();
  }

  isFinished(): boolean {
    return !this.isActive;
  }
} 
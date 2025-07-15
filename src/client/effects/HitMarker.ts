export class HitMarker {
  private position: { x: number; y: number };
  private startTime: number;
  private duration: number = 200; // ms
  private size: number = 2; // pixels
  private isActive: boolean = true;

  constructor(position: { x: number; y: number }) {
    this.position = { ...position };
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
    ctx.fillStyle = '#FF0000'; // Red hit marker
    ctx.strokeStyle = '#FFFFFF'; // White outline
    ctx.lineWidth = 1;
    
    // Draw X mark
    const halfSize = this.size / 2;
    
    // Draw lines forming an X
    ctx.beginPath();
    ctx.moveTo(this.position.x - halfSize, this.position.y - halfSize);
    ctx.lineTo(this.position.x + halfSize, this.position.y + halfSize);
    ctx.moveTo(this.position.x + halfSize, this.position.y - halfSize);
    ctx.lineTo(this.position.x - halfSize, this.position.y + halfSize);
    
    ctx.stroke();
    
    ctx.restore();
  }

  isFinished(): boolean {
    return !this.isActive;
  }
} 
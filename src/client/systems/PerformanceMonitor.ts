import { IGameSystem } from '../../../shared/interfaces/IGameSystem';
import { GAME_CONFIG } from '../../../shared/constants/index';

interface PerformanceData {
  fps: number;
  avgFps: number;
  memoryUsage: number;
  renderTime: number;
  networkLatency: number;
  frameDrops: number;
}

export class PerformanceMonitor implements IGameSystem {
  private scene: Phaser.Scene;
  private isVisible: boolean = false;
  
  // Performance tracking
  private frameCount: number = 0;
  private lastTime: number = 0;
  private fpsHistory: number[] = [];
  private currentFps: number = 60;
  private frameDropCount: number = 0;
  private lastFrameTime: number = 0;
  
  // Display elements
  private container: Phaser.GameObjects.Container | null = null;
  private background: Phaser.GameObjects.Graphics | null = null;
  private fpsText: Phaser.GameObjects.Text | null = null;
  private perfText: Phaser.GameObjects.Text | null = null;
  private graphicsContainer: Phaser.GameObjects.Container | null = null;
  
  // Settings
  private readonly MAX_HISTORY = 60; // Track last 60 frames
  private readonly UPDATE_INTERVAL = 100; // Update display every 100ms
  private lastUpdateTime: number = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  initialize(): void {
    // Check if FPS counter should be shown
    this.isVisible = localStorage.getItem('show_fps') === 'true';
    
    this.setupKeyboardListeners();
    this.createDisplayElements();
    
    // Initialize timing
    this.lastTime = performance.now();
    this.lastFrameTime = this.lastTime;
    this.lastUpdateTime = this.lastTime;
  }

  update(deltaTime: number): void {
    const currentTime = performance.now();
    
    // Calculate FPS
    this.calculateFPS(currentTime);
    
    // Update display if visible and enough time has passed
    if (this.isVisible && currentTime - this.lastUpdateTime > this.UPDATE_INTERVAL) {
      this.updateDisplay();
      this.lastUpdateTime = currentTime;
    }
    
    this.lastFrameTime = currentTime;
  }

  destroy(): void {
    this.destroyDisplayElements();
    this.removeKeyboardListeners();
  }

  render(ctx: CanvasRenderingContext2D): void {
    // No custom canvas rendering needed - using Phaser objects
  }

  private calculateFPS(currentTime: number): void {
    this.frameCount++;
    
    if (this.lastTime > 0) {
      const deltaTime = currentTime - this.lastTime;
      const instantFps = 1000 / deltaTime;
      
      // Track frame drops (frame took longer than 1000/55ms = ~18ms for 55fps)
      if (deltaTime > 18) {
        this.frameDropCount++;
      }
      
      // Add to history
      this.fpsHistory.push(instantFps);
      if (this.fpsHistory.length > this.MAX_HISTORY) {
        this.fpsHistory.shift();
      }
      
      // Calculate average
      this.currentFps = this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length;
    }
    
    this.lastTime = currentTime;
  }

  private updateDisplay(): void {
    if (!this.isVisible || !this.fpsText || !this.perfText) return;

    const perfData = this.gatherPerformanceData();
    
    // Update FPS text
    const fpsColor = this.getFPSColor(perfData.fps);
    this.fpsText.setText(`FPS: ${Math.round(perfData.fps)}`);
    this.fpsText.setColor(fpsColor);
    
    // Update detailed performance text
    const perfDetails = [
      `Avg: ${Math.round(perfData.avgFps)}`,
      `Drops: ${perfData.frameDrops}`,
      `Mem: ${perfData.memoryUsage}MB`,
      `Render: ${perfData.renderTime.toFixed(1)}ms`
    ];
    
    this.perfText.setText(perfDetails.join('\n'));
  }

  private gatherPerformanceData(): PerformanceData {
    const avgFps = this.fpsHistory.length > 0 
      ? this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length 
      : 60;

    // Get memory usage if available
    let memoryUsage = 0;
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      memoryUsage = Math.round(memory.usedJSHeapSize / 1024 / 1024);
    }

    // Estimate render time based on FPS
    const renderTime = this.currentFps > 0 ? 1000 / this.currentFps : 16.67;

    return {
      fps: this.currentFps,
      avgFps,
      memoryUsage,
      renderTime,
      networkLatency: 0, // Would need backend for this
      frameDrops: this.frameDropCount
    };
  }

  private getFPSColor(fps: number): string {
    if (fps >= 55) return '#00ff00'; // Green - good
    if (fps >= 40) return '#ffff00'; // Yellow - okay
    if (fps >= 25) return '#ff8800'; // Orange - poor
    return '#ff0000'; // Red - bad
  }

  private createDisplayElements(): void {
    if (!this.isVisible) return;

    // Create container
    this.container = this.scene.add.container(GAME_CONFIG.GAME_WIDTH - 10, 10);
    this.container.setDepth(10000); // Very high depth to stay on top

    // Background
    this.background = this.scene.add.graphics();
    this.background.fillStyle(0x000000, 0.7);
    this.background.fillRect(-80, 0, 75, 80);
    this.background.lineStyle(1, 0x444444);
    this.background.strokeRect(-80, 0, 75, 80);

    // FPS text (main)
    this.fpsText = this.scene.add.text(-75, 5, 'FPS: --', {
      fontSize: '10px',
      color: '#ffffff',
      fontFamily: 'monospace',
      fontStyle: 'bold'
    });

    // Performance details text
    this.perfText = this.scene.add.text(-75, 20, '', {
      fontSize: '7px',
      color: '#cccccc',
      fontFamily: 'monospace',
      lineSpacing: 2
    });

    // Add to container
    this.container.add([this.background, this.fpsText, this.perfText]);
  }

  private destroyDisplayElements(): void {
    if (this.container) {
      this.container.destroy();
      this.container = null;
    }
    this.background = null;
    this.fpsText = null;
    this.perfText = null;
    this.graphicsContainer = null;
  }

  private setupKeyboardListeners(): void {
    // Listen for F3 key to toggle performance display
    this.scene.input.keyboard?.on('keydown-F3', () => {
      this.toggleDisplay();
    });

    // Listen for storage changes (from settings panel)
    window.addEventListener('storage', (e) => {
      if (e.key === 'show_fps') {
        const shouldShow = e.newValue === 'true';
        if (shouldShow !== this.isVisible) {
          if (shouldShow) {
            this.showDisplay();
          } else {
            this.hideDisplay();
          }
        }
      }
    });
  }

  private removeKeyboardListeners(): void {
    this.scene.input.keyboard?.off('keydown-F3');
  }

  public toggleDisplay(): void {
    if (this.isVisible) {
      this.hideDisplay();
    } else {
      this.showDisplay();
    }
  }

  public showDisplay(): void {
    this.isVisible = true;
    localStorage.setItem('show_fps', 'true');
    this.createDisplayElements();
  }

  public hideDisplay(): void {
    this.isVisible = false;
    localStorage.setItem('show_fps', 'false');
    this.destroyDisplayElements();
  }

  // Public methods for external access
  public getCurrentFPS(): number {
    return Math.round(this.currentFps);
  }

  public getAverageFPS(): number {
    return this.fpsHistory.length > 0 
      ? Math.round(this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length)
      : 60;
  }

  public getFrameDropCount(): number {
    return this.frameDropCount;
  }

  public resetStats(): void {
    this.frameCount = 0;
    this.fpsHistory = [];
    this.frameDropCount = 0;
    this.lastTime = performance.now();
  }

  // Debug method
  public getPerformanceReport(): string {
    const data = this.gatherPerformanceData();
    return [
      `=== PERFORMANCE REPORT ===`,
      `Current FPS: ${Math.round(data.fps)}`,
      `Average FPS: ${Math.round(data.avgFps)}`,
      `Frame Drops: ${data.frameDrops}`,
      `Memory Usage: ${data.memoryUsage}MB`,
      `Render Time: ${data.renderTime.toFixed(1)}ms`,
      `Frame Count: ${this.frameCount}`,
      `History Size: ${this.fpsHistory.length}`
    ].join('\n');
  }
}

import { GAME_CONFIG } from '../../../shared/constants/index';
import { indexToPixel, groupTilesIntoRectangles, pixelToIndex } from '../utils/visionHelpers';

export class VisionRenderer {
  private scene: Phaser.Scene;
  private fogLayer: Phaser.GameObjects.RenderTexture;
  private visionDebugGraphics: Phaser.GameObjects.Graphics | null = null;
  private lastVisibleTiles: Set<number> = new Set();
  
  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    
    // Create render texture for fog - ensure it's positioned at origin
    this.fogLayer = scene.add.renderTexture(0, 0, GAME_CONFIG.GAME_WIDTH, GAME_CONFIG.GAME_HEIGHT);
    this.fogLayer.setOrigin(0, 0); // Ensure origin is top-left
    this.fogLayer.setDepth(90); // Above game but below UI
    
    // Fill with black fog initially
    this.fogLayer.fill(0x000000, 0.9);
  }
  
  // Update vision using backend's tile index data
  updateVisionFromBackend(visibleTiles: number[]): void {
    // Convert to Set for fast lookups
    const visibleSet = new Set(visibleTiles);
    
    // Clear the fog layer
    this.fogLayer.clear();
    
    // Create temporary graphics for batch drawing
    const graphics = this.scene.make.graphics({ x: 0, y: 0 }, false);
    
    // Method 1: Draw fog everywhere except visible tiles (more accurate)
    // Fill everything with dark fog
    graphics.fillStyle(0x000000, 0.9);
    graphics.fillRect(0, 0, GAME_CONFIG.GAME_WIDTH, GAME_CONFIG.GAME_HEIGHT);
    
    // Use erase blend mode to cut out visible areas
    graphics.setBlendMode(Phaser.BlendModes.ERASE);
    graphics.fillStyle(0xffffff, 1);
    
    // Group adjacent tiles into rectangles for better performance
    const rectangles = groupTilesIntoRectangles(visibleTiles);
    
    // Draw rectangles instead of individual tiles
    for (const rect of rectangles) {
      graphics.fillRect(rect.x, rect.y, rect.width, rect.height);
    }
    
    // Apply the graphics to the fog layer
    this.fogLayer.draw(graphics);
    
    // Clean up
    graphics.destroy();
    
    // Store for debugging
    this.lastVisibleTiles = visibleSet;
    
    // Debug logging
    if (Math.random() < 0.05) { // Log 5% of updates
      console.log(`👁️ Vision update: ${visibleTiles.length} visible tiles`);
    }
  }

  
  // Check if a position is visible (for other systems to query)
  isVisible(x: number, y: number): boolean {
    const tileIndex = pixelToIndex(x, y);
    return this.lastVisibleTiles.has(tileIndex);
  }
  
  // Toggle debug visualization
  toggleDebug(): void {
    if (this.visionDebugGraphics) {
      this.visionDebugGraphics.destroy();
      this.visionDebugGraphics = null;
    } else {
      this.visionDebugGraphics = this.scene.add.graphics();
      this.visionDebugGraphics.setDepth(91); // Above fog
      this.updateDebugVisualization();
    }
  }
  
  private updateDebugVisualization(): void {
    if (!this.visionDebugGraphics) return;
    
    this.visionDebugGraphics.clear();
    
    // Draw visible tiles as semi-transparent squares
    this.visionDebugGraphics.fillStyle(0x00ff00, 0.3);
    for (const tileIndex of this.lastVisibleTiles) {
      const pixelCoords = indexToPixel(tileIndex);
      this.visionDebugGraphics.fillRect(pixelCoords.x, pixelCoords.y, 16, 16);
    }
    
    // Show stats
    const debugText = `Visible tiles: ${this.lastVisibleTiles.size}`;
    const style = { fontSize: '10px', color: '#00ff00' };
    
    // Remove old debug text if it exists
    const oldText = this.scene.children.getByName('visionDebugText');
    if (oldText) oldText.destroy();
    
    const text = this.scene.add.text(5, 5, debugText, style);
    text.setName('visionDebugText');
    text.setDepth(92);
  }
  
  destroy(): void {
    this.fogLayer.destroy();
    if (this.visionDebugGraphics) {
      this.visionDebugGraphics.destroy();
    }
    const debugText = this.scene.children.getByName('visionDebugText');
    if (debugText) debugText.destroy();
  }
} 
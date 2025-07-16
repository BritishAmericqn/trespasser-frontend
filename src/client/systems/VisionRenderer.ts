import { GAME_CONFIG } from '../../../shared/constants/index';
import { VISION_CONSTANTS } from '../../../shared/types/index';
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
    
    console.log('🌫️ Fog layer created:', {
      width: GAME_CONFIG.GAME_WIDTH,
      height: GAME_CONFIG.GAME_HEIGHT,
      depth: this.fogLayer.depth,
      visible: this.fogLayer.visible
    });
  }
  
  // Update vision using backend's tile index data
  updateVisionFromBackend(visibleTiles: number[]): void {
    // Convert to Set for fast lookups
    const visibleSet = new Set(visibleTiles);
    
    // Store for debugging
    this.lastVisibleTiles = visibleSet;
    
    // Debug logging once
    if (visibleTiles.length > 0 && !(this as any).loggedVisionOnce) {
      (this as any).loggedVisionOnce = true;
      console.log(`👁️ Vision system active: ${visibleTiles.length} visible tiles, fog layer visible: ${this.fogLayer.visible}`);
    }
    
    // Clear the fog layer completely
    this.fogLayer.clear();
    
    // Create a graphics object for drawing fog
    const graphics = this.scene.make.graphics({ x: 0, y: 0 }, false);
    graphics.fillStyle(0x000000, 0.85);
    
    // Draw fog for each tile that is NOT visible
    const totalTiles = VISION_CONSTANTS.GRID_WIDTH * VISION_CONSTANTS.GRID_HEIGHT;
    for (let tileIndex = 0; tileIndex < totalTiles; tileIndex++) {
      // Skip if this tile is visible
      if (visibleSet.has(tileIndex)) continue;
      
      // Draw fog for this non-visible tile
      const pixelPos = indexToPixel(tileIndex);
      graphics.fillRect(pixelPos.x, pixelPos.y, 16, 16);
    }
    
    // Draw the graphics to the render texture
    this.fogLayer.draw(graphics);
    
    // Clean up
    graphics.destroy();
    
    // Make sure fog layer is on top
    this.fogLayer.setDepth(100);
    
    // Debug: Log some info about what we're rendering
    if (visibleTiles.length > 0 && !(this as any).debuggedVision) {
      (this as any).debuggedVision = true;
      console.log('🔍 Vision debug:', {
        visibleTileCount: visibleTiles.length,
        totalTiles: totalTiles,
        foggedTiles: totalTiles - visibleTiles.length,
        sampleVisibleIndices: visibleTiles.slice(0, 5),
        sampleVisiblePositions: visibleTiles.slice(0, 5).map(i => indexToPixel(i))
      });
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
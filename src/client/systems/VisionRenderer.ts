import { GAME_CONFIG } from '../../../shared/constants/index';
import { VISION_CONSTANTS, TileVision, PolygonVision, Vector2 } from '../../../shared/types/index';
import { indexToPixel, groupTilesIntoRectangles, pixelToIndex } from '../utils/visionHelpers';

export class VisionRenderer {
  private scene: Phaser.Scene;
  private fogLayer: Phaser.GameObjects.RenderTexture;
  private desaturationLayer: Phaser.GameObjects.RenderTexture;
  private visionDebugGraphics: Phaser.GameObjects.Graphics | null = null;
  private lastVisibleTiles: Set<number> = new Set();
  private lastPolygon: Vector2[] | null = null;
  private visionGraphics: Phaser.GameObjects.Graphics;
  
  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    
    // Create render texture for fog - ensure it's positioned at origin
    this.fogLayer = scene.add.renderTexture(0, 0, GAME_CONFIG.GAME_WIDTH, GAME_CONFIG.GAME_HEIGHT);
    this.fogLayer.setOrigin(0, 0); // Ensure origin is top-left
    this.fogLayer.setDepth(90); // Applied second, on top of desaturation
    
    // Create render texture for desaturation effect
    this.desaturationLayer = scene.add.renderTexture(0, 0, GAME_CONFIG.GAME_WIDTH, GAME_CONFIG.GAME_HEIGHT);
    this.desaturationLayer.setOrigin(0, 0);
    this.desaturationLayer.setDepth(85); // Applied first, behind fog
    this.desaturationLayer.setBlendMode(Phaser.BlendModes.COLOR_BURN); // Better desaturation effect
    
    // Create graphics object for polygon rendering
    this.visionGraphics = scene.add.graphics();
    this.visionGraphics.setDepth(89); // Just below fog
    
    // Fill with initial fog and desaturation
    this.fogLayer.fill(0x000000, 0.85); // Much darker for stronger fog effect
    this.desaturationLayer.fill(0x606060, 0.9); // Darker gray for stronger desaturation
  }
  
  // Main update method that handles both polygon and tile-based vision
  updateVisionFromBackend(visionData: TileVision | PolygonVision | number[]): void {
    // Handle legacy array format
    if (Array.isArray(visionData)) {
      this.updateTileVision(visionData);
      return;
    }
    
    // Handle new format with type field
    if (visionData.type === 'polygon') {
      this.updatePolygonVision(visionData);
    } else if (visionData.type === 'tiles') {
      this.updateTileVision(visionData.visibleTiles);
    }
  }
  
  // Update vision using polygon data
  private updatePolygonVision(visionData: PolygonVision): void {
    // Store polygon for debugging
    this.lastPolygon = visionData.polygon;
    
    // Clear both layers
    this.fogLayer.clear();
    this.desaturationLayer.clear();
    
    // Create fog effect (darkening)
    const fogGraphics = this.scene.make.graphics({ x: 0, y: 0 }, false);
    fogGraphics.fillStyle(0x000000, 0.85); // Much darker fog
    fogGraphics.fillRect(0, 0, GAME_CONFIG.GAME_WIDTH, GAME_CONFIG.GAME_HEIGHT);
    
    // Create desaturation effect  
    const desatGraphics = this.scene.make.graphics({ x: 0, y: 0 }, false);
    desatGraphics.fillStyle(0x606060, 0.8); // Darker gray for stronger desaturation
    desatGraphics.fillRect(0, 0, GAME_CONFIG.GAME_WIDTH, GAME_CONFIG.GAME_HEIGHT);
    
    // Create mask for visible area
    const maskGraphics = this.scene.make.graphics({ x: 0, y: 0 }, false);
    maskGraphics.fillStyle(0xffffff, 1);
    
    // Draw the visibility polygon
    maskGraphics.beginPath();
    maskGraphics.moveTo(visionData.polygon[0].x, visionData.polygon[0].y);
    
    for (let i = 1; i < visionData.polygon.length; i++) {
      maskGraphics.lineTo(visionData.polygon[i].x, visionData.polygon[i].y);
    }
    
    maskGraphics.closePath();
    maskGraphics.fillPath();
    
    // Apply mask to both fog and desaturation (inverted so polygon area is clear)
    const fogMask = maskGraphics.createGeometryMask();
    const desatMask = maskGraphics.createGeometryMask();
    
    fogGraphics.setMask(fogMask);
    desatGraphics.setMask(desatMask);
    fogMask.invertAlpha = true;
    desatMask.invertAlpha = true;
    
    // Draw the masked effects to render textures
    this.fogLayer.draw(fogGraphics);
    this.desaturationLayer.draw(desatGraphics);
    
    // Clean up
    fogGraphics.destroy();
    desatGraphics.destroy();
    maskGraphics.destroy();
    fogMask.destroy();
    desatMask.destroy();
    
    // Update depths
    this.desaturationLayer.setDepth(85);
    this.fogLayer.setDepth(90);
  }

  // Update vision using tile data (legacy)
  private updateTileVision(visibleTiles: number[]): void {
    // Convert to Set for fast lookups
    const visibleSet = new Set(visibleTiles);
    
    // Store for debugging
    this.lastVisibleTiles = visibleSet;
    
    // Clear both layers
    this.fogLayer.clear();
    this.desaturationLayer.clear();
    
    // Create graphics for fog and desaturation
    const fogGraphics = this.scene.make.graphics({ x: 0, y: 0 }, false);
    const desatGraphics = this.scene.make.graphics({ x: 0, y: 0 }, false);
    
    fogGraphics.fillStyle(0x000000, 0.85); // Much darker fog
    desatGraphics.fillStyle(0x606060, 0.8); // Darker gray for stronger desaturation
    
    // Draw fog and desaturation for each tile that is NOT visible
    const totalTiles = VISION_CONSTANTS.GRID_WIDTH * VISION_CONSTANTS.GRID_HEIGHT;
    for (let tileIndex = 0; tileIndex < totalTiles; tileIndex++) {
      // Skip if this tile is visible
      if (visibleSet.has(tileIndex)) continue;
      
      // Draw effects for this non-visible tile
      const pixelPos = indexToPixel(tileIndex);
      fogGraphics.fillRect(pixelPos.x, pixelPos.y, VISION_CONSTANTS.TILE_SIZE, VISION_CONSTANTS.TILE_SIZE);
      desatGraphics.fillRect(pixelPos.x, pixelPos.y, VISION_CONSTANTS.TILE_SIZE, VISION_CONSTANTS.TILE_SIZE);
    }
    
    // Draw the graphics to the render textures
    this.fogLayer.draw(fogGraphics);
    this.desaturationLayer.draw(desatGraphics);
    
    // Clean up
    fogGraphics.destroy();
    desatGraphics.destroy();
    
    // Update depths
    this.desaturationLayer.setDepth(85);
    this.fogLayer.setDepth(90);
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
    
    // Remove old debug text if it exists
    const oldText = this.scene.children.getByName('visionDebugText');
    if (oldText) oldText.destroy();
    
    // Draw polygon if available
    if (this.lastPolygon && this.lastPolygon.length > 0) {
      // Draw polygon outline
      this.visionDebugGraphics.lineStyle(2, 0x00ff00, 1);
      this.visionDebugGraphics.beginPath();
      this.visionDebugGraphics.moveTo(this.lastPolygon[0].x, this.lastPolygon[0].y);
      
      for (let i = 1; i < this.lastPolygon.length; i++) {
        this.visionDebugGraphics.lineTo(this.lastPolygon[i].x, this.lastPolygon[i].y);
      }
      
      this.visionDebugGraphics.closePath();
      this.visionDebugGraphics.strokePath();
      
      // Draw vertices
      this.visionDebugGraphics.fillStyle(0xff0000, 1);
      for (const vertex of this.lastPolygon) {
        this.visionDebugGraphics.fillCircle(vertex.x, vertex.y, 3);
      }
      
      // Show stats
      const debugText = `Polygon vertices: ${this.lastPolygon.length} | Enhanced fog with desaturation`;
      const style = { fontSize: '10px', color: '#00ff00' };
      const text = this.scene.add.text(5, 5, debugText, style);
      text.setName('visionDebugText');
      text.setDepth(92);
    }
    // Draw tiles if using tile system
    else if (this.lastVisibleTiles.size > 0) {
      // Draw visible tiles as semi-transparent squares
      this.visionDebugGraphics.fillStyle(0x00ff00, 0.3);
      for (const tileIndex of this.lastVisibleTiles) {
        const pixelCoords = indexToPixel(tileIndex);
        this.visionDebugGraphics.fillRect(pixelCoords.x, pixelCoords.y, VISION_CONSTANTS.TILE_SIZE, VISION_CONSTANTS.TILE_SIZE);
      }
      
      // Show stats
      const debugText = `Visible tiles: ${this.lastVisibleTiles.size} | Enhanced fog with desaturation`;
      const style = { fontSize: '10px', color: '#00ff00' };
      const text = this.scene.add.text(5, 5, debugText, style);
      text.setName('visionDebugText');
      text.setDepth(92);
    }
  }
  
  // Get current vision polygon for masking other sprites
  getCurrentPolygon(): Vector2[] | null {
    return this.lastPolygon;
  }
  
  destroy(): void {
    this.fogLayer.destroy();
    this.desaturationLayer.destroy();
    if (this.visionDebugGraphics) {
      this.visionDebugGraphics.destroy();
    }
    const debugText = this.scene.children.getByName('visionDebugText');
    if (debugText) debugText.destroy();
  }
} 
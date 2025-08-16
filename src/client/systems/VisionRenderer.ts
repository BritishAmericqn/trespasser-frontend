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
    this.fogLayer.fill(0x000000, 0.45); // More transparent fog for better visibility
    this.desaturationLayer.fill(0x606060, 0.35); // Lighter desaturation effect
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
    
    // Add comprehensive vertex validation logging
    if (visionData.polygon) {
      const validVertices = visionData.polygon.filter(v => 
        v && typeof v.x === 'number' && typeof v.y === 'number' && 
        !isNaN(v.x) && !isNaN(v.y)
      );
      
      // Vertex validation (silent)
      
      // Check for duplicate consecutive vertices
      const duplicates = [];
      for (let i = 1; i < visionData.polygon.length; i++) {
        const prev = visionData.polygon[i-1];
        const curr = visionData.polygon[i];
        if (prev && curr && Math.abs(prev.x - curr.x) < 0.01 && Math.abs(prev.y - curr.y) < 0.01) {
          duplicates.push({ index: i, vertex: curr });
        }
      }
      
      // Duplicate vertex validation (silent)
      
      // Check for potential missing vertices (large gaps between consecutive vertices) - silent
      
      // Polygon validation complete
    }
    
    // Clear both layers
    this.fogLayer.clear();
    this.desaturationLayer.clear();
    
    // Create fog effect (darkening)
    const fogGraphics = this.scene.make.graphics({ x: 0, y: 0 }, false);
    fogGraphics.fillStyle(0x000000, 0.45); // More transparent fog for better visibility
    fogGraphics.fillRect(0, 0, GAME_CONFIG.GAME_WIDTH, GAME_CONFIG.GAME_HEIGHT);
    
    // Create desaturation effect  
    const desatGraphics = this.scene.make.graphics({ x: 0, y: 0 }, false);
    desatGraphics.fillStyle(0x606060, 0.35); // Lighter desaturation effect
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
    
    fogGraphics.fillStyle(0x000000, 0.45); // More transparent fog for better visibility
    desatGraphics.fillStyle(0x606060, 0.35); // Lighter desaturation effect
    
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
    
    // Clean up old vertex labels and gap indicators
    this.cleanupDebugElements();
    
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
      
      // Draw vertices with numbers and distance indicators
      this.visionDebugGraphics.fillStyle(0xff0000, 1);
      for (let i = 0; i < this.lastPolygon.length; i++) {
        const vertex = this.lastPolygon[i];
        if (vertex && typeof vertex.x === 'number' && typeof vertex.y === 'number') {
          // Draw vertex dot
          this.visionDebugGraphics.fillCircle(vertex.x, vertex.y, 3);
          
          // Add vertex number
          const text = this.scene.add.text(vertex.x + 5, vertex.y - 5, `${i}`, {
            fontSize: '8px', 
            color: '#ffff00',
            backgroundColor: '#000000'
          });
          text.setName(`vertex_${i}`);
          text.setDepth(93);
          
          // Check distance to next vertex and highlight large gaps
          if (i < this.lastPolygon.length - 1) {
            const nextVertex = this.lastPolygon[i + 1];
            if (nextVertex && typeof nextVertex.x === 'number' && typeof nextVertex.y === 'number') {
              const distance = Math.sqrt(
                Math.pow(nextVertex.x - vertex.x, 2) + 
                Math.pow(nextVertex.y - vertex.y, 2)
              );
              
              // Highlight large gaps in red
              if (distance > 50) {
                this.visionDebugGraphics.lineStyle(3, 0xff0000, 0.8);
                this.visionDebugGraphics.beginPath();
                this.visionDebugGraphics.moveTo(vertex.x, vertex.y);
                this.visionDebugGraphics.lineTo(nextVertex.x, nextVertex.y);
                this.visionDebugGraphics.strokePath();
                
                // Add distance label
                const midX = (vertex.x + nextVertex.x) / 2;
                const midY = (vertex.y + nextVertex.y) / 2;
                const distText = this.scene.add.text(midX, midY, `${distance.toFixed(0)}px`, {
                  fontSize: '10px',
                  color: '#ff0000',
                  backgroundColor: '#ffffff'
                });
                distText.setName(`gap_${i}`);
                distText.setDepth(93);
              }
            }
          }
        }
      }
      
      // Enhanced stats with vertex analysis
      const bounds = this.calculatePolygonBounds(this.lastPolygon);
      const area = this.calculatePolygonArea(this.lastPolygon);
      const perimeter = this.calculatePolygonPerimeter(this.lastPolygon);
      
      const debugText = `Polygon: ${this.lastPolygon.length} vertices | Area: ${area.toFixed(0)}px² | Perimeter: ${perimeter.toFixed(0)}px | Bounds: ${bounds.maxX - bounds.minX}×${bounds.maxY - bounds.minY}`;
      const style = { fontSize: '10px', color: '#00ff00', backgroundColor: '#000000' };
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
  
  // Helper methods for polygon analysis
  private calculatePolygonBounds(polygon: Vector2[]): { minX: number; minY: number; maxX: number; maxY: number } {
    if (!polygon || polygon.length === 0) {
      return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    }
    
    let minX = polygon[0].x, minY = polygon[0].y;
    let maxX = polygon[0].x, maxY = polygon[0].y;
    
    for (const vertex of polygon) {
      if (vertex && typeof vertex.x === 'number' && typeof vertex.y === 'number') {
        minX = Math.min(minX, vertex.x);
        minY = Math.min(minY, vertex.y);
        maxX = Math.max(maxX, vertex.x);
        maxY = Math.max(maxY, vertex.y);
      }
    }
    
    return { minX, minY, maxX, maxY };
  }
  
  private calculatePolygonArea(polygon: Vector2[]): number {
    if (!polygon || polygon.length < 3) return 0;
    
    let area = 0;
    for (let i = 0; i < polygon.length; i++) {
      const current = polygon[i];
      const next = polygon[(i + 1) % polygon.length];
      
      if (current && next && 
          typeof current.x === 'number' && typeof current.y === 'number' &&
          typeof next.x === 'number' && typeof next.y === 'number') {
        area += (current.x * next.y - next.x * current.y);
      }
    }
    
    return Math.abs(area) / 2;
  }
  
  private calculatePolygonPerimeter(polygon: Vector2[]): number {
    if (!polygon || polygon.length < 2) return 0;
    
    let perimeter = 0;
    for (let i = 0; i < polygon.length; i++) {
      const current = polygon[i];
      const next = polygon[(i + 1) % polygon.length];
      
      if (current && next && 
          typeof current.x === 'number' && typeof current.y === 'number' &&
          typeof next.x === 'number' && typeof next.y === 'number') {
        const dx = next.x - current.x;
        const dy = next.y - current.y;
        perimeter += Math.sqrt(dx * dx + dy * dy);
      }
    }
    
    return perimeter;
  }
  
  private cleanupDebugElements(): void {
    // Clean up vertex labels (numbered 0-99 should be enough)
    for (let i = 0; i < 100; i++) {
      const vertexLabel = this.scene.children.getByName(`vertex_${i}`);
      if (vertexLabel) {
        vertexLabel.destroy();
      }
      
      const gapLabel = this.scene.children.getByName(`gap_${i}`);
      if (gapLabel) {
        gapLabel.destroy();
      }
    }
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
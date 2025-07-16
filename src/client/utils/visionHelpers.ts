import { VISION_CONSTANTS } from '../../../shared/types/index';

// Pre-calculated lookup table for performance
const TILE_LOOKUP: { x: number; y: number }[] = new Array(VISION_CONSTANTS.MAX_TILE_INDEX + 1);
for (let i = 0; i <= VISION_CONSTANTS.MAX_TILE_INDEX; i++) {
  TILE_LOOKUP[i] = {
    x: i % VISION_CONSTANTS.GRID_WIDTH,
    y: Math.floor(i / VISION_CONSTANTS.GRID_WIDTH)
  };
}

/**
 * Convert a tile index to tile coordinates
 */
export function indexToTile(index: number): { x: number; y: number } {
  if (index < 0 || index > VISION_CONSTANTS.MAX_TILE_INDEX) {
    console.warn(`Invalid tile index: ${index}`);
    return { x: 0, y: 0 };
  }
  return TILE_LOOKUP[index];
}

/**
 * Convert a tile index to pixel coordinates (top-left of tile)
 */
export function indexToPixel(index: number): { x: number; y: number } {
  const tile = indexToTile(index);
  return {
    x: tile.x * VISION_CONSTANTS.TILE_SIZE,
    y: tile.y * VISION_CONSTANTS.TILE_SIZE
  };
}

/**
 * Convert tile coordinates to a tile index
 */
export function tileToIndex(tileX: number, tileY: number): number {
  return tileY * VISION_CONSTANTS.GRID_WIDTH + tileX;
}

/**
 * Convert pixel coordinates to tile index
 */
export function pixelToIndex(x: number, y: number): number {
  const tileX = Math.floor(x / VISION_CONSTANTS.TILE_SIZE);
  const tileY = Math.floor(y / VISION_CONSTANTS.TILE_SIZE);
  return tileToIndex(tileX, tileY);
}

/**
 * Check if a tile is visible given an array of visible tile indices
 */
export function isTileVisible(tileX: number, tileY: number, visibleTiles: number[]): boolean {
  const index = tileToIndex(tileX, tileY);
  return visibleTiles.includes(index);
}

/**
 * Group adjacent tile indices into rectangles for efficient rendering
 * Updated for 8x8 tiles and 60x34 grid
 */
export function groupTilesIntoRectangles(tileIndices: number[]): Array<{ x: number; y: number; width: number; height: number }> {
  if (tileIndices.length === 0) return [];
  
  // Create a 2D grid to track which tiles are visible
  const grid: boolean[][] = Array(VISION_CONSTANTS.GRID_HEIGHT)
    .fill(null)
    .map(() => Array(VISION_CONSTANTS.GRID_WIDTH).fill(false));
  
  // Mark visible tiles in the grid
  for (const index of tileIndices) {
    const tile = indexToTile(index);
    if (tile.y < VISION_CONSTANTS.GRID_HEIGHT && tile.x < VISION_CONSTANTS.GRID_WIDTH) {
      grid[tile.y][tile.x] = true;
    }
  }
  
  const rectangles: Array<{ x: number; y: number; width: number; height: number }> = [];
  const visited: boolean[][] = Array(VISION_CONSTANTS.GRID_HEIGHT)
    .fill(null)
    .map(() => Array(VISION_CONSTANTS.GRID_WIDTH).fill(false));
  
  // Find rectangles using a greedy algorithm
  for (let y = 0; y < VISION_CONSTANTS.GRID_HEIGHT; y++) {
    for (let x = 0; x < VISION_CONSTANTS.GRID_WIDTH; x++) {
      if (grid[y][x] && !visited[y][x]) {
        // Find the largest rectangle starting from this tile
        let width = 1;
        let height = 1;
        
        // Extend width
        while (x + width < VISION_CONSTANTS.GRID_WIDTH && grid[y][x + width] && !visited[y][x + width]) {
          width++;
        }
        
        // Extend height
        let canExtendHeight = true;
        while (y + height < VISION_CONSTANTS.GRID_HEIGHT && canExtendHeight) {
          for (let dx = 0; dx < width; dx++) {
            if (!grid[y + height][x + dx] || visited[y + height][x + dx]) {
              canExtendHeight = false;
              break;
            }
          }
          if (canExtendHeight) height++;
        }
        
        // Mark tiles as visited
        for (let dy = 0; dy < height; dy++) {
          for (let dx = 0; dx < width; dx++) {
            visited[y + dy][x + dx] = true;
          }
        }
        
        // Convert to pixel coordinates using 8x8 tile size
        rectangles.push({
          x: x * VISION_CONSTANTS.TILE_SIZE,
          y: y * VISION_CONSTANTS.TILE_SIZE,
          width: width * VISION_CONSTANTS.TILE_SIZE,
          height: height * VISION_CONSTANTS.TILE_SIZE
        });
      }
    }
  }
  
  return rectangles;
} 
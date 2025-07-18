import { Vector2 } from '../../../shared/types';

interface WallData {
  id: string;
  position: { x: number; y: number };
  width: number;
  height: number;
  orientation: 'horizontal' | 'vertical';
  destructionMask: number[];
}

export class CollisionSystem {
  private walls: WallData[] = [];
  private playerRadius: number = 5; // Player collision radius
  
  updateWalls(wallsData: WallData[]): void {
    this.walls = wallsData;
  }
  
  /**
   * Check if a position collides with any intact wall sections
   */
  checkCollision(position: Vector2): boolean {
    for (const wall of this.walls) {
      if (this.checkWallCollision(position, wall)) {
        return true;
      }
    }
    return false;
  }
  
  /**
   * Try to move from currentPos to newPos, return the furthest valid position
   */
  resolveMovement(currentPos: Vector2, newPos: Vector2): Vector2 {
    // If new position doesn't collide, return it as-is
    if (!this.checkCollision(newPos)) {
      return newPos;
    }
    
    // Try to slide along walls by testing X and Y separately
    const intermediateX = { x: newPos.x, y: currentPos.y };
    const intermediateY = { x: currentPos.x, y: newPos.y };
    
    // Try moving only in X direction
    if (!this.checkCollision(intermediateX)) {
      return intermediateX;
    }
    
    // Try moving only in Y direction
    if (!this.checkCollision(intermediateY)) {
      return intermediateY;
    }
    
    // Can't move anywhere, stay at current position
    return currentPos;
  }
  
  /**
   * Check collision with a specific wall, considering destroyed sections
   */
  private checkWallCollision(position: Vector2, wall: WallData): boolean {
    // Expand the wall bounds by player radius for collision detection
    const left = wall.position.x - this.playerRadius;
    const right = wall.position.x + wall.width + this.playerRadius;
    const top = wall.position.y - this.playerRadius;
    const bottom = wall.position.y + wall.height + this.playerRadius;
    
    // Check if player is even near the wall
    if (position.x < left || position.x > right || position.y < top || position.y > bottom) {
      return false;
    }
    
    // Check if the player is colliding with an intact section of the wall
    return this.checkWallSliceCollision(position, wall);
  }
  
  /**
   * Check collision with wall slices, respecting destruction mask
   */
  private checkWallSliceCollision(position: Vector2, wall: WallData): boolean {
    // Handle special case: 10x10 pillars with 2px slices
    const isPillar = wall.width === 10 && wall.height === 10;
    
    if (isPillar) {
      // Each slice is 2 pixels tall, check which slice the player is in
      const relativeY = position.y - wall.position.y;
      const sliceIndex = Math.floor(relativeY / 2);
      
      // Check bounds and destruction mask
      if (sliceIndex >= 0 && sliceIndex < 5) {
        return wall.destructionMask[sliceIndex] === 0; // 0 = intact, 1 = destroyed
      }
      return true; // Default to collision if out of bounds
    }
    
    if (wall.orientation === 'horizontal') {
      // Horizontal wall: vertical slices (divide width by 5)
      const relativeX = position.x - wall.position.x;
      const sliceWidth = wall.width / 5;
      const sliceIndex = Math.floor(relativeX / sliceWidth);
      
      // Check bounds and destruction mask
      if (sliceIndex >= 0 && sliceIndex < 5) {
        return wall.destructionMask[sliceIndex] === 0; // 0 = intact, 1 = destroyed
      }
      return true; // Default to collision if out of bounds
    } else {
      // Vertical wall: horizontal slices (divide height by 5)
      const relativeY = position.y - wall.position.y;
      const sliceHeight = wall.height / 5;
      const sliceIndex = Math.floor(relativeY / sliceHeight);
      
      // Check bounds and destruction mask
      if (sliceIndex >= 0 && sliceIndex < 5) {
        return wall.destructionMask[sliceIndex] === 0; // 0 = intact, 1 = destroyed
      }
      return true; // Default to collision if out of bounds
    }
  }
  
  /**
   * Get debug information about collisions at a position
   */
  getCollisionDebug(position: Vector2): any {
    const collisions = [];
    
    for (const wall of this.walls) {
      if (this.checkWallCollision(position, wall)) {
        collisions.push({
          wallId: wall.id,
          position: wall.position,
          size: { width: wall.width, height: wall.height },
          orientation: wall.orientation,
          destructionMask: wall.destructionMask.join('')
        });
      }
    }
    
    return {
      position,
      hasCollision: collisions.length > 0,
      collisions
    };
  }
} 
import { Vector2 } from '../../../shared/types/index';

export class InterpolationSystem {
  private lerpFactor: number = 0.15; // Smoothing factor (0-1, lower = smoother)
  
  /**
   * Interpolate between current and target positions
   * @param current Current position
   * @param target Target position
   * @param deltaTime Delta time in seconds
   * @returns Interpolated position
   */
  interpolatePosition(current: Vector2, target: Vector2, deltaTime: number): Vector2 {
    // Use exponential smoothing for smooth interpolation
    const factor = 1 - Math.pow(1 - this.lerpFactor, deltaTime * 60); // Normalize to 60fps
    
    return {
      x: current.x + (target.x - current.x) * factor,
      y: current.y + (target.y - current.y) * factor
    };
  }
  
  /**
   * Interpolate angle with wrapping
   * @param current Current angle in radians
   * @param target Target angle in radians
   * @param deltaTime Delta time in seconds
   * @returns Interpolated angle
   */
  interpolateAngle(current: number, target: number, deltaTime: number): number {
    // Handle angle wrapping
    let diff = target - current;
    
    // Wrap to [-PI, PI]
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    
    const factor = 1 - Math.pow(1 - this.lerpFactor, deltaTime * 60);
    return current + diff * factor;
  }
  
  /**
   * Set the interpolation smoothing factor
   * @param factor Value between 0 and 1 (lower = smoother)
   */
  setLerpFactor(factor: number): void {
    this.lerpFactor = Math.max(0, Math.min(1, factor));
  }
} 
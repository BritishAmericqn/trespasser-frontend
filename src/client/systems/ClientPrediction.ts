import { Vector2 } from '../../../shared/types';
import { GAME_CONFIG } from '../../../shared/constants';

interface InputSnapshot {
  sequence: number;
  input: any; // InputState from InputSystem
  timestamp: number;
  predictedPosition: Vector2;
  processed: boolean;
}

export class ClientPrediction {
  private inputBuffer: InputSnapshot[] = [];
  private lastAcknowledgedInput: number = 0;
  private serverPosition: Vector2 = { x: 240, y: 135 };
  private predictedPosition: Vector2 = { x: 240, y: 135 };
  private smoothCorrection: Vector2 | null = null;
  private renderPosition: Vector2 = { x: 240, y: 135 };
  
  // Callback for position updates
  private onPositionUpdate: ((pos: Vector2) => void) | null = null;
  
  constructor() {

  }
  
  setPositionCallback(callback: (pos: Vector2) => void): void {
    this.onPositionUpdate = callback;
  }
  
  // Apply input locally for immediate response
  applyInput(input: any, sequence: number): void {
    // Calculate movement delta
    const deltaTime = 1/60; // 16.67ms
    const movement = this.calculateMovement(input);
    
    // Update predicted position
    this.predictedPosition.x += movement.x * deltaTime;
    this.predictedPosition.y += movement.y * deltaTime;
    
    // Clamp to bounds
    this.predictedPosition.x = Math.max(10, Math.min(GAME_CONFIG.GAME_WIDTH - 10, this.predictedPosition.x));
    this.predictedPosition.y = Math.max(10, Math.min(GAME_CONFIG.GAME_HEIGHT - 10, this.predictedPosition.y));
    
    // Store in buffer
    this.inputBuffer.push({
      sequence: sequence,
      input: { ...input },
      timestamp: Date.now(),
      predictedPosition: { ...this.predictedPosition },
      processed: false
    });
    
    // Keep buffer size reasonable (last 2 seconds)
    if (this.inputBuffer.length > 120) {
      this.inputBuffer.shift();
    }
    
    // Update render position immediately
    this.updateRenderPosition(deltaTime);
    
    // Notify callback
    if (this.onPositionUpdate) {
      this.onPositionUpdate(this.renderPosition);
    }
  }
  
  // Calculate movement from input
  private calculateMovement(input: any): Vector2 {
    const movement = { x: 0, y: 0 };
    
    if (input.movement) {
      movement.x = input.movement.x * GAME_CONFIG.PLAYER_SPEED_WALK * input.movementSpeed;
      movement.y = input.movement.y * GAME_CONFIG.PLAYER_SPEED_WALK * input.movementSpeed;
    }
    
    return movement;
  }
  
  // When receiving game state from server, reconcile predictions
  onGameStateReceived(serverPlayer: any): void {
    if (!serverPlayer) return;
    
    // Extract server data
    const serverPos = this.extractServerPosition(serverPlayer);
    const lastProcessedInput = serverPlayer.lastProcessedInput || 0;
    
    // Log reconciliation info
    const unprocessedCount = this.inputBuffer.filter(s => s.sequence > lastProcessedInput).length;
    if (unprocessedCount > 0) {

    }
    
    // Update acknowledged input
    this.lastAcknowledgedInput = lastProcessedInput;
    
    // Server position is authoritative for that input
    this.serverPosition = serverPos;
    
    // Remove old acknowledged inputs
    this.inputBuffer = this.inputBuffer.filter(
      snapshot => snapshot.sequence > lastProcessedInput
    );
    
    // If no unprocessed inputs, we're in sync!
    if (this.inputBuffer.length === 0) {
      const drift = Math.hypot(
        this.predictedPosition.x - serverPos.x,
        this.predictedPosition.y - serverPos.y
      );
      
      if (drift > 0.1) {
        console.log(`📍 No pending inputs, syncing to server position (drift: ${drift.toFixed(1)}px)`);
      }
      
      this.predictedPosition = { ...serverPos };
      this.applySmoothCorrection();
      return;
    }
    
    // Re-apply unprocessed inputs from server position
    let replayPosition = { ...serverPos };
    
    for (const snapshot of this.inputBuffer) {
      const movement = this.calculateMovement(snapshot.input);
      const deltaTime = 1/60;
      
      replayPosition.x += movement.x * deltaTime;
      replayPosition.y += movement.y * deltaTime;
      
      // Clamp to bounds
      replayPosition.x = Math.max(10, Math.min(GAME_CONFIG.GAME_WIDTH - 10, replayPosition.x));
      replayPosition.y = Math.max(10, Math.min(GAME_CONFIG.GAME_HEIGHT - 10, replayPosition.y));
      
      snapshot.predictedPosition = { ...replayPosition };
    }
    
    // Calculate prediction error
    const predictionError = Math.hypot(
      this.predictedPosition.x - replayPosition.x,
      this.predictedPosition.y - replayPosition.y
    );
    
    if (predictionError > 1) {
      console.log(`⚠️ Prediction error: ${predictionError.toFixed(1)}px, correcting...`);
    }
    
    // Update predicted position
    this.predictedPosition = replayPosition;
    
    // Apply smooth correction
    this.applySmoothCorrection();
  }
  
  // Extract position from various server formats
  private extractServerPosition(serverPlayer: any): Vector2 {
    if (serverPlayer.transform && serverPlayer.transform.position) {
      return serverPlayer.transform.position;
    } else if (serverPlayer.position) {
      return serverPlayer.position;
    } else if (typeof serverPlayer.x === 'number' && typeof serverPlayer.y === 'number') {
      return { x: serverPlayer.x, y: serverPlayer.y };
    }
    
    console.warn('⚠️ Could not extract position from server player data');
    return this.serverPosition;
  }
  
  // Apply smooth error correction
  private applySmoothCorrection(): void {
    const error = {
      x: this.predictedPosition.x - this.renderPosition.x,
      y: this.predictedPosition.y - this.renderPosition.y
    };
    
    const errorMagnitude = Math.sqrt(error.x * error.x + error.y * error.y);
    
    if (errorMagnitude < 0.5) {
      // Very small error - ignore
      return;
    } else if (errorMagnitude > 20) {
      // Large error - snap to correct position
      console.warn(`🚨 Large position error (${errorMagnitude.toFixed(1)}px), snapping to predicted position`);
      this.renderPosition = { ...this.predictedPosition };
      
      if (this.onPositionUpdate) {
        this.onPositionUpdate(this.renderPosition);
      }
    } else {
      // Smooth correction over next few frames
      this.smoothCorrection = error;
    }
  }
  
  // Update render position with smooth corrections
  updateRenderPosition(deltaTime: number): void {
    if (this.smoothCorrection) {
      const correctionSpeed = 8; // Adjust for smoothness
      const correction = {
        x: this.smoothCorrection.x * correctionSpeed * deltaTime,
        y: this.smoothCorrection.y * correctionSpeed * deltaTime
      };
      
      // Apply correction
      this.renderPosition.x += correction.x;
      this.renderPosition.y += correction.y;
      
      // Reduce remaining correction
      this.smoothCorrection.x -= correction.x;
      this.smoothCorrection.y -= correction.y;
      
      // Stop when close enough
      if (Math.abs(this.smoothCorrection.x) < 0.1 && 
          Math.abs(this.smoothCorrection.y) < 0.1) {
        this.smoothCorrection = null;
      }
    } else {
      // No correction needed, render at predicted position
      this.renderPosition = { ...this.predictedPosition };
    }
  }
  
  // Get current positions for debugging
  getDebugInfo(): any {
    return {
      serverPosition: this.serverPosition,
      predictedPosition: this.predictedPosition,
      renderPosition: this.renderPosition,
      lastAcknowledged: this.lastAcknowledgedInput,
      bufferSize: this.inputBuffer.length,
      hasCorrection: this.smoothCorrection !== null
    };
  }
  
  // Reset to a specific position
  reset(position: Vector2): void {
    this.serverPosition = { ...position };
    this.predictedPosition = { ...position };
    this.renderPosition = { ...position };
    this.inputBuffer = [];
    this.smoothCorrection = null;
    this.lastAcknowledgedInput = 0;
    
    if (this.onPositionUpdate) {
      this.onPositionUpdate(this.renderPosition);
    }
  }
} 
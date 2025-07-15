import { IGameSystem } from '../../../shared/interfaces/IGameSystem';
import { EVENTS } from '../../../shared/constants/index';

export interface InputState {
  keys: {
    w: boolean;
    a: boolean;
    s: boolean;
    d: boolean;
    shift: boolean;
    ctrl: boolean;
  };
  mouse: {
    x: number;
    y: number;
  };
  sequence: number;
  timestamp: number;
}

export class InputSystem implements IGameSystem {
  private scene: Phaser.Scene;
  private keys: any;
  private inputState: InputState;
  private sequence: number = 0;
  private networkTimer: number = 0;
  private readonly NETWORK_RATE = 1000 / 60; // 60 times per second (16.67ms)
  private playerPosition: { x: number; y: number } = { x: 240, y: 135 }; // Default center
  private lastInputState: InputState | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.inputState = {
      keys: {
        w: false,
        a: false,
        s: false,
        d: false,
        shift: false,
        ctrl: false
      },
      mouse: { x: 0, y: 0 },
      sequence: 0,
      timestamp: 0
    };
  }

  initialize(): void {
    // Set up keyboard input
    this.keys = this.scene.input.keyboard!.addKeys({
      w: Phaser.Input.Keyboard.KeyCodes.W,
      a: Phaser.Input.Keyboard.KeyCodes.A,
      s: Phaser.Input.Keyboard.KeyCodes.S,
      d: Phaser.Input.Keyboard.KeyCodes.D,
      shift: Phaser.Input.Keyboard.KeyCodes.SHIFT,
      ctrl: Phaser.Input.Keyboard.KeyCodes.CTRL
    });

    // Set up mouse input
    this.scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      this.inputState.mouse.x = pointer.x;
      this.inputState.mouse.y = pointer.y;
    });

    console.log('InputSystem initialized - sending input at 60Hz');
  }

  update(deltaTime: number): void {
    // Update key states
    this.inputState.keys.w = this.keys.w.isDown;
    this.inputState.keys.a = this.keys.a.isDown;
    this.inputState.keys.s = this.keys.s.isDown;
    this.inputState.keys.d = this.keys.d.isDown;
    this.inputState.keys.shift = this.keys.shift.isDown;
    this.inputState.keys.ctrl = this.keys.ctrl.isDown;

    // Update timestamp
    this.inputState.timestamp = Date.now();

    // Send input to server at 60Hz
    this.networkTimer += deltaTime;
    if (this.networkTimer >= this.NETWORK_RATE) {
      this.sendInputToServer();
      this.networkTimer = 0;
    }
  }

  destroy(): void {
    // Clean up input listeners
    this.scene.input.off('pointermove');
  }

  private sendInputToServer(): void {
    // Update sequence number
    this.inputState.sequence = this.sequence++;

    // Add debug logging with explicit key states
    const pressedKeys = Object.entries(this.inputState.keys)
      .filter(([key, pressed]) => pressed)
      .map(([key, pressed]) => key.toUpperCase())
      .join(', ') || 'none';

    console.log(`🎮 SENDING INPUT #${this.inputState.sequence}:`, {
      pressedKeys: pressedKeys,
      keys: {
        w: this.inputState.keys.w,
        a: this.inputState.keys.a,
        s: this.inputState.keys.s,
        d: this.inputState.keys.d,
        shift: this.inputState.keys.shift,
        ctrl: this.inputState.keys.ctrl
      },
      mouse: `${this.inputState.mouse.x}, ${this.inputState.mouse.y}`,
      timestamp: this.inputState.timestamp
    });

    // Emit to NetworkSystem
    this.scene.events.emit(EVENTS.PLAYER_INPUT, this.inputState);
  }

  // Get current input state (for local player movement)
  getInputState(): InputState {
    return { ...this.inputState };
  }

  // Update player position (called by GameScene)
  setPlayerPosition(x: number, y: number): void {
    this.playerPosition.x = x;
    this.playerPosition.y = y;
  }

  // Calculate which direction is "forward" based on mouse position
  private getForwardDirection(): 'w' | 'a' | 's' | 'd' {
    const mouseX = this.inputState.mouse.x;
    const mouseY = this.inputState.mouse.y;
    const playerX = this.playerPosition.x;
    const playerY = this.playerPosition.y;

    // Calculate angle from player to mouse
    const angle = Math.atan2(mouseY - playerY, mouseX - playerX);
    
    // Convert angle to degrees for easier understanding
    let degrees = (angle * 180 / Math.PI + 360) % 360;
    
    // Determine which direction is "forward" based on mouse angle
    // North: 315° to 45° (or -45° to 45°)
    // East: 45° to 135°
    // South: 135° to 225°
    // West: 225° to 315°
    
    if (degrees >= 315 || degrees < 45) {
      return 'd'; // East (right)
    } else if (degrees >= 45 && degrees < 135) {
      return 's'; // South (down)
    } else if (degrees >= 135 && degrees < 225) {
      return 'a'; // West (left)
    } else {
      return 'w'; // North (up)
    }
  }

  // Check if we're moving in the forward direction
  private isMovingForward(): boolean {
    const forwardDirection = this.getForwardDirection();
    return this.inputState.keys[forwardDirection];
  }

  // Calculate movement speed based on input
  getMovementSpeed(): number {
    const { keys } = this.inputState;
    
    // Sneak mode (50% speed)
    if (keys.ctrl) {
      return 0.5;
    }
    
    // Run mode (150% speed, when moving in the direction of the mouse)
    if (keys.shift && this.isMovingForward()) {
      return 1.5;
    }
    
    // Normal speed (100%)
    return 1.0;
  }

  // Get movement direction vector
  getMovementDirection(): { x: number; y: number } {
    const { keys } = this.inputState;
    let x = 0;
    let y = 0;

    if (keys.a) x -= 1;
    if (keys.d) x += 1;
    if (keys.w) y -= 1;
    if (keys.s) y += 1;

    // Normalize diagonal movement
    if (x !== 0 && y !== 0) {
      const length = Math.sqrt(x * x + y * y);
      x /= length;
      y /= length;
    }

    return { x, y };
  }

  // Get forward direction for debugging
  getForwardDirectionForDebug(): 'w' | 'a' | 's' | 'd' {
    return this.getForwardDirection();
  }
} 
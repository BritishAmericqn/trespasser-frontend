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
    r: boolean;    // reload
    g: boolean;    // grenade
    '1': boolean;  // weapon slots
    '2': boolean;
    '3': boolean;
    '4': boolean;
  };
  mouse: {
    x: number;
    y: number;
    buttons: number;
    leftPressed: boolean;  // NEW: track press events
    rightPressed: boolean; // NEW: for ADS
    leftReleased: boolean;
    rightReleased: boolean;
  };
  sequence: number;
  timestamp: number;
  position?: { x: number; y: number }; // NEW: Include position for sync
}

export class InputSystem implements IGameSystem {
  private scene: Phaser.Scene;
  private keys: any;
  private inputState: InputState;
  private sequence: number = 0;
  private networkTimer: number = 0;
  private readonly NETWORK_RATE = 1000 / 60; // 60 times per second (16.67ms)
  private playerPosition: { x: number; y: number } = { x: 240, y: 135 }; // Default center
  private playerRotation: number = 0; // Player's current rotation in radians
  private lastInputState: InputState | null = null;
  
  // Weapon-related properties
  private weaponSlots: (string | null)[] = [null, 'rifle', 'pistol', 'grenade', 'rocket'];
  private currentWeapon: number = 1;
  private isADS: boolean = false;
  private grenadeChargeStart: number = 0;
  private grenadeChargeLevel: number = 0;
  private lastMouseState: { left: boolean; right: boolean } = { left: false, right: false };
  private pendingWeaponFire: boolean = false;
  private pendingADSToggle: boolean = false;
  private isChargingGrenade: boolean = false; // Track if we're charging via left-click
  private weaponUI: any = null; // Reference to WeaponUI for ammo checking
  
  // Full-auto firing system
  private weaponRPM: { [key: string]: number } = {
    rifle: 600,   // 600 rounds per minute (10 rounds per second)
    pistol: 200,  // 200 rounds per minute (3.33 rounds per second) - semi-auto
    rocket: 60,   // 60 rounds per minute (1 round per second)
    grenade: 120  // 120 rounds per minute (2 rounds per second)
  };
  private weaponFireModes: { [key: string]: 'auto' | 'semi' } = {
    rifle: 'auto',
    pistol: 'semi',
    rocket: 'semi',
    grenade: 'semi'
  };
  private isMouseHeld: boolean = false;
  private lastFireTime: number = 0;
  private autoFireTimer: number | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.inputState = {
      keys: {
        w: false,
        a: false,
        s: false,
        d: false,
        shift: false,
        ctrl: false,
        r: false,
        g: false,
        '1': false,
        '2': false,
        '3': false,
        '4': false
      },
      mouse: { 
        x: 0, 
        y: 0, 
        buttons: 0,
        leftPressed: false,
        rightPressed: false,
        leftReleased: false,
        rightReleased: false
      },
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
      ctrl: Phaser.Input.Keyboard.KeyCodes.CTRL,
      r: Phaser.Input.Keyboard.KeyCodes.R,
      g: Phaser.Input.Keyboard.KeyCodes.G,
      one: Phaser.Input.Keyboard.KeyCodes.ONE,
      two: Phaser.Input.Keyboard.KeyCodes.TWO,
      three: Phaser.Input.Keyboard.KeyCodes.THREE,
      four: Phaser.Input.Keyboard.KeyCodes.FOUR
    });

    // Set up mouse input
    this.scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      // Get world coordinates instead of screen coordinates
      const worldPoint = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
      this.inputState.mouse.x = Math.round(worldPoint.x);
      this.inputState.mouse.y = Math.round(worldPoint.y);
      
      // Update player rotation based on mouse position
      this.updatePlayerRotation();
    });

    // Set up mouse button events
    this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.inputState.mouse.buttons = pointer.buttons;
      if (pointer.leftButtonDown()) {
        this.inputState.mouse.leftPressed = true;
        this.isMouseHeld = true;
        
        // Check if we should start grenade charging
        const weapon = this.weaponSlots[this.currentWeapon];
        if (weapon === 'grenade' && this.grenadeChargeStart === 0) {
          // Start grenade charging instead of immediate fire
          this.grenadeChargeStart = Date.now();
          this.isChargingGrenade = true;
        } else {
          // Fire immediately on first click
          this.pendingWeaponFire = true;
          
          // Start auto-fire timer for full-auto weapons
          if (weapon && this.weaponFireModes[weapon] === 'auto') {
            this.startAutoFire();
          }
        }
      }
      if (pointer.rightButtonDown()) {
        this.inputState.mouse.rightPressed = true;
        // Defer ADS toggle until update cycle
        this.pendingADSToggle = true;
      }
    });

    this.scene.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      this.inputState.mouse.buttons = pointer.buttons;
      if (pointer.leftButtonReleased()) {
        this.inputState.mouse.leftReleased = true;
        this.isMouseHeld = false;
        
        // Stop auto-fire when mouse is released
        this.stopAutoFire();
        
        // Check if we were charging a grenade
        if (this.isChargingGrenade && this.grenadeChargeStart > 0) {
          this.throwGrenade();
          this.isChargingGrenade = false;
        }
      }
      if (pointer.rightButtonReleased()) {
        this.inputState.mouse.rightReleased = true;
      }
    });


  }

  update(deltaTime: number): void {
    // Update key states
    this.inputState.keys.w = this.keys.w.isDown;
    this.inputState.keys.a = this.keys.a.isDown;
    this.inputState.keys.s = this.keys.s.isDown;
    this.inputState.keys.d = this.keys.d.isDown;
    this.inputState.keys.shift = this.keys.shift.isDown;
    this.inputState.keys.ctrl = this.keys.ctrl.isDown;
    this.inputState.keys.r = this.keys.r.isDown;
    this.inputState.keys.g = this.keys.g.isDown;
    this.inputState.keys['1'] = this.keys.one.isDown;
    this.inputState.keys['2'] = this.keys.two.isDown;
    this.inputState.keys['3'] = this.keys.three.isDown;
    this.inputState.keys['4'] = this.keys.four.isDown;

    // Handle weapon switching
    this.handleWeaponSwitching();
    
    // Handle grenade charging
    this.handleGrenadeCharging();
    
    // Handle reload
    this.handleReload();

    // Handle deferred actions (weapon fire, ADS) to ensure position is current
    if (this.pendingWeaponFire) {
      this.handleWeaponFire();
      this.pendingWeaponFire = false;
    }
    
    if (this.pendingADSToggle) {
      this.handleADSToggle();
      this.pendingADSToggle = false;
    }

    // Update timestamp
    this.inputState.timestamp = Date.now();

    // Reset press/release flags after processing
    this.inputState.mouse.leftPressed = false;
    this.inputState.mouse.rightPressed = false;
    this.inputState.mouse.leftReleased = false;
    this.inputState.mouse.rightReleased = false;

    // Always update sequence for local prediction
    this.inputState.sequence = this.sequence++;

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
    this.scene.input.off('pointerdown');
    this.scene.input.off('pointerup');
    // Clear pending actions
    this.pendingWeaponFire = false;
    this.pendingADSToggle = false;
    // Stop auto-fire timer
    this.stopAutoFire();
  }

  private sendInputToServer(): void {
    // Include position every 30 frames (0.5 seconds) for sync
    if (this.sequence % 30 === 0) {
      this.inputState.position = { ...this.playerPosition };

    } else {
      // Don't send position every frame to save bandwidth
      delete this.inputState.position;
    }

    // Emit to NetworkSystem - send raw input state, backend calculates movement
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
  
  // Set WeaponUI reference for auto-reload functionality
  setWeaponUI(weaponUI: any): void {
    this.weaponUI = weaponUI;
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

  // ===== WEAPON HANDLING METHODS =====
  
  private handleWeaponFire(): void {
    const weapon = this.weaponSlots[this.currentWeapon];
    if (!weapon) return;
    
    // Skip if it's a grenade - handled by charging system
    if (weapon === 'grenade') return;
    
    // Check current ammo and trigger auto-reload if empty
    if (this.weaponUI) {
      const ammoData = this.weaponUI.getCurrentWeaponAmmo();
      
      // If we're out of ammo and not already reloading, trigger auto-reload
      if (ammoData.current <= 0 && !ammoData.isReloading && ammoData.reserve > 0) {
        // Trigger reload instead of firing
        this.scene.events.emit('weapon:reload', {
          weaponType: weapon,
          timestamp: Date.now()
        });
        return; // Don't fire, just reload
      }
      
      // If we're out of ammo and out of reserves, just click sound (no auto-reload)
      if (ammoData.current <= 0) {
        return; // Don't fire or reload
      }
    }
    
    // Decrease ammo locally for immediate feedback
    this.scene.events.emit('weapon:ammo:decrease', {
      weaponType: weapon,
      amount: 1
    });
    
    // Calculate target position for bullet trail
    const targetPosition = { x: this.inputState.mouse.x, y: this.inputState.mouse.y };
    
    // Send weapon fire event to network system
    this.scene.events.emit('weapon:fire', {
      weaponType: weapon,
      position: this.playerPosition,
      targetPosition: targetPosition,
      direction: this.playerRotation, // Use stored rotation instead of recalculating
      isADS: this.isADS,
      timestamp: Date.now(),
      sequence: this.sequence++
    });
    
    // Concise weapon fire logging
    
  }

  private handleADSToggle(): void {
    this.isADS = !this.isADS;

    
    // Send ADS toggle event
    this.scene.events.emit('ads:toggle', {
      isADS: this.isADS,
      timestamp: Date.now()
    });
  }

  private handleWeaponSwitching(): void {
    // Check for weapon switching (1-4 keys)
    for (let i = 1; i <= 4; i++) {
      const keyPressed = this.inputState.keys[i.toString() as '1' | '2' | '3' | '4'];
      if (keyPressed && this.currentWeapon !== i) {
        this.switchWeapon(i);
        break;
      }
    }
  }

  private handleGrenadeCharging(): void {
    const gPressed = this.inputState.keys.g;
    const isCharging = this.grenadeChargeStart > 0;
    
    // G key can always charge/throw grenades regardless of selected weapon
    if (gPressed && !isCharging && !this.isChargingGrenade) {
      // Start charging via G key
      this.grenadeChargeStart = Date.now();
    } else if (!gPressed && isCharging && !this.isChargingGrenade) {
      // Release grenade via G key (only if not charging via mouse)
      this.throwGrenade();
    }
    
    // Update charge level if we're charging (either via G or left-click)
    if (isCharging) {
      const chargeDuration = Date.now() - this.grenadeChargeStart;
      const newChargeLevel = Math.min(5, Math.floor(chargeDuration / 200) + 1);
      
      // Only emit update if charge level changed
      if (newChargeLevel !== this.grenadeChargeLevel) {
        this.grenadeChargeLevel = newChargeLevel;
        this.scene.events.emit('grenade:charge:update', this.grenadeChargeLevel);
      }
    }
  }

  private handleReload(): void {
    if (this.keys.r.isDown && !this.lastInputState?.keys.r) {
      const weapon = this.weaponSlots[this.currentWeapon];
      if (!weapon) return;
      

      
      // Send reload event
      this.scene.events.emit('weapon:reload', {
        weaponType: weapon,
        timestamp: Date.now()
      });
    }
  }

  private switchWeapon(slot: number): void {
    const fromWeapon = this.weaponSlots[this.currentWeapon];
    const toWeapon = this.weaponSlots[slot];
    
    if (!toWeapon) return;
    
    // Stop auto-fire when switching weapons
    this.stopAutoFire();
    
    this.currentWeapon = slot;
    
    // Send weapon switch event
    this.scene.events.emit('weapon:switch', {
      fromWeapon,
      toWeapon,
      timestamp: Date.now()
    });
  }

  private throwGrenade(): void {
    // Calculate charge level
    const chargeDuration = Date.now() - this.grenadeChargeStart;
    this.grenadeChargeLevel = Math.min(5, Math.floor(chargeDuration / 200) + 1);
    
    // Switch to grenade if using G key and not already selected
    const wasUsingGKey = !this.isChargingGrenade;
    if (wasUsingGKey && this.weaponSlots[this.currentWeapon] !== 'grenade') {
      this.switchWeapon(3); // Switch to grenade slot
    }
    
    // Decrease ammo locally for immediate feedback
    this.scene.events.emit('weapon:ammo:decrease', {
      weaponType: 'grenade',
      amount: 1
    });
    
    // Calculate target position for projectile
    const targetPosition = { x: this.inputState.mouse.x, y: this.inputState.mouse.y };
    
    // Use weapon:fire event to ensure backend creates projectile tracking
    this.scene.events.emit('weapon:fire', {
      weaponType: 'grenade',
      position: this.playerPosition,
      targetPosition: targetPosition,
      direction: this.playerRotation,
      chargeLevel: this.grenadeChargeLevel, // Include charge level
      isADS: false,
      timestamp: Date.now(),
      sequence: this.sequence++
    });
    
    
    
    // Reset charge state
    this.grenadeChargeStart = 0;
    this.grenadeChargeLevel = 0;
    this.scene.events.emit('grenade:charge:update', 0);
  }

  private getAimDirection(): number {
    const mouseX = this.inputState.mouse.x;
    const mouseY = this.inputState.mouse.y;
    const playerX = this.playerPosition.x;
    const playerY = this.playerPosition.y;
    
    // Calculate angle from player to mouse
    return Math.atan2(mouseY - playerY, mouseX - playerX);
  }

  private updatePlayerRotation(): void {
    const dx = this.inputState.mouse.x - this.playerPosition.x;
    const dy = this.inputState.mouse.y - this.playerPosition.y;
    
    // Prevent atan2(0,0) issues when mouse is very close to player
    if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) {
      this.playerRotation = Math.atan2(dy, dx);
    }
  }

  // ===== PUBLIC WEAPON GETTERS =====
  
  getCurrentWeapon(): string | null {
    return this.weaponSlots[this.currentWeapon];
  }

  getGrenadeChargeLevel(): number {
    return this.grenadeChargeLevel;
  }

  isAimingDownSights(): boolean {
    return this.isADS;
  }
  
  // ===== AUTO-FIRE METHODS =====
  
  private startAutoFire(): void {
    const weapon = this.weaponSlots[this.currentWeapon];
    if (!weapon || this.weaponFireModes[weapon] !== 'auto') return;
    
    // Clear any existing timer
    this.stopAutoFire();
    
    // Calculate fire interval based on RPM
    const rpm = this.weaponRPM[weapon] || 600;
    const fireInterval = (60 / rpm) * 1000; // Convert RPM to milliseconds between shots
    
    // Set up recurring timer for auto-fire
    this.autoFireTimer = window.setInterval(() => {
      // Stop if mouse no longer held or weapon changed
      if (!this.isMouseHeld || this.weaponSlots[this.currentWeapon] !== weapon) {
        this.stopAutoFire();
        return;
      }
      
      // Check if we can fire (has ammo, not reloading)
      if (this.weaponUI) {
        const ammoData = this.weaponUI.getCurrentWeaponAmmo();
        if (ammoData.current <= 0 || ammoData.isReloading) {
          this.stopAutoFire();
          return;
        }
      }
      
      // Fire the weapon
      this.pendingWeaponFire = true;
    }, fireInterval);
  }
  
  private stopAutoFire(): void {
    if (this.autoFireTimer !== null) {
      clearInterval(this.autoFireTimer);
      this.autoFireTimer = null;
    }
  }
} 
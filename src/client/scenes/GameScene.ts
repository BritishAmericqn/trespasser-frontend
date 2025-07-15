import { InputSystem } from '../systems/InputSystem';
import { NetworkSystem } from '../systems/NetworkSystem';
import { GAME_CONFIG } from '../../../shared/constants/index';

export class GameScene extends Phaser.Scene {
  private inputSystem!: InputSystem;
  private networkSystem!: NetworkSystem;
  private player!: Phaser.GameObjects.Rectangle;
  private playerPosition: { x: number; y: number };
  private connectionStatus!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'GameScene' });
    this.playerPosition = { 
      x: GAME_CONFIG.GAME_WIDTH / 2, 
      y: GAME_CONFIG.GAME_HEIGHT / 2 
    };
  }

  create(): void {
    console.log('GameScene created');
    
    // Create background
    this.add.rectangle(0, 0, GAME_CONFIG.GAME_WIDTH, GAME_CONFIG.GAME_HEIGHT, 0x2d2d2d)
      .setOrigin(0, 0);

    // Create player sprite (simple colored square)
    this.player = this.add.rectangle(
      this.playerPosition.x,
      this.playerPosition.y,
      20,
      20,
      0x00ff00
    );

    // Create connection status text
    this.connectionStatus = this.add.text(10, 10, 'Connecting...', {
      fontSize: '12px',
      color: '#ffffff'
    });

    // Initialize systems
    this.inputSystem = new InputSystem(this);
    this.networkSystem = new NetworkSystem(this);

    this.inputSystem.initialize();
    this.networkSystem.initialize();

    // Set up network event listeners
    this.setupNetworkListeners();

    // Create UI elements
    this.createUI();
  }

  update(time: number, delta: number): void {
    // Update systems
    this.inputSystem.update(delta);
    this.networkSystem.update(delta);

    // Update player position in InputSystem
    this.inputSystem.setPlayerPosition(this.playerPosition.x, this.playerPosition.y);

    // Update local player movement for immediate feedback
    this.updateLocalPlayer(delta);
  }

  private setupNetworkListeners(): void {
    // Connection status updates
    this.events.on('network:connected', () => {
      this.connectionStatus.setText('Connected to server');
      this.connectionStatus.setColor('#00ff00');
    });

    this.events.on('network:disconnected', (reason: string) => {
      this.connectionStatus.setText(`Disconnected: ${reason}`);
      this.connectionStatus.setColor('#ff0000');
    });

    this.events.on('network:connectionFailed', () => {
      this.connectionStatus.setText('Connection failed');
      this.connectionStatus.setColor('#ff0000');
    });

    // Game state updates from server
    this.events.on('network:gameState', (gameState: any) => {
      // Handle server game state updates here
      console.log('Received game state:', gameState);
    });

    // Player join/leave events
    this.events.on('network:playerJoined', (playerData: any) => {
      console.log('Player joined:', playerData);
    });

    this.events.on('network:playerLeft', (playerData: any) => {
      console.log('Player left:', playerData);
    });
  }

  private updateLocalPlayer(delta: number): void {
    // Get input state for local movement
    const direction = this.inputSystem.getMovementDirection();
    const speed = this.inputSystem.getMovementSpeed();
    
    // Calculate movement
    const moveSpeed = GAME_CONFIG.PLAYER_SPEED_WALK * speed * (delta / 1000);
    
    // Update position
    this.playerPosition.x += direction.x * moveSpeed;
    this.playerPosition.y += direction.y * moveSpeed;

    // Keep player within bounds
    this.playerPosition.x = Phaser.Math.Clamp(
      this.playerPosition.x, 
      10, 
      GAME_CONFIG.GAME_WIDTH - 10
    );
    this.playerPosition.y = Phaser.Math.Clamp(
      this.playerPosition.y, 
      10, 
      GAME_CONFIG.GAME_HEIGHT - 10
    );

    // Update sprite position
    this.player.setPosition(this.playerPosition.x, this.playerPosition.y);

    // Change player color based on movement speed
    if (speed === 0.5) {
      this.player.setFillStyle(0x0000ff); // Blue for sneaking
    } else if (speed === 1.5) {
      this.player.setFillStyle(0xff0000); // Red for running
    } else {
      this.player.setFillStyle(0x00ff00); // Green for normal
    }
  }

  private createUI(): void {
    // Create input state display for debugging
    const inputText = this.add.text(10, 30, '', {
      fontSize: '10px',
      color: '#ffffff'
    });

    // Update input display every frame
    this.events.on('update', () => {
      if (this.inputSystem) {
        const inputState = this.inputSystem.getInputState();
        const direction = this.inputSystem.getMovementDirection();
        const speed = this.inputSystem.getMovementSpeed();
        const forwardDir = this.inputSystem.getForwardDirectionForDebug();
        
        // Convert direction key to arrow for better visualization
        const directionArrows = {
          'w': '↑',
          'a': '←',
          's': '↓',
          'd': '→'
        };
        
        inputText.setText([
          `Keys: W:${inputState.keys.w} A:${inputState.keys.a} S:${inputState.keys.s} D:${inputState.keys.d}`,
          `Modifiers: Shift:${inputState.keys.shift} Ctrl:${inputState.keys.ctrl}`,
          `Mouse: ${inputState.mouse.x}, ${inputState.mouse.y}`,
          `Forward Dir: ${directionArrows[forwardDir]} (${forwardDir.toUpperCase()})`,
          `Direction: ${direction.x.toFixed(2)}, ${direction.y.toFixed(2)}`,
          `Speed: ${(speed * 100).toFixed(0)}%`,
          `Position: ${this.playerPosition.x.toFixed(0)}, ${this.playerPosition.y.toFixed(0)}`
        ].join('\n'));
      }
    });

    // Create movement speed legend
    this.add.text(10, GAME_CONFIG.GAME_HEIGHT - 80, [
      'Movement:',
      '🔵 Ctrl = Sneak (50%)',
      '🟢 Normal = Walk (100%)',
      '🔴 Shift+Forward = Run (150%)',
      '➡️ Forward = Direction of mouse'
    ].join('\n'), {
      fontSize: '10px',
      color: '#cccccc'
    });
  }

  shutdown(): void {
    // Clean up systems
    if (this.inputSystem) {
      this.inputSystem.destroy();
    }
    if (this.networkSystem) {
      this.networkSystem.destroy();
    }
  }
} 
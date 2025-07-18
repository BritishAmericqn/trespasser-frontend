import { GAME_CONFIG } from '../../../shared/constants/index';
import { NetworkSystem, ConnectionState, ServerInfo } from '../systems/NetworkSystem';
import NetworkSystemSingleton from '../systems/NetworkSystemSingleton';

export class ServerConnectionSceneText extends Phaser.Scene {
  private networkSystem!: NetworkSystem;
  
  // UI Elements
  private mainContainer!: Phaser.GameObjects.Container;
  private serverInput!: Phaser.GameObjects.Text;
  private passwordInput!: Phaser.GameObjects.Text;
  private serverInputBg!: Phaser.GameObjects.Rectangle;
  private passwordInputBg!: Phaser.GameObjects.Rectangle;
  private connectButton!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private errorText!: Phaser.GameObjects.Text;
  
  // Input state
  private serverText: string = '';
  private passwordText: string = '';
  private activeInput: 'server' | 'password' | null = null;
  private currentConnectionState: ConnectionState = ConnectionState.DISCONNECTED;
  private isPasswordRequired: boolean = false;
  private wasAlreadyConnected: boolean = false;

  constructor() {
    super({ key: 'ServerConnectionSceneText' });
  }

  create(): void {
    // Create dark background
    this.add.rectangle(0, 0, GAME_CONFIG.GAME_WIDTH, GAME_CONFIG.GAME_HEIGHT, 0x111111)
      .setOrigin(0, 0);

    // Get or create NetworkSystem singleton
    const isFirstTime = !NetworkSystemSingleton.hasInstance();
    this.networkSystem = NetworkSystemSingleton.getInstance(this);
    
    if (isFirstTime) {
      this.networkSystem.initialize();
    }
    
    // Check current connection state
    const currentState = this.networkSystem.getConnectionState();
    console.log('ServerConnectionSceneText: Current connection state:', currentState);
    
    // Check if already connected
    if (currentState === ConnectionState.AUTHENTICATED) {
      console.log('Already connected - staying in server connection scene');
      this.currentConnectionState = ConnectionState.AUTHENTICATED;
      this.wasAlreadyConnected = true;
    }
    
    // Setup network event listeners
    this.setupNetworkListeners();
    
    // Create the main UI
    this.createUI();
    
    // Load saved server URL
    this.loadSavedServerUrl();
    
    // Setup keyboard input
    this.setupKeyboardInput();
  }

  private setupNetworkListeners(): void {
    this.events.on('network:connectionStateChanged', (state: ConnectionState) => {
      this.currentConnectionState = state;
      this.updateConnectionUI();
    });
    
    this.events.on('network:connectionError', (error: string) => {
      this.showError(error);
    });
    
    this.events.on('network:gameReady', () => {
      console.log('network:gameReady event received, wasAlreadyConnected:', this.wasAlreadyConnected);
      // Don't auto-transition if we were already connected when entering this scene
      if (!this.wasAlreadyConnected) {
        this.saveServerUrl();
        this.scene.start('ConfigureScene');
      }
    });
  }

  private createUI(): void {
    // Title
    const title = this.add.text(GAME_CONFIG.GAME_WIDTH / 2, 20, 'SERVER CONNECTION', {
      fontSize: '16px',
      color: '#00ff00',
      fontStyle: 'bold',
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    // Create visual container for connection form
    const containerWidth = 300;
    const containerHeight = 160;
    const containerX = GAME_CONFIG.GAME_WIDTH / 2;
    const containerY = GAME_CONFIG.GAME_HEIGHT / 2;

    const connectionBox = this.add.rectangle(containerX, containerY, containerWidth, containerHeight, 0x222222);
    connectionBox.setStrokeStyle(2, 0x444444);

    // Main container for all connection elements
    this.mainContainer = this.add.container(containerX, containerY);

    // Server address section
    const serverLabel = this.add.text(0, -50, 'Server Address:', {
      fontSize: '10px',
      color: '#ffffff',
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    // Server input background and text
    this.serverInputBg = this.add.rectangle(0, -25, 240, 24, 0x333333);
    this.serverInputBg.setStrokeStyle(2, 0x555555);
    this.serverInputBg.setInteractive();
    this.serverInputBg.on('pointerdown', () => this.setActiveInput('server'));

    this.serverInput = this.add.text(0, -25, 'http://localhost:3000', {
      fontSize: '10px',
      color: '#ffffff',
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    // Password section
    const passwordLabel = this.add.text(0, 5, 'Password (optional):', {
      fontSize: '10px',
      color: '#ffffff',
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    // Password input background and text
    this.passwordInputBg = this.add.rectangle(0, 30, 240, 24, 0x333333);
    this.passwordInputBg.setStrokeStyle(2, 0x555555);
    this.passwordInputBg.setInteractive();
    this.passwordInputBg.on('pointerdown', () => this.setActiveInput('password'));

    this.passwordInput = this.add.text(0, 30, '', {
      fontSize: '10px',
      color: '#888888',
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    // Connect button
    this.connectButton = this.add.text(0, 60, 'CONNECT', {
      fontSize: '12px',
      color: '#ffffff',
      backgroundColor: '#006600',
      padding: { x: 20, y: 6 },
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    this.connectButton.setInteractive({ useHandCursor: true });
    this.connectButton.on('pointerover', () => {
      if (this.currentConnectionState === ConnectionState.DISCONNECTED || this.currentConnectionState === ConnectionState.FAILED) {
        this.connectButton.setStyle({ backgroundColor: '#008800' });
      } else if (this.currentConnectionState === ConnectionState.AUTHENTICATED) {
        this.connectButton.setStyle({ backgroundColor: '#aa4400' });
      }
    });
    this.connectButton.on('pointerout', () => {
      if (this.currentConnectionState === ConnectionState.DISCONNECTED || this.currentConnectionState === ConnectionState.FAILED) {
        this.connectButton.setStyle({ backgroundColor: '#006600' });
      } else if (this.currentConnectionState === ConnectionState.AUTHENTICATED) {
        this.connectButton.setStyle({ backgroundColor: '#884400' });
      }
    });
    this.connectButton.on('pointerdown', () => this.handleConnectClick());

    // Add elements to main container
    this.mainContainer.add([
      serverLabel, this.serverInputBg, this.serverInput,
      passwordLabel, this.passwordInputBg, this.passwordInput,
      this.connectButton
    ]);

    // Status text below the container
    this.statusText = this.add.text(containerX, containerY + 100, 'Ready to connect', {
      fontSize: '9px',
      color: '#888888',
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    // Error text
    this.errorText = this.add.text(containerX, containerY + 120, '', {
      fontSize: '9px',
      color: '#ff4444',
      align: 'center',
      wordWrap: { width: 280 },
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    // Back button
    const backButton = this.add.text(60, GAME_CONFIG.GAME_HEIGHT - 20, 'BACK', {
      fontSize: '10px',
      color: '#ffffff',
      backgroundColor: '#333333',
      padding: { x: 15, y: 5 },
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    backButton.setInteractive({ useHandCursor: true });
    backButton.on('pointerover', () => backButton.setStyle({ backgroundColor: '#555555' }));
    backButton.on('pointerout', () => backButton.setStyle({ backgroundColor: '#333333' }));
    backButton.on('pointerdown', () => this.scene.start('MenuScene'));

    // Set initial values
    this.serverText = 'http://localhost:3000';
    this.updateInputDisplay();
    
    // Update UI to reflect current connection state
    this.updateConnectionUI();
  }

  private setupKeyboardInput(): void {
    this.input.keyboard!.on('keydown', (event: KeyboardEvent) => {
      if (!this.activeInput) return;

      if (event.key === 'Tab') {
        event.preventDefault();
        this.setActiveInput(this.activeInput === 'server' ? 'password' : 'server');
        return;
      }

      if (event.key === 'Enter') {
        this.handleConnectClick();
        return;
      }

      if (event.key === 'Escape') {
        this.setActiveInput(null);
        return;
      }

      if (event.key === 'Backspace') {
        if (this.activeInput === 'server') {
          this.serverText = this.serverText.slice(0, -1);
        } else {
          this.passwordText = this.passwordText.slice(0, -1);
        }
        this.updateInputDisplay();
        return;
      }

      // Regular character input
      if (event.key.length === 1) {
        if (this.activeInput === 'server') {
          this.serverText += event.key;
        } else {
          this.passwordText += event.key;
        }
        this.updateInputDisplay();
        this.checkServerRequirements();
      }
    });
  }

  private setActiveInput(input: 'server' | 'password' | null): void {
    this.activeInput = input;
    
    // Update visual indicators
    this.serverInputBg.setStrokeStyle(2, this.activeInput === 'server' ? 0x00ff00 : 0x555555);
    this.passwordInputBg.setStrokeStyle(2, this.activeInput === 'password' ? 0x00ff00 : 0x555555);
  }

  private updateInputDisplay(): void {
    // Update server input display
    const serverDisplay = this.serverText || 'http://localhost:3000';
    this.serverInput.setText(serverDisplay);
    this.serverInput.setColor(this.serverText ? '#ffffff' : '#888888');

    // Update password input display (show asterisks)
    const passwordDisplay = this.passwordText ? '*'.repeat(this.passwordText.length) : 'Enter if required';
    this.passwordInput.setText(passwordDisplay);
    this.passwordInput.setColor(this.passwordText ? '#ffffff' : '#888888');
  }

  private async checkServerRequirements(): Promise<void> {
    if (!this.serverText) {
      this.isPasswordRequired = false;
      this.statusText.setText('Enter server address');
      this.statusText.setStyle({ color: '#888888' });
      return;
    }

    try {
      const serverInfo = await this.networkSystem.checkServerStatus(this.serverText);
      this.isPasswordRequired = serverInfo.passwordRequired;
      
      const passwordText = serverInfo.passwordRequired ? ' (Password Required)' : '';
      this.statusText.setText(`Server: ${serverInfo.players}/${serverInfo.maxPlayers} players${passwordText}`);
      this.statusText.setStyle({ color: '#00ff00' });
      
      this.passwordInputBg.setStrokeStyle(2, serverInfo.passwordRequired ? 0xffaa00 : 0x555555);
      
    } catch (error) {
      this.isPasswordRequired = false;
      this.statusText.setText('Server not responding');
      this.statusText.setStyle({ color: '#ff4444' });
      
      this.passwordInputBg.setStrokeStyle(2, 0x555555);
    }
  }

  private async handleConnectClick(): Promise<void> {
    // If already authenticated, proceed to configure scene
    if (this.currentConnectionState === ConnectionState.AUTHENTICATED) {
      this.scene.start('ConfigureScene');
      return;
    }

    if (this.currentConnectionState === ConnectionState.CONNECTING || 
        this.currentConnectionState === ConnectionState.AUTHENTICATING) {
      return;
    }

    if (!this.serverText) {
      this.showError('Please enter a server address');
      return;
    }

    this.clearError();
    
    try {
      await this.networkSystem.connectToServer(this.serverText, this.passwordText);
    } catch (error) {
      this.showError(`Connection failed: ${error}`);
    }
  }

  private updateConnectionUI(): void {
    switch (this.currentConnectionState) {
      case ConnectionState.DISCONNECTED:
        this.statusText.setText('Ready to connect');
        this.statusText.setStyle({ color: '#888888' });
        this.connectButton.setText('CONNECT');
        this.connectButton.setStyle({ backgroundColor: '#006600' });
        break;

      case ConnectionState.CONNECTING:
        this.statusText.setText('Connecting...');
        this.statusText.setStyle({ color: '#ffaa00' });
        this.connectButton.setText('CONNECTING...');
        this.connectButton.setStyle({ backgroundColor: '#666666' });
        break;

      case ConnectionState.CONNECTED:
        this.statusText.setText('Connected');
        this.statusText.setStyle({ color: '#00ff00' });
        this.connectButton.setText('CONNECTED');
        this.connectButton.setStyle({ backgroundColor: '#008800' });
        break;

      case ConnectionState.AUTHENTICATING:
        this.statusText.setText('Authenticating...');
        this.statusText.setStyle({ color: '#0088ff' });
        this.connectButton.setText('AUTHENTICATING...');
        this.connectButton.setStyle({ backgroundColor: '#004488' });
        break;

      case ConnectionState.AUTHENTICATED:
        this.statusText.setText('Connected! Click to proceed to game setup');
        this.statusText.setStyle({ color: '#00ff00' });
        this.connectButton.setText('PROCEED TO GAME');
        this.connectButton.setStyle({ backgroundColor: '#884400' });
        break;

      case ConnectionState.FAILED:
        this.statusText.setText('Connection failed');
        this.statusText.setStyle({ color: '#ff4444' });
        this.connectButton.setText('RETRY');
        this.connectButton.setStyle({ backgroundColor: '#006600' });
        break;
    }
  }

  private showError(message: string): void {
    let displayMessage = message;
    if (message.includes('Server is not responding')) {
      displayMessage = 'Server not responding.\nCheck server address.';
    } else if (message.includes('Failed to connect')) {
      displayMessage = 'Connection failed.\nVerify server details.';
    }
    
    this.errorText.setText(displayMessage);
    this.errorText.setVisible(true);
  }

  private clearError(): void {
    this.errorText.setText('');
    this.errorText.setVisible(false);
  }

  private loadSavedServerUrl(): void {
    try {
      const savedUrl = localStorage.getItem('trespasser_server_url');
      if (savedUrl) {
        this.serverText = savedUrl;
      } else {
        this.serverText = this.getDefaultServerUrl();
      }
      this.updateInputDisplay();
      this.checkServerRequirements();
    } catch (error) {
      // localStorage might not be available
    }
  }

  private saveServerUrl(): void {
    try {
      if (this.serverText) {
        localStorage.setItem('trespasser_server_url', this.serverText);
      }
    } catch (error) {
      // localStorage might not be available
    }
  }

  private getDefaultServerUrl(): string {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:3000';
    } else {
      return `http://${hostname}:3000`;
    }
  }

  shutdown(): void {
    // NetworkSystem is a singleton, preserve it
  }
} 
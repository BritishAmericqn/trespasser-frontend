import { GAME_CONFIG } from '../../../shared/constants/index';
import { NetworkSystem, ConnectionState, ServerInfo } from '../systems/NetworkSystem';
import NetworkSystemSingleton from '../systems/NetworkSystemSingleton';

export class ServerConnectionScene extends Phaser.Scene {
  private networkSystem!: NetworkSystem;
  
  // UI Elements
  private mainContainer!: Phaser.GameObjects.Container;
  private serverUrlInput!: Phaser.GameObjects.DOMElement;
  private passwordInput!: Phaser.GameObjects.DOMElement;
  private connectButton!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private errorText!: Phaser.GameObjects.Text;
  private loadingSpinner!: Phaser.GameObjects.Graphics;
  private spinnerAngle: number = 0;
  
  // Connection state
  private currentConnectionState: ConnectionState = ConnectionState.DISCONNECTED;
  private isPasswordRequired: boolean = false;

  constructor() {
    super({ key: 'ServerConnectionScene' });
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
    
    // Setup network event listeners
    this.setupNetworkListeners();
    
    // Create the main UI
    this.createUI();
    
    // Load saved server URL
    this.loadSavedServerUrl();
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
      this.saveServerUrl();
      this.scene.start('ConfigureScene');
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

    console.log('Container position:', containerX, containerY);
    console.log('Game size:', GAME_CONFIG.GAME_WIDTH, GAME_CONFIG.GAME_HEIGHT);

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

    // Create inputs using createFromHTML with exact positioning
    const serverInputHTML = `
      <div style="width: 240px; height: 24px; position: relative; left: 50%; transform: translateX(-50%);">
        <input type="text" 
               style="width: 100%; height: 100%; padding: 4px 8px; font-size: 10px; font-family: monospace; background: #333; color: #fff; border: 2px solid #555; border-radius: 0; text-align: center; box-sizing: border-box;" 
               placeholder="http://localhost:3000" />
      </div>
    `;
    
    console.log('DOM position for server input:', containerX, containerY - 25);
    this.serverUrlInput = this.add.dom(containerX, containerY - 25).createFromHTML(serverInputHTML);

    // Password section
    const passwordLabel = this.add.text(0, 5, 'Password (optional):', {
      fontSize: '10px',
      color: '#ffffff',
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    const passwordInputHTML = `
      <div style="width: 240px; height: 24px; position: relative; left: 50%; transform: translateX(-50%);">
        <input type="password" 
               style="width: 100%; height: 100%; padding: 4px 8px; font-size: 10px; font-family: monospace; background: #333; color: #fff; border: 2px solid #555; border-radius: 0; text-align: center; box-sizing: border-box;" 
               placeholder="Enter if required" />
      </div>
    `;
    
    console.log('DOM position for password input:', containerX, containerY + 30);
    this.passwordInput = this.add.dom(containerX, containerY + 30).createFromHTML(passwordInputHTML);

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
      }
    });
    this.connectButton.on('pointerout', () => {
      if (this.currentConnectionState === ConnectionState.DISCONNECTED || this.currentConnectionState === ConnectionState.FAILED) {
        this.connectButton.setStyle({ backgroundColor: '#006600' });
      }
    });
    this.connectButton.on('pointerdown', () => this.handleConnectClick());

    // Add text elements to main container (DOM elements positioned absolutely)
    this.mainContainer.add([serverLabel, passwordLabel, this.connectButton]);

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

    // Loading spinner
    this.loadingSpinner = this.add.graphics();
    this.loadingSpinner.setVisible(false);

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

    // Setup input listeners
    this.setupInputListeners();
  }

  private setupInputListeners(): void {
    const serverInput = this.serverUrlInput.node.querySelector('input') as HTMLInputElement;
    const passwordInput = this.passwordInput.node.querySelector('input') as HTMLInputElement;
    
    serverInput.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        this.handleConnectClick();
      }
    });

    passwordInput.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        this.handleConnectClick();
      }
    });

    serverInput.addEventListener('input', () => {
      this.clearError();
      this.checkServerRequirements();
    });
  }

  private async checkServerRequirements(): Promise<void> {
    const serverUrl = (this.serverUrlInput.node.querySelector('input') as HTMLInputElement).value.trim();
    
    if (!serverUrl) {
      this.isPasswordRequired = false;
      this.statusText.setText('Enter server address');
      this.statusText.setStyle({ color: '#888888' });
      return;
    }

    try {
      const serverInfo = await this.networkSystem.checkServerStatus(serverUrl);
      this.isPasswordRequired = serverInfo.passwordRequired;
      
      const passwordText = serverInfo.passwordRequired ? ' (Password Required)' : '';
      this.statusText.setText(`Server: ${serverInfo.players}/${serverInfo.maxPlayers} players${passwordText}`);
      this.statusText.setStyle({ color: '#00ff00' });
      
      const passwordInput = this.passwordInput.node.querySelector('input') as HTMLInputElement;
      if (serverInfo.passwordRequired) {
        passwordInput.style.borderColor = '#ffaa00';
        passwordInput.placeholder = 'Password required';
      } else {
        passwordInput.style.borderColor = '#555';
        passwordInput.placeholder = 'Enter if required';
      }
      
    } catch (error) {
      this.isPasswordRequired = false;
      this.statusText.setText('Server not responding');
      this.statusText.setStyle({ color: '#ff4444' });
      
      const passwordInput = this.passwordInput.node.querySelector('input') as HTMLInputElement;
      passwordInput.style.borderColor = '#555';
      passwordInput.placeholder = 'Enter if required';
    }
  }

  private async handleConnectClick(): Promise<void> {
    if (this.currentConnectionState === ConnectionState.CONNECTING || 
        this.currentConnectionState === ConnectionState.AUTHENTICATING) {
      return;
    }

    const serverUrl = (this.serverUrlInput.node.querySelector('input') as HTMLInputElement).value.trim();
    const password = (this.passwordInput.node.querySelector('input') as HTMLInputElement).value;

    if (!serverUrl) {
      this.showError('Please enter a server address');
      return;
    }

    this.clearError();
    
    try {
      await this.networkSystem.connectToServer(serverUrl, password);
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
        this.loadingSpinner.setVisible(false);
        break;

      case ConnectionState.CONNECTING:
        this.statusText.setText('Connecting...');
        this.statusText.setStyle({ color: '#ffaa00' });
        this.connectButton.setText('CONNECTING...');
        this.connectButton.setStyle({ backgroundColor: '#666666' });
        this.loadingSpinner.setVisible(true);
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
        this.statusText.setText('Success! Starting game...');
        this.statusText.setStyle({ color: '#00ff00' });
        this.connectButton.setText('SUCCESS');
        this.connectButton.setStyle({ backgroundColor: '#008800' });
        break;

      case ConnectionState.FAILED:
        this.statusText.setText('Connection failed');
        this.statusText.setStyle({ color: '#ff4444' });
        this.connectButton.setText('RETRY');
        this.connectButton.setStyle({ backgroundColor: '#006600' });
        this.loadingSpinner.setVisible(false);
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
      const serverInput = this.serverUrlInput.node.querySelector('input') as HTMLInputElement;
      if (!serverInput) return;
      
      const savedUrl = localStorage.getItem('trespasser_server_url');
      if (savedUrl) {
        serverInput.value = savedUrl;
      } else {
        const defaultUrl = this.getDefaultServerUrl();
        serverInput.value = defaultUrl;
      }
      this.checkServerRequirements();
    } catch (error) {
      // localStorage might not be available
    }
  }

  private saveServerUrl(): void {
    try {
      const serverUrl = (this.serverUrlInput.node.querySelector('input') as HTMLInputElement).value.trim();
      if (serverUrl) {
        localStorage.setItem('trespasser_server_url', serverUrl);
      }
    } catch (error) {
      // localStorage might not be available
    }
  }

  private getDefaultServerUrl(): string {
    const hostname = window.location.hostname;
    let serverUrl: string;
    
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      serverUrl = 'http://localhost:3000';
    } else {
      serverUrl = `http://${hostname}:3000`;
    }
    
    return serverUrl;
  }

  update(): void {
    if (this.loadingSpinner.visible) {
      this.spinnerAngle += 0.1;
      this.loadingSpinner.clear();
      this.loadingSpinner.lineStyle(2, 0x00ff00);
      this.loadingSpinner.arc(
        GAME_CONFIG.GAME_WIDTH / 2, 
        GAME_CONFIG.GAME_HEIGHT / 2 + 50, 
        10, 
        this.spinnerAngle, 
        this.spinnerAngle + Math.PI / 2
      );
    }
  }

  shutdown(): void {
    // NetworkSystem is a singleton, preserve it
  }
} 
import { io, Socket } from 'socket.io-client';
import { IGameSystem } from '../../../shared/interfaces/IGameSystem';
import { EVENTS, GAME_CONFIG } from '../../../shared/constants/index';
import { InputState } from './InputSystem';

// Connection states enum
export enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting', 
  CONNECTED = 'connected',
  AUTHENTICATING = 'authenticating',
  AUTHENTICATED = 'authenticated',
  FAILED = 'failed'
}

export interface ServerInfo {
  game: string;
  status: string;
  players: number;
  maxPlayers: number;
  passwordRequired: boolean;
  uptime: number;
}

export class NetworkSystem implements IGameSystem {
  private scene: Phaser.Scene;
  private socket: Socket | null = null;
  private isConnected: boolean = false;
  private connectionAttempts: number = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private inputsSent: number = 0;
  private connectionState: ConnectionState = ConnectionState.DISCONNECTED;
  private currentServerUrl: string = '';
  private authenticationTimeout: number | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  initialize(): void {
    // Don't auto-connect anymore - wait for explicit connection request
    this.setupEventListeners();
  }

  update(deltaTime: number): void {
    // NetworkSystem doesn't need regular updates
    // All communication is event-driven
  }

  destroy(): void {
    console.log('NetworkSystem: Destroying network connection');
    
    // Clear scene event listeners
    this.scene.events.off(EVENTS.PLAYER_INPUT);
    this.scene.events.off('weapon:fire');
    this.scene.events.off('weapon:switch');
    this.scene.events.off('weapon:reload');
    this.scene.events.off('ads:toggle');
    
    // Disconnect socket
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    if (this.authenticationTimeout) {
      clearTimeout(this.authenticationTimeout);
    }
    
    this.connectionState = ConnectionState.DISCONNECTED;
    this.isConnected = false;
  }

  // Public method to connect to a specific server
  async connectToServer(serverUrl: string, password: string = ''): Promise<void> {
    this.currentServerUrl = serverUrl;
    console.log(`🔌 Attempting to connect to backend at: ${serverUrl}`);
    this.setConnectionState(ConnectionState.CONNECTING);
    
    try {
      // First check server info to see if password is required
      const serverInfo = await this.checkServerStatus(serverUrl);
      
      this.socket = io(serverUrl, {
        transports: ['websocket'],
        timeout: 5000,
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: this.MAX_RECONNECT_ATTEMPTS
      });

      this.setupSocketListeners();
      
      // Handle authentication if needed
      this.socket.on('connect', () => {
        this.isConnected = true;
        this.connectionAttempts = 0;
        this.setConnectionState(ConnectionState.CONNECTED);
        
        if (serverInfo.passwordRequired) {
          this.setConnectionState(ConnectionState.AUTHENTICATING);
          this.socket!.emit('authenticate', password);
          
          // Set 5-second timeout for authentication
          this.authenticationTimeout = window.setTimeout(() => {
            this.handleAuthenticationTimeout();
          }, 5000);
        } else {
          this.setConnectionState(ConnectionState.AUTHENTICATED);
          this.onGameReady();
        }
      });
      
    } catch (error) {
      console.error('Failed to connect to server:', error);
      this.setConnectionState(ConnectionState.FAILED);
      this.scene.events.emit('network:connectionError', `Failed to connect: ${error}`);
    }
  }

  // Check server status
  async checkServerStatus(serverUrl: string): Promise<ServerInfo> {
    try {
      const response = await fetch(serverUrl);
      const data = await response.json();
      return data as ServerInfo;
    } catch (error) {
      throw new Error('Server is not responding');
    }
  }

  private setConnectionState(state: ConnectionState): void {
    const previousState = this.connectionState;
    this.connectionState = state;
    if (previousState !== state) {
      console.log(`NetworkSystem: Connection state changed from ${previousState} to ${state}`);
    }
    this.scene.events.emit('network:connectionStateChanged', state);
  }

  private onGameReady(): void {
    console.log('🎮 Game ready! Emitting network:gameReady event');
    // Notify scene about successful connection and authentication
    this.scene.events.emit('network:gameReady');
    
    // Don't send player join here - loadout isn't configured yet!
    // Player join is now sent when GameScene starts
  }


  private handleAuthenticationTimeout(): void {
    this.setConnectionState(ConnectionState.FAILED);
    this.scene.events.emit('network:connectionError', 'Authentication timeout');
    if (this.socket) {
      this.socket.disconnect();
    }
  }

  private setupSocketListeners(): void {
    if (!this.socket) return;

    // Add debug listener for weapon/combat events only
    this.socket.onAny((eventName, data) => {

    });

    // Remove the old connect handler since we handle it in connectToServer
    
    this.socket.on('disconnect', (reason) => {
      console.log(`NetworkSystem: Socket disconnected, reason: ${reason}`);
      this.isConnected = false;
      this.setConnectionState(ConnectionState.DISCONNECTED);
      
      // Notify scene about disconnection
      this.scene.events.emit('network:disconnected', reason);
    });

    this.socket.on('connect_error', (error) => {
      this.connectionAttempts++;
      
      if (this.connectionAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
        this.handleConnectionError();
      }
    });

    // New authentication event handlers
    this.socket.on('authenticated', (data: any) => {
      console.log('✅ Authentication successful!', data);
      if (this.authenticationTimeout) {
        clearTimeout(this.authenticationTimeout);
        this.authenticationTimeout = null;
      }
      this.setConnectionState(ConnectionState.AUTHENTICATED);
      this.onGameReady();
      this.scene.events.emit('network:authenticated', data);
    });

    this.socket.on('auth-failed', (reason: string) => {
      if (this.authenticationTimeout) {
        clearTimeout(this.authenticationTimeout);
        this.authenticationTimeout = null;
      }
      this.setConnectionState(ConnectionState.FAILED);
      this.scene.events.emit('network:connectionError', `Authentication failed: ${reason}`);
    });

    this.socket.on('auth-timeout', (reason: string) => {
      if (this.authenticationTimeout) {
        clearTimeout(this.authenticationTimeout);
        this.authenticationTimeout = null;
      }
      this.setConnectionState(ConnectionState.FAILED);
      this.scene.events.emit('network:connectionError', `Authentication timeout: ${reason}`);
    });

    this.socket.on('error', (message: string) => {
      this.setConnectionState(ConnectionState.FAILED);
      this.scene.events.emit('network:connectionError', message);
    });

        // Listen for game state updates from server
    this.socket.on(EVENTS.GAME_STATE, (gameState: any) => {
      // Only process game events if authenticated
      if (this.connectionState === ConnectionState.AUTHENTICATED) {
        this.scene.events.emit('network:gameState', gameState);
      }
    });

    // Listen for player join/leave events
    this.socket.on(EVENTS.PLAYER_JOINED, (playerData: any) => {
      if (this.connectionState === ConnectionState.AUTHENTICATED) {
        this.scene.events.emit('network:playerJoined', playerData);
      }
    });

    this.socket.on(EVENTS.PLAYER_LEFT, (playerData: any) => {
      if (this.connectionState === ConnectionState.AUTHENTICATED) {
        this.scene.events.emit('network:playerLeft', playerData);
      }
    });

    // Listen for weapon events from backend
    this.socket.on('weapon:fired', (data: any) => {
      if (this.connectionState === ConnectionState.AUTHENTICATED) {
        this.scene.events.emit('backend:weapon:fired', data);
      }
    });

    this.socket.on('weapon:hit', (data: any) => {
      if (this.connectionState === ConnectionState.AUTHENTICATED) {
        this.scene.events.emit('backend:weapon:hit', data);
      }
    });

    this.socket.on('weapon:miss', (data: any) => {
      if (this.connectionState === ConnectionState.AUTHENTICATED) {
        this.scene.events.emit('backend:weapon:miss', data);
      }
    });

    this.socket.on('weapon:reloaded', (data: any) => {
      if (this.connectionState === ConnectionState.AUTHENTICATED) {
        this.scene.events.emit('backend:weapon:reloaded', data);
      }
    });

    this.socket.on('weapon:heat:update', (data: any) => {
      if (this.connectionState === ConnectionState.AUTHENTICATED) {
        this.scene.events.emit('backend:weapon:heat:update', data);
      }
    });

    this.socket.on('weapon:switched', (data: any) => {
      if (this.connectionState === ConnectionState.AUTHENTICATED) {
        this.scene.events.emit('backend:weapon:switched', data);
      }
    });

    this.socket.on('player:damaged', (data: any) => {
      if (this.connectionState === ConnectionState.AUTHENTICATED) {
        this.scene.events.emit('backend:player:damaged', data);
      }
    });

    this.socket.on('player:killed', (data: any) => {
      if (this.connectionState === ConnectionState.AUTHENTICATED) {
        this.scene.events.emit('backend:player:killed', data);
      }
    });

    this.socket.on('wall:damaged', (data: any) => {
      if (this.connectionState === ConnectionState.AUTHENTICATED) {
        this.scene.events.emit('backend:wall:damaged', data);
      }
    });

    this.socket.on('wall:destroyed', (data: any) => {
      if (this.connectionState === ConnectionState.AUTHENTICATED) {
        this.scene.events.emit('backend:wall:destroyed', data);
      }
    });

    this.socket.on('projectile:created', (data: any) => {
      if (this.connectionState === ConnectionState.AUTHENTICATED) {
        this.scene.events.emit('backend:projectile:created', data);
      }
    });

    this.socket.on('projectile:updated', (data: any) => {
      if (this.connectionState === ConnectionState.AUTHENTICATED) {
        this.scene.events.emit('backend:projectile:updated', data);
      }
    });

    this.socket.on('projectile:exploded', (data: any) => {
      if (this.connectionState === ConnectionState.AUTHENTICATED) {
        this.scene.events.emit('backend:projectile:exploded', data);
      }
    });

    this.socket.on('explosion:created', (data: any) => {
      if (this.connectionState === ConnectionState.AUTHENTICATED) {
        this.scene.events.emit('backend:explosion:created', data);
      }
    });
    
    // Listen for collision events
    this.socket.on('player:collision', (data: any) => {
      if (this.connectionState === ConnectionState.AUTHENTICATED) {
        this.scene.events.emit('network:collision', data);
      }
    });
    
    this.socket.on('collision:detected', (data: any) => {
      if (this.connectionState === ConnectionState.AUTHENTICATED) {
        this.scene.events.emit('network:collision', data);
      }
    });

    // Game restart event handlers
    this.socket.on('game:restarting', (data: any) => {
      if (this.connectionState === ConnectionState.AUTHENTICATED) {
        this.scene.events.emit('game:restarting', data);
      }
    });

    this.socket.on('game:restarted', (data: any) => {
      if (this.connectionState === ConnectionState.AUTHENTICATED) {
        this.scene.events.emit('game:restarted', data);
      }
    });

    this.socket.on('game:restart_failed', (data: any) => {
      if (this.connectionState === ConnectionState.AUTHENTICATED) {
        this.scene.events.emit('game:restart_failed', data);
      }
    });

    // Admin authentication event handlers
    this.socket.on('admin:authenticated', () => {
      if (this.connectionState === ConnectionState.AUTHENTICATED) {
        this.scene.events.emit('admin:authenticated');
      }
    });

    this.socket.on('admin:auth-failed', () => {
      if (this.connectionState === ConnectionState.AUTHENTICATED) {
        this.scene.events.emit('admin:auth-failed');
      }
    });
  }

  private setupEventListeners(): void {
    console.log('🎮 NetworkSystem: Setting up event listeners');
    
    // Listen for input events from InputSystem
    this.scene.events.on(EVENTS.PLAYER_INPUT, (inputState: InputState) => {
      // Input event logging removed to reduce console spam
      this.sendPlayerInput(inputState);
    });
    
    // Listen for weapon events from InputSystem
    this.scene.events.on('weapon:fire', (data: any) => {
      console.log('🎯 NetworkSystem received weapon:fire event', data);
      this.emit('weapon:fire', data);
    });
    
    this.scene.events.on('weapon:switch', (data: any) => {
      console.log('🎯 NetworkSystem received weapon:switch event', data);
      this.emit('weapon:switch', data);
    });
    
    this.scene.events.on('weapon:reload', (data: any) => {
      console.log('🎯 NetworkSystem received weapon:reload event', data);
      this.emit('weapon:reload', data);
    });
    
    // grenade:throw event removed - grenades now use weapon:fire
    
    this.scene.events.on('ads:toggle', (data: any) => {
      this.emit('ads:toggle', data);
    });
  }

  private sendPlayerInput(inputState: InputState): void {
    if (!this.socket || !this.isConnected || this.connectionState !== ConnectionState.AUTHENTICATED) {
      // Only log once per second to avoid spam
      const now = Date.now();
      if (!this.lastInputWarning || now - this.lastInputWarning > 1000) {
        console.warn(`❌ Cannot send input: socket=${!!this.socket}, connected=${this.isConnected}, state=${this.connectionState}`);
        this.lastInputWarning = now;
      }
      return;
    }

    try {
      this.inputsSent++;
      this.socket.emit(EVENTS.PLAYER_INPUT, inputState);
    } catch (error) {
      console.error('Failed to send player input:', error);
    }
  }
  
  private lastInputWarning: number = 0;

  private handleConnectionError(): void {
    console.error('Max reconnection attempts reached. Connection failed.');
    this.setConnectionState(ConnectionState.FAILED);
    this.scene.events.emit('network:connectionFailed');
  }

  // Method to update scene reference (when transitioning between scenes)
  updateScene(newScene: Phaser.Scene): void {
    console.log(`NetworkSystem: Updating scene from ${this.scene.scene.key} to ${newScene.scene.key}`);
    console.log(`Current state: connected=${this.isConnected}, authenticated=${this.isAuthenticated()}, state=${this.connectionState}`);
    
    // Remove old event listeners from previous scene
    this.scene.events.off(EVENTS.PLAYER_INPUT);
    this.scene.events.off('weapon:fire');
    this.scene.events.off('weapon:switch');
    this.scene.events.off('weapon:reload');
    this.scene.events.off('ads:toggle');
    
    // Update scene reference
    this.scene = newScene;
    
    // Re-setup event listeners for new scene
    this.setupEventListeners();
    
    console.log('NetworkSystem: Updated scene reference and re-initialized event listeners');
    
    // If already authenticated, notify the new scene
    if (this.connectionState === ConnectionState.AUTHENTICATED) {
      console.log('NetworkSystem: Already authenticated, notifying new scene');
      setTimeout(() => {
        this.scene.events.emit('network:gameReady');
        this.scene.events.emit('network:connected');
      }, 100);
    }
  }

  // Public getters
  isSocketConnected(): boolean {
    return this.isConnected;
  }

  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  isAuthenticated(): boolean {
    return this.connectionState === ConnectionState.AUTHENTICATED;
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  getCurrentServerUrl(): string {
    return this.currentServerUrl;
  }

  // Method to manually send events to server
  emit(event: string, data?: any): void {
    if (!this.socket || !this.isConnected || this.connectionState !== ConnectionState.AUTHENTICATED) {
      console.warn(`Cannot emit ${event}: not authenticated`);
      return;
    }

    try {
      // Log all weapon events being sent to backend
      if (event.startsWith('weapon:') || event === 'ads:toggle') {
        console.log(`📤 Sending to backend: ${event}`, data);
      }
      
      this.socket.emit(event, data);
    } catch (error) {
      console.error(`Failed to emit ${event}:`, error);
    }
  }
} 
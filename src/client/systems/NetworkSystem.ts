import { io, Socket } from 'socket.io-client';
import { IGameSystem } from '../../../shared/interfaces/IGameSystem';
import { EVENTS } from '../../../shared/constants/index';
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
    console.warn('⚠️ NetworkSystem.destroy() called - THIS SHOULD NOT HAPPEN DURING NORMAL GAMEPLAY!');
    console.trace(); // Log stack trace to see who's calling destroy
    
    // Clear scene event listeners
    this.scene.events.off(EVENTS.PLAYER_INPUT);
    this.scene.events.off('weapon:fire');
    this.scene.events.off('weapon:switch');
    this.scene.events.off('weapon:reload');
    this.scene.events.off('ads:toggle');
    
    // Disconnect socket
    if (this.socket) {
      console.error('🔴 DESTROYING SOCKET CONNECTION - This will disconnect from backend!');
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
    console.log(`🔌 DETAILED: Attempting to connect to backend at: ${serverUrl}`);
    console.log(`🔌 DETAILED: Password provided: ${password ? 'YES' : 'NO'}`);
    console.log(`🔌 DETAILED: Current connection state: ${this.isConnected ? 'CONNECTED' : 'DISCONNECTED'}`);
    console.log(`🔌 DETAILED: Existing socket: ${!!this.socket}, connected: ${this.socket?.connected}`);
    
    // CRITICAL FIX: Don't create new connection if already connected!
    if (this.socket && this.socket.connected) {
      console.log('⚠️ ALREADY CONNECTED! Not creating new connection.');
      console.log(`Current URL: ${this.socket.io.uri}, Requested URL: ${serverUrl}`);
      
      // If same server, just ensure we're authenticated
      if (this.socket.io.uri === serverUrl) {
        console.log('Same server, checking authentication state...');
        if (this.connectionState === ConnectionState.AUTHENTICATED) {
          console.log('Already authenticated, triggering game ready');
          this.onGameReady();
        }
        return;
      } else {
        console.log('Different server requested, disconnecting old connection...');
        this.socket.disconnect();
        this.socket = null;
      }
    }
    
    this.setConnectionState(ConnectionState.CONNECTING);
    
    try {
      // First check server info to see if password is required
      const serverInfo = await this.checkServerStatus(serverUrl);
      
      console.log(`🔌 DETAILED: Creating Socket.IO connection with config:`, {
        transports: ['websocket'],
        timeout: 5000,
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: this.MAX_RECONNECT_ATTEMPTS
      });
      
      // CRITICAL: Check if we already have a socket before creating a new one
      if (this.socket) {
        console.error('⚠️ WARNING: Socket already exists! This will create a duplicate!');
        console.error('Existing socket ID:', this.socket.id);
        console.error('Existing socket connected:', this.socket.connected);
      }
      
      this.socket = io(serverUrl, {
        transports: ['websocket'],
        timeout: 5000,
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: this.MAX_RECONNECT_ATTEMPTS,
        autoConnect: false  // Don't connect immediately
      });
      
      console.log(`🔌 DETAILED: Socket.IO instance created, setting up listeners...`);

      // Setup ALL listeners BEFORE connecting
      this.setupSocketListeners();
      
      // Handle authentication if needed
      this.socket.on('connect', () => {
        console.log(`🔌 DETAILED: Socket.IO connected successfully to ${serverUrl}!`);
        this.isConnected = true;
        this.connectionAttempts = 0;
        this.setConnectionState(ConnectionState.CONNECTED);
        
        // 🔥 NEW: No-password public server support
        // Only authenticate if password is explicitly provided OR server requires it
        if (password && password.trim() !== '') {
          console.log('🔐 Attempting authentication with password for private lobby...');
          this.setConnectionState(ConnectionState.AUTHENTICATING);
          this.socket!.emit('authenticate', password);
          console.log('📤 Authentication event sent to backend');
          
          // Set 5-second timeout for authentication
          this.authenticationTimeout = window.setTimeout(() => {
            this.handleAuthenticationTimeout();
          }, 5000);
        } else if (serverInfo.passwordRequired) {
          // Private server/lobby requires password but none provided
          console.log('🔒 Server requires password but none provided - attempting empty auth');
          this.setConnectionState(ConnectionState.AUTHENTICATING);
          this.socket!.emit('authenticate', '');
          
          // Set 5-second timeout for authentication
          this.authenticationTimeout = window.setTimeout(() => {
            this.handleAuthenticationTimeout();
          }, 5000);
        } else {
          // 🚀 PUBLIC SERVER: No password needed, connect directly
          console.log('🌐 Public server connection - no authentication required');
          this.setConnectionState(ConnectionState.AUTHENTICATED);
          this.onGameReady();
        }
      });
      
      // NOW connect the socket after all listeners are set up
      console.log('🔌 Starting socket connection...');
      this.socket.connect();
      
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
      const text = await response.text();
      console.log('🌐 Server status response (raw):', text);
      
      try {
        const data = JSON.parse(text);
        console.log('📊 Server status (parsed):', data);
        return data as ServerInfo;
      } catch (parseError) {
        console.warn('⚠️ Server returned non-JSON response, using defaults');
        // Return default structure if server doesn't return JSON
        return {
          game: 'Trespasser',
          status: 'Running',
          players: 0,
          maxPlayers: 10,
          passwordRequired: true, // Default to requiring password for safety
          uptime: 0
        };
      }
    } catch (error) {
      console.error('❌ Server status check failed:', error);
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
      console.log(`📥 BACKEND EVENT: ${eventName}`, data);
    });

    // Remove the old connect handler since we handle it in connectToServer
    
    this.socket.on('disconnect', (reason) => {
      console.error(`❌ SOCKET DISCONNECTED! Reason: ${reason}`);
      console.error('Stack trace:', new Error().stack);
      this.isConnected = false;
      
      // Only update state if we're not just switching scenes
      if (reason !== 'io client disconnect') {
        this.setConnectionState(ConnectionState.DISCONNECTED);
      }
      
      // Notify scene about disconnection
      this.scene.events.emit('network:disconnected', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error(`🔌 DETAILED: Socket connection error:`, error);
      console.error(`🔌 DETAILED: Error type: ${error.type}`);
      console.error(`🔌 DETAILED: Error description: ${error.description}`);
      console.error(`🔌 DETAILED: Attempt ${this.connectionAttempts + 1}/${this.MAX_RECONNECT_ATTEMPTS}`);
      
      this.connectionAttempts++;
      
      if (this.connectionAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
        console.error(`🔌 DETAILED: Max connection attempts reached, handling connection error`);
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
        console.log('📨 GAME STATE RECEIVED! Scene:', this.scene.scene.key);
        console.log('  - Players:', Object.keys(gameState.players || {}).length);
        console.log('  - Walls:', (gameState.walls || []).length);
        console.log('  - Vision:', !!gameState.vision);
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
      
      // Debug: Log movement input periodically
      if (inputState.movement && (inputState.movement.x !== 0 || inputState.movement.y !== 0)) {
        const now = Date.now();
        if (!this.lastMovementLog || now - this.lastMovementLog > 1000) {
          console.log('🎮 Sending movement input:', inputState.movement, 'Keys:', inputState.keys);
          this.lastMovementLog = now;
        }
      }
      
      this.socket.emit(EVENTS.PLAYER_INPUT, inputState);
    } catch (error) {
      console.error('Failed to send player input:', error);
    }
  }
  
  private lastInputWarning: number = 0;
  private lastMovementLog: number = 0;

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
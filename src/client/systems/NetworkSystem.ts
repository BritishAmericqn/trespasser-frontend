import { io, Socket } from 'socket.io-client';
import { IGameSystem } from '../../../shared/interfaces/IGameSystem';
import { EVENTS, GAME_CONFIG } from '../../../shared/constants/index';
import { InputState } from './InputSystem';

export class NetworkSystem implements IGameSystem {
  private scene: Phaser.Scene;
  private socket: Socket | null = null;
  private isConnected: boolean = false;
  private connectionAttempts: number = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private inputsSent: number = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  initialize(): void {
    this.connect();
    this.setupEventListeners();
    console.log('NetworkSystem initialized - ready to send input events');
  }

  update(deltaTime: number): void {
    // NetworkSystem doesn't need regular updates
    // All communication is event-driven
  }

  destroy(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.scene.events.off(EVENTS.PLAYER_INPUT);
  }

  private connect(): void {
    try {
      console.log('🔌 Connecting to backend at:', GAME_CONFIG.SERVER_URL);
      this.socket = io(GAME_CONFIG.SERVER_URL, {
        transports: ['websocket'],
        timeout: 5000,
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: this.MAX_RECONNECT_ATTEMPTS
      });

      this.setupSocketListeners();
    } catch (error) {
      console.error('Failed to initialize socket connection:', error);
      this.handleConnectionError();
    }
  }

  private setupSocketListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      this.isConnected = true;
      this.connectionAttempts = 0;
      console.log('✅ Connected to server:', this.socket?.id);
      
      // Notify scene about connection
      this.scene.events.emit('network:connected');
    });

    this.socket.on('disconnect', (reason) => {
      this.isConnected = false;
      console.log('❌ Disconnected from server:', reason);
      
      // Notify scene about disconnection
      this.scene.events.emit('network:disconnected', reason);
    });

    this.socket.on('connect_error', (error) => {
      this.connectionAttempts++;
      console.error('Connection error:', error.message);
      
      if (this.connectionAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
        this.handleConnectionError();
      }
    });

    // Listen for game state updates from server
    this.socket.on(EVENTS.GAME_STATE, (gameState: any) => {
      this.scene.events.emit('network:gameState', gameState);
    });

    // Listen for player join/leave events
    this.socket.on(EVENTS.PLAYER_JOINED, (playerData: any) => {
      this.scene.events.emit('network:playerJoined', playerData);
    });

    this.socket.on(EVENTS.PLAYER_LEFT, (playerData: any) => {
      this.scene.events.emit('network:playerLeft', playerData);
    });
  }

  private setupEventListeners(): void {
    // Listen for input events from InputSystem
    this.scene.events.on(EVENTS.PLAYER_INPUT, (inputState: InputState) => {
      console.log(`🎮 NetworkSystem received input event #${inputState.sequence}`);
      this.sendPlayerInput(inputState);
    });
  }

  private sendPlayerInput(inputState: InputState): void {
    if (!this.socket || !this.isConnected) {
      console.warn('❌ Cannot send input: not connected to server');
      return;
    }

    try {
      this.inputsSent++;
      console.log(`📤 SENDING to backend: '${EVENTS.PLAYER_INPUT}' #${inputState.sequence} (total sent: ${this.inputsSent})`);
      this.socket.emit(EVENTS.PLAYER_INPUT, inputState);
    } catch (error) {
      console.error('Failed to send player input:', error);
    }
  }

  private handleConnectionError(): void {
    console.error('Max reconnection attempts reached. Connection failed.');
    this.scene.events.emit('network:connectionFailed');
  }

  // Public methods for other systems to use
  isSocketConnected(): boolean {
    return this.isConnected;
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  // Method to manually send events to server
  emit(event: string, data?: any): void {
    if (!this.socket || !this.isConnected) {
      console.warn(`Cannot emit ${event}: not connected to server`);
      return;
    }

    try {
      this.socket.emit(event, data);
    } catch (error) {
      console.error(`Failed to emit ${event}:`, error);
    }
  }
} 
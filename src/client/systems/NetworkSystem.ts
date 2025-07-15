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

    // Add debug listener for weapon/combat events only
    this.socket.onAny((eventName, data) => {
      // Only log weapon/combat related events, not movement/game state
      if (eventName.includes('weapon') || eventName.includes('wall') || eventName.includes('explosion') || eventName.includes('hit')) {
        console.log(`🔥 BACKEND EVENT RECEIVED: ${eventName}`, data);
        
        // Special debug for wall events
        if (eventName === 'wall:damaged') {
          console.log('🧱 WALL DAMAGE EVENT DETAILS:', {
            wallId: data.wallId,
            position: data.position,
            damage: data.damage,
            newHealth: data.newHealth,
            isDestroyed: data.isDestroyed
          });
        }
      }
    });

    this.socket.on('connect', () => {
      this.isConnected = true;
      this.connectionAttempts = 0;
      
      // Notify scene about connection
      this.scene.events.emit('network:connected');
    });

    this.socket.on('disconnect', (reason) => {
      this.isConnected = false;
      
      // Notify scene about disconnection
      this.scene.events.emit('network:disconnected', reason);
    });

    this.socket.on('connect_error', (error) => {
      this.connectionAttempts++;
      
      if (this.connectionAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
        this.handleConnectionError();
      }
    });

        // Listen for game state updates from server
    this.socket.on(EVENTS.GAME_STATE, (gameState: any) => {
      // Silently emit game state without logging
      this.scene.events.emit('network:gameState', gameState);
    });

    // Listen for player join/leave events
    this.socket.on(EVENTS.PLAYER_JOINED, (playerData: any) => {
      this.scene.events.emit('network:playerJoined', playerData);
    });

    this.socket.on(EVENTS.PLAYER_LEFT, (playerData: any) => {
      this.scene.events.emit('network:playerLeft', playerData);
    });

    // Listen for weapon events from backend
    this.socket.on('weapon:fired', (data: any) => {
      this.scene.events.emit('backend:weapon:fired', data);
    });

    this.socket.on('weapon:hit', (data: any) => {
      this.scene.events.emit('backend:weapon:hit', data);
    });

    this.socket.on('weapon:miss', (data: any) => {
      this.scene.events.emit('backend:weapon:miss', data);
    });

    this.socket.on('weapon:reloaded', (data: any) => {
      this.scene.events.emit('backend:weapon:reloaded', data);
    });

    this.socket.on('weapon:switched', (data: any) => {
      this.scene.events.emit('backend:weapon:switched', data);
    });

    this.socket.on('player:damaged', (data: any) => {
      this.scene.events.emit('backend:player:damaged', data);
    });

    this.socket.on('player:killed', (data: any) => {
      this.scene.events.emit('backend:player:killed', data);
    });

    this.socket.on('wall:damaged', (data: any) => {
      this.scene.events.emit('backend:wall:damaged', data);
    });

    this.socket.on('wall:destroyed', (data: any) => {
      this.scene.events.emit('backend:wall:destroyed', data);
    });

    this.socket.on('projectile:created', (data: any) => {
      this.scene.events.emit('backend:projectile:created', data);
    });

    this.socket.on('explosion:created', (data: any) => {
      this.scene.events.emit('backend:explosion:created', data);
    });
    
    // DEBUG: Listen to ALL events from backend
    this.socket.onAny((eventName: string, ...args: any[]) => {
      // Only log weapon/hit related events
      if (eventName.includes('weapon') || eventName.includes('wall') || eventName.includes('hit') || eventName.includes('damage')) {
        console.log(`🔵 BACKEND EVENT: ${eventName}`, args[0]);
      }
    });
  }

  private setupEventListeners(): void {
    // Listen for input events from InputSystem
    this.scene.events.on(EVENTS.PLAYER_INPUT, (inputState: InputState) => {
      // Input event logging removed to reduce console spam
      this.sendPlayerInput(inputState);
    });
    
    // Listen for weapon events from InputSystem
    this.scene.events.on('weapon:fire', (data: any) => {
      this.emit('weapon:fire', data);
    });
    
    this.scene.events.on('weapon:switch', (data: any) => {
      this.emit('weapon:switch', data);
    });
    
    this.scene.events.on('weapon:reload', (data: any) => {
      this.emit('weapon:reload', data);
    });
    
    this.scene.events.on('grenade:throw', (data: any) => {
      this.emit('grenade:throw', data);
    });
    
    this.scene.events.on('ads:toggle', (data: any) => {
      this.emit('ads:toggle', data);
    });
  }

  private sendPlayerInput(inputState: InputState): void {
    if (!this.socket || !this.isConnected) {
      console.warn('❌ Cannot send input: not connected to server');
      return;
    }

    try {
      this.inputsSent++;
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
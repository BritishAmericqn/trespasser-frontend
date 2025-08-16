/**
 * LobbyStateManager - Single source of truth for lobby state
 * 
 * This manager ensures all UI components stay synchronized by maintaining
 * a single authoritative state that comes from the backend.
 */

export interface PlayerInfo {
  id: string;
  name: string;
  team: 'red' | 'blue';
  isReady: boolean;
  loadout?: any;
  ping?: number;
}

export interface LobbyState {
  lobbyId: string;
  playerCount: number;
  maxPlayers: number;
  players: PlayerInfo[];
  status: 'waiting' | 'starting' | 'in_progress' | 'finished';
  gameMode: string;
  mapName?: string;
  isPrivate: boolean;
  hostId?: string;
  countdown?: number;
  inviteCode?: string;
  minimumPlayers: number;
}

type LobbyStateListener = (state: LobbyState | null) => void;

export class LobbyStateManager {
  private static instance: LobbyStateManager | null;
  private currentLobby: LobbyState | null = null;
  private listeners: Set<LobbyStateListener> = new Set();
  private socket: any = null;

  private constructor() {
    console.log('🏢 LobbyStateManager initialized');
  }

  /**
   * Get singleton instance
   */
  static getInstance(): LobbyStateManager {
    if (!this.instance) {
      this.instance = new LobbyStateManager();
      // Store on window for emergency cleanup access
      (window as any).LobbyStateManagerInstance = this.instance;
    }
    return this.instance;
  }

  /**
   * Initialize with socket connection
   */
  initialize(socket: any): void {
    this.socket = socket;
    this.setupSocketListeners();
    console.log('🔌 LobbyStateManager connected to socket');
  }

  /**
   * Setup socket event listeners for lobby state updates
   */
  private setupSocketListeners(): void {
    if (!this.socket) return;

    // Unified lobby state update (what backend SHOULD send)
    this.socket.on('lobby:state', (state: LobbyState) => {
      console.log('📊 Received unified lobby state:', state);
      this.updateState(state);
    });

    // Handle individual updates (current backend events)
    this.socket.on('lobby_joined', (data: any) => {
      console.log('🏢 Lobby joined event:', data);
      this.updateFromPartial({
        lobbyId: data.lobbyId,
        playerCount: data.playerCount,
        maxPlayers: data.maxPlayers,
        status: 'waiting'
      });
    });

    this.socket.on('player_joined_lobby', (data: any) => {
      console.log('👤 Player joined lobby:', data);
      if (this.currentLobby && data.lobbyId === this.currentLobby.lobbyId) {
        this.updateFromPartial({
          playerCount: data.playerCount
        });
      }
    });

    this.socket.on('player_left_lobby', (data: any) => {
      console.log('👋 Player left lobby:', data);
      if (this.currentLobby && data.lobbyId === this.currentLobby.lobbyId) {
        this.updateFromPartial({
          playerCount: data.playerCount
        });
      }
    });

    this.socket.on('match_starting', (data: any) => {
      console.log('⏱️ Match starting:', data);
      this.updateFromPartial({
        status: 'starting',
        countdown: data.countdown
      });
    });

    this.socket.on('match_started', (data: any) => {
      console.log('🚀 Match started:', data);
      this.updateFromPartial({
        status: 'in_progress'
      });
      // Clear state after a small delay to allow scenes to transition
      setTimeout(() => {
        console.log('🎮 Match started, clearing lobby state');
        this.clearState();
      }, 100);
    });

    // Clear state on disconnect or lobby leave
    this.socket.on('left_lobby', () => {
      console.log('👋 Left lobby');
      this.clearState();
    });

    this.socket.on('disconnect', () => {
      console.log('❌ Disconnected - clearing lobby state');
      this.clearState();
    });
  }

  /**
   * Update the complete lobby state
   */
  updateState(newState: LobbyState): void {
    const oldState = this.currentLobby;
    this.currentLobby = newState;
    
    // Log state changes for debugging
    if (oldState?.playerCount !== newState.playerCount) {
      console.log(`📊 Player count changed: ${oldState?.playerCount || 0} → ${newState.playerCount}`);
    }
    if (oldState?.status !== newState.status) {
      console.log(`📊 Status changed: ${oldState?.status || 'none'} → ${newState.status}`);
    }

    this.notifyListeners();
  }

  /**
   * Update from partial data (for compatibility with current backend)
   */
  private updateFromPartial(partial: Partial<LobbyState>): void {
    if (!this.currentLobby) {
      // Initialize with defaults if we don't have a full state yet
      this.currentLobby = {
        lobbyId: partial.lobbyId || 'unknown',
        playerCount: partial.playerCount || 1,
        maxPlayers: partial.maxPlayers || 8,
        players: [],
        status: partial.status || 'waiting',
        gameMode: partial.gameMode || 'deathmatch',
        isPrivate: false,
        minimumPlayers: 2,
        ...partial
      };
    } else {
      // Merge partial update into existing state
      this.currentLobby = {
        ...this.currentLobby,
        ...partial
      };
    }

    this.notifyListeners();
  }

  /**
   * Clear the current lobby state
   */
  clearState(): void {
    this.currentLobby = null;
    this.notifyListeners();
  }

  /**
   * Get current lobby state
   */
  getState(): LobbyState | null {
    return this.currentLobby;
  }

  /**
   * Check if currently in a lobby
   */
  isInLobby(): boolean {
    return this.currentLobby !== null;
  }

  /**
   * Check if match is ready to start
   */
  isMatchReady(): boolean {
    return this.currentLobby !== null && 
           this.currentLobby.playerCount >= this.currentLobby.minimumPlayers;
  }

  /**
   * Subscribe to state changes
   */
  subscribe(callback: LobbyStateListener): () => void {
    this.listeners.add(callback);
    
    // Immediately call with current state
    callback(this.currentLobby);

    // Return unsubscribe function
    return () => {
      this.unsubscribe(callback);
    };
  }

  /**
   * Unsubscribe from state changes
   */
  unsubscribe(callback: LobbyStateListener): void {
    this.listeners.delete(callback);
  }

  /**
   * Notify all listeners of state change
   */
  private notifyListeners(): void {
    // Don't notify if we're in game
    if (this.currentLobby?.status === 'in_progress') {
      return;
    }
    
    // Create a copy to avoid modification during iteration
    const listenersToNotify = Array.from(this.listeners);
    
    listenersToNotify.forEach(callback => {
      try {
        callback(this.currentLobby);
      } catch (error) {
        console.error('Error in lobby state listener:', error);
        // Remove problematic listener
        this.listeners.delete(callback);
      }
    });
  }

  /**
   * Debug method to log current state
   */
  debug(): void {
    console.log('🏢 Current Lobby State:', this.currentLobby);
    console.log(`📊 Listeners: ${this.listeners.size}`);
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.clearState();
    this.listeners.clear();
    
    // Remove socket listeners
    if (this.socket) {
      this.socket.off('lobby:state');
      this.socket.off('lobby_joined');
      this.socket.off('player_joined_lobby');
      this.socket.off('player_left_lobby');
      this.socket.off('match_starting');
      this.socket.off('match_started');
    }
    
    this.socket = null;
    
    // Clear the singleton instance
    LobbyStateManager.instance = null;
    delete (window as any).LobbyStateManagerInstance;
  }
}

// Export singleton instance getter for convenience
export const getLobbyState = () => LobbyStateManager.getInstance();

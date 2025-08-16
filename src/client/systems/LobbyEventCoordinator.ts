/**
 * Centralized Lobby Event Coordinator
 * Prevents multiple scenes from handling lobby events simultaneously
 * Ensures only the active scene processes match_started events
 */

import NetworkSystemSingleton from './NetworkSystemSingleton';
import { SceneManager } from '../utils/SceneManager';

interface MatchData {
  lobbyId: string;
  killTarget?: number;
  gameMode?: string;
  isLateJoin?: boolean;
}

export class LobbyEventCoordinator {
  private static instance: LobbyEventCoordinator | null = null;
  private currentScene: Phaser.Scene | null = null;
  private socket: any = null;
  private isHandlingMatchStart: boolean = false;
  
  private constructor() {
    this.setupGlobalListeners();
  }
  
  static getInstance(): LobbyEventCoordinator {
    if (!this.instance) {
      this.instance = new LobbyEventCoordinator();
    }
    return this.instance;
  }
  
  /**
   * Register the currently active scene that should handle lobby events
   */
  registerActiveScene(scene: Phaser.Scene): void {
    console.log(`🎭 LobbyEventCoordinator: Registering ${scene.scene.key} as active scene`);
    
    // Unregister previous scene
    if (this.currentScene && this.currentScene !== scene) {
      console.log(`🎭 Unregistering previous scene: ${this.currentScene.scene.key}`);
    }
    
    this.currentScene = scene;
    
    // Ensure we have the latest socket and set up listener
    if (NetworkSystemSingleton.hasInstance()) {
      const networkSystem = NetworkSystemSingleton.getInstance(scene);
      const newSocket = networkSystem.getSocket();
      
      if (newSocket) {
        // Always remove any existing match_started listeners first
        if (newSocket.hasListeners('match_started')) {
          console.log('🎭 Removing ALL existing match_started listeners');
          newSocket.removeAllListeners('match_started');
        }
        
        this.socket = newSocket;
        console.log('🎭 LobbyEventCoordinator: Setting up EXCLUSIVE match_started listener');
        this.socket.on('match_started', this.handleMatchStarted.bind(this));
      }
    }
  }
  
  /**
   * Unregister a scene when it's no longer active
   */
  unregisterScene(scene: Phaser.Scene): void {
    if (this.currentScene === scene) {
      console.log(`🎭 LobbyEventCoordinator: Unregistering ${scene.scene.key}`);
      this.currentScene = null;
    }
  }
  
  private setupGlobalListeners(): void {
    // We'll set up the listener when we have a socket
    this.ensureSocketListener();
  }
  
  private ensureSocketListener(): void {
    // This method is now deprecated - we set up listeners in registerActiveScene
  }
  
  private handleMatchStarted(data: any): void {
    // Prevent multiple simultaneous handling
    if (this.isHandlingMatchStart) {
      console.log('🎭 Already handling match_started, ignoring duplicate');
      return;
    }
    
    this.isHandlingMatchStart = true;
    console.log('🎭 LobbyEventCoordinator: Centralized match_started handler', {
      activeScene: this.currentScene?.scene.key || 'none',
      data
    });
    
    try {
      // Determine the correct flow based on the active scene
      if (!this.currentScene) {
        console.error('🎭 No active scene registered for match_started');
        return;
      }
      
      const sceneName = this.currentScene.scene.key;
      const matchData: MatchData = {
        lobbyId: data.lobbyId,
        killTarget: data.killTarget || 50,
        gameMode: data.gameMode || 'deathmatch'
      };
      
      // Route based on the active scene
      switch (sceneName) {
        case 'LobbyWaitingScene':
          // Normal lobby start - go to ConfigureScene for loadout selection
          console.log('🎭 Normal lobby start from LobbyWaitingScene → ConfigureScene');
          
          // Immediately stop the current scene and start ConfigureScene
          // Use direct scene management to avoid SceneManager conflicts
          console.log('🎭 Using direct scene start for immediate transition');
          this.currentScene.scene.stop();
          this.currentScene.scene.manager.start('ConfigureScene', {
            matchData: {
              ...matchData,
              isLateJoin: false
            }
          });
          break;
          
        case 'ServerBrowserScene':
        case 'LobbyMenuScene':
        case 'MatchmakingScene':
          // ALWAYS go to ConfigureScene first - no exceptions!
          console.log(`🎭 Match started from ${sceneName} → ConfigureScene (universal loadout access)`);
          SceneManager.transition(this.currentScene, 'ConfigureScene', {
            matchData: {
              ...matchData,
              isLateJoin: false  // Everyone gets configuration
            }
          });
          break;
          
        case 'ConfigureScene':
          // Already in configure scene, go directly to game
          console.log('🎭 Match started while in ConfigureScene → GameScene');
          this.currentScene.scene.start('GameScene', { matchData });
          break;
          
        default:
          console.warn(`🎭 Unhandled match_started from scene: ${sceneName}`);
          // ALWAYS go to ConfigureScene - universal loadout access
          console.log(`🎭 Fallback route for ${sceneName} → ConfigureScene (universal loadout access)`);
          SceneManager.transition(this.currentScene, 'ConfigureScene', {
            matchData: {
              ...matchData,
              isLateJoin: false  // Everyone gets configuration
            }
          });
      }
    } finally {
      // Reset the flag after a short delay
      setTimeout(() => {
        this.isHandlingMatchStart = false;
      }, 100);
    }
  }
  
  /**
   * Clean up when no longer needed
   */
  destroy(): void {
    if (this.socket) {
      this.socket.off('match_started', this.handleMatchStarted);
    }
    this.currentScene = null;
    this.socket = null;
    LobbyEventCoordinator.instance = null;
  }
  
  /**
   * Force reset if stuck
   */
  forceReset(): void {
    console.log('🎭 LobbyEventCoordinator: Force reset');
    this.isHandlingMatchStart = false;
    this.currentScene = null;
  }
}

export default LobbyEventCoordinator;

/**
 * RegistrySafety - Safe access to game registry with fallbacks
 * 
 * This module provides safe access to registry data with automatic
 * fallbacks for missing values, preventing crashes from undefined data.
 */

interface PlayerLoadout {
  team: 'red' | 'blue';
  primary: string;
  secondary: string;
  support: string[];
}

interface MatchData {
  lobbyId?: string;
  killTarget: number;
  gameMode: string;
  isLateJoin?: boolean;
  mapData?: any;
  fromNetworkSystem?: boolean;
  fromFallback?: boolean;
}

export class RegistrySafety {
  /**
   * Get player loadout with fallback
   */
  static getLoadout(game: Phaser.Game): PlayerLoadout {
    const loadout = game.registry.get('playerLoadout');
    
    if (loadout && loadout.team && loadout.primary) {
      // Valid loadout exists
      return loadout;
    }
    
    // Create default loadout
    console.warn('⚠️ No valid loadout found in registry, creating default');
    const defaultLoadout: PlayerLoadout = {
      team: 'blue',
      primary: 'rifle',
      secondary: 'pistol',
      support: ['grenade']
    };
    
    // Store it for future use
    game.registry.set('playerLoadout', defaultLoadout);
    
    return defaultLoadout;
  }
  
  /**
   * Get match data with fallback
   */
  static getMatchData(game: Phaser.Game): MatchData {
    const matchData = game.registry.get('matchData');
    
    if (matchData && (matchData.lobbyId || matchData.fromNetworkSystem)) {
      // Valid match data exists
      return matchData;
    }
    
    // Create fallback match data
    console.warn('⚠️ No valid match data found in registry, creating fallback');
    const fallbackData: MatchData = {
      killTarget: 50,
      gameMode: 'deathmatch',
      fromFallback: true,
      mapData: { width: 480, height: 270 }
    };
    
    return fallbackData;
  }
  
  /**
   * Get lobby data with fallback
   */
  static getLobbyData(game: Phaser.Game): any {
    const lobbyData = game.registry.get('currentLobbyData');
    
    if (lobbyData && lobbyData.lobbyId) {
      return lobbyData;
    }
    
    // Create fallback lobby data
    console.warn('⚠️ No valid lobby data found in registry, creating fallback');
    return {
      lobbyId: 'fallback-lobby',
      playerCount: 1,
      maxPlayers: 8,
      status: 'waiting',
      gameMode: 'deathmatch',
      killTarget: 50
    };
  }
  
  /**
   * Safe get with type checking
   */
  static get<T>(game: Phaser.Game, key: string, fallback?: T): T | undefined {
    try {
      const value = game.registry.get(key);
      
      // Return value if it exists
      if (value !== undefined && value !== null) {
        return value as T;
      }
      
      // Use fallback if provided
      if (fallback !== undefined) {
        console.log(`📦 Registry: Using fallback for '${key}'`);
        return fallback;
      }
      
      return undefined;
    } catch (error) {
      console.error(`❌ Registry error accessing '${key}':`, error);
      return fallback;
    }
  }
  
  /**
   * Safe set with validation
   */
  static set(game: Phaser.Game, key: string, value: any): boolean {
    try {
      // Validate value is not circular
      JSON.stringify(value);
      
      game.registry.set(key, value);
      console.log(`📦 Registry: Set '${key}'`);
      return true;
    } catch (error) {
      console.error(`❌ Registry error setting '${key}':`, error);
      return false;
    }
  }
  
  /**
   * Check if a key exists and has a valid value
   */
  static has(game: Phaser.Game, key: string): boolean {
    try {
      const value = game.registry.get(key);
      return value !== undefined && value !== null;
    } catch {
      return false;
    }
  }
  
  /**
   * Clear specific keys
   */
  static clear(game: Phaser.Game, keys: string[]): void {
    keys.forEach(key => {
      try {
        game.registry.remove(key);
        console.log(`🗑️ Registry: Cleared '${key}'`);
      } catch (error) {
        console.error(`❌ Registry error clearing '${key}':`, error);
      }
    });
  }
  
  /**
   * Get registry snapshot for debugging
   */
  static getSnapshot(game: Phaser.Game): Record<string, any> {
    const criticalKeys = [
      'playerLoadout',
      'matchData',
      'currentLobbyData',
      'pendingMatch',
      'pendingGameState',
      'fromInstantPlay',
      'playNowMode',
      'testMode'
    ];
    
    const snapshot: Record<string, any> = {};
    
    criticalKeys.forEach(key => {
      try {
        const value = game.registry.get(key);
        if (value !== undefined) {
          snapshot[key] = typeof value === 'object' ? { ...value } : value;
        }
      } catch {
        snapshot[key] = 'error';
      }
    });
    
    return snapshot;
  }
  
  /**
   * Validate and repair registry state
   */
  static validateAndRepair(game: Phaser.Game): string[] {
    const issues: string[] = [];
    
    // Check for playerLoadout
    const loadout = game.registry.get('playerLoadout');
    if (!loadout || !loadout.team || !loadout.primary) {
      issues.push('Invalid or missing playerLoadout - creating default');
      this.getLoadout(game); // This will create default
    }
    
    // Clean up old/temporary flags
    const temporaryKeys = [
      'gameSceneRedirected',
      'fromInstantPlay',
      'playNowMode'
    ];
    
    temporaryKeys.forEach(key => {
      if (game.registry.has(key)) {
        const value = game.registry.get(key);
        const age = Date.now() - (value?.timestamp || 0);
        
        // Clear if older than 5 minutes
        if (age > 5 * 60 * 1000) {
          game.registry.remove(key);
          issues.push(`Cleared stale key: ${key}`);
        }
      }
    });
    
    return issues;
  }
}

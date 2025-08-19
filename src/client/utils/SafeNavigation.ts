/**
 * SafeNavigation - A safety wrapper for scene transitions
 * 
 * This module adds validation and fallbacks to scene transitions
 * without changing the underlying navigation behavior.
 */

interface TransitionOptions {
  validateData?: boolean;
  fallbackScene?: string;
  requiredData?: string[];
}

export class SafeNavigation {
  private static validScenes = [
    'LoadingScene',
    'MenuScene',
    'ServerConnectionScene',
    'ServerConnectionSceneText',
    'ConfigureScene',
    'GameScene',
    'LobbyMenuScene',
    'MatchmakingScene',
    'LobbyWaitingScene',
    'MatchResultsScene',
    'ServerBrowserScene'
  ];
  
  /**
   * Safe scene transition with validation and fallbacks
   */
  static transition(
    scene: Phaser.Scene, 
    target: string, 
    data?: any,
    options?: TransitionOptions
  ): void {
    const from = scene.scene.key;
    
    console.log(`🎬 SafeNavigation: ${from} → ${target}`, {
      hasData: !!data,
      dataKeys: data ? Object.keys(data) : [],
      options
    });
    
    // Validate target scene exists
    if (!this.validateSceneExists(scene, target)) {
      console.error(`❌ Scene '${target}' does not exist!`);
      const fallback = options?.fallbackScene || 'MenuScene';
      console.warn(`⚠️ Falling back to ${fallback}`);
      scene.scene.start(fallback);
      return;
    }
    
    // Check for same-scene transition
    if (from === target) {
      console.warn(`⚠️ Attempting to transition to same scene: ${target}`);
      return;
    }
    
    // Validate required data if specified
    if (options?.validateData || options?.requiredData) {
      const validatedData = this.validateAndFixData(target, data, options.requiredData);
      if (!validatedData) {
        console.error(`❌ Required data missing for ${target}`);
        const fallback = options?.fallbackScene || this.getFallbackScene(target);
        console.warn(`⚠️ Falling back to ${fallback}`);
        scene.scene.start(fallback);
        return;
      }
      data = validatedData;
    }
    
    // Perform the transition
    try {
      scene.scene.start(target, data);
    } catch (error) {
      console.error(`❌ Scene transition failed: ${from} → ${target}`, error);
      this.handleTransitionError(scene, target, error);
    }
  }
  
  /**
   * Check if a scene exists
   */
  private static validateSceneExists(scene: Phaser.Scene, target: string): boolean {
    // Check our known scenes list
    if (!this.validScenes.includes(target)) {
      return false;
    }
    
    // Double-check with Phaser
    const targetScene = scene.scene.manager.getScene(target);
    return targetScene !== null;
  }
  
  /**
   * Validate and fix data for a scene transition
   */
  private static validateAndFixData(
    target: string, 
    data: any,
    requiredFields?: string[]
  ): any | null {
    // Scene-specific data requirements
    const sceneRequirements: Record<string, string[]> = {
      'GameScene': ['playerLoadout'], // matchData is optional for late joins
      'LobbyWaitingScene': ['lobbyData'],
      'MatchResultsScene': ['matchResults'],
      'ConfigureScene': [], // matchData is optional
      'ServerBrowserScene': [],
      'MatchmakingScene': []
    };
    
    const required = requiredFields || sceneRequirements[target] || [];
    if (required.length === 0) return data || {};
    
    // Check for required fields
    const fixedData = { ...data };
    let hasAllRequired = true;
    
    for (const field of required) {
      if (!fixedData[field]) {
        // Try to get from registry for certain fields
        if (field === 'playerLoadout' && target === 'GameScene') {
          const game = (window as any).game;
          const loadout = game?.registry?.get('playerLoadout');
          if (loadout) {
            console.log(`✅ Retrieved ${field} from registry`);
            fixedData[field] = loadout;
          } else {
            console.error(`❌ Missing required field: ${field}`);
            hasAllRequired = false;
          }
        } else {
          console.error(`❌ Missing required field: ${field}`);
          hasAllRequired = false;
        }
      }
    }
    
    return hasAllRequired ? fixedData : null;
  }
  
  /**
   * Get fallback scene for a given target
   */
  private static getFallbackScene(target: string): string {
    const fallbacks: Record<string, string> = {
      'GameScene': 'ConfigureScene',
      'ConfigureScene': 'LobbyMenuScene',
      'LobbyWaitingScene': 'LobbyMenuScene',
      'MatchResultsScene': 'LobbyMenuScene',
      'ServerBrowserScene': 'LobbyMenuScene',
      'MatchmakingScene': 'LobbyMenuScene',
      'LobbyMenuScene': 'MenuScene',
      'ServerConnectionScene': 'MenuScene',
      'ServerConnectionSceneText': 'MenuScene'
    };
    
    return fallbacks[target] || 'MenuScene';
  }
  
  /**
   * Handle transition errors
   */
  private static handleTransitionError(scene: Phaser.Scene, target: string, error: any): void {
    console.error('Scene transition error:', error);
    
    // Try fallback scene
    const fallback = this.getFallbackScene(target);
    console.log(`Attempting fallback to ${fallback}`);
    
    try {
      scene.scene.start(fallback);
    } catch (fallbackError) {
      console.error('Fallback also failed, going to MenuScene');
      try {
        scene.scene.start('MenuScene');
      } catch (finalError) {
        console.error('❌ CRITICAL: Cannot navigate to any scene!');
      }
    }
  }
  
  /**
   * Simple back navigation
   */
  static back(scene: Phaser.Scene): void {
    const from = scene.scene.key;
    const destination = this.getFallbackScene(from);
    console.log(`⬅️ Back navigation: ${from} → ${destination}`);
    this.transition(scene, destination);
  }
}

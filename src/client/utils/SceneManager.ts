/**
 * Centralized Scene Manager to handle scene transitions cleanly
 * Prevents multiple scenes from being active simultaneously
 */
export class SceneManager {
  private static transitioning = false;
  private static activeScenes = new Set<string>();
  private static transitionTimeout: any = null;
  
  /**
   * Safely transition to a new scene, ensuring proper cleanup
   */
  static transition(currentScene: Phaser.Scene, targetScene: string, data?: any): void {
    const currentSceneName = currentScene.scene.key;
    
    // If transitioning to the same scene we're already in, ignore
    if (currentSceneName === targetScene) {
      console.log(`📍 Already in ${targetScene}, ignoring transition`);
      return;
    }
    
    // Check if target scene is already active
    const targetSceneInstance = currentScene.scene.manager.getScene(targetScene);
    if (targetSceneInstance && targetSceneInstance.scene.isActive()) {
      console.log(`📍 ${targetScene} is already active, ignoring transition`);
      return;
    }
    
    // If we're already transitioning to this same target, allow it (reset the transition)
    if (this.transitioning) {
      console.warn(`⚠️ Overriding previous transition, forcing transition to ${targetScene}`);
      this.forceResetTransition();
    }
    
    console.log(`🎬 Transitioning from ${currentSceneName} to ${targetScene}`);
    
    this.transitioning = true;
    
    // Set a timeout to force reset the flag if something goes wrong
    if (this.transitionTimeout) {
      clearTimeout(this.transitionTimeout);
    }
    this.transitionTimeout = setTimeout(() => {
      if (this.transitioning) {
        console.error('⚠️ Transition timeout - forcing reset');
        this.transitioning = false;
      }
    }, 2000); // 2 second timeout
    
    try {
      // Stop all active scenes first (except LoadingScene and target)
      const sceneManager = currentScene.scene.manager;
      const scenes = sceneManager.scenes;
      
      scenes.forEach((scene: Phaser.Scene) => {
        if (scene.scene.isActive() && 
            scene.scene.key !== 'LoadingScene' && 
            scene.scene.key !== targetScene) {
          console.log(`  📛 Stopping active scene: ${scene.scene.key}`);
          scene.scene.stop();
        }
      });
      
      // Clear our tracking
      this.activeScenes.clear();
      
      // Slightly longer delay to ensure cleanup completes
      currentScene.time.delayedCall(100, () => {
        try {
          // Now start the target scene
          console.log(`  ✅ Starting scene: ${targetScene}`);
          currentScene.scene.start(targetScene, data);
          this.activeScenes.add(targetScene);
        } catch (error) {
          console.error(`❌ Failed to start ${targetScene}:`, error);
        } finally {
          // Always reset the transitioning flag
          this.transitioning = false;
          if (this.transitionTimeout) {
            clearTimeout(this.transitionTimeout);
            this.transitionTimeout = null;
          }
        }
      });
      
    } catch (error) {
      console.error(`❌ Scene transition failed:`, error);
      this.forceResetTransition();
      
      // Fallback to lobby menu on error
      if (targetScene !== 'LobbyMenuScene') {
        currentScene.scene.start('LobbyMenuScene');
      }
    }
  }
  
  /**
   * Force reset the transition state
   */
  private static forceResetTransition(): void {
    this.transitioning = false;
    if (this.transitionTimeout) {
      clearTimeout(this.transitionTimeout);
      this.transitionTimeout = null;
    }
  }
  
  /**
   * Stop a scene properly
   */
  static stopScene(scene: Phaser.Scene): void {
    const sceneName = scene.scene.key;
    console.log(`📛 Stopping scene: ${sceneName}`);
    
    try {
      scene.scene.stop();
      this.activeScenes.delete(sceneName);
    } catch (error) {
      console.error(`❌ Failed to stop scene ${sceneName}:`, error);
    }
  }
  
  /**
   * Check if we're currently transitioning
   */
  static isTransitioning(): boolean {
    return this.transitioning;
  }
  
  /**
   * Get list of active scenes
   */
  static getActiveScenes(): string[] {
    return Array.from(this.activeScenes);
  }
  
  /**
   * Emergency cleanup - stops all scenes except LoadingScene
   */
  static emergencyCleanup(currentScene: Phaser.Scene): void {
    console.warn('🚨 Emergency scene cleanup initiated');
    
    const sceneManager = currentScene.scene.manager;
    const scenes = sceneManager.scenes;
    
    scenes.forEach((scene: Phaser.Scene) => {
      if (scene.scene.isActive() && scene.scene.key !== 'LoadingScene') {
        console.log(`  📛 Emergency stop: ${scene.scene.key}`);
        try {
          scene.scene.stop();
        } catch (error) {
          console.error(`  ❌ Failed to stop ${scene.scene.key}:`, error);
        }
      }
    });
    
    this.activeScenes.clear();
    this.transitioning = false;
    
    // Return to safe state
    currentScene.time.delayedCall(100, () => {
      currentScene.scene.start('LobbyMenuScene');
    });
  }
}

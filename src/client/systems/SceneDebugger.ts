/**
 * Scene Debugger - Helps diagnose and fix scene management issues
 */
export class SceneDebugger {
  private scene: Phaser.Scene;
  private debugText?: Phaser.GameObjects.Text;
  private updateTimer?: Phaser.Time.TimerEvent;
  
  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }
  
  /**
   * Enable scene debugging overlay
   */
  enable(): void {
    // Create debug overlay
    this.debugText = this.scene.add.text(5, 5, '', {
      fontSize: '8px',
      color: '#00ff00',
      backgroundColor: '#000000aa',
      padding: { x: 2, y: 2 }
    });
    this.debugText.setDepth(100000);
    this.debugText.setScrollFactor(0);
    
    // Update every 500ms
    this.updateTimer = this.scene.time.addEvent({
      delay: 500,
      callback: () => this.update(),
      loop: true
    });
    
    // Initial update
    this.update();
  }
  
  /**
   * Update debug information
   */
  private update(): void {
    if (!this.debugText) return;
    
    const manager = this.scene.scene.manager;
    const activeScenes: string[] = [];
    const sleepingScenes: string[] = [];
    
    // Check all scenes
    manager.scenes.forEach((scene: Phaser.Scene) => {
      if (scene.scene.isActive()) {
        activeScenes.push(scene.scene.key);
      } else if (scene.scene.isSleeping()) {
        sleepingScenes.push(scene.scene.key);
      }
    });
    
    // Check for problems
    const problems: string[] = [];
    if (activeScenes.length > 2) {
      problems.push('⚠️ Multiple scenes active!');
    }
    
    // Check for duplicate GameScenes
    const gameSceneCount = activeScenes.filter(s => s === 'GameScene').length;
    if (gameSceneCount > 1) {
      problems.push('🔴 DUPLICATE GameScene!');
    }
    
    // Build debug text
    let debugInfo = `SCENE DEBUG\n`;
    debugInfo += `Active: ${activeScenes.join(', ') || 'none'}\n`;
    
    if (sleepingScenes.length > 0) {
      debugInfo += `Sleeping: ${sleepingScenes.join(', ')}\n`;
    }
    
    if (problems.length > 0) {
      debugInfo += `\nPROBLEMS:\n${problems.join('\n')}`;
    }
    
    this.debugText.setText(debugInfo);
    
    // Auto-fix critical issues
    if (activeScenes.length > 2 && activeScenes.includes('GameScene') && activeScenes.includes('LobbyWaitingScene')) {
      console.error('🚨 CRITICAL: Both GameScene and LobbyWaitingScene are active!');
      this.attemptAutoFix(activeScenes);
    }
  }
  
  /**
   * Attempt to auto-fix scene conflicts
   */
  private attemptAutoFix(activeScenes: string[]): void {
    console.warn('🔧 Attempting auto-fix for scene conflicts...');
    
    // If both GameScene and LobbyWaitingScene are active, stop the lobby
    if (activeScenes.includes('GameScene') && activeScenes.includes('LobbyWaitingScene')) {
      const lobbyScene = this.scene.scene.get('LobbyWaitingScene');
      if (lobbyScene) {
        console.log('  📛 Stopping LobbyWaitingScene (GameScene takes priority)');
        lobbyScene.scene.stop();
      }
    }
  }
  
  /**
   * Disable debugging
   */
  disable(): void {
    if (this.debugText) {
      this.debugText.destroy();
      this.debugText = undefined;
    }
    
    if (this.updateTimer) {
      this.updateTimer.destroy();
      this.updateTimer = undefined;
    }
  }
  
  /**
   * Force cleanup all scenes except the current one
   */
  forceCleanup(): void {
    console.warn('🧹 Force cleaning up all other scenes...');
    
    const currentKey = this.scene.scene.key;
    const manager = this.scene.scene.manager;
    
    manager.scenes.forEach((scene: Phaser.Scene) => {
      if (scene.scene.key !== currentKey && scene.scene.key !== 'LoadingScene') {
        if (scene.scene.isActive()) {
          console.log(`  📛 Force stopping: ${scene.scene.key}`);
          scene.scene.stop();
        }
      }
    });
  }
}

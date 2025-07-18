import { NetworkSystem } from './NetworkSystem';

class NetworkSystemSingleton {
  private static instance: NetworkSystem | null = null;
  
  static getInstance(scene?: Phaser.Scene): NetworkSystem {
    if (!this.instance && scene) {
      this.instance = new NetworkSystem(scene);
      // Don't initialize here - let the scene do it
      console.log('NetworkSystemSingleton: Created new instance');
    } else if (this.instance && scene) {
      // Update scene reference without destroying connection
      const currentState = this.instance.getConnectionState();
      const isAuthenticated = this.instance.isAuthenticated();
      console.log(`NetworkSystemSingleton: Updating scene, current state: ${currentState}, authenticated: ${isAuthenticated}`);
      
      this.instance.updateScene(scene);
      console.log('NetworkSystemSingleton: Updated scene reference');
    }
    
    if (!this.instance) {
      throw new Error('NetworkSystemSingleton: No instance exists and no scene provided');
    }
    
    return this.instance;
  }
  
  static hasInstance(): boolean {
    return this.instance !== null;
  }
  
  static destroy(): void {
    console.warn('NetworkSystemSingleton: destroy() called - this should not happen during normal gameplay!');
    console.trace(); // Log stack trace to see who's calling destroy
    if (this.instance) {
      this.instance.destroy();
      this.instance = null;
      console.log('NetworkSystemSingleton: Destroyed instance');
    }
  }
}

export default NetworkSystemSingleton; 
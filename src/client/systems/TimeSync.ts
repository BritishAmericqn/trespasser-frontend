/**
 * TimeSync - Synchronizes client time with server time
 * 
 * Uses NTP-style algorithm to calculate time offset accounting for network latency.
 * Re-syncs periodically to prevent drift over time.
 */
export class TimeSync {
  private timeOffset: number = 0;
  private socket: any;
  private syncInterval: number | null = null;
  private lastSyncTime: number = 0;
  private syncAttempts: number = 0;
  private maxSyncAttempts: number = 3;
  private isDestroyed: boolean = false;
  
  constructor(socket: any) {
    this.socket = socket;
    this.initializeSync();
  }
  
  private initializeSync(): void {
    if (!this.socket) {
      console.error('❌ TimeSync: No socket provided');
      return;
    }
    
    // Initial sync on connection
    this.socket.on('connect', () => {
      if (!this.isDestroyed) {
        console.log('⏰ TimeSync: Socket connected, performing initial sync');
        this.performSync();
        
        // Set up periodic re-sync every 30 seconds
        if (this.syncInterval) {
          clearInterval(this.syncInterval);
        }
        
        this.syncInterval = window.setInterval(() => {
          if (!this.isDestroyed && this.socket?.connected) {
            this.performSync();
          }
        }, 30000);
      }
    });
    
    // Handle sync response from server
    this.socket.on('time:sync:response', (data: any) => {
      if (this.isDestroyed) return;
      
      const now = Date.now();
      const rtt = now - data.clientTime; // Round trip time
      const serverTime = data.serverTime + Math.floor(rtt / 2); // Estimate current server time
      const newOffset = serverTime - now;
      
      // If this is first sync or offset changed significantly, update it
      if (this.syncAttempts === 0 || Math.abs(newOffset - this.timeOffset) > 100) {
        this.timeOffset = newOffset;
        console.log(`⏰ TimeSync: Synchronized! Offset: ${this.timeOffset}ms, RTT: ${rtt}ms`);
      } else {
        // Small adjustments - use weighted average to smooth
        this.timeOffset = Math.floor(this.timeOffset * 0.8 + newOffset * 0.2);
        console.log(`⏰ TimeSync: Adjusted offset to ${this.timeOffset}ms (RTT: ${rtt}ms)`);
      }
      
      this.lastSyncTime = now;
      this.syncAttempts++;
    });
    
    // Handle sync error
    this.socket.on('time:sync:error', (error: any) => {
      console.error('❌ TimeSync: Server sync error:', error);
    });
    
    // Clear interval on disconnect
    this.socket.on('disconnect', () => {
      console.log('⏰ TimeSync: Socket disconnected, clearing sync interval');
      if (this.syncInterval) {
        clearInterval(this.syncInterval);
        this.syncInterval = null;
      }
    });
  }
  
  private performSync(): void {
    if (!this.socket?.connected || this.isDestroyed) {
      console.warn('⏰ TimeSync: Cannot sync - socket not connected or destroyed');
      return;
    }
    
    const clientTime = Date.now();
    this.socket.emit('time:sync', clientTime);
    console.log('⏰ TimeSync: Requesting time sync from server');
  }
  
  /**
   * Get the current server time (client time + offset)
   */
  getServerTime(): number {
    return Date.now() + this.timeOffset;
  }
  
  /**
   * Get the current time offset in milliseconds
   */
  getOffset(): number {
    return this.timeOffset;
  }
  
  /**
   * Get milliseconds since last sync
   */
  getLastSyncAge(): number {
    return this.lastSyncTime ? Date.now() - this.lastSyncTime : Infinity;
  }
  
  /**
   * Check if time sync is healthy (synced within last minute)
   */
  isHealthy(): boolean {
    return this.getLastSyncAge() < 60000 && this.syncAttempts > 0;
  }
  
  /**
   * Force an immediate sync
   */
  forceSync(): void {
    console.log('⏰ TimeSync: Forcing immediate sync');
    this.performSync();
  }
  
  /**
   * Clean up resources
   */
  destroy(): void {
    console.log('⏰ TimeSync: Destroying');
    this.isDestroyed = true;
    
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    
    // Remove listeners if socket still exists
    if (this.socket) {
      this.socket.off('connect');
      this.socket.off('disconnect');
      this.socket.off('time:sync:response');
      this.socket.off('time:sync:error');
    }
  }
}

/**
 * Navigation Diagnostics System
 * 
 * This module provides non-invasive diagnostics for scene transitions.
 * It ONLY logs and monitors - it does not change any behavior.
 */

interface TransitionRecord {
  from: string;
  to: string;
  data: any;
  timestamp: number;
  stack?: string;
  success: boolean;
}

export class NavigationDiagnostics {
  private static history: TransitionRecord[] = [];
  private static isEnabled: boolean = true;
  private static problemPatterns: Map<string, number> = new Map();
  
  /**
   * Initialize diagnostics - make available in console
   * This is non-invasive - it only adds logging
   */
  static initialize(): void {
    if (typeof window !== 'undefined') {
      (window as any).navDiag = this;
      console.log('✅ Navigation diagnostics initialized. Use window.navDiag.getReport() to see navigation patterns.');
    }
  }
  
  /**
   * Manually log a scene transition (call this from scenes)
   */
  static logTransition(from: string, to: string, data?: any): void {
    this.recordTransition(from, to, data, true);
  }
  
  /**
   * Record a scene transition
   */
  private static recordTransition(from: string, to: string, data: any, success: boolean): void {
    const record: TransitionRecord = {
      from,
      to,
      data: this.sanitizeData(data),
      timestamp: Date.now(),
      success,
      stack: new Error().stack?.split('\n').slice(3, 5).join('\n')
    };
    
    this.history.push(record);
    
    // Keep only last 50 transitions to prevent memory issues
    if (this.history.length > 50) {
      this.history.shift();
    }
    
    // Log the transition
    const dataKeys = data ? Object.keys(data) : [];
    const hasRequiredData = this.checkRequiredData(to, data);
    
    console.log(
      `🎬 TRANSITION: ${from} → ${to}`,
      {
        dataKeys,
        hasRequiredData,
        timestamp: new Date().toISOString()
      }
    );
    
    // Check for problems
    this.detectProblems(record);
  }
  
  /**
   * Sanitize data for storage (remove circular references)
   */
  private static sanitizeData(data: any): any {
    if (!data) return null;
    
    try {
      // Only keep keys, not values (to avoid circular references)
      return Object.keys(data).reduce((acc, key) => {
        acc[key] = typeof data[key];
        return acc;
      }, {} as any);
    } catch {
      return 'complex-object';
    }
  }
  
  /**
   * Check if required data exists for a scene
   */
  private static checkRequiredData(sceneName: string, data: any): boolean {
    const requirements: Record<string, string[]> = {
      'GameScene': ['matchData', 'playerLoadout'],
      'LobbyWaitingScene': ['lobbyData'],
      'MatchResultsScene': ['matchResults'],
      'ConfigureScene': [] // Optional matchData
    };
    
    const required = requirements[sceneName] || [];
    if (required.length === 0) return true;
    
    // Check if data has required fields OR if they exist in registry
    for (const field of required) {
      const hasField = data?.[field] !== undefined;
      if (!hasField && sceneName === 'GameScene' && field === 'playerLoadout') {
        // Special case: GameScene can get playerLoadout from registry
        const game = (window as any).game;
        if (game?.registry?.get('playerLoadout')) {
          continue;
        }
      }
      if (!hasField) {
        console.warn(`⚠️ ${sceneName} missing required data: ${field}`);
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Detect problem patterns
   */
  private static detectProblems(record: TransitionRecord): void {
    // Check for loops (A→B→A in quick succession)
    const recent = this.history.slice(-3);
    if (recent.length === 3) {
      const pattern = recent.map(r => r.to).join('→');
      if (recent[0].to === recent[2].to && recent[0].to !== recent[1].to) {
        console.warn(`🔄 Potential navigation loop detected: ${pattern}`);
        this.problemPatterns.set('loop', (this.problemPatterns.get('loop') || 0) + 1);
      }
    }
    
    // Check for rapid transitions (< 100ms apart)
    if (this.history.length > 1) {
      const lastTransition = this.history[this.history.length - 2];
      const timeDiff = record.timestamp - lastTransition.timestamp;
      if (timeDiff < 100) {
        console.warn(`⚡ Rapid transition detected (${timeDiff}ms): ${lastTransition.to} → ${record.to}`);
        this.problemPatterns.set('rapid', (this.problemPatterns.get('rapid') || 0) + 1);
      }
    }
    
    // Check for missing data transitions
    if (!record.success || !this.checkRequiredData(record.to, record.data)) {
      this.problemPatterns.set('missingData', (this.problemPatterns.get('missingData') || 0) + 1);
    }
  }
  
  /**
   * Get diagnostic report
   */
  static getReport(): void {
    console.group('📊 Navigation Diagnostics Report');
    
    // Recent transitions
    console.group('Recent Transitions:');
    this.history.slice(-10).forEach(record => {
      const time = new Date(record.timestamp).toLocaleTimeString();
      const status = record.success ? '✅' : '❌';
      console.log(`${status} [${time}] ${record.from} → ${record.to}`);
    });
    console.groupEnd();
    
    // Problem patterns
    if (this.problemPatterns.size > 0) {
      console.group('⚠️ Problem Patterns:');
      this.problemPatterns.forEach((count, pattern) => {
        console.log(`${pattern}: ${count} occurrences`);
      });
      console.groupEnd();
    }
    
    // Most common transitions
    const transitionCounts = new Map<string, number>();
    this.history.forEach(record => {
      const key = `${record.from}→${record.to}`;
      transitionCounts.set(key, (transitionCounts.get(key) || 0) + 1);
    });
    
    console.group('Most Common Transitions:');
    Array.from(transitionCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .forEach(([transition, count]) => {
        console.log(`${transition}: ${count} times`);
      });
    console.groupEnd();
    
    console.groupEnd();
  }
  
  /**
   * Get the last N transitions
   */
  static getHistory(count: number = 10): TransitionRecord[] {
    return this.history.slice(-count);
  }
  
  /**
   * Clear history
   */
  static clear(): void {
    this.history = [];
    this.problemPatterns.clear();
    console.log('Navigation diagnostics cleared');
  }
  
  /**
   * Enable/disable diagnostics
   */
  static setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    console.log(`Navigation diagnostics ${enabled ? 'enabled' : 'disabled'}`);
  }
}

// Auto-initialize if in browser environment
if (typeof window !== 'undefined' && typeof Phaser !== 'undefined') {
  // Wait for Phaser to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      NavigationDiagnostics.initialize();
    });
  } else {
    NavigationDiagnostics.initialize();
  }
}

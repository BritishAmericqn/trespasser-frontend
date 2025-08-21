import { GAME_CONFIG } from '../../../shared/constants/index';
import { NetworkSystem } from '../systems/NetworkSystem';
import NetworkSystemSingleton from '../systems/NetworkSystemSingleton';
import { LobbyStateManager } from '../systems/LobbyStateManager';

interface MatchResults {
  lobbyId: string;
  winnerTeam: 'red' | 'blue';
  redKills: number;
  blueKills: number;
  duration: number; // milliseconds
  playerStats: Array<{
    playerId: string;
    playerName: string;
    team: 'red' | 'blue';
    kills: number;
    deaths: number;
    damageDealt: number;
  }>;
}

export class MatchResultsScene extends Phaser.Scene {
  private networkSystem!: NetworkSystem;
  
  // UI Elements
  private resultsContainer!: Phaser.GameObjects.Container;
  private playAgainButton!: Phaser.GameObjects.Text;
  private mainMenuButton!: Phaser.GameObjects.Text;
  
  // State
  private matchResults!: MatchResults;
  private autoReturnTimer!: Phaser.Time.TimerEvent;
  private autoReturnCountdown: number = 30; // 30 seconds auto-return

  constructor() {
    super({ key: 'MatchResultsScene' });
  }

  init(data: any): void {
    console.log('🏁 MatchResultsScene init with data:', data);
    
    // SENIOR DEV REVIEW: Handle both wrapped and direct data formats
    // Backend sends data.matchResults, but some paths might send direct data
    this.matchResults = data.matchResults || data;
    
    // Validate required fields with proper error handling
    if (!this.matchResults || !this.matchResults.winnerTeam) {
      console.error('❌ Invalid match results data:', data);
      // Fallback for development/testing only
      this.matchResults = {
        lobbyId: 'test-lobby',
        winnerTeam: 'red',
        redKills: 50,
        blueKills: 47,
        duration: 300000,
        playerStats: []
      };
      console.warn('⚠️ Using fallback match data for display');
      return;
    }
    
    // Ensure playerStats is an array (backend guarantees this, but defensive coding)
    if (!Array.isArray(this.matchResults.playerStats)) {
      console.warn('⚠️ playerStats not an array, defaulting to empty');
      this.matchResults.playerStats = [];
    }
    
    // Log what we're working with
    console.log(`📊 Match Results Loaded:
      Winner: ${this.matchResults.winnerTeam}
      Score: RED ${this.matchResults.redKills} - ${this.matchResults.blueKills} BLUE
      Players: ${this.matchResults.playerStats.length}
      Duration: ${Math.floor((this.matchResults.duration || 0) / 1000)}s
    `);
  }

  create(): void {
    console.log('🎮 MatchResultsScene create() called');
    
    try {
      // Create dark background with overlay
      this.add.rectangle(0, 0, GAME_CONFIG.GAME_WIDTH, GAME_CONFIG.GAME_HEIGHT, 0x000000, 0.9)
        .setOrigin(0, 0);

      // Get NetworkSystem singleton
      this.networkSystem = NetworkSystemSingleton.getInstance(this);
      
      // Create the UI
      this.createUI();
      
      // Start auto-return countdown
      this.startAutoReturnTimer();
      
      console.log('✅ MatchResultsScene created successfully');
    } catch (error) {
      console.error('❌ Error creating MatchResultsScene:', error);
      // Try to return to menu on error
      this.time.delayedCall(2000, () => {
        this.scene.start('MenuScene');
      });
    }
  }

  private createUI(): void {
    // Victory banner
    this.createVictoryBanner();
    
    // Match summary
    this.createMatchSummary();
    
    // Player scoreboard
    this.createScoreboard();
    
    // Action buttons
    this.createActionButtons();
    
    // Auto-return countdown
    this.createAutoReturnDisplay();
  }

  private createVictoryBanner(): void {
    // Winner announcement (big and bold)
    const winnerTeam = this.matchResults?.winnerTeam || 'red';
    const winnerColor = winnerTeam === 'red' ? '#ff4444' : '#4444ff';
    const winnerText = `${winnerTeam.toUpperCase()} TEAM WINS!`;
    
    const banner = this.add.text(GAME_CONFIG.GAME_WIDTH / 2, 40, winnerText, {
      fontSize: '24px',
      color: winnerColor,
      fontStyle: 'bold',
      fontFamily: 'monospace',
      shadow: { offsetX: 2, offsetY: 2, color: '#000000', blur: 4, stroke: true, fill: true }
    }).setOrigin(0.5);

    // Add celebration animation
    this.tweens.add({
      targets: banner,
      scaleX: 1.1,
      scaleY: 1.1,
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // Final score display
    const redKills = this.matchResults?.redKills || 0;
    const blueKills = this.matchResults?.blueKills || 0;
    const scoreText = `Final Score: RED ${redKills} - ${blueKills} BLUE`;
    this.add.text(GAME_CONFIG.GAME_WIDTH / 2, 65, scoreText, {
      fontSize: '14px',
      color: '#ffffff',
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    // Match duration
    const matchDuration = this.matchResults?.duration || 0;
    const duration = this.formatDuration(matchDuration);
    this.add.text(GAME_CONFIG.GAME_WIDTH / 2, 80, `Match Duration: ${duration}`, {
      fontSize: '10px',
      color: '#cccccc',
      fontFamily: 'monospace'
    }).setOrigin(0.5);
  }

  private createMatchSummary(): void {
    // Team scores section
    const summaryY = 105;
    
    // Red team score
    const redKills = this.matchResults?.redKills || 0;
    const redScore = this.add.text(GAME_CONFIG.GAME_WIDTH / 2 - 60, summaryY, `RED TEAM\n${redKills} kills`, {
      fontSize: '12px',
      color: '#ff4444',
      fontStyle: 'bold',
      fontFamily: 'monospace',
      align: 'center'
    }).setOrigin(0.5);

    // VS divider
    this.add.text(GAME_CONFIG.GAME_WIDTH / 2, summaryY, 'VS', {
      fontSize: '10px',
      color: '#888888',
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    // Blue team score
    const blueKills = this.matchResults?.blueKills || 0;
    const blueScore = this.add.text(GAME_CONFIG.GAME_WIDTH / 2 + 60, summaryY, `BLUE TEAM\n${blueKills} kills`, {
      fontSize: '12px',
      color: '#4444ff',
      fontStyle: 'bold',
      fontFamily: 'monospace',
      align: 'center'
    }).setOrigin(0.5);
  }

  private createScoreboard(): void {
    const startY = 140;
    
    // Scoreboard title
    this.add.text(GAME_CONFIG.GAME_WIDTH / 2, startY, 'PLAYER STATISTICS', {
      fontSize: '12px',
      color: '#00ff00',
      fontStyle: 'bold',
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    // Scoreboard background
    const boardBg = this.add.graphics();
    boardBg.fillStyle(0x1a1a1a, 0.8);
    boardBg.lineStyle(1, 0x444444);
    boardBg.fillRect(20, startY + 10, GAME_CONFIG.GAME_WIDTH - 40, 80);
    boardBg.strokeRect(20, startY + 10, GAME_CONFIG.GAME_WIDTH - 40, 80);

    // Headers
    const headerY = startY + 20;
    this.add.text(30, headerY, 'PLAYER', {
      fontSize: '8px',
      color: '#cccccc',
      fontStyle: 'bold',
      fontFamily: 'monospace'
    });
    this.add.text(120, headerY, 'TEAM', {
      fontSize: '8px',
      color: '#cccccc',
      fontStyle: 'bold',
      fontFamily: 'monospace'
    });
    this.add.text(160, headerY, 'KILLS', {
      fontSize: '8px',
      color: '#cccccc',
      fontStyle: 'bold',
      fontFamily: 'monospace'
    });
    this.add.text(200, headerY, 'DEATHS', {
      fontSize: '8px',
      color: '#cccccc',
      fontStyle: 'bold',
      fontFamily: 'monospace'
    });
    this.add.text(250, headerY, 'K/D', {
      fontSize: '8px',
      color: '#cccccc',
      fontStyle: 'bold',
      fontFamily: 'monospace'
    });

    // Sort players by kills (descending)
    // SENIOR DEV REVIEW: Backend now provides real playerStats array
    if (!this.matchResults.playerStats || !Array.isArray(this.matchResults.playerStats)) {
      console.warn('⚠️ No player stats available, skipping scoreboard rows');
      return;
    }
    
    if (this.matchResults.playerStats.length === 0) {
      // Show message for empty scoreboard
      this.add.text(GAME_CONFIG.GAME_WIDTH / 2, startY + 40, 'No player data available', {
        fontSize: '10px',
        color: '#888888',
        fontFamily: 'monospace'
      }).setOrigin(0.5);
      return;
    }
    
    const sortedStats = [...this.matchResults.playerStats].sort((a, b) => b.kills - a.kills);

    // Player rows
    let rowY = headerY + 12;
    sortedStats.forEach((player, index) => {
      if (rowY > startY + 75) return; // Don't exceed scoreboard bounds

      const teamColor = player.team === 'red' ? '#ff6666' : '#6666ff';
      const kd = player.deaths > 0 ? (player.kills / player.deaths).toFixed(1) : player.kills.toString();

      // Player name with fallback (backend provides playerName)
      const displayName = player.playerName || player.playerId || `Player${index + 1}`;
      const playerName = displayName.length > 12 ? 
        displayName.substring(0, 12) + '...' : 
        displayName;

      this.add.text(30, rowY, playerName, {
        fontSize: '8px',
        color: '#ffffff',
        fontFamily: 'monospace'
      });

      this.add.text(120, rowY, player.team.toUpperCase(), {
        fontSize: '8px',
        color: teamColor,
        fontFamily: 'monospace'
      });

      this.add.text(160, rowY, player.kills.toString(), {
        fontSize: '8px',
        color: '#ffffff',
        fontFamily: 'monospace'
      });

      this.add.text(200, rowY, player.deaths.toString(), {
        fontSize: '8px',
        color: '#ffffff',
        fontFamily: 'monospace'
      });

      this.add.text(250, rowY, kd, {
        fontSize: '8px',
        color: '#ffffff',
        fontFamily: 'monospace'
      });

      rowY += 10;
    });
  }

  private createActionButtons(): void {
    const buttonY = GAME_CONFIG.GAME_HEIGHT - 50;

    // Fixed-width button dimensions
    const buttonWidth = 90;
    const buttonHeight = 20;
    const buttonGap = 20;
    
    // Play Again button with fixed-width background
    const playAgainX = GAME_CONFIG.GAME_WIDTH / 2 - buttonGap/2 - buttonWidth/2;
    const playAgainBg = this.add.graphics();
    playAgainBg.fillStyle(0x006600);
    playAgainBg.fillRect(
      playAgainX - buttonWidth/2,
      buttonY - buttonHeight/2,
      buttonWidth,
      buttonHeight
    );
    
    this.playAgainButton = this.add.text(playAgainX, buttonY, 'AGAIN', {
      fontSize: '12px',
      color: '#ffffff',
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    // Main Menu button with fixed-width background
    const mainMenuX = GAME_CONFIG.GAME_WIDTH / 2 + buttonGap/2 + buttonWidth/2;
    const mainMenuBg = this.add.graphics();
    mainMenuBg.fillStyle(0x333333);
    mainMenuBg.fillRect(
      mainMenuX - buttonWidth/2,
      buttonY - buttonHeight/2,
      buttonWidth,
      buttonHeight
    );
    
    this.mainMenuButton = this.add.text(mainMenuX, buttonY, 'MENU', {
      fontSize: '12px',
      color: '#ffffff',
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    // Setup button interactions
    this.setupButton(this.playAgainButton, '#006600', '#008800', () => this.playAgain());
    this.setupButton(this.mainMenuButton, '#333333', '#555555', () => this.returnToMenu());
  }

  private createAutoReturnDisplay(): void {
    // Auto-return countdown at bottom
    const countdownText = this.add.text(GAME_CONFIG.GAME_WIDTH / 2, GAME_CONFIG.GAME_HEIGHT - 15, '', {
      fontSize: '8px',
      color: '#888888',
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    // Update countdown display
    const updateCountdown = () => {
      countdownText.setText(`Returning to lobby browser in ${this.autoReturnCountdown}s (or press button)`);
    };

    updateCountdown();

    // Timer to update countdown
    this.time.addEvent({
      delay: 1000,
      callback: () => {
        this.autoReturnCountdown--;
        if (this.autoReturnCountdown > 0) {
          updateCountdown();
        }
      },
      repeat: this.autoReturnCountdown - 1
    });
  }

  private setupButton(button: Phaser.GameObjects.Text, normalColor: string, hoverColor: string, callback: () => void): void {
    button.setInteractive({ useHandCursor: true });
    
    button.on('pointerover', () => {
      button.setStyle({ backgroundColor: hoverColor });
      this.tweens.add({
        targets: button,
        scaleX: 1.02,
        scaleY: 1.02,
        duration: 100,
        ease: 'Power2'
      });
    });
    
    button.on('pointerout', () => {
      button.setStyle({ backgroundColor: normalColor });
      this.tweens.add({
        targets: button,
        scaleX: 1,
        scaleY: 1,
        duration: 100,
        ease: 'Power2'
      });
    });
    
    button.on('pointerdown', () => {
      this.tweens.add({
        targets: button,
        scaleX: 0.98,
        scaleY: 0.98,
        duration: 50,
        yoyo: true,
        ease: 'Power2',
        onComplete: () => {
          this.stopAutoReturnTimer();
          callback();
        }
      });
    });
  }

  private startAutoReturnTimer(): void {
    this.autoReturnTimer = this.time.delayedCall(30000, () => {
      console.log('⏰ Auto-returning to lobby browser...');
      this.returnToMenu();
    });
  }

  private stopAutoReturnTimer(): void {
    if (this.autoReturnTimer) {
      this.autoReturnTimer.destroy();
    }
  }

  private playAgain(): void {
    console.log('🔄 Play Again pressed - attempting rematch');
    
    // SENIOR DEV REVIEW: Stay in same lobby for rematch
    const lobbyState = LobbyStateManager.getInstance().getState();
    
    if (lobbyState?.lobbyId) {
      // Stay in same lobby
      console.log(`📍 Staying in lobby: ${lobbyState.lobbyId}`);
      
      const socket = this.networkSystem.getSocket();
      if (socket) {
        // Optional: Notify backend of rematch intent
        socket.emit('request_rematch', { 
          lobbyId: lobbyState.lobbyId,
          timestamp: Date.now()
        });
      }
      
      // Go to waiting scene in same lobby
      this.scene.start('LobbyWaitingScene', { 
        lobbyData: {
          ...lobbyState,
          status: 'waiting'
        }
      });
    } else {
      // No lobby, go to menu
      console.warn('⚠️ No lobby found, returning to menu');
      this.scene.start('LobbyMenuScene');
    }
  }

  private returnToMenu(): void {
    console.log('🏠 Returning to main menu - properly leaving lobby');
    
    // SENIOR DEV REVIEW: Proper cleanup prevents stuck lobbies
    const socket = this.networkSystem.getSocket();
    if (socket && socket.connected) {
      socket.emit('leave_lobby');
      console.log('📤 Sent leave_lobby event to backend');
    }
    
    // Clear local lobby state to prevent confusion
    LobbyStateManager.getInstance().clearState();
    console.log('🧹 Cleared local lobby state');
    
    // Small delay to ensure backend processes the leave
    // Phaser's time.delayedCall ensures proper scene lifecycle
    this.time.delayedCall(100, () => {
      this.scene.start('LobbyMenuScene');
    });
  }

  private formatDuration(milliseconds: number): string {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  shutdown(): void {
    this.stopAutoReturnTimer();
    this.tweens.killAll();
  }
}

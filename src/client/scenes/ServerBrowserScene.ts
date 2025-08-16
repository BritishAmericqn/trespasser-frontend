import { GAME_CONFIG } from '../../../shared/constants/index';
import { NetworkSystem } from '../systems/NetworkSystem';
import NetworkSystemSingleton from '../systems/NetworkSystemSingleton';

interface LobbyInfo {
  id: string;
  playerCount: number;
  maxPlayers: number;
  gameMode: string;
  status: 'waiting' | 'playing' | 'finished';
  isPrivate: boolean;
  passwordRequired: boolean;
  mapName: string;
  createdAt: number;
  lastActivity: number;
}

interface LobbyListResponse {
  lobbies: LobbyInfo[];
  totalCount: number;
}

export class ServerBrowserScene extends Phaser.Scene {
  private networkSystem!: NetworkSystem;
  
  // UI Elements
  private titleText!: Phaser.GameObjects.Text;
  private refreshButton!: Phaser.GameObjects.Text;
  private backButton!: Phaser.GameObjects.Text;
  private lobbyContainer!: Phaser.GameObjects.Container;
  private filterContainer!: Phaser.GameObjects.Container;
  private statusText!: Phaser.GameObjects.Text;
  
  // Filter toggles
  private showPrivateToggle!: Phaser.GameObjects.Text;
  private showFullToggle!: Phaser.GameObjects.Text;
  private showInProgressToggle!: Phaser.GameObjects.Text;
  
  // State
  private lobbies: LobbyInfo[] = [];
  private filters = {
    showPrivate: false,
    showFull: false,
    showInProgress: true  // Default to showing in-progress games
  };
  private refreshTimer?: Phaser.Time.TimerEvent;
  private lobbyCards: Phaser.GameObjects.Container[] = [];

  constructor() {
    super({ key: 'ServerBrowserScene' });
  }

  create(): void {
    // Dark background
    this.add.rectangle(0, 0, GAME_CONFIG.GAME_WIDTH, GAME_CONFIG.GAME_HEIGHT, 0x111111)
      .setOrigin(0, 0);

    // Get NetworkSystem singleton
    this.networkSystem = NetworkSystemSingleton.getInstance(this);
    
    // Create UI elements
    this.createUI();
    
    // Setup network listeners
    this.setupNetworkListeners();
    
    // Initial lobby request
    this.refreshLobbyList();
    
    // Auto-refresh every 5 seconds
    this.refreshTimer = this.time.addEvent({
      delay: 5000,
      callback: () => this.refreshLobbyList(),
      loop: true
    });
  }

  private createUI(): void {
    // Title
    this.titleText = this.add.text(GAME_CONFIG.GAME_WIDTH / 2, 30, 'SERVER BROWSER', {
      fontSize: '16px',
      color: '#ffffff',
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    // Back button
    this.backButton = this.add.text(50, 30, '< BACK', {
      fontSize: '12px',
      color: '#ffffff',
      backgroundColor: '#333333',
      padding: { x: 10, y: 5 },
      fontFamily: 'monospace'
    }).setOrigin(0.5);
    this.setupButton(this.backButton, '#333333', '#555555', () => {
      this.scene.start('LobbyMenuScene');
    });

    // Refresh button
    this.refreshButton = this.add.text(GAME_CONFIG.GAME_WIDTH - 50, 30, 'REFRESH', {
      fontSize: '12px',
      color: '#ffffff',
      backgroundColor: '#006600',
      padding: { x: 10, y: 5 },
      fontFamily: 'monospace'
    }).setOrigin(0.5);
    this.setupButton(this.refreshButton, '#006600', '#008800', () => {
      this.refreshLobbyList();
    });

    // Create filter controls
    this.createFilterControls();

    // Status text
    this.statusText = this.add.text(GAME_CONFIG.GAME_WIDTH / 2, GAME_CONFIG.GAME_HEIGHT - 30, '', {
      fontSize: '10px',
      color: '#888888',
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    // Lobby list container
    this.lobbyContainer = this.add.container(0, 120);
  }

  private createFilterControls(): void {
    const filterY = 70;
    const startX = GAME_CONFIG.GAME_WIDTH / 2 - 150;
    
    // Filter label
    this.add.text(startX - 60, filterY, 'FILTERS:', {
      fontSize: '10px',
      color: '#888888',
      fontFamily: 'monospace'
    }).setOrigin(0, 0.5);

    // Show Private toggle
    this.showPrivateToggle = this.add.text(startX, filterY, this.getToggleText('Show Private', this.filters.showPrivate), {
      fontSize: '10px',
      color: '#ffffff',
      fontFamily: 'monospace'
    }).setOrigin(0, 0.5);
    this.setupToggle(this.showPrivateToggle, () => {
      this.filters.showPrivate = !this.filters.showPrivate;
      this.showPrivateToggle.setText(this.getToggleText('Show Private', this.filters.showPrivate));
      this.refreshLobbyList();
    });

    // Show Full toggle
    this.showFullToggle = this.add.text(startX + 120, filterY, this.getToggleText('Show Full', this.filters.showFull), {
      fontSize: '10px',
      color: '#ffffff',
      fontFamily: 'monospace'
    }).setOrigin(0, 0.5);
    this.setupToggle(this.showFullToggle, () => {
      this.filters.showFull = !this.filters.showFull;
      this.showFullToggle.setText(this.getToggleText('Show Full', this.filters.showFull));
      this.refreshLobbyList();
    });

    // Show In Progress toggle
    this.showInProgressToggle = this.add.text(startX + 220, filterY, this.getToggleText('In Progress', this.filters.showInProgress), {
      fontSize: '10px',
      color: '#ffffff',
      fontFamily: 'monospace'
    }).setOrigin(0, 0.5);
    this.setupToggle(this.showInProgressToggle, () => {
      this.filters.showInProgress = !this.filters.showInProgress;
      this.showInProgressToggle.setText(this.getToggleText('In Progress', this.filters.showInProgress));
      this.refreshLobbyList();
    });
  }

  private getToggleText(label: string, enabled: boolean): string {
    return `[${enabled ? '✓' : ' '}] ${label}`;
  }

  private setupNetworkListeners(): void {
    const socket = this.networkSystem.getSocket();
    if (!socket) return;

    // Listen for lobby list response
    socket.on('lobby_list', (data: LobbyListResponse) => {
      console.log(`📋 Received ${data.totalCount} lobbies`);
      this.lobbies = data.lobbies;
      this.updateLobbyDisplay();
      this.statusText.setText(`Found ${data.totalCount} lobbies`);
      this.statusText.setColor('#00aa00');
    });

    // Listen for join failures
    socket.on('lobby_join_failed', (data: any) => {
      console.error('❌ Failed to join lobby:', data.reason);
      this.showError(data.reason);
    });

    // Listen for successful join
    socket.on('lobby_joined', (data: any) => {
      console.log('✅ Joined lobby:', data);
      
      // Check if the lobby is already playing
      // Check if this is a true mid-game join (game has been running for a while)
      const gameStartTime = data.gameStartTime;
      const currentTime = Date.now();
      const timeSinceStart = gameStartTime ? (currentTime - gameStartTime) / 1000 : 0;
      
      // VERY conservative late join detection - only skip configuration if:
      // 1. Game has been running for more than 2 minutes (120 seconds)
      // 2. AND we have reliable timestamp data
      // 3. AND backend explicitly says players are actively fighting
      const isDefinitelyMidGame = gameStartTime && 
                                  timeSinceStart > 120 && 
                                  data.status === 'playing' && 
                                  data.activePlayerCount > 1;
      
      if (isDefinitelyMidGame) {
        console.log(`🎮 Joining truly mid-game (started ${timeSinceStart}s ago, ${data.activePlayerCount} active players), going directly to GameScene`);
        
        // Stop this scene immediately and go to game
        this.scene.stop();
        
        // Use direct scene start for confirmed late joins
        this.scene.manager.start('GameScene', { 
          matchData: {
            lobbyId: data.lobbyId,
            isLateJoin: true,
            killTarget: data.killTarget || 50,
            gameMode: data.gameMode || 'deathmatch'
          }
        });
      } else {
        // DEFAULT: Go to configuration - much safer for player experience
        console.log(`📝 Joining lobby for configuration (game time: ${timeSinceStart}s, status: ${data.status})`);
        this.scene.start('LobbyWaitingScene', { lobbyData: data });
      }
    });
  }

  private refreshLobbyList(): void {
    const socket = this.networkSystem.getSocket();
    if (!socket || !socket.connected) {
      this.showError('Not connected to server');
      return;
    }

    console.log('🔄 Refreshing lobby list with filters:', this.filters);
    this.statusText.setText('Refreshing...');
    this.statusText.setColor('#ffaa00');

    socket.emit('get_lobby_list', {
      showPrivate: this.filters.showPrivate,
      showFull: this.filters.showFull,
      showInProgress: this.filters.showInProgress,
      gameMode: 'deathmatch'  // Optional filter
    });
  }

  private updateLobbyDisplay(): void {
    // Clear existing lobby cards
    this.lobbyCards.forEach(card => card.destroy());
    this.lobbyCards = [];

    // Create a card for each lobby
    this.lobbies.forEach((lobby, index) => {
      const card = this.createLobbyCard(lobby, index);
      this.lobbyCards.push(card);
      this.lobbyContainer.add(card);
    });

    // Show message if no lobbies
    if (this.lobbies.length === 0) {
      const emptyText = this.add.text(GAME_CONFIG.GAME_WIDTH / 2, 50, 'No lobbies found. Try adjusting filters or create your own!', {
        fontSize: '12px',
        color: '#888888',
        fontFamily: 'monospace',
        align: 'center'
      }).setOrigin(0.5);
      
      const emptyCard = this.add.container(0, 0);
      emptyCard.add(emptyText);
      this.lobbyCards.push(emptyCard);
      this.lobbyContainer.add(emptyCard);
    }
  }

  private createLobbyCard(lobby: LobbyInfo, index: number): Phaser.GameObjects.Container {
    const cardWidth = GAME_CONFIG.GAME_WIDTH - 100;
    const cardHeight = 60;
    const cardY = index * (cardHeight + 10);
    
    const container = this.add.container(GAME_CONFIG.GAME_WIDTH / 2, cardY);

    // Card background
    const bg = this.add.graphics();
    bg.fillStyle(lobby.status === 'playing' ? 0x333344 : 0x222222);
    bg.fillRoundedRect(-cardWidth/2, -cardHeight/2, cardWidth, cardHeight, 5);
    
    // Border for private lobbies
    if (lobby.isPrivate) {
      bg.lineStyle(2, 0xaaaa00);
      bg.strokeRoundedRect(-cardWidth/2, -cardHeight/2, cardWidth, cardHeight, 5);
    }

    // Game mode and map
    const titleText = this.add.text(-cardWidth/2 + 15, -cardHeight/2 + 10, 
      `${lobby.gameMode.toUpperCase()} - ${lobby.mapName}`, {
      fontSize: '12px',
      color: '#ffffff',
      fontFamily: 'monospace'
    });

    // Player count
    const playerText = this.add.text(-cardWidth/2 + 15, -cardHeight/2 + 30, 
      `Players: ${lobby.playerCount}/${lobby.maxPlayers}`, {
      fontSize: '10px',
      color: lobby.playerCount >= lobby.maxPlayers ? '#ff4444' : '#00aa00',
      fontFamily: 'monospace'
    });

    // Status badges
    const badges: string[] = [];
    if (lobby.status === 'playing') badges.push('IN GAME');
    if (lobby.isPrivate) badges.push('PRIVATE');
    if (lobby.passwordRequired) badges.push('🔒');
    
    if (badges.length > 0) {
      const badgeText = this.add.text(0, -cardHeight/2 + 20, badges.join(' | '), {
        fontSize: '9px',
        color: '#ffaa00',
        fontFamily: 'monospace'
      }).setOrigin(0.5);
      container.add(badgeText);
    }

    // Join button
    const canJoin = lobby.playerCount < lobby.maxPlayers || this.filters.showFull;
    const buttonText = lobby.status === 'playing' ? 'JOIN IN PROGRESS' : 'JOIN GAME';
    const joinButton = this.add.text(cardWidth/2 - 80, 0, buttonText, {
      fontSize: '11px',
      color: canJoin ? '#ffffff' : '#666666',
      backgroundColor: canJoin ? '#006600' : '#333333',
      padding: { x: 10, y: 5 },
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    if (canJoin) {
      this.setupButton(joinButton, '#006600', '#008800', () => {
        this.joinLobby(lobby);
      });
    }

    // Add all elements to container
    container.add([bg, titleText, playerText, joinButton]);
    
    return container;
  }

  private joinLobby(lobby: LobbyInfo): void {
    const socket = this.networkSystem.getSocket();
    if (!socket || !socket.connected) {
      this.showError('Not connected to server');
      return;
    }

    // If lobby requires password, prompt for it
    if (lobby.passwordRequired) {
      const password = prompt('This lobby requires a password:');
      if (password === null) return; // User cancelled
      
      console.log('🔐 Joining private lobby with password');
      socket.emit('join_lobby', {
        lobbyId: lobby.id,
        password: password.trim()
      });
    } else {
      console.log('🎮 Joining public lobby');
      socket.emit('join_lobby', {
        lobbyId: lobby.id
      });
    }

    this.statusText.setText('Joining lobby...');
    this.statusText.setColor('#ffaa00');
  }

  private setupButton(button: Phaser.GameObjects.Text, normalColor: string, hoverColor: string, callback: () => void): void {
    button.setInteractive({ useHandCursor: true });
    
    button.on('pointerover', () => {
      button.setBackgroundColor(hoverColor);
    });
    
    button.on('pointerout', () => {
      button.setBackgroundColor(normalColor);
    });
    
    button.on('pointerup', callback);
  }

  private setupToggle(toggle: Phaser.GameObjects.Text, callback: () => void): void {
    toggle.setInteractive({ useHandCursor: true });
    
    toggle.on('pointerover', () => {
      toggle.setColor('#ffff00');
    });
    
    toggle.on('pointerout', () => {
      toggle.setColor('#ffffff');
    });
    
    toggle.on('pointerup', callback);
  }

  private showError(message: string): void {
    this.statusText.setText(`Error: ${message}`);
    this.statusText.setColor('#ff4444');
    
    // Auto-clear error after 3 seconds
    this.time.delayedCall(3000, () => {
      this.statusText.setText('');
    });
  }

  shutdown(): void {
    // Clear refresh timer
    if (this.refreshTimer) {
      this.refreshTimer.destroy();
    }

    // Clean up socket listeners
    const socket = this.networkSystem?.getSocket();
    if (socket) {
      socket.off('lobby_list');
      socket.off('lobby_join_failed');
      socket.off('lobby_joined');
    }
  }
}

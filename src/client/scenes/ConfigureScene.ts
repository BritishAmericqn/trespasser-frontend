import { GAME_CONFIG } from '../../../shared/constants/index';
import { 
  WEAPON_CONFIGS, 
  WEAPON_CATEGORIES, 
  PlayerLoadout, 
  DEFAULT_LOADOUT,
  getWeaponConfig,
  calculateSupportSlots,
  canAddSupportWeapon,
  isValidLoadout 
} from '../../../shared/constants/weapons';
import NetworkSystemSingleton from '../systems/NetworkSystemSingleton';
import { ConnectionState } from '../systems/NetworkSystem';
import LobbyEventCoordinator from '../systems/LobbyEventCoordinator';

export class ConfigureScene extends Phaser.Scene {
  private loadout: PlayerLoadout = { ...DEFAULT_LOADOUT };
  private wallPositions: Array<{x: number, y: number, width: number, height: number}> = [];
  private matchData: any = null; // Store match data passed from lobby
  
  // UI Elements
  private leftPanel!: Phaser.GameObjects.Container;
  private rightPanel!: Phaser.GameObjects.Container;
  private topRightPanel!: Phaser.GameObjects.Container;
  private bottomRightPanel!: Phaser.GameObjects.Container;
  private teamContainer!: Phaser.GameObjects.Container;
  private weaponContainer!: Phaser.GameObjects.Container;
  private currentTab: 'team' | 'primary' | 'secondary' | 'support' = 'team';
  
  // Team Selection
  private redTeamButton!: Phaser.GameObjects.Text;
  private blueTeamButton!: Phaser.GameObjects.Text;
  private teamPreview!: Phaser.GameObjects.Rectangle;
  
  // Weapon Selection
  private tabButtons: { [key: string]: Phaser.GameObjects.Text } = {};
  private weaponButtons: { [key: string]: Phaser.GameObjects.Container } = {};
  private weaponBackgrounds: { [key: string]: Phaser.GameObjects.Rectangle } = {};
  private weaponGrid!: Phaser.GameObjects.Container;
  
  // Right Panel - Selected Loadout
  private selectedLoadoutContainer!: Phaser.GameObjects.Container;
  private selectedPrimaryDisplay!: Phaser.GameObjects.Container;
  private selectedSecondaryDisplay!: Phaser.GameObjects.Container;
  private selectedSupportDisplay!: Phaser.GameObjects.Container;
  private supportSlotsDisplay!: Phaser.GameObjects.Text;
  
  // Weapon Stats Display
  private weaponStatsContainer!: Phaser.GameObjects.Container;
  private weaponStatsText!: Phaser.GameObjects.Text;
  
  // Navigation
  private backButton!: Phaser.GameObjects.Text;
  private startGameButton!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'ConfigureScene' });
  }

  init(data?: any): void {
    // Store match data if provided from lobby
    console.log('🎮 ConfigureScene init called with data:', data);
    console.log('🎮 ConfigureScene data keys:', data ? Object.keys(data) : 'no data');
    if (data && data.matchData) {
      this.matchData = data.matchData;
      console.log('🎮 ConfigureScene received matchData:', this.matchData);
      console.log('🎮 ConfigureScene matchData keys:', Object.keys(this.matchData));
    } else {
      this.matchData = null;
      console.log('🎮 ConfigureScene - no matchData (normal flow), data was:', data);
      
      // Emergency fallback - try to get lobby data from registry if available
      const emergencyLobbyData = this.game.registry.get('currentLobbyData');
      if (emergencyLobbyData) {
        console.log('🚨 ConfigureScene: Found emergency lobbyData in registry:', emergencyLobbyData);
        this.matchData = {
          lobbyId: emergencyLobbyData.lobbyId,
          killTarget: emergencyLobbyData.killTarget || 50,
          gameMode: emergencyLobbyData.gameMode || 'deathmatch',
          isLateJoin: false
        };
        console.log('🚨 ConfigureScene: Created emergency matchData:', this.matchData);
      }
    }
  }

  create(): void {
    // IMMEDIATELY register with LobbyEventCoordinator
    if (typeof NetworkSystemSingleton !== 'undefined' && NetworkSystemSingleton.hasInstance()) {
      const networkSystem = NetworkSystemSingleton.getInstance(this);
      
      // Register with coordinator right away to handle any match_started events
      const coordinator = LobbyEventCoordinator.getInstance();
      coordinator.registerActiveScene(this);
      console.log('🎭 ConfigureScene: Early registration with coordinator complete');
      
      const socket = networkSystem.getSocket();
      if (socket) {
        // Note: match_started is now handled by LobbyEventCoordinator
        // Don't listen for game:state here - NetworkSystem handles it
      }
    }
    // Create atmospheric background from main menu
    this.createAtmosphericBackground();
    
    // Create dark semi-transparent overlay for readability
    const overlay = this.add.rectangle(0, 0, GAME_CONFIG.GAME_WIDTH, GAME_CONFIG.GAME_HEIGHT, 0x111111, 0.85)
      .setOrigin(0, 0);
    overlay.setDepth(1);

    // Title moved down to avoid overlap
    const title = this.add.text(GAME_CONFIG.GAME_WIDTH / 2, 20, 'CONFIGURE LOADOUT', {
      fontSize: '14px',
      color: '#00ff00',
      fontStyle: 'bold',
      fontFamily: 'monospace'
    }).setOrigin(0.5);
    title.setDepth(2);

    // Define layout areas with optimized spacing
    const MARGIN = 8;
    const LEFT_PANEL_WIDTH = 260;
    const RIGHT_PANEL_WIDTH = 180;
    const LEFT_PANEL_HEIGHT = 180; // Left panel height
    const TOP_RIGHT_PANEL_HEIGHT = 95; // Reduced height for more stats title room
    const BOTTOM_RIGHT_PANEL_HEIGHT = 70; // Increased height for better stats display
    const PANEL_TOP = 55; // Moved down more to put title outside box
    
    // Calculate panel positions
    const LEFT_PANEL_X = MARGIN + LEFT_PANEL_WIDTH / 2;
    const RIGHT_PANEL_X = MARGIN + LEFT_PANEL_WIDTH + 12 + RIGHT_PANEL_WIDTH / 2;
    
    // Create visual containers (background boxes)
    const leftBox = this.add.rectangle(LEFT_PANEL_X, PANEL_TOP + LEFT_PANEL_HEIGHT / 2, LEFT_PANEL_WIDTH, LEFT_PANEL_HEIGHT, 0x222222);
    leftBox.setStrokeStyle(2, 0x444444);
    leftBox.setDepth(2);
    
    // Two separate right panels - stacked vertically with different heights
    const topRightBox = this.add.rectangle(RIGHT_PANEL_X, PANEL_TOP + TOP_RIGHT_PANEL_HEIGHT / 2, RIGHT_PANEL_WIDTH, TOP_RIGHT_PANEL_HEIGHT, 0x222222);
    topRightBox.setStrokeStyle(2, 0x444444);
    topRightBox.setDepth(2);
    
    const bottomRightBox = this.add.rectangle(RIGHT_PANEL_X, PANEL_TOP + TOP_RIGHT_PANEL_HEIGHT + 10 + BOTTOM_RIGHT_PANEL_HEIGHT / 2, RIGHT_PANEL_WIDTH, BOTTOM_RIGHT_PANEL_HEIGHT, 0x222222);
    bottomRightBox.setStrokeStyle(2, 0x444444);
    bottomRightBox.setDepth(2);
    
    // Add section headers - positioned outside and above the boxes
    const leftHeader = this.add.text(LEFT_PANEL_X, PANEL_TOP - 18, 'CONFIGURATION', {
      fontSize: '11px',
      color: '#cccccc',
      fontStyle: 'bold',
      fontFamily: 'monospace'
    }).setOrigin(0.5);
    leftHeader.setDepth(3);
    
    // Headers for the two right panels
    const topRightHeader = this.add.text(RIGHT_PANEL_X, PANEL_TOP - 18, 'SELECTED', {
      fontSize: '10px',
      color: '#00ff00',
      fontStyle: 'bold',
      fontFamily: 'monospace'
    }).setOrigin(0.5);
    topRightHeader.setDepth(3);
    
    const bottomRightHeader = this.add.text(RIGHT_PANEL_X, PANEL_TOP + TOP_RIGHT_PANEL_HEIGHT + 10 - 18, 'STATS', {
      fontSize: '10px',
      color: '#00ff00',
      fontStyle: 'bold',
      fontFamily: 'monospace'
    }).setOrigin(0.5);
    bottomRightHeader.setDepth(3);
    
    // Create panels at calculated positions
    this.leftPanel = this.add.container(LEFT_PANEL_X, PANEL_TOP);
    this.leftPanel.setDepth(3);
    
    // Split right panel into two separate containers
    this.topRightPanel = this.add.container(RIGHT_PANEL_X, PANEL_TOP);
    this.topRightPanel.setDepth(3);
    
    this.bottomRightPanel = this.add.container(RIGHT_PANEL_X, PANEL_TOP + TOP_RIGHT_PANEL_HEIGHT + 10);
    this.bottomRightPanel.setDepth(3);
    
    // Keep rightPanel reference for backward compatibility, point to top panel
    this.rightPanel = this.topRightPanel;

    // Create UI sections
    this.createTeamSelection();
    this.createWeaponConfiguration();
    this.createSelectedLoadoutDisplay();
    this.createWeaponStatsDisplay();
    this.createNavigationButtons();
    
    // Initialize with team tab active - let user choose their team
    this.showTab('team');
    
    // Already registered with LobbyEventCoordinator early in create()
  }

  private createTeamSelection(): void {
    this.teamContainer = this.add.container(0, 25); // Adjusted for new layout - less space needed now

    // Team title
    const teamTitle = this.add.text(0, -10, 'Select Team:', {
      fontSize: '12px',
      color: '#ffffff',
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    // Team buttons with player sprites - more horizontal spacing
    this.redTeamButton = this.add.text(-65, 20, 'RED', {
      fontSize: '12px',
      color: '#ffffff',
      backgroundColor: '#660000',
      padding: { x: 25, y: 8 },
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    this.redTeamButton.setInteractive({ useHandCursor: true });
    this.redTeamButton.on('pointerover', () => this.redTeamButton.setStyle({ backgroundColor: '#880000' }));
    this.redTeamButton.on('pointerout', () => this.updateTeamButtonStyles());
    this.redTeamButton.on('pointerdown', () => this.selectTeam('red'));

    this.blueTeamButton = this.add.text(65, 20, 'BLUE', {
      fontSize: '12px',
      color: '#ffffff',
      backgroundColor: '#000066',
      padding: { x: 25, y: 8 },
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    this.blueTeamButton.setInteractive({ useHandCursor: true });
    this.blueTeamButton.on('pointerover', () => this.blueTeamButton.setStyle({ backgroundColor: '#000088' }));
    this.blueTeamButton.on('pointerout', () => this.updateTeamButtonStyles());
    this.blueTeamButton.on('pointerdown', () => this.selectTeam('blue'));

    // Red player sprite - larger and better positioned
    const redPlayerSprite = this.add.sprite(-65, 60, 'player_red');
    redPlayerSprite.setScale(2.0);

    // Blue player sprite - larger and better positioned
    const bluePlayerSprite = this.add.sprite(65, 60, 'player_blue');
    bluePlayerSprite.setScale(2.0);

    // Selection indicator (will be positioned over the selected team)
    this.teamPreview = this.add.rectangle(-65, 60, 45, 45, 0x00ff00, 0);
    this.teamPreview.setStrokeStyle(3, 0x00ff00);

    this.teamContainer.add([teamTitle, this.redTeamButton, this.blueTeamButton, redPlayerSprite, bluePlayerSprite, this.teamPreview]);
    this.leftPanel.add(this.teamContainer);
  }

  private createWeaponConfiguration(): void {
    this.weaponContainer = this.add.container(0, 0);

    // Create tabs - centered in container
    const tabs = ['team', 'primary', 'secondary', 'support'];
    const tabWidth = 50;
    const totalWidth = tabs.length * tabWidth + (tabs.length - 1) * 3;
    const startX = -totalWidth / 2 + tabWidth / 2;
    
    tabs.forEach((tab, index) => {
      const x = startX + index * (tabWidth + 3);
      
      this.tabButtons[tab] = this.add.text(x, 5, tab.toUpperCase(), {
        fontSize: '8px',
        color: '#ffffff',
        backgroundColor: '#333333',
        padding: { x: 6, y: 4 },
        fontFamily: 'monospace'
      }).setOrigin(0.5);
      
      this.tabButtons[tab].setInteractive({ useHandCursor: true });
      this.tabButtons[tab].on('pointerover', () => {
        if (this.currentTab !== tab) {
          this.tabButtons[tab].setStyle({ backgroundColor: '#555555' });
        }
      });
      this.tabButtons[tab].on('pointerout', () => this.updateTabStyles());
      this.tabButtons[tab].on('pointerdown', () => this.showTab(tab as any));
      
      this.weaponContainer.add(this.tabButtons[tab]);
    });

    // Weapon grid container
    this.weaponGrid = this.add.container(0, 30);
    this.weaponContainer.add(this.weaponGrid);
    
    this.leftPanel.add(this.weaponContainer);
  }

  private createSelectedLoadoutDisplay(): void {
    this.selectedLoadoutContainer = this.add.container(0, 8); // Pixel art compact start

    // Pixel art approach - tighter spacing, 15px between lines
    this.selectedPrimaryDisplay = this.add.container(0, 8);
    this.selectedSecondaryDisplay = this.add.container(0, 23);  // 15px gap
    this.selectedSupportDisplay = this.add.container(0, 38);   // 15px gap

    // Remove separate slots display - will be integrated into support line
    this.supportSlotsDisplay = this.add.text(0, 0, '', {
      fontSize: '8px',
      color: '#ffaa00',
      fontFamily: 'monospace'
    }).setOrigin(0, 0.5);

    this.selectedLoadoutContainer.add([
      this.selectedPrimaryDisplay,
      this.selectedSecondaryDisplay,
      this.selectedSupportDisplay
      // Note: supportSlotsDisplay will be added directly to selectedSupportDisplay
    ]);
    
    this.rightPanel.add(this.selectedLoadoutContainer);
  }

  private createWeaponStatsDisplay(): void {
    this.weaponStatsContainer = this.add.container(0, 12); // Positioned in larger bottom panel

    // No title needed since panel has its own header
    this.weaponStatsText = this.add.text(0, 0, '', { // Centered in panel
      fontSize: '8px', // Increased font for better readability
      color: '#cccccc',
      align: 'center',
      wordWrap: { width: 170 }, // Use full panel width
      lineSpacing: 0, // Normal line spacing with larger panel
      fontFamily: 'monospace'
    }).setOrigin(0.5, 0);

    this.weaponStatsContainer.add(this.weaponStatsText);
    this.bottomRightPanel.add(this.weaponStatsContainer); // Use bottom panel
  }

  private createNavigationButtons(): void {
    // Bottom button positioning
    const BUTTON_Y = GAME_CONFIG.GAME_HEIGHT - 18;
    
    // Back button with proper depth
    this.backButton = this.add.text(60, BUTTON_Y, 'BACK', {
      fontSize: '10px',
      color: '#ffffff',
      backgroundColor: '#333333',
      padding: { x: 15, y: 5 },
      fontFamily: 'monospace'
    }).setOrigin(0.5);
    this.backButton.setDepth(10); // Ensure it's on top

    this.backButton.setInteractive({ useHandCursor: true });
    this.backButton.on('pointerover', () => this.backButton.setStyle({ backgroundColor: '#555555' }));
    this.backButton.on('pointerout', () => this.backButton.setStyle({ backgroundColor: '#333333' }));
    this.backButton.on('pointerdown', () => this.handleBack());

    // Save button - check if already connected
    let isConnected = false;
    if (typeof NetworkSystemSingleton !== 'undefined' && NetworkSystemSingleton.hasInstance()) {
      const networkSystem = NetworkSystemSingleton.getInstance(this);
      isConnected = networkSystem.getConnectionState() === ConnectionState.AUTHENTICATED;
    }
    
    this.startGameButton = this.add.text(GAME_CONFIG.GAME_WIDTH - 60, BUTTON_Y, isConnected ? 'JOIN GAME' : 'SAVE & BACK', {
      fontSize: '10px',
      color: '#ffffff',
      backgroundColor: isConnected ? '#884400' : '#006600',
      padding: { x: 15, y: 5 },
      fontFamily: 'monospace'
    }).setOrigin(0.5);
    this.startGameButton.setDepth(10); // Ensure it's on top

    this.startGameButton.setInteractive({ useHandCursor: true });
    this.startGameButton.on('pointerover', () => {
      const bgColor = isConnected ? '#aa4400' : '#008800';
      this.startGameButton.setStyle({ backgroundColor: bgColor });
    });
    this.startGameButton.on('pointerout', () => this.updateStartGameButton());
    this.startGameButton.on('pointerdown', () => this.handleStartGame());
  }

  private showTab(tab: 'team' | 'primary' | 'secondary' | 'support'): void {
    this.currentTab = tab;
    
    // Update visibility
    if (tab === 'team') {
      this.teamContainer.setVisible(true);
      this.weaponGrid.setVisible(false);
    } else {
      this.teamContainer.setVisible(false);  
      this.weaponGrid.setVisible(true);
      this.showWeaponTab(tab);
    }
    
    // Update tab styles and display
    this.updateTabStyles();
    this.updateSelectedLoadoutDisplay();
  }

  private showWeaponTab(category: 'primary' | 'secondary' | 'support'): void {
    console.log(`Switching to ${category} tab`);
    this.currentTab = category;
    this.updateTabStyles();
    this.createWeaponGrid(category);
    this.updateSelectedLoadoutDisplay();
  }

  private createWeaponGrid(category: 'primary' | 'secondary' | 'support'): void {
    // Clear existing grid
    this.weaponGrid.removeAll(true);
    this.weaponButtons = {};
    this.weaponBackgrounds = {};

    const weapons = WEAPON_CATEGORIES[category].weapons;
    
    // Grid layout - 3 columns for support weapons to prevent overflow
    const COLS = category === 'support' ? 3 : 2;
    const BUTTON_WIDTH = category === 'support' ? 80 : 100;
    const BUTTON_HEIGHT = category === 'support' ? 42 : 45;
    const GAP_X = category === 'support' ? 5 : 10;
    const GAP_Y = category === 'support' ? 5 : 6;
    
    // Calculate total grid size and center it
    const totalWidth = COLS * BUTTON_WIDTH + (COLS - 1) * GAP_X;
    const START_X = -totalWidth / 2 + BUTTON_WIDTH / 2;
    const START_Y = 12;

    weapons.forEach((weaponId, index) => {
      const config = getWeaponConfig(weaponId)!;
      const col = index % COLS;
      const row = Math.floor(index / COLS);
      const x = START_X + col * (BUTTON_WIDTH + GAP_X);
      const y = START_Y + row * (BUTTON_HEIGHT + GAP_Y);

      // Create weapon button container
      const buttonContainer = this.add.container(x, y);

      // Background
      const background = this.add.rectangle(0, 0, BUTTON_WIDTH, BUTTON_HEIGHT, 0x333333);
      background.setStrokeStyle(1, 0x555555);

      // Weapon icon positioned on left with better scaling
      const weaponIcon = this.add.sprite(category === 'support' ? -25 : -30, 0, config.textureKey);
      weaponIcon.setScale(category === 'support' ? 0.9 : 1.3);

      // Weapon name with better positioning and sizing
      const weaponName = this.add.text(category === 'support' ? 0 : -5, -12, config.name, {
        fontSize: category === 'support' ? '7px' : '8px',
        color: '#ffffff',
        fontFamily: 'monospace',
        wordWrap: { width: category === 'support' ? 65 : 85 }
      }).setOrigin(category === 'support' ? 0.5 : 0, 0.5);

      // Add all elements
      buttonContainer.add([background, weaponIcon, weaponName]);

      // Slot cost for support weapons
      if (category === 'support') {
        const slotText = this.add.text(0, 12, `${config.slotCost} slot${config.slotCost > 1 ? 's' : ''}`, {
          fontSize: '6px',
          color: '#ffaa00',
          fontFamily: 'monospace'
        }).setOrigin(0.5, 0.5);
        buttonContainer.add(slotText);
      }

      // Store references
      this.weaponButtons[weaponId] = buttonContainer;
      this.weaponBackgrounds[weaponId] = background;

      // Make interactive
      background.setInteractive({ useHandCursor: true });
      background.on('pointerover', () => {
        this.highlightWeapon(weaponId);
        this.showWeaponStats(weaponId);
      });
      background.on('pointerout', () => this.unhighlightWeapon(weaponId));
      background.on('pointerdown', () => this.selectWeapon(category, weaponId));

      this.weaponGrid.add(buttonContainer);
    });

    this.updateWeaponSelection();
  }

  private selectTeam(team: 'red' | 'blue'): void {
    console.log(`🎮 TEAM SELECTION: Player selected ${team.toUpperCase()} team`);
    this.loadout.team = team;
    
    // Move selection indicator to the chosen team (updated positions)
    this.teamPreview.setPosition(team === 'red' ? -65 : 65, 60);
    
    this.updateTeamButtonStyles();
    
    // Update loadout display immediately
    this.updateSelectedLoadoutDisplay();
    
    // Log the complete loadout state
    console.log(`📋 Current loadout after team selection:`, this.loadout);
  }

  private selectWeapon(category: 'primary' | 'secondary' | 'support', weaponId: string): void {
    console.log(`Selecting weapon: ${weaponId} in category: ${category}`);
    
    if (category === 'support') {
      // Handle support weapon selection with slot validation
      if (this.loadout.support.includes(weaponId)) {
        // Remove weapon if already selected
        console.log(`Removing ${weaponId} from support weapons`);
        this.loadout.support = this.loadout.support.filter(w => w !== weaponId);
      } else {
        // Try to add weapon if slots available
        const currentSlots = calculateSupportSlots(this.loadout.support);
        const weaponSlots = getWeaponConfig(weaponId)?.slotCost || 0;
        console.log(`Current slots: ${currentSlots}, Weapon slots: ${weaponSlots}, Total would be: ${currentSlots + weaponSlots}`);
        
        if (canAddSupportWeapon(this.loadout.support, weaponId)) {
          console.log(`Adding ${weaponId} to support weapons`);
          this.loadout.support.push(weaponId);
        } else {
          console.log(`Cannot add ${weaponId} - not enough slots`);
          // Show error feedback
          this.showSlotError();
          return;
        }
      }
    } else {
      // Handle primary/secondary weapon selection (replace current)
      this.loadout[category] = this.loadout[category] === weaponId ? null : weaponId;
    }

    console.log('Updated loadout:', this.loadout);
    this.updateWeaponSelection();
    this.updateSelectedLoadoutDisplay();
    this.updateStartGameButton();
  }

  private updateSelectedLoadoutDisplay(): void {
    // Clear existing displays
    this.selectedPrimaryDisplay.removeAll(true);
    this.selectedSecondaryDisplay.removeAll(true);
    this.selectedSupportDisplay.removeAll(true);

    // PIXEL ART APPROACH: Inline everything on single lines
    
    // Primary weapon - inline format: "Primary: [Icon] Name" - SCALED UP
    const primaryLabel = this.add.text(-80, 0, 'Primary:', { 
      fontSize: '10px', // Increased from 9px
      color: '#ffffff',
      fontFamily: 'monospace'
    }).setOrigin(0, 0.5);
    
    this.selectedPrimaryDisplay.add(primaryLabel);
    
    if (this.loadout.primary) {
      const config = getWeaponConfig(this.loadout.primary)!;
      const primaryIcon = this.add.sprite(-20, 0, config.textureKey).setScale(0.7); // Increased from 0.6
      const primaryName = this.add.text(0, 0, config.name, { 
        fontSize: '9px', // Increased from 8px
        color: '#00ff00',
        fontFamily: 'monospace'
      }).setOrigin(0, 0.5);
      this.selectedPrimaryDisplay.add([primaryIcon, primaryName]);
    } else {
      const primaryNone = this.add.text(-20, 0, '---', { 
        fontSize: '9px', // Increased from 8px
        color: '#888888',
        fontFamily: 'monospace'
      }).setOrigin(0, 0.5);
      this.selectedPrimaryDisplay.add(primaryNone);
    }

    // Secondary weapon - inline format: "Secondary: [Icon] Name" - SCALED UP
    const secondaryLabel = this.add.text(-80, 0, 'Secondary:', { 
      fontSize: '10px', // Increased from 9px
      color: '#ffffff',
      fontFamily: 'monospace'
    }).setOrigin(0, 0.5);
    
    this.selectedSecondaryDisplay.add(secondaryLabel);
    
    if (this.loadout.secondary) {
      const config = getWeaponConfig(this.loadout.secondary)!;
      const secondaryIcon = this.add.sprite(-20, 0, config.textureKey).setScale(0.7); // Increased from 0.6
      const secondaryName = this.add.text(0, 0, config.name, { 
        fontSize: '9px', // Increased from 8px
        color: '#00ff00',
        fontFamily: 'monospace'
      }).setOrigin(0, 0.5);
      this.selectedSecondaryDisplay.add([secondaryIcon, secondaryName]);
    } else {
      const secondaryNone = this.add.text(-20, 0, '---', { 
        fontSize: '9px', // Increased from 8px
        color: '#888888',
        fontFamily: 'monospace'
      }).setOrigin(0, 0.5);
      this.selectedSecondaryDisplay.add(secondaryNone);
    }

    // Support weapons - inline format: "Support: [Icon1] [Icon2] [Icon3] (2/3)" - SCALED UP
    const supportLabel = this.add.text(-80, 0, 'Support:', { 
      fontSize: '10px', // Increased from 9px
      color: '#ffffff',
      fontFamily: 'monospace'
    }).setOrigin(0, 0.5);
    
    this.selectedSupportDisplay.add(supportLabel);
    
    // Add support icons horizontally in a row - bigger icons
    if (this.loadout.support.length > 0) {
      this.loadout.support.forEach((weaponId, index) => {
        const config = getWeaponConfig(weaponId)!;
        const supportIcon = this.add.sprite(-30 + index * 20, 0, config.textureKey).setScale(0.6); // Increased from 0.5 and spacing from 18
        this.selectedSupportDisplay.add(supportIcon);
      });
    }
    
    // Add slot count at the end of support line - PIXEL ART STYLE!
    const usedSlots = calculateSupportSlots(this.loadout.support);
    const maxSlots = WEAPON_CATEGORIES.support.maxSlots;
    
    const slotsText = this.add.text(25, 0, `(${usedSlots}/${maxSlots})`, { // Moved right slightly
      fontSize: '9px', // Increased from 8px
      color: usedSlots === maxSlots ? '#00ff00' : usedSlots > maxSlots ? '#ff0000' : '#ffaa00',
      fontFamily: 'monospace'
    }).setOrigin(0, 0.5);
    
    this.selectedSupportDisplay.add(slotsText);
  }

  private showWeaponStats(weaponId: string): void {
    const config = getWeaponConfig(weaponId);
    if (!config) return;

    let statsText = `${config.name}\n`;
    statsText += `"${config.description}"\n`;
    
    const stats = [];
    if (config.damage) stats.push(`DMG: ${config.damage}`);
    if (config.fireRate) stats.push(`RPM: ${config.fireRate}`);
    if (config.range) stats.push(`RNG: ${config.range}`);
    if (config.category === 'support') stats.push(`COST: ${config.slotCost}`);
    
    if (stats.length > 0) {
      statsText += '\n' + stats.join(' | ');
    }

    this.weaponStatsText.setText(statsText);
  }

  private updateTeamButtonStyles(): void {
    this.redTeamButton.setStyle({ 
      backgroundColor: this.loadout.team === 'red' ? '#aa0000' : '#660000' 
    });
    this.blueTeamButton.setStyle({ 
      backgroundColor: this.loadout.team === 'blue' ? '#0000aa' : '#000066' 
    });
  }

  private updateTabStyles(): void {
    Object.entries(this.tabButtons).forEach(([category, button]) => {
      button.setStyle({
        backgroundColor: this.currentTab === category ? '#00aa00' : '#333333'
      });
    });
  }

  private updateWeaponSelection(): void {
    Object.entries(this.weaponBackgrounds).forEach(([weaponId, background]) => {
      const isSelected = this.isWeaponSelected(weaponId);
      background.setFillStyle(isSelected ? 0x006600 : 0x333333);
      background.setStrokeStyle(1, isSelected ? 0x00aa00 : 0x555555);
    });
  }

  private isWeaponSelected(weaponId: string): boolean {
    return this.loadout.primary === weaponId ||
           this.loadout.secondary === weaponId ||
           this.loadout.support.includes(weaponId);
  }

  private highlightWeapon(weaponId: string): void {
    const background = this.weaponBackgrounds[weaponId];
    if (background && !this.isWeaponSelected(weaponId)) {
      background.setFillStyle(0x555555);
    }
  }

  private unhighlightWeapon(weaponId: string): void {
    const background = this.weaponBackgrounds[weaponId];
    if (background && !this.isWeaponSelected(weaponId)) {
      background.setFillStyle(0x333333);
    }
  }

  private updateStartGameButton(): void {
    // Allow start even with null team (will be randomized as fallback)
    const canStart = isValidLoadout(this.loadout);
    
    // Check if already connected
    let isConnected = false;
    if (typeof NetworkSystemSingleton !== 'undefined' && NetworkSystemSingleton.hasInstance()) {
      const networkSystem = NetworkSystemSingleton.getInstance(this);
      isConnected = networkSystem.getConnectionState() === ConnectionState.AUTHENTICATED;
    }
    
    // Update button text based on connection state and match data
    let buttonText = 'SAVE & BACK';
    if (this.matchData) {
      buttonText = 'START MATCH'; // We're in a lobby waiting to start
    } else if (isConnected) {
      buttonText = 'JOIN GAME'; // We're connected but no specific match
    }
    this.startGameButton.setText(buttonText);
    
    this.startGameButton.setStyle({
      backgroundColor: canStart ? (isConnected ? '#884400' : '#006600') : '#333333',
      color: canStart ? '#ffffff' : '#666666'
    });
  }

  private showSlotError(): void {
    // Flash support slots display red to indicate error
    this.supportSlotsDisplay.setColor('#ff0000');
    this.supportSlotsDisplay.setText('Not enough slots!');
    
    setTimeout(() => {
      this.updateSelectedLoadoutDisplay();
    }, 1000);
  }

  private handleBack(): void {
    // Simple, predictable back navigation
    // Users expect to go back to the lobby menu when in the configure screen
    console.log('⬅️ ConfigureScene: Back button pressed, returning to LobbyMenuScene');
    this.scene.start('LobbyMenuScene');
  }

  private handleStartGame(): void {
    // Safety fallback: randomize team if somehow null
    if (this.loadout.team === null) {
      const fallbackTeam = Math.random() < 0.5 ? 'red' : 'blue';
      console.warn(`⚠️ No team selected, assigning random team: ${fallbackTeam}`);
      this.selectTeam(fallbackTeam);
    }
    
    // Validate weapons configuration
    if (!isValidLoadout(this.loadout)) {
      console.warn('❌ Invalid loadout configuration');
      return; // Block if weapons are invalid
    }

    // Store loadout for GameScene to use
    this.game.registry.set('playerLoadout', this.loadout);
    
    // SENIOR DEV REVIEW: Generate player name if not set
    // In production, this would come from a UI input field
    const existingName = this.game.registry.get('playerName');
    if (!existingName) {
      const generatedName = `Player${Math.floor(Math.random() * 9999)}`;
      this.game.registry.set('playerName', generatedName);
      console.log(`🏷️ Generated player name: ${generatedName}`);
    }
    
    console.log('🎮 ConfigureScene: Saved loadout to GAME registry:', this.loadout);
    console.log('🎮 ConfigureScene: Current matchData when starting game:', this.matchData);
    
    // PRIORITY 1: Check if we have match data from lobby (late joiners and normal lobby flow)
    if (this.matchData) {
      console.log('🎮 ConfigureScene: Found lobby matchData, going directly to GameScene');
      this.scene.start('GameScene', { matchData: this.matchData });
      return;
    }
    
    // PRIORITY 2: Check if we have a pending match from instant play
    const pendingMatch = this.game.registry.get('pendingMatch');
    if (pendingMatch) {
      console.log('🎮 ConfigureScene: Found pending match, going directly to GameScene');
      this.game.registry.remove('pendingMatch');
      this.scene.start('GameScene', { matchData: pendingMatch });
      return;
    }
    
    // PRIORITY 3: Check if we came from Play Now mode (immediate game access)
    const playNowMode = this.game.registry.get('playNowMode');
    if (playNowMode) {
      console.log('🚀 ConfigureScene: Play Now mode - finding immediate deathmatch game');
      this.game.registry.remove('playNowMode');
      
      // Find an immediate deathmatch game
      const networkSystem = NetworkSystemSingleton.getInstance(this);
      const socket = networkSystem.getSocket();
      if (socket) {
        // Emit find_match for immediate deathmatch
        console.log('🚀 Play Now: Finding deathmatch game...');
        socket.emit('find_match', { 
          gameMode: 'deathmatch',
          isPrivate: false,
          quickJoin: true  // Flag for immediate joining
        });
        
        // Go to matchmaking scene with play now flag
        this.scene.start('MatchmakingScene', { gameMode: 'deathmatch', instantPlay: true, playNow: true });
        return;
      }
    }
    
    // PRIORITY 4: Check if we came from instant play flow (need to start matchmaking)
    const fromInstantPlay = this.game.registry.get('fromInstantPlay');
    if (fromInstantPlay) {
      console.log('🎮 ConfigureScene: Came from instant play, starting matchmaking');
      this.game.registry.remove('fromInstantPlay');
      
      // Go directly to matchmaking with instant play mode
      const networkSystem = NetworkSystemSingleton.getInstance(this);
      const socket = networkSystem.getSocket();
      if (socket) {
        // Emit find_match directly here
        socket.emit('find_match', { 
          gameMode: 'deathmatch',
          isPrivate: false 
        });
        
        // Go to matchmaking scene
        this.scene.start('MatchmakingScene', { gameMode: 'deathmatch', instantPlay: true });
        return;
      }
    }
    
    // PRIORITY 5: Check if connected but no specific match (should go to lobby to find/create one)
    if (typeof NetworkSystemSingleton !== 'undefined' && NetworkSystemSingleton.hasInstance()) {
      const networkSystem = NetworkSystemSingleton.getInstance(this);
      const connectionState = networkSystem.getConnectionState();
      console.log('🎮 ConfigureScene: Connection state:', connectionState);
      
      if (connectionState === ConnectionState.AUTHENTICATED) {
        // Already connected, go to lobby menu to find/create a match
        console.log('🎮 ConfigureScene: Already connected, going to LobbyMenuScene');
        this.scene.start('LobbyMenuScene');
        return;
      }
    }
    
    // FALLBACK: Not connected, return to MenuScene so user can connect to server with configured loadout
    console.log('🎮 ConfigureScene: Not connected, returning to MenuScene');
    this.scene.start('MenuScene');
  }

  private lastConnectionCheck = 0;
  
  update(): void {
    // Only check connection state occasionally to prevent spam
    const now = Date.now();
    if (now - this.lastConnectionCheck > 1000) { // Check once per second
      this.lastConnectionCheck = now;
      this.updateStartGameButton();
    }
  }

  private createAtmosphericBackground(): void {
    // Very dark base layer
    const darkOverlay = this.add.graphics();
    darkOverlay.fillStyle(0x050505, 0.95);
    darkOverlay.fillRect(0, 0, GAME_CONFIG.GAME_WIDTH, GAME_CONFIG.GAME_HEIGHT);
    darkOverlay.setDepth(-1000);

    // Store wall positions for occlusion
    this.wallPositions = [];

    // Create wall silhouettes
    this.createWallSilhouettes();

    // Create muzzle flash effects
    this.createMuzzleFlashEffects();
  }

  private createWallSilhouettes(): void {
    const wallGraphics = this.add.graphics();
    wallGraphics.fillStyle(0x0f0f0f, 0.9);

    // Create simple wall network for background
    const walls = [
      {x: 60, y: 0, width: 12, height: 140},
      {x: 120, y: 30, width: 12, height: 160},
      {x: 180, y: 0, width: 12, height: 100},
      {x: 240, y: 80, width: 12, height: 190},
      {x: 300, y: 0, width: 12, height: 120},
      {x: 360, y: 50, width: 12, height: 180},
      {x: 420, y: 0, width: 12, height: 150},
      {x: 0, y: 60, width: 180, height: 12},
      {x: 200, y: 120, width: 200, height: 12},
      {x: 120, y: 180, width: 250, height: 12},
      {x: 0, y: 240, width: 160, height: 12},
      {x: 280, y: 200, width: 200, height: 12}
    ];

    wallGraphics.setDepth(-20);

    walls.forEach(wall => {
      wallGraphics.fillRect(wall.x, wall.y, wall.width, wall.height);
      this.wallPositions.push(wall);
    });
  }

  private createMuzzleFlashEffects(): void {
    // Subtle muzzle flash positions
    const flashPositions = [
      { x: 90, y: 110, angle: 45 },
      { x: 330, y: 90, angle: 225 },
      { x: 390, y: 210, angle: -90 },
      { x: 130, y: 200, angle: -45 }
    ];

    flashPositions.forEach((pos, index) => {
      this.time.delayedCall(index * 600 + Math.random() * 1000, () => {
        this.createSingleMuzzleFlash(pos.x, pos.y);
      });
    });
  }

  private createSingleMuzzleFlash(x: number, y: number): void {
    const flashContainer = this.add.container(x, y);
    flashContainer.setDepth(-10);

    // Simple gradient flash
    const gradientLayers = [
      { radius: 65, color: 0x881100, alpha: 0.08 },
      { radius: 45, color: 0xdd4411, alpha: 0.12 },
      { radius: 30, color: 0xff7722, alpha: 0.18 },
      { radius: 18, color: 0xffaa44, alpha: 0.25 },
      { radius: 10, color: 0xffdd88, alpha: 0.35 },
      { radius: 4, color: 0xffffcc, alpha: 0.5 }
    ];

    gradientLayers.forEach(layer => {
      const circle = this.add.graphics();
      circle.fillStyle(layer.color, layer.alpha);
      circle.fillCircle(0, 0, layer.radius);
      flashContainer.add(circle);
    });

    // Animate flash
    this.tweens.add({
      targets: flashContainer,
      alpha: 0,
      duration: 200,
      onComplete: () => {
        flashContainer.destroy();
        // Schedule next flash
        this.time.delayedCall(3000 + Math.random() * 4000, () => {
          if (this.scene.isActive()) {
            this.createSingleMuzzleFlash(x, y);
          }
        });
      }
    });
  }

  shutdown(): void {
    // Unregister from LobbyEventCoordinator
    const coordinator = LobbyEventCoordinator.getInstance();
    coordinator.unregisterScene(this);
    
    // Clean up socket listeners if needed
    // Note: match_started is handled by LobbyEventCoordinator
    
    // Clean up any timers
    this.time.removeAllEvents();
    
    // Clean up any tweens
    this.tweens.killAll();
  }
} 
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

export class ConfigureScene extends Phaser.Scene {
  private loadout: PlayerLoadout = { ...DEFAULT_LOADOUT };
  
  // UI Elements
  private leftPanel!: Phaser.GameObjects.Container;
  private rightPanel!: Phaser.GameObjects.Container;
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

  create(): void {
    // Create dark background
    this.add.rectangle(0, 0, GAME_CONFIG.GAME_WIDTH, GAME_CONFIG.GAME_HEIGHT, 0x111111)
      .setOrigin(0, 0);

    // Title at top with proper margin
    const title = this.add.text(GAME_CONFIG.GAME_WIDTH / 2, 8, 'CONFIGURE LOADOUT', {
      fontSize: '14px',
      color: '#00ff00',
      fontStyle: 'bold',
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    // Define layout areas with optimized spacing
    const MARGIN = 8;
    const LEFT_PANEL_WIDTH = 260;
    const RIGHT_PANEL_WIDTH = 180;
    const PANEL_HEIGHT = 200;
    const PANEL_TOP = 30;
    
    // Calculate panel positions
    const LEFT_PANEL_X = MARGIN + LEFT_PANEL_WIDTH / 2;
    const RIGHT_PANEL_X = MARGIN + LEFT_PANEL_WIDTH + 12 + RIGHT_PANEL_WIDTH / 2;
    
    // Create visual containers (background boxes)
    const leftBox = this.add.rectangle(LEFT_PANEL_X, PANEL_TOP + PANEL_HEIGHT / 2, LEFT_PANEL_WIDTH, PANEL_HEIGHT, 0x222222);
    leftBox.setStrokeStyle(2, 0x444444);
    
    const rightBox = this.add.rectangle(RIGHT_PANEL_X, PANEL_TOP + PANEL_HEIGHT / 2, RIGHT_PANEL_WIDTH, PANEL_HEIGHT, 0x222222);
    rightBox.setStrokeStyle(2, 0x444444);
    
    // Add section headers
    const leftHeader = this.add.text(LEFT_PANEL_X, PANEL_TOP - 12, 'CONFIGURATION', {
      fontSize: '10px',
      color: '#cccccc',
      fontStyle: 'bold',
      fontFamily: 'monospace'
    }).setOrigin(0.5);
    
    const rightHeader = this.add.text(RIGHT_PANEL_X, PANEL_TOP - 12, 'LOADOUT', {
      fontSize: '10px',
      color: '#cccccc',
      fontStyle: 'bold',
      fontFamily: 'monospace'
    }).setOrigin(0.5);
    
    // Create panels at calculated positions
    this.leftPanel = this.add.container(LEFT_PANEL_X, PANEL_TOP);
    this.rightPanel = this.add.container(RIGHT_PANEL_X, PANEL_TOP);

    // Create UI sections
    this.createTeamSelection();
    this.createWeaponConfiguration();
    this.createSelectedLoadoutDisplay();
    this.createWeaponStatsDisplay();
    this.createNavigationButtons();
    
    // Initialize with team tab active
    this.showTab('team');
  }

  private createTeamSelection(): void {
    this.teamContainer = this.add.container(0, 15);

    // Team title
    const teamTitle = this.add.text(0, 0, 'Select Team:', {
      fontSize: '11px',
      color: '#ffffff',
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    // Team buttons with player sprites underneath
    this.redTeamButton = this.add.text(-45, 25, 'RED', {
      fontSize: '10px',
      color: '#ffffff',
      backgroundColor: '#660000',
      padding: { x: 18, y: 5 },
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    this.redTeamButton.setInteractive({ useHandCursor: true });
    this.redTeamButton.on('pointerover', () => this.redTeamButton.setStyle({ backgroundColor: '#880000' }));
    this.redTeamButton.on('pointerout', () => this.updateTeamButtonStyles());
    this.redTeamButton.on('pointerdown', () => this.selectTeam('red'));

    this.blueTeamButton = this.add.text(45, 25, 'BLUE', {
      fontSize: '10px',
      color: '#ffffff',
      backgroundColor: '#000066',
      padding: { x: 18, y: 5 },
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    this.blueTeamButton.setInteractive({ useHandCursor: true });
    this.blueTeamButton.on('pointerover', () => this.blueTeamButton.setStyle({ backgroundColor: '#000088' }));
    this.blueTeamButton.on('pointerout', () => this.updateTeamButtonStyles());
    this.blueTeamButton.on('pointerdown', () => this.selectTeam('blue'));

    // Red player sprite
    const redPlayerSprite = this.add.sprite(-45, 55, 'player_red');
    redPlayerSprite.setScale(1.5);

    // Blue player sprite  
    const bluePlayerSprite = this.add.sprite(45, 55, 'player_blue');
    bluePlayerSprite.setScale(1.5);

    // Selection indicator (will be positioned over the selected team)
    this.teamPreview = this.add.rectangle(-45, 55, 35, 35, 0x00ff00, 0);
    this.teamPreview.setStrokeStyle(2, 0x00ff00);

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
    this.selectedLoadoutContainer = this.add.container(0, 0);

    // Title
    const selectedTitle = this.add.text(0, 8, 'SELECTED', {
      fontSize: '11px',
      color: '#00ff00',
      fontStyle: 'bold',
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    // Primary display
    this.selectedPrimaryDisplay = this.add.container(0, 28);
    
    // Secondary display
    this.selectedSecondaryDisplay = this.add.container(0, 48);
    
    // Support display
    this.selectedSupportDisplay = this.add.container(0, 68);

    // Support slots display
    this.supportSlotsDisplay = this.add.text(0, 115, '', {
      fontSize: '9px',
      color: '#ffaa00',
      fontStyle: 'bold',
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    this.selectedLoadoutContainer.add([
      selectedTitle,
      this.selectedPrimaryDisplay,
      this.selectedSecondaryDisplay,
      this.selectedSupportDisplay,
      this.supportSlotsDisplay
    ]);
    
    this.rightPanel.add(this.selectedLoadoutContainer);
  }

  private createWeaponStatsDisplay(): void {
    this.weaponStatsContainer = this.add.container(0, 135);

    const statsTitle = this.add.text(0, 0, 'STATS', {
      fontSize: '10px',
      color: '#00ff00',
      fontStyle: 'bold',
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    this.weaponStatsText = this.add.text(0, 15, '', {
      fontSize: '8px',
      color: '#cccccc',
      align: 'center',
      wordWrap: { width: 160 },
      fontFamily: 'monospace'
    }).setOrigin(0.5, 0);

    this.weaponStatsContainer.add([statsTitle, this.weaponStatsText]);
    this.rightPanel.add(this.weaponStatsContainer);
  }

  private createNavigationButtons(): void {
    // Bottom button positioning
    const BUTTON_Y = GAME_CONFIG.GAME_HEIGHT - 18;
    
    // Back button
    this.backButton = this.add.text(60, BUTTON_Y, 'BACK', {
      fontSize: '10px',
      color: '#ffffff',
      backgroundColor: '#333333',
      padding: { x: 15, y: 5 },
      fontFamily: 'monospace'
    }).setOrigin(0.5);

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
    
    // Grid layout centered in container
    const COLS = 2;
    const BUTTON_WIDTH = 100;
    const BUTTON_HEIGHT = 45;
    const GAP_X = 10;
    const GAP_Y = 6;
    
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

      // Weapon icon positioned on left
      const weaponIcon = this.add.sprite(-30, 0, config.textureKey);
      weaponIcon.setScale(1.3);

      // Weapon name
      const weaponName = this.add.text(-5, -12, config.name, {
        fontSize: '8px',
        color: '#ffffff',
        fontFamily: 'monospace'
      }).setOrigin(0, 0.5);

      // Add all elements
      buttonContainer.add([background, weaponIcon, weaponName]);

      // Slot cost for support weapons
      if (category === 'support') {
        const slotText = this.add.text(-5, 12, `${config.slotCost} slot${config.slotCost > 1 ? 's' : ''}`, {
          fontSize: '7px',
          color: '#ffaa00',
          fontFamily: 'monospace'
        }).setOrigin(0, 0.5);
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
    console.log(`Selected team: ${team}`);
    this.loadout.team = team;
    
    // Move selection indicator to the chosen team
    this.teamPreview.setPosition(team === 'red' ? -45 : 45, 55);
    
    this.updateTeamButtonStyles();
    
    // Update loadout display immediately
    this.updateSelectedLoadoutDisplay();
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

    // Primary weapon
    const primaryLabel = this.add.text(-80, 0, 'Primary:', { 
      fontSize: '9px', 
      color: '#ffffff',
      fontFamily: 'monospace'
    }).setOrigin(0, 0.5);
    
    if (this.loadout.primary) {
      const config = getWeaponConfig(this.loadout.primary)!;
      const primaryIcon = this.add.sprite(-10, 0, config.textureKey).setScale(0.7);
      const primaryName = this.add.text(10, 0, config.name, { 
        fontSize: '8px', 
        color: '#00ff00',
        fontFamily: 'monospace'
      }).setOrigin(0, 0.5);
      this.selectedPrimaryDisplay.add([primaryLabel, primaryIcon, primaryName]);
    } else {
      const primaryNone = this.add.text(-10, 0, 'None', { 
        fontSize: '8px', 
        color: '#888888',
        fontFamily: 'monospace'
      }).setOrigin(0, 0.5);
      this.selectedPrimaryDisplay.add([primaryLabel, primaryNone]);
    }

    // Secondary weapon
    const secondaryLabel = this.add.text(-80, 0, 'Secondary:', { 
      fontSize: '9px', 
      color: '#ffffff',
      fontFamily: 'monospace'
    }).setOrigin(0, 0.5);
    
    if (this.loadout.secondary) {
      const config = getWeaponConfig(this.loadout.secondary)!;
      const secondaryIcon = this.add.sprite(-10, 0, config.textureKey).setScale(0.7);
      const secondaryName = this.add.text(10, 0, config.name, { 
        fontSize: '8px', 
        color: '#00ff00',
        fontFamily: 'monospace'
      }).setOrigin(0, 0.5);
      this.selectedSecondaryDisplay.add([secondaryLabel, secondaryIcon, secondaryName]);
    } else {
      const secondaryNone = this.add.text(-10, 0, 'None', { 
        fontSize: '8px', 
        color: '#888888',
        fontFamily: 'monospace'
      }).setOrigin(0, 0.5);
      this.selectedSecondaryDisplay.add([secondaryLabel, secondaryNone]);
    }

    // Support weapons
    const supportLabel = this.add.text(-80, 0, 'Support:', { 
      fontSize: '9px', 
      color: '#ffffff',
      fontFamily: 'monospace'
    }).setOrigin(0, 0.5);
    this.selectedSupportDisplay.add(supportLabel);
    
    if (this.loadout.support.length > 0) {
      this.loadout.support.forEach((weaponId, index) => {
        const config = getWeaponConfig(weaponId)!;
        const yOffset = 15 + index * 14;
        const supportIcon = this.add.sprite(-10, yOffset, config.textureKey).setScale(0.6);
        const supportName = this.add.text(10, yOffset, config.name, { 
          fontSize: '7px', 
          color: '#00ff00',
          fontFamily: 'monospace'
        }).setOrigin(0, 0.5);
        this.selectedSupportDisplay.add([supportIcon, supportName]);
      });
    } else {
      const supportNone = this.add.text(-10, 0, 'None', { 
        fontSize: '8px', 
        color: '#888888',
        fontFamily: 'monospace'
      }).setOrigin(0, 0.5);
      this.selectedSupportDisplay.add(supportNone);
    }

    // Update support slots display
    const usedSlots = calculateSupportSlots(this.loadout.support);
    const maxSlots = WEAPON_CATEGORIES.support.maxSlots;
    
    this.supportSlotsDisplay.setText(`Slots: ${usedSlots}/${maxSlots}`);
    this.supportSlotsDisplay.setColor(usedSlots === maxSlots ? '#00ff00' : usedSlots > maxSlots ? '#ff0000' : '#ffaa00');
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
    const canStart = this.loadout.team !== null && isValidLoadout(this.loadout);
    
    // Check if already connected
    let isConnected = false;
    if (typeof NetworkSystemSingleton !== 'undefined' && NetworkSystemSingleton.hasInstance()) {
      const networkSystem = NetworkSystemSingleton.getInstance(this);
      isConnected = networkSystem.getConnectionState() === ConnectionState.AUTHENTICATED;
    }
    
    // Update button text based on connection state
    this.startGameButton.setText(isConnected ? 'JOIN GAME' : 'SAVE & BACK');
    
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
    // Check if already connected
    if (typeof NetworkSystemSingleton !== 'undefined' && NetworkSystemSingleton.hasInstance()) {
      const networkSystem = NetworkSystemSingleton.getInstance(this);
      if (networkSystem.getConnectionState() === ConnectionState.AUTHENTICATED) {
        // If connected, go back to server connection scene
        this.scene.start('ServerConnectionSceneText');
        return;
      }
    }
    
    // Not connected, return to MenuScene
    this.scene.start('MenuScene');
  }

  private handleStartGame(): void {
    if (this.loadout.team === null || !isValidLoadout(this.loadout)) {
      return; // Can't start without valid loadout
    }

    // Store loadout for GameScene to use
    this.game.registry.set('playerLoadout', this.loadout);
    console.log('ConfigureScene: Saved loadout to GAME registry:', this.loadout);
    
    // Check if we have NetworkSystemSingleton and are already connected
    if (typeof NetworkSystemSingleton !== 'undefined' && NetworkSystemSingleton.hasInstance()) {
      const networkSystem = NetworkSystemSingleton.getInstance(this);
      const connectionState = networkSystem.getConnectionState();
      console.log('ConfigureScene: Connection state:', connectionState);
      
      if (connectionState === ConnectionState.AUTHENTICATED) {
        // Already connected, go directly to game
        console.log('ConfigureScene: Already connected, starting GameScene');
        this.scene.start('GameScene');
        return;
      }
    }
    
    // Not connected, return to MenuScene so user can connect to server with configured loadout
    console.log('ConfigureScene: Not connected, returning to MenuScene');
    this.scene.start('MenuScene');
  }

  update(): void {
    // Update button states
    this.updateStartGameButton();
  }
} 
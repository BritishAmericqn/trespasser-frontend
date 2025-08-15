import * as Phaser from 'phaser';
import { LobbyStateManager } from '../systems/LobbyStateManager';

/**
 * Debug overlay to visualize lobby synchronization state
 * Shows real-time lobby information and socket events
 */
export class DebugOverlay {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private lobbyText: Phaser.GameObjects.Text;
  private eventLog: Phaser.GameObjects.Text;
  private events: string[] = [];
  private maxEvents = 10;
  private unsubscribe?: () => void;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = this.scene.add.container(10, 10);
    
    // Background
    const bg = this.scene.add.rectangle(0, 0, 300, 200, 0x000000, 0.8);
    bg.setOrigin(0, 0);
    this.container.add(bg);

    // Title
    const title = this.scene.add.text(10, 10, '🔍 DEBUG OVERLAY', {
      fontSize: '14px',
      color: '#00ff00',
      fontFamily: 'monospace'
    });
    this.container.add(title);

    // Lobby state display
    this.lobbyText = this.scene.add.text(10, 35, 'Lobby: Not connected', {
      fontSize: '12px',
      color: '#ffffff',
      fontFamily: 'monospace'
    });
    this.container.add(this.lobbyText);

    // Event log
    this.eventLog = this.scene.add.text(10, 100, 'Events:', {
      fontSize: '10px',
      color: '#ffff00',
      fontFamily: 'monospace'
    });
    this.container.add(this.eventLog);

    // Make it stay on top
    this.container.setDepth(10000);

    // Subscribe to lobby state
    this.subscribeLobbyState();

    // Listen for socket events
    this.listenSocketEvents();

    // Toggle visibility with F9
    this.scene.input.keyboard?.on('keydown-F9', () => {
      this.container.setVisible(!this.container.visible);
    });

    // Start hidden
    this.container.setVisible(false);
  }

  private subscribeLobbyState(): void {
    const lsm = LobbyStateManager.getInstance();
    this.unsubscribe = lsm.subscribe((state) => {
      if (state) {
        this.lobbyText.setText([
          `Lobby: ${state.lobbyId}`,
          `Players: ${state.playerCount}/${state.maxPlayers}`,
          `Status: ${state.status}`,
          `Mode: ${state.gameMode}`,
          state.countdown ? `Countdown: ${state.countdown}` : ''
        ].filter(Boolean).join('\n'));
      } else {
        this.lobbyText.setText('Lobby: Not in lobby');
      }
    });
  }

  private listenSocketEvents(): void {
    const socket = (window as any).socket;
    if (!socket) return;

    // Track specific events
    const trackedEvents = [
      'lobby_joined',
      'player_joined_lobby', 
      'player_left_lobby',
      'match_starting',
      'match_started',
      'lobby_state_update'
    ];

    trackedEvents.forEach(event => {
      socket.on(event, (data: any) => {
        this.addEvent(`${event}: ${data.playerCount || '?'} players`);
      });
    });
  }

  private addEvent(event: string): void {
    const timestamp = new Date().toLocaleTimeString();
    this.events.unshift(`${timestamp} - ${event}`);
    
    // Keep only recent events
    if (this.events.length > this.maxEvents) {
      this.events.pop();
    }

    // Update display
    this.eventLog.setText('Events:\n' + this.events.join('\n'));
  }

  public destroy(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
    this.container.destroy();
  }

  public show(): void {
    this.container.setVisible(true);
  }

  public hide(): void {
    this.container.setVisible(false);
  }

  public toggle(): void {
    this.container.setVisible(!this.container.visible);
  }
}

import Phaser from 'phaser';
import { LoadingScene } from './client/scenes/LoadingScene';
import { MenuScene } from './client/scenes/MenuScene';
import { ServerConnectionScene } from './client/scenes/ServerConnectionScene';
import { ServerConnectionSceneText } from './client/scenes/ServerConnectionSceneText';
import { ConfigureScene } from './client/scenes/ConfigureScene';
import { GameScene } from './client/scenes/GameScene';
import { LobbyMenuScene } from './client/scenes/LobbyMenuScene';
import { MatchmakingScene } from './client/scenes/MatchmakingScene';
import { LobbyWaitingScene } from './client/scenes/LobbyWaitingScene';
import { MatchResultsScene } from './client/scenes/MatchResultsScene';
import { ServerBrowserScene } from './client/scenes/ServerBrowserScene';
import { NavigationDiagnostics } from './client/utils/NavigationDiagnostics';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 480,
  height: 270,
  parent: 'game-container',
  backgroundColor: '#222222',
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  dom: {
    createContainer: true
  },
  scene: [LoadingScene, MenuScene, ServerConnectionScene, ServerConnectionSceneText, ConfigureScene, GameScene, LobbyMenuScene, MatchmakingScene, LobbyWaitingScene, MatchResultsScene, ServerBrowserScene]
};

// Create and start the game
const game = new Phaser.Game(config);

// Global game reference for debugging
(window as any).game = game;

// Initialize navigation diagnostics for debugging
NavigationDiagnostics.initialize(); 
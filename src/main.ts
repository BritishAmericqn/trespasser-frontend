import Phaser from 'phaser';
import { LoadingScene } from './client/scenes/LoadingScene';
import { MenuScene } from './client/scenes/MenuScene';
import { ServerConnectionScene } from './client/scenes/ServerConnectionScene';
import { ServerConnectionSceneText } from './client/scenes/ServerConnectionSceneText';
import { ConfigureScene } from './client/scenes/ConfigureScene';
import { GameScene } from './client/scenes/GameScene';

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
  scene: [LoadingScene, MenuScene, ServerConnectionScene, ServerConnectionSceneText, ConfigureScene, GameScene]
};

// Create and start the game
const game = new Phaser.Game(config);

// Global game reference for debugging
(window as any).game = game; 
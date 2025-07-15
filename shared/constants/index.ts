export const GAME_CONFIG = {
  GAME_WIDTH: 480,
  GAME_HEIGHT: 270,
  SERVER_URL: 'http://localhost:3000',
  TICK_RATE: 60,
  NETWORK_RATE: 20,
  PLAYER_SPEED_WALK: 100,
  PLAYER_HEALTH: 100
} as const;

export const EVENTS = {
  PLAYER_INPUT: 'player:input',
  GAME_STATE: 'game:state',
  PLAYER_JOINED: 'player:joined',
  PLAYER_LEFT: 'player:left'
} as const; 
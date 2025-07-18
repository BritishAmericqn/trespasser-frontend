export const GAME_CONFIG = {
  GAME_WIDTH: 480,
  GAME_HEIGHT: 270,
  SERVER_URL: 'http://localhost:3000',
  TICK_RATE: 60,
  NETWORK_RATE: 20,
  PLAYER_SPEED_WALK: 100,
  PLAYER_HEALTH: 100,

  // Screen Shake Configuration
  SCREEN_SHAKE: {
    ENABLED: true,
    
    // Weapon shake settings (duration in ms, intensity 0-1)
    WEAPONS: {
      pistol: { duration: 80, intensity: 0.0015 },
      rifle: { duration: 100, intensity: 0.002 },
      rocket: { duration: 200, intensity: 0.004 },
      grenade: { duration: 150, intensity: 0.000 }
    },
    
    // Explosion shake settings
    EXPLOSIONS: {
      grenade: { 
        baseDuration: 300, 
        baseIntensity: 0.015,
        maxDistance: 250  // Max distance for shake effect
      },
      rocket: { 
        baseDuration: 400, 
        baseIntensity: 0.015,
        maxDistance: 250
      }
    },
    
    // Other shake effects
    HIT_TAKEN: { duration: 60, intensity: 0.002 },
    WALL_COLLISION: { duration: 50, intensity: 0.001 }
  }
} as const;

export const EVENTS = {
  PLAYER_INPUT: 'player:input',
  GAME_STATE: 'game:state',
  PLAYER_JOINED: 'player:joined',
  PLAYER_LEFT: 'player:left'
} as const; 
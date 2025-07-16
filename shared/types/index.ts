// These types must match the backend exactly!
export interface Vector2 {
  x: number;
  y: number;
}

export interface PlayerState {
  id: string;
  position: Vector2;
  velocity: Vector2;
  health: number;
  team: 'red' | 'blue';
  isAlive: boolean;
  angle?: number;
  weaponType?: string;
  movementState?: 'idle' | 'walking' | 'running' | 'sneaking';
}

export interface WallState {
  id: string;
  position: Vector2;
  width: number;
  height: number;
  material: string;
  health: number;
  maxHealth: number;
  destructionMask: number[];
  sliceHealth: number[];
}

export interface ProjectileState {
  id: string;
  position: Vector2;
  velocity: Vector2;
  type: string;
  ownerId: string;
  damage: number;
}

export interface GameState {
  players: Map<string, PlayerState> | { [key: string]: PlayerState };
  visiblePlayers?: PlayerState[];
  recentlyVisiblePlayers?: {
    player: PlayerState;
    lastSeenTimestamp: number;
  }[];
  projectiles?: ProjectileState[];
  walls?: Map<string, WallState> | { [key: string]: WallState };
  timestamp: number;
  tickRate: number;
  visionMask?: number[];
  vision?: {
    visibleTiles: number[];   // Array of tile indices (0-509)
    viewAngle: number;        // Player's looking angle in radians
    position: Vector2;        // Player position
  };
}

export interface CollisionEvent {
  playerId: string;
  position: Vector2;
  velocity: Vector2;
}

// Vision system constants
export const VISION_CONSTANTS = {
  TILE_SIZE: 16,        // Each tile is 16x16 pixels
  GRID_WIDTH: 30,       // 480 / 16
  GRID_HEIGHT: 17,      // 270 / 16 (rounded up)
  MAX_TILE_INDEX: 509   // (30 * 17) - 1
} as const; 
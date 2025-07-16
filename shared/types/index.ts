// These types must match the backend exactly!
export interface Vector2 {
  x: number;
  y: number;
}

export interface PlayerState {
  id: string;
  position: Vector2;
  transform?: Vector2;  // Backend might send this instead of position
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
  vision?: TileVision | PolygonVision;
}

// Tile-based vision (legacy)
export interface TileVision {
  type: 'tiles';
  visibleTiles: number[];   // Array of tile indices
  viewAngle: number;        // Player's looking angle in radians
  position: Vector2;        // Player position
}

// Polygon-based vision (new)
export interface PolygonVision {
  type: 'polygon';
  polygon: Vector2[];       // Array of vertices forming visibility polygon
  viewAngle: number;        // FOV angle in radians (e.g., 2.094 for 120°)
  viewDirection: number;    // Player's facing direction in radians
  viewDistance: number;     // Maximum view distance in pixels
  position: Vector2;        // Player position
}

export interface CollisionEvent {
  playerId: string;
  position: Vector2;
  velocity: Vector2;
}

// Vision system constants
export const VISION_CONSTANTS = {
  TILE_SIZE: 8,         // Each tile is 8x8 pixels (updated from 16x16)
  GRID_WIDTH: 60,       // 480 / 8
  GRID_HEIGHT: 34,      // 272 / 8 (covers full height)
  MAX_TILE_INDEX: 2039  // (60 * 34) - 1
} as const; 
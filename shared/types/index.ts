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
}

export interface GameState {
  players: Map<string, PlayerState>;
  timestamp: number;
  tickRate: number;
} 
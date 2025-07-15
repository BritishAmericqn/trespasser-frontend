export interface IGameSystem {
  initialize(): void;
  update(deltaTime: number): void;
  destroy(): void;
} 
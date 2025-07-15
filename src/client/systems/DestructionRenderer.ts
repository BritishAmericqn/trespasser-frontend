import { IGameSystem } from '../../../shared/interfaces/IGameSystem';

interface Wall {
  id: string;
  position: { x: number; y: number };
  width: number;
  height: number;
  material: string;
  sliceHealth: number[];
  destructionMask: number[];
  maxHealth: number;
  needsUpdate: boolean;
}

interface WallSprite {
  intact: ImageData | null;
  damaged: ImageData | null;
  critical: ImageData | null;
}

export class DestructionRenderer implements IGameSystem {
  private scene: Phaser.Scene;
  private walls: Map<string, Wall> = new Map();
  private wallSprites: Map<string, WallSprite> = new Map();
  private ctx: CanvasRenderingContext2D | null = null;
  private renderCanvas: HTMLCanvasElement | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  initialize(): void {
    this.setupRenderCanvas();
    this.generateWallSprites();
    this.setupEventListeners();

  }

  update(deltaTime: number): void {
    // Update walls that need re-rendering
    for (const wall of this.walls.values()) {
      if (wall.needsUpdate) {
        wall.needsUpdate = false;
        // Wall will be re-rendered on next render call
      }
    }
  }

  destroy(): void {
    this.walls.clear();
    this.wallSprites.clear();
    this.removeEventListeners();
    if (this.renderCanvas) {
      this.renderCanvas.remove();
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    // Render all walls
    for (const wall of this.walls.values()) {
      this.renderWall(ctx, wall);
    }
  }

  private setupRenderCanvas(): void {
    this.renderCanvas = document.createElement('canvas');
    this.renderCanvas.width = 64; // Max wall width
    this.renderCanvas.height = 32; // Max wall height
    this.ctx = this.renderCanvas.getContext('2d');
  }

  private generateWallSprites(): void {
    // Generate sprites for different materials
    const materials = ['concrete', 'wood', 'metal', 'glass'];
    
    for (const material of materials) {
      const sprite: WallSprite = {
        intact: this.generateWallSprite(material, 'intact'),
        damaged: this.generateWallSprite(material, 'damaged'),
        critical: this.generateWallSprite(material, 'critical')
      };
      this.wallSprites.set(material, sprite);
    }
  }

  private generateWallSprite(material: string, state: string): ImageData | null {
    if (!this.ctx) return null;

    const width = 60;
    const height = 15;
    
    // Clear canvas
    this.ctx.clearRect(0, 0, width, height);
    
    // Get material color
    const color = this.getMaterialColor(material);
    
    // Draw base wall
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, width, height);
    
    // Add texture based on state
    if (state === 'damaged') {
      this.addDamageTexture(width, height, 0.3);
    } else if (state === 'critical') {
      this.addDamageTexture(width, height, 0.7);
    }
    
    // Add material-specific texture
    this.addMaterialTexture(material, width, height);
    
    return this.ctx.getImageData(0, 0, width, height);
  }

  private getMaterialColor(material: string): string {
    switch (material) {
      case 'concrete': return '#808080';
      case 'wood': return '#8B4513';
      case 'metal': return '#C0C0C0';
      case 'glass': return '#E6E6FA';
      default: return '#808080';
    }
  }

  private addDamageTexture(width: number, height: number, intensity: number): void {
    if (!this.ctx) return;
    
    const numCracks = Math.floor(intensity * 8);
    
    this.ctx.strokeStyle = '#000000';
    this.ctx.lineWidth = 1;
    this.ctx.globalAlpha = intensity;
    
    for (let i = 0; i < numCracks; i++) {
      const x1 = Math.random() * width;
      const y1 = Math.random() * height;
      const x2 = x1 + (Math.random() - 0.5) * 10;
      const y2 = y1 + (Math.random() - 0.5) * 10;
      
      this.ctx.beginPath();
      this.ctx.moveTo(x1, y1);
      this.ctx.lineTo(x2, y2);
      this.ctx.stroke();
    }
    
    this.ctx.globalAlpha = 1;
  }

  private addMaterialTexture(material: string, width: number, height: number): void {
    if (!this.ctx) return;
    
    switch (material) {
      case 'wood':
        // Add wood grain lines
        this.ctx.strokeStyle = '#654321';
        this.ctx.lineWidth = 1;
        this.ctx.globalAlpha = 0.3;
        
        for (let i = 0; i < 3; i++) {
          const y = (i + 1) * height / 4;
          this.ctx.beginPath();
          this.ctx.moveTo(0, y);
          this.ctx.lineTo(width, y);
          this.ctx.stroke();
        }
        break;
        
      case 'metal':
        // Add metal bolts
        this.ctx.fillStyle = '#696969';
        this.ctx.globalAlpha = 0.8;
        
        for (let i = 0; i < 4; i++) {
          const x = (i + 1) * width / 5;
          const y = height / 2;
          this.ctx.beginPath();
          this.ctx.arc(x, y, 1, 0, Math.PI * 2);
          this.ctx.fill();
        }
        break;
        
      case 'glass':
        // Add glass shine
        this.ctx.strokeStyle = '#FFFFFF';
        this.ctx.lineWidth = 1;
        this.ctx.globalAlpha = 0.6;
        
        this.ctx.beginPath();
        this.ctx.moveTo(width * 0.1, height * 0.1);
        this.ctx.lineTo(width * 0.3, height * 0.3);
        this.ctx.stroke();
        break;
    }
    
    this.ctx.globalAlpha = 1;
  }

  private setupEventListeners(): void {
    // Listen for wall damage events from backend
    this.scene.events.on('backend:wall:damaged', (data: any) => {
      if (data.wallId && data.sliceIndex !== undefined) {
        console.log(`🧱 WALL DAMAGE: ${data.wallId} slice ${data.sliceIndex} - health: ${data.newHealth}${data.isDestroyed ? ' (DESTROYED)' : ''}`);
      }
      
      if (this.walls.has(data.wallId)) {
        this.updateWallDamage(data.wallId, data.sliceIndex, data.newHealth);
        
        // Check if backend says this slice is destroyed
        if (data.isDestroyed) {
          const wall = this.walls.get(data.wallId);
          if (wall) {
            wall.destructionMask[data.sliceIndex] = 1;
  
          }
        }
      } else {
        console.warn('🧱 DESTRUCTION: Wall not found:', data.wallId);
      }
    });

    this.scene.events.on('backend:wall:destroyed', (data: any) => {
      console.log('💥 DESTRUCTION: Processing wall:destroyed event', data);
      this.destroyWallSlice(data.wallId, data.sliceIndex);
    });

    // Listen for game state updates to add new walls
    this.scene.events.on('network:gameState', (gameState: any) => {
      if (gameState.walls) {
  
        this.updateWallsFromGameState(gameState.walls);
      }
    });
  }

  private removeEventListeners(): void {
    this.scene.events.off('backend:wall:damaged');
    this.scene.events.off('backend:wall:destroyed');
    this.scene.events.off('network:gameState');
  }

  private renderWall(ctx: CanvasRenderingContext2D, wall: Wall): void {
    const sliceWidth = wall.width / 5;
    
    // Render each slice
    for (let i = 0; i < 5; i++) {
      const sliceX = wall.position.x + (i * sliceWidth);
      const sliceHealth = wall.sliceHealth[i];
      const isDestroyed = wall.destructionMask[i] === 1;
      
      if (isDestroyed) {
        // Render destroyed slices as dark gaps
        ctx.save();
        ctx.fillStyle = '#111111';
        ctx.globalAlpha = 0.3;
        ctx.fillRect(sliceX, wall.position.y, sliceWidth, wall.height);
        
        // Add destruction marker
        ctx.fillStyle = '#ff0000';
        ctx.globalAlpha = 0.5;
        ctx.font = '8px monospace';
        ctx.fillText('X', sliceX + sliceWidth/2 - 3, wall.position.y + wall.height/2 + 3);
        ctx.restore();
        continue;
      }
      
      // Determine damage state
      const healthPercent = sliceHealth / wall.maxHealth;
      let damageState = 'intact';
      
      if (healthPercent <= 0.25) {
        damageState = 'critical';
      } else if (healthPercent <= 0.75) {
        damageState = 'damaged';
      }
      
      // Render the slice
      ctx.save();
      ctx.fillStyle = this.getMaterialColor(wall.material);
      
      // Apply damage darkening
      if (damageState === 'damaged') {
        ctx.globalAlpha = 0.8;
      } else if (damageState === 'critical') {
        ctx.globalAlpha = 0.6;
      }
      
      ctx.fillRect(sliceX, wall.position.y, sliceWidth, wall.height);
      
      // Add damage overlay
      if (damageState !== 'intact') {
        this.renderSliceDamage(ctx, sliceX, wall.position.y, sliceWidth, wall.height, damageState);
      }
      
      ctx.restore();
    }
    
    // Render wall border
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 1;
    ctx.strokeRect(wall.position.x, wall.position.y, wall.width, wall.height);
  }

  private renderSliceDamage(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, damageState: string): void {
    const intensity = damageState === 'critical' ? 0.8 : 0.4;
    const numCracks = Math.floor(intensity * 5);
    
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.globalAlpha = intensity;
    
    for (let i = 0; i < numCracks; i++) {
      const x1 = x + Math.random() * width;
      const y1 = y + Math.random() * height;
      const x2 = x1 + (Math.random() - 0.5) * 6;
      const y2 = y1 + (Math.random() - 0.5) * 6;
      
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    
    ctx.globalAlpha = 1;
  }

  private updateWallDamage(wallId: string, sliceIndex: number, newHealth: number): void {
    const wall = this.walls.get(wallId);
    if (!wall) return;
    
    wall.sliceHealth[sliceIndex] = newHealth;
    
    // If health reaches 0, mark as destroyed
    if (newHealth <= 0) {
      wall.destructionMask[sliceIndex] = 1;
      console.log(`💥 Wall ${wallId} slice ${sliceIndex} destroyed (health: 0)`);
    }
    
    wall.needsUpdate = true;
    
    console.log(`🧱 Wall ${wallId} slice ${sliceIndex} damaged: ${newHealth} health`);
  }

  private destroyWallSlice(wallId: string, sliceIndex: number): void {
    const wall = this.walls.get(wallId);
    if (!wall) return;
    
    wall.sliceHealth[sliceIndex] = 0;
    wall.destructionMask[sliceIndex] = 1;
    wall.needsUpdate = true;
    
    console.log(`💥 Wall ${wallId} slice ${sliceIndex} destroyed`);
  }

  private updateWallsFromGameState(wallsData: any): void {
    // Update walls from game state
    for (const [wallId, wallData] of Object.entries(wallsData)) {
      const data = wallData as any;
      
      if (!this.walls.has(wallId)) {
        // Create new wall
        const wall: Wall = {
          id: wallId,
          position: data.position,
          width: data.width,
          height: data.height,
          material: data.material,
          sliceHealth: [...data.sliceHealth],
          destructionMask: [...data.destructionMask],
          maxHealth: Math.max(...data.sliceHealth),
          needsUpdate: true
        };
        
        this.walls.set(wallId, wall);
  
      } else {
        // Update existing wall
        const wall = this.walls.get(wallId)!;
        wall.sliceHealth = [...data.sliceHealth];
        wall.destructionMask = [...data.destructionMask];
        wall.needsUpdate = true;
      }
    }
  }

  // Public methods
  
  addWall(wallData: any): void {
    const wall: Wall = {
      id: wallData.id,
      position: wallData.position,
      width: wallData.width,
      height: wallData.height,
      material: wallData.material,
      sliceHealth: wallData.sliceHealth || [100, 100, 100, 100, 100],
      destructionMask: wallData.destructionMask || [0, 0, 0, 0, 0],
      maxHealth: 100,
      needsUpdate: true
    };
    
    this.walls.set(wallData.id, wall);
    console.log(`🧱 Wall added: ${wallData.id}`);
  }

  removeWall(wallId: string): void {
    if (this.walls.delete(wallId)) {
      console.log(`🧱 Wall removed: ${wallId}`);
    }
  }

  getWallCount(): number {
    return this.walls.size;
  }

  getWallsData(): Wall[] {
    return Array.from(this.walls.values());
  }

  addTestWalls(): void {
    // Add test walls for development (using backend wall IDs with underscores)
    const testWalls = [
      {
        id: 'wall_1',
        position: { x: 200, y: 100 },
        width: 60,
        height: 15,
        material: 'concrete',
        maxHealth: 150
      },
      {
        id: 'wall_2',
        position: { x: 100, y: 200 },
        width: 60,
        height: 15,
        material: 'wood',
        maxHealth: 80
      },
      {
        id: 'wall_3',
        position: { x: 300, y: 150 },
        width: 60,
        height: 15,
        material: 'metal',
        maxHealth: 200
      },
      {
        id: 'wall_4',
        position: { x: 150, y: 50 },
        width: 60,
        height: 15,
        material: 'glass',
        maxHealth: 30
      }
    ];

    testWalls.forEach(wallData => {
      const wall: Wall = {
        ...wallData,
        sliceHealth: [wallData.maxHealth, wallData.maxHealth, wallData.maxHealth, wallData.maxHealth, wallData.maxHealth],
        destructionMask: [0, 0, 0, 0, 0],
        needsUpdate: true
      };
      this.walls.set(wall.id, wall);
    });
  }

  simulateWallDamage(wallId: string, damage: number = 20): void {
    const wall = this.walls.get(wallId);
    if (!wall) return;

    // Damage a random slice
    const sliceIndex = Math.floor(Math.random() * 5);
    const newHealth = Math.max(0, wall.sliceHealth[sliceIndex] - damage);
    
    this.updateWallDamage(wallId, sliceIndex, newHealth);
    

  }
  
  getWallsDebugInfo(): any[] {
    const wallsInfo: any[] = [];
    
    this.walls.forEach((wall, wallId) => {
      const currentHealth = wall.sliceHealth.reduce((sum, health) => sum + health, 0);
      const sliceMaxHealth = wall.maxHealth / 5;
      
      const slices = wall.sliceHealth.map((health, index) => ({
        index,
        health,
        destroyed: wall.destructionMask[index] === 1
      }));
      
      wallsInfo.push({
        id: wallId,
        position: wall.position,
        material: wall.material,
        maxHealth: wall.maxHealth,
        currentHealth,
        sliceMaxHealth,
        slices,
        isDestroyed: currentHealth <= 0
      });
    });
    
    return wallsInfo;
  }
} 
# 🎯 Realistic Production Conversion Plan for Trespasser

## Executive Summary

This plan converts Trespasser from a prototype to a production system supporting 10,000 concurrent players while **maintaining all core gameplay features**: fine-grained destruction, complex vision systems, three-speed movement, and tactical audio. The plan is phased to maintain playability throughout development.

## Core Game Priorities (Non-Negotiable)

Based on your documentation, these features define Trespasser:

1. **Tactical Gameplay** - 2-8 player matches at 480x270 resolution
2. **Fine-Grained Destruction** - 5 vertical slices per player width
3. **Complex Vision System** - Mouse-controlled FOV, vision through holes
4. **Three-Speed Movement** - Sneak/Walk/Run with audio implications
5. **Spatial Audio** - Wall muffling, directional sound
6. **120+ FPS Performance** - Smooth, competitive gameplay

## Architecture Overview

### Current State
- Single monolithic backend
- No player state management
- Memory leaks (450+ listeners after 10 transitions)
- O(n²) event broadcasting
- Emergency transition band-aids

### Target State (10K Players)
```
┌─────────────────────────────────────────────────────────┐
│                    Load Balancer                         │
│                  (HAProxy + Redis)                       │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┴────────────┬────────────────┐
        │                         │                 │
┌───────┴────────┐     ┌─────────┴──────┐  ┌──────┴───────┐
│ Matchmaking    │     │ Game Servers   │  │ Asset CDN    │
│ Service        │     │ (Regional)     │  │ (CloudFlare) │
│                │     │                │  │              │
│ - Queue Mgmt   │     │ - 50 servers   │  │ - Sprites    │
│ - Skill Match  │     │ - 25 matches   │  │ - Audio      │
│ - Region Route │     │   each         │  │ - Maps       │
└────────┬───────┘     └────────┬───────┘  └──────────────┘
         │                      │
         └──────────┬───────────┘
                    │
            ┌───────┴────────┐
            │ Match Database │
            │ (PostgreSQL)   │
            └────────────────┘
```

## Phase 1: Foundation Cleanup (Week 1-2)

### Goals
- Stop the bleeding (memory leaks)
- Maintain current playability
- Prepare for scaling

### Tasks

#### 1.1 Fix Critical Memory Leaks
```typescript
// BaseScene.ts - Enforce cleanup
abstract class BaseScene extends Phaser.Scene {
  private sceneListeners: Map<string, Function> = new Map();
  
  protected addSocketListener(event: string, handler: Function) {
    this.sceneListeners.set(event, handler);
    this.getSocket()?.on(event, handler);
  }
  
  shutdown() {
    // Auto-cleanup all listeners
    this.sceneListeners.forEach((handler, event) => {
      this.getSocket()?.off(event, handler);
    });
    this.sceneListeners.clear();
    super.shutdown();
  }
}
```

#### 1.2 Player State Management
```typescript
enum PlayerState {
  MENU = 'menu',
  MATCHMAKING = 'matchmaking',
  IN_MATCH = 'in_match',
  POST_MATCH = 'post_match'
}

class PlayerStateManager {
  private states = new Map<string, PlayerState>();
  
  canReceiveEvent(playerId: string, eventType: string): boolean {
    const state = this.states.get(playerId);
    const validEvents = {
      [PlayerState.MENU]: ['server_info', 'news'],
      [PlayerState.MATCHMAKING]: ['queue_update', 'match_found'],
      [PlayerState.IN_MATCH]: ['game:*', 'player:*'],
      [PlayerState.POST_MATCH]: ['stats', 'next_match']
    };
    return validEvents[state]?.some(pattern => 
      eventType.match(pattern.replace('*', '.*'))
    );
  }
}
```

#### 1.3 Smart Event Routing
```javascript
// Replace io.emit() with targeted broadcasting
function broadcastToMatch(matchId, event, data) {
  const match = matches.get(matchId);
  match.players.forEach(player => {
    if (playerStateManager.canReceiveEvent(player.id, event)) {
      player.socket.emit(event, data);
    }
  });
}
```

### Deliverables
- Zero memory leaks
- 50% reduction in bandwidth
- Clean scene transitions
- No gameplay changes

## Phase 2: Match Service Separation (Week 3-4)

### Goals
- Separate matchmaking from game logic
- Enable horizontal scaling
- Maintain seamless player experience

### Architecture
```
Player Flow:
1. Main Menu → Matchmaking Service
2. Queue → Find 2-8 players
3. Assign to least-loaded Game Server
4. Direct connection to Game Server
5. Return to Matchmaking after match
```

### Implementation

#### 2.1 Matchmaking Service
```javascript
class MatchmakingService {
  private queues = new Map<string, PlayerQueue>();
  
  async queuePlayer(player: Player, mode: string) {
    const queue = this.getQueue(mode);
    queue.add(player);
    
    // Check for match
    if (queue.canFormMatch()) {
      const players = queue.takePlayersForMatch();
      const server = await this.findBestGameServer(players);
      
      // Send players to game server
      players.forEach(p => {
        p.socket.emit('match_found', {
          server: server.url,
          token: this.generateToken(p.id, server.id),
          matchId: uuid()
        });
      });
    }
  }
  
  private findBestGameServer(players: Player[]) {
    // Consider: player regions, server load, ping
    return this.gameServers
      .filter(s => s.availableSlots >= players.length)
      .sort((a, b) => a.load - b.load)[0];
  }
}
```

#### 2.2 Game Server Pool
```javascript
class GameServer {
  private matches = new Map<string, Match>();
  private maxMatches = 25; // 25 matches × 8 players = 200 players/server
  
  canAcceptMatch(): boolean {
    return this.matches.size < this.maxMatches;
  }
  
  async createMatch(players: Player[], config: MatchConfig) {
    const match = new Match(config);
    
    // Transfer players from matchmaking to game
    for (const player of players) {
      await player.transferToGameServer(this);
      match.addPlayer(player);
    }
    
    this.matches.set(match.id, match);
    match.start();
  }
}
```

### Deliverables
- Dedicated matchmaking service
- 50 game servers supporting 1,250 concurrent matches
- Seamless player handoff
- Regional server selection

## Phase 3: State Optimization (Week 5-6)

### Goals
- Reduce bandwidth to 2KB/s per player
- Implement delta compression
- Maintain pixel-perfect accuracy

### 3.1 Binary Protocol
```typescript
// Current: JSON (inefficient)
{
  "type": "player_update",
  "data": {
    "id": "abc123",
    "position": { "x": 240, "y": 135 },
    "rotation": 1.57,
    "movement": "walk"
  }
}
// Size: ~150 bytes

// New: Binary
[
  0x01,              // Message type (1 byte)
  0x0A,              // Player ID index (1 byte)
  0x00, 0xF0,        // X position (2 bytes)
  0x00, 0x87,        // Y position (2 bytes)
  0x64,              // Rotation (1 byte, quantized)
  0x01               // Movement state (1 byte)
]
// Size: 8 bytes (94% reduction!)
```

### 3.2 Delta Compression
```typescript
class StateManager {
  private lastState = new Map<string, GameState>();
  
  generateDelta(playerId: string, currentState: GameState): Delta {
    const last = this.lastState.get(playerId);
    if (!last) return currentState; // Full state
    
    const delta = new Delta();
    
    // Only send changed values
    if (last.position.x !== currentState.position.x ||
        last.position.y !== currentState.position.y) {
      delta.position = currentState.position;
    }
    
    // Destruction updates only for changed tiles
    const changedTiles = this.getChangedTiles(last.walls, currentState.walls);
    if (changedTiles.length > 0) {
      delta.wallUpdates = changedTiles;
    }
    
    return delta;
  }
}
```

### 3.3 Prioritized Updates
```typescript
class UpdatePrioritizer {
  getPriority(update: Update, viewer: Player): number {
    // Vision-based priority
    if (!viewer.canSee(update.position)) return 0;
    
    // Distance-based priority
    const distance = viewer.distanceTo(update.position);
    
    // Type-based priority
    const typePriority = {
      'player_shot': 10,
      'explosion': 9,
      'player_move': 5,
      'wall_damage': 3
    };
    
    return typePriority[update.type] * (1 / (distance + 1));
  }
}
```

### Deliverables
- 95% bandwidth reduction
- Sub-20ms state updates
- Prioritized update system
- Binary protocol implementation

## Phase 4: Infrastructure Scaling (Week 7-8)

### Goals
- Deploy production infrastructure
- Implement monitoring and alerting
- Achieve 99.9% uptime

### 4.1 Kubernetes Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: game-server
spec:
  replicas: 50
  template:
    spec:
      containers:
      - name: game-server
        image: trespasser/game:latest
        resources:
          requests:
            memory: "2Gi"
            cpu: "2"
          limits:
            memory: "4Gi"
            cpu: "4"
        env:
        - name: MAX_MATCHES_PER_SERVER
          value: "25"
        - name: TICK_RATE
          value: "60"
```

### 4.2 Auto-scaling
```javascript
class AutoScaler {
  async checkScale() {
    const metrics = await this.getMetrics();
    
    // Scale up if >80% capacity
    if (metrics.totalPlayers / metrics.maxCapacity > 0.8) {
      await this.scaleUp();
    }
    
    // Scale down if <30% capacity
    if (metrics.totalPlayers / metrics.maxCapacity < 0.3) {
      await this.scaleDown();
    }
  }
  
  private async scaleUp() {
    // Spin up new game servers
    const newServers = Math.ceil(this.currentServers * 0.2);
    await this.kubernetes.scale('game-server', 
      this.currentServers + newServers);
  }
}
```

### 4.3 Monitoring Stack
```javascript
// Prometheus metrics
const metrics = {
  activeMatches: new Gauge({
    name: 'trespasser_active_matches',
    help: 'Number of active matches'
  }),
  
  playerLatency: new Histogram({
    name: 'trespasser_player_latency_ms',
    help: 'Player connection latency',
    buckets: [10, 20, 50, 100, 200]
  }),
  
  wallDestructions: new Counter({
    name: 'trespasser_wall_destructions_total',
    help: 'Total wall destructions'
  })
};
```

### Deliverables
- Kubernetes cluster with auto-scaling
- Prometheus + Grafana monitoring
- 99.9% uptime SLA
- Automated deployment pipeline

## Phase 5: Advanced Features (Week 9-10)

### Goals
- Add competitive features
- Implement anti-cheat
- Polish for launch

### 5.1 Replay System
```typescript
class ReplayRecorder {
  private actions: ReplayAction[] = [];
  
  record(action: GameAction) {
    this.actions.push({
      timestamp: Date.now(),
      tick: this.currentTick,
      type: action.type,
      data: this.compressAction(action)
    });
  }
  
  async saveReplay(matchId: string) {
    const compressed = await this.compress(this.actions);
    await this.storage.save(`replays/${matchId}`, compressed);
  }
}
```

### 5.2 Server-Side Anti-Cheat
```typescript
class AntiCheat {
  validatePlayerAction(player: Player, action: Action): boolean {
    // Movement speed check
    if (action.type === 'move') {
      const maxSpeed = this.getMaxSpeed(player.movementState);
      const actualSpeed = this.calculateSpeed(
        player.lastPosition, 
        action.position, 
        action.deltaTime
      );
      
      if (actualSpeed > maxSpeed * 1.1) { // 10% tolerance
        this.flag(player, 'SPEED_HACK');
        return false;
      }
    }
    
    // Vision check
    if (action.type === 'shoot') {
      if (!this.canPlayerSee(player, action.target)) {
        this.flag(player, 'WALLHACK');
        return false;
      }
    }
    
    return true;
  }
}
```

### 5.3 Skill-Based Matchmaking
```typescript
class SkillMatcher {
  calculateMMR(player: Player, matchResult: MatchResult): number {
    const K = 32; // K-factor
    const expectedScore = 1 / (1 + Math.pow(10, 
      (matchResult.avgOpponentMMR - player.mmr) / 400));
    
    const actualScore = matchResult.placement / matchResult.totalPlayers;
    
    return player.mmr + K * (actualScore - expectedScore);
  }
}
```

## Timeline & Budget

### Development Timeline (10 weeks)
- **Weeks 1-2**: Foundation Cleanup
- **Weeks 3-4**: Match Service Separation  
- **Weeks 5-6**: State Optimization
- **Weeks 7-8**: Infrastructure Scaling
- **Weeks 9-10**: Advanced Features

### Infrastructure Costs (Monthly)
```
Game Servers (50 × c5.2xlarge):     $8,500
Load Balancers:                       $300
Database (RDS):                       $500
Redis Cluster:                        $400
Monitoring:                           $200
CDN (CloudFlare):                     $200
Backup Storage:                       $100
─────────────────────────────────────────
Total:                             $10,200/month

Cost per concurrent player: $1.02/month
```

### Development Resources
- 2 Senior Backend Engineers (10 weeks)
- 1 Senior Frontend Engineer (10 weeks)
- 1 DevOps Engineer (8 weeks)
- 1 QA Engineer (6 weeks)

## Risk Mitigation

### Technical Risks
1. **State Sync Complexity**: Mitigated by delta compression
2. **Latency Issues**: Regional servers + client prediction
3. **DDoS Attacks**: CloudFlare + rate limiting
4. **Data Loss**: Real-time replication + hourly backups

### Rollout Strategy
1. **Alpha**: 100 players on 2 servers
2. **Beta**: 1,000 players on 10 servers
3. **Soft Launch**: 5,000 players, one region
4. **Full Launch**: 10,000+ players, global

## Success Metrics

### Performance Targets
- **Latency**: < 30ms for 90% of players
- **FPS**: 120+ on recommended hardware
- **Bandwidth**: < 2KB/s per player
- **Uptime**: 99.9% availability

### Business Metrics
- **Concurrent Players**: 10,000+
- **Match Start Time**: < 30 seconds
- **Player Retention**: 40% day-7 retention
- **Infrastructure Efficiency**: < $1.50 per CCU

## Conclusion

This plan transforms Trespasser from a prototype to a production system supporting 10,000 concurrent players while **preserving all core gameplay features**. The phased approach ensures playability throughout development, and the architecture scales beyond 10K if needed.

The key insight: your game design (8-player matches, 480x270 resolution) is perfectly suited for massive scale. By fixing the current architectural issues and implementing proper separation of concerns, Trespasser can deliver its unique tactical destruction gameplay to thousands of players simultaneously.

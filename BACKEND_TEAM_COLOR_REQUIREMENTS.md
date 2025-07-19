# Backend Team Color Data Requirements

## Problem Description

Players are sometimes seeing incorrect team colors for themselves and other players. The frontend has been updated to handle team color assignment consistently, but the backend needs to ensure team data is properly included in all player-related events.

## Required Backend Changes

### 1. Player State Updates (Critical)

**Event:** `backend:game:state`

The backend MUST include the `team` field in every player state object. Currently, some player state updates are missing this field.

**Required Format:**
```javascript
{
  players: {
    "player123": {
      id: "player123",
      position: { x: 100, y: 200 },
      velocity: { x: 0, y: 0 },
      health: 100,
      team: "blue",  // ⭐ THIS FIELD IS REQUIRED
      weaponType: "rifle",
      // ... other fields
    },
    "player456": {
      id: "player456", 
      position: { x: 300, y: 400 },
      velocity: { x: 5, y: 0 },
      health: 85,
      team: "red",   // ⭐ THIS FIELD IS REQUIRED
      weaponType: "shotgun",
      // ... other fields
    }
  },
  // ... other game state
}
```

### 2. Player Join Events

**Event:** `backend:player:joined`

When a player joins, ensure their team is included in the player data.

**Required Format:**
```javascript
{
  playerId: "player123",
  playerState: {
    id: "player123",
    position: { x: 100, y: 200 },
    health: 100,
    team: "blue",  // ⭐ THIS FIELD IS REQUIRED
    weaponType: "rifle"
  },
  // OR if sending raw data
  id: "player123",
  position: { x: 100, y: 200 },
  health: 100,
  team: "blue",    // ⭐ THIS FIELD IS REQUIRED
  loadout: {
    team: "blue",  // ⭐ Backup source for team data
    primary: "rifle",
    secondary: "pistol"
  }
}
```

### 3. Implementation Details

#### Where to Store Team Data
- Store the player's team selection when they join via `player:join` event
- The frontend sends: `{ loadout: { team: "blue", primary: "rifle", ... }, timestamp: ... }`
- Extract and persist the team from `loadout.team`

#### Where to Include Team Data
- **Game state updates**: Include `team` field in every player object
- **Player join events**: Include `team` field in player data
- **Player damage events**: Include `team` field (for team-damage rules)
- **Player death events**: Include `team` field

#### Team Values
- Valid values: `"red"` or `"blue"`
- Default fallback: `"blue"` (if team data is somehow lost)

### 4. Testing & Validation

#### Frontend Debug Logs
The frontend now logs team data to help identify issues:

```javascript
// Look for these console messages:
"🎨 Creating local player with team: blue"
"🎨 Player player123 team data: backend=blue final=blue"
"⚠️ Player player123 missing team data, defaulting to blue"  // ❌ This indicates missing backend data
```

#### Test Scenarios
1. **Single Player**: Player selects red team, joins game, should appear red
2. **Multiple Players**: Players select different teams, should appear with correct colors
3. **Player Joins Mid-Game**: New player joins, should appear with their selected team color
4. **Game State Updates**: During gameplay, all players should maintain their team colors

### 5. Debugging Backend Team Data

Add logging on the backend to verify team data:

```javascript
// When player joins
console.log(`Player ${playerId} joined with team: ${playerTeam}`);

// In game state updates
console.log(`Sending player ${playerId} state with team: ${playerState.team}`);

// Verify team persistence
console.log(`Player ${playerId} team data: stored=${storedTeam} sending=${playerState.team}`);
```

## Priority: HIGH

This is blocking proper team-based gameplay and visual consistency. The frontend changes are complete and waiting for the backend to provide consistent team data.

## Contact

If you have questions about the expected data format or need clarification on any requirements, please reach out immediately. 
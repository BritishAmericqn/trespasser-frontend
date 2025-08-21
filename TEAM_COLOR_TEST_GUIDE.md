# Team Color Testing Guide

## Quick Test Steps

### 1. Test Your Own Team Color
1. Open game in browser (`http://localhost:5173`)
2. Go to Configure/Loadout screen
3. **Select RED team** - You should see the red player sprite
4. Start game
5. **Verify**: You should see yourself as RED player
6. Open console (F12) and look for:
   - `🎮 TEAM SELECTION: Player selected RED team`
   - `🎨 LOCAL PLAYER SPRITE: Creating as red team`
   - `🎨 TEAM VERIFICATION: Player is on RED team`

### 2. Test Blue Team
1. Return to menu
2. Select **BLUE team** in Configure screen
3. Start game
4. **Verify**: You should see yourself as BLUE player
5. Console should show:
   - `🎮 TEAM SELECTION: Player selected BLUE team`
   - `🎨 LOCAL PLAYER SPRITE: Creating as blue team`
   - `🎨 TEAM VERIFICATION: Player is on BLUE team`

### 3. Test Multiplayer (Two Browser Windows)
1. **Window 1**: Select RED team, join game
2. **Window 2**: Select BLUE team, join same game
3. **Verify in Window 1**:
   - You appear as RED
   - Other player appears as BLUE
4. **Verify in Window 2**:
   - You appear as BLUE
   - Other player appears as RED

## Console Messages to Monitor

### Good Messages ✅
- `🎮 TEAM SELECTION: Player selected [COLOR] team` - Team selection working
- `🎨 LOCAL PLAYER SPRITE: Creating as [color] team` - Correct sprite created
- `🎨 TEAM VERIFICATION: Player is on [COLOR] team` - Team confirmed
- `📋 Using cached team for player` - Team caching working

### Warning Messages ⚠️
- `⚠️ Backend missing team data for player` - Backend not sending team
- `⚠️ Player X missing team data, inferring Y from position` - Using fallback
- `⚠️ Backend thinks we're X but our loadout says Y` - Backend/frontend mismatch

### Error Messages ❌
- `❌ Invalid team configuration detected!` - Team setup failed
- `❌ Player X has no team data` - Complete team data loss

## Visual Verification Checklist

| Test Case | Expected Result | Pass/Fail |
|-----------|----------------|-----------|
| Select RED team | Red player sprite in config screen | |
| Select BLUE team | Blue player sprite in config screen | |
| Start as RED | You appear red in game | |
| Start as BLUE | You appear blue in game | |
| RED sees BLUE player | Blue player appears blue | |
| BLUE sees RED player | Red player appears red | |
| After respawn | Team color unchanged | |
| Late join as RED | Appear as red | |
| Late join as BLUE | Appear as blue | |

## Debug Commands

Open browser console (F12) and run:

```javascript
// Check your current team
game.registry.get('playerLoadout')?.team

// Check your sprite texture
game.scene.scenes[0].playerSprite?.texture.key

// Check cached teams
game.scene.scenes[0].playerManager?.playerTeamCache
```

## Common Issues & Solutions

### Issue: "I selected red but appear blue"
**Solution**: The backend might be overriding your team. Check console for:
- `⚠️ Backend thinks we're blue but our loadout says red`

### Issue: "Other players all appear blue"
**Solution**: Backend not sending team data. Check for:
- `⚠️ Backend missing team data for player`
- System will use position-based inference as fallback

### Issue: "Team changes after respawn"
**Solution**: Check if backend is resetting team on respawn

## Backend Requirements

For team colors to work perfectly, the backend must:
1. Store team from `loadout.team` when player joins
2. Include `team` field in all player state updates
3. Include `team` field in `visiblePlayers` array
4. Never change a player's team mid-game

## Summary

The frontend now:
- ✅ Respects player's team selection
- ✅ Shows correct colors for local player
- ✅ Attempts to show correct colors for other players
- ✅ Uses intelligent fallbacks when backend data is missing
- ✅ Caches team data to handle inconsistent backend updates

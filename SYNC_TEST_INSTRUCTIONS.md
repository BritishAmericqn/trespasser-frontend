# 🧪 Synchronization Test Instructions

## Quick Test Procedure

### Prerequisites
- Frontend dev server running at http://localhost:5174
- Backend server running (should be on port 3001)

### Test 1: Basic Player Count Sync

1. **Open Browser Tab 1:**
   - Navigate to http://localhost:5174
   - Click "▶ INSTANT PLAY"
   - Note the lobby ID displayed
   - Should show "1/8 players"

2. **Open Browser Tab 2:**
   - Navigate to http://localhost:5174  
   - Click "▶ INSTANT PLAY"
   - Check the lobby ID (should be same as Tab 1)
   - **BOTH tabs should now show "2/8 players"**

3. **Expected Console Output (both tabs):**
   ```
   LSM: lobby_joined received {lobbyId: "deathmatch_xxx", playerCount: 1, ...}
   LSM: player_joined_lobby received {lobbyId: "deathmatch_xxx", playerCount: 2, ...}
   ```

### Test 2: Match Auto-Start

1. With both tabs showing "2/8 players"
2. Wait for 5-second countdown to appear
3. **BOTH tabs should show:**
   - "Match starting in 5..."
   - Countdown from 5 to 1
   - Transition to game scene simultaneously

### Test 3: Player Leave Sync

1. From the lobby (before match starts):
2. Close Browser Tab 2
3. **Tab 1 should immediately update:**
   - From "2/8 players" → "1/8 players"
   - Status returns to "Waiting for players..."

### Test 4: Console Verification

Open browser console (F12) and look for these synchronized events:

```javascript
// When Player 2 joins:
LSM: player_joined_lobby received {
  lobbyId: "deathmatch_xxx",
  playerCount: 2,  // ← Should be same in BOTH consoles
  playerId: "xxx",
  timestamp: xxx
}

// When match starts:
LSM: match_starting received {
  lobbyId: "deathmatch_xxx", 
  countdown: 5
}

// When player leaves:
LSM: player_left_lobby received {
  lobbyId: "deathmatch_xxx",
  playerCount: 1,  // ← Updated count
  playerId: "xxx",
  timestamp: xxx
}
```

## Debug Commands

Run these in browser console to inspect state:

```javascript
// Check LobbyStateManager state
require('src/client/systems/LobbyStateManager').LobbyStateManager.getInstance().debug()

// Monitor all socket events
socket.onAny((event, data) => {
  console.log('📡 Socket Event:', event, data);
});

// Check current lobby state
const lsm = require('src/client/systems/LobbyStateManager').LobbyStateManager.getInstance();
console.log('Current Lobby:', lsm.getState());
```

## Success Criteria

✅ **PASS** if:
- Both players see same player count
- Both players see same lobby ID
- Countdown appears simultaneously  
- Match starts for both at same time
- Leave updates reflect immediately

❌ **FAIL** if:
- Player counts differ between tabs
- One player sees countdown, other doesn't
- Match starts for one but not the other
- Player count doesn't update on leave

## Common Issues & Solutions

### Issue: "Different player counts"
- **Check:** Backend console for broadcasting logs
- **Fix:** Backend must use `io.to(lobbyId).emit()` not `socket.emit()`

### Issue: "Stuck on loading screen"
- **Check:** Console for `match_started` event
- **Fix:** Ensure MatchmakingScene listens for `match_started`

### Issue: "Player count not updating"
- **Check:** LobbyStateManager debug output
- **Fix:** Verify socket listeners are set up correctly

## Report Results

After testing, note:
1. Which tests passed/failed
2. Any console errors
3. Event timing discrepancies
4. Screenshots of desync if it occurs

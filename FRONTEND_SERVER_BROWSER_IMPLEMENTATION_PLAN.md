# 🎮 Server Browser & Private Lobbies - Implementation Plan

## Overview
Complete implementation plan to add server browser functionality and improve private lobby features for friend play.

## Current Status

### ✅ Backend - FULLY WORKING
- Server browser with filtering
- Private password-protected lobbies  
- Join by lobby ID
- Mid-game joining with spawn protection
- Shareable invite codes

### 🔧 Frontend - PARTIAL IMPLEMENTATION
- Socket listeners ready
- Private lobby creation works (with password)
- Missing: Server browser UI, Join by ID button, Invite code display

---

## Implementation Tasks

### 📋 Task 1: Add "Join by ID" Button [PRIORITY: HIGH]
**File:** `src/client/scenes/LobbyMenuScene.ts`

**Current Layout:**
```
[🎮 INSTANT PLAY] - Quick matchmaking
[🌐 SERVER BROWSER] - Shows "coming soon"
[🔒 CREATE PRIVATE] - Works, creates password lobbies
[MISSING: Join by ID button]
```

**Implementation:**
1. Add new button below "CREATE PRIVATE"
2. Wire to existing `joinLobbyById()` method
3. Position at `y: 55` (30 pixels below CREATE PRIVATE)

**Code Changes:**
```typescript
// Add after CREATE PRIVATE button (line ~156)
const joinByIdBg = this.add.graphics();
joinByIdBg.fillStyle(0x444444);
joinByIdBg.fillRect(-buttonWidth/2, 55 - secondaryHeight/2, buttonWidth, secondaryHeight);
this.joinByIdButton = this.add.text(0, 55, '🔑 JOIN BY CODE', {
  fontSize: '12px',
  color: '#ffffff',
  fontFamily: 'monospace'
}).setOrigin(0.5);

// Add button setup (line ~161)
this.setupButton(this.joinByIdButton, '#444444', '#666666', () => this.joinLobbyById());

// Add to container (update line ~163)
this.mainContainer.add([...existing, joinByIdBg, this.joinByIdButton]);
```

---

### 📋 Task 2: Create ServerBrowserScene [PRIORITY: HIGH]
**New File:** `src/client/scenes/ServerBrowserScene.ts`

**Features:**
- Display list of available lobbies
- Show player count, status, map
- Filter toggles (private/full/in-progress)
- Join button for each lobby
- Auto-refresh every 5 seconds

**Key Components:**
```typescript
export class ServerBrowserScene extends Phaser.Scene {
  private lobbies: LobbyInfo[] = []
  private filters = {
    showPrivate: false,
    showFull: false,
    showInProgress: true  // Allow joining games in progress
  }
  
  create() {
    // UI: Title, filter toggles, lobby list, refresh button
    // Socket: emit get_lobby_list, listen for lobby_list
    // Display: Lobby cards with join buttons
  }
}
```

---

### 📋 Task 3: Display Invite Code for Private Lobbies [PRIORITY: HIGH]
**File:** `src/client/scenes/LobbyWaitingScene.ts`

**Current Issue:** When private lobby is created, invite code isn't shown

**Implementation:**
1. Check if `lobbyData.inviteCode` exists
2. Display prominently with copy button
3. Show "Share this code with friends: [CODE]"

**Code Changes:**
```typescript
// In createUI() after lobby ID display
if (this.lobbyData.inviteCode) {
  // Invite code display
  const inviteLabel = this.add.text(centerX, centerY - 60, 'INVITE CODE:', {
    fontSize: '10px',
    color: '#888888'
  });
  
  const inviteCode = this.add.text(centerX, centerY - 40, this.lobbyData.inviteCode, {
    fontSize: '16px',
    color: '#00ff00',
    backgroundColor: '#003300',
    padding: { x: 10, y: 5 }
  });
  
  // Copy button
  const copyButton = this.add.text(centerX, centerY - 15, '[CLICK TO COPY]', {
    fontSize: '9px',
    color: '#ffff00'
  }).setInteractive();
  
  copyButton.on('pointerup', () => {
    navigator.clipboard.writeText(this.lobbyData.inviteCode);
    copyButton.setText('[COPIED!]');
    this.time.delayedCall(1500, () => copyButton.setText('[CLICK TO COPY]'));
  });
}
```

---

### 📋 Task 4: Fix Server Browser Button [PRIORITY: MEDIUM]
**File:** `src/client/scenes/LobbyMenuScene.ts`

**Current:** Shows "Server Browser coming soon!"
**Fix:** Launch new ServerBrowserScene

```typescript
private openServerBrowser(): void {
  console.log('🌐 Opening server browser...');
  this.scene.start('ServerBrowserScene');
}
```

---

### 📋 Task 5: Server Browser UI Components [PRIORITY: HIGH]

**Lobby Card Design:**
```
┌─────────────────────────────────┐
│ DEATHMATCH     3/8 Players  🎮  │
│ Map: downtown   Status: Playing  │
│ [Private 🔒]    [JOIN GAME]     │
└─────────────────────────────────┘
```

**Filter Bar Design:**
```
FILTERS: [✓] Show Private  [✓] Show Full  [✓] Show In Progress
```

---

## User Flow Examples

### Flow 1: Browse and Join Public Game
1. Click "SERVER BROWSER"
2. See list of games (auto-refreshing)
3. Click "JOIN GAME" on desired lobby
4. Enter game (with spawn protection if in-progress)

### Flow 2: Create Private Game for Friends
1. Click "CREATE PRIVATE"
2. Enter password
3. See invite code prominently displayed
4. Share code with friends
5. Friends click "JOIN BY CODE"
6. Enter code and password
7. Everyone in same lobby

### Flow 3: Quick Join Friend's Game
1. Friend shares: "Join my game: private_abc123_xyz"
2. Click "JOIN BY CODE"
3. Paste code
4. Enter password
5. Instantly in friend's lobby

---

## Testing Checklist

### Server Browser
- [ ] Displays all public lobbies
- [ ] Updates list every 5 seconds
- [ ] Shows correct player counts
- [ ] Can filter by private/full/in-progress
- [ ] Join button works for each lobby
- [ ] Shows error if lobby is full

### Private Lobbies
- [ ] Create with password works
- [ ] Invite code displays prominently
- [ ] Copy to clipboard works
- [ ] Join by code button exists
- [ ] Wrong password shows error
- [ ] Can join mid-game

### Edge Cases
- [ ] Handle disconnection gracefully
- [ ] Show error for invalid lobby codes
- [ ] Prevent joining full lobbies
- [ ] Clear error messages

---

## File Structure
```
src/client/scenes/
├── LobbyMenuScene.ts      (Update: Add Join by ID button)
├── ServerBrowserScene.ts  (New: Full server browser)
├── LobbyWaitingScene.ts   (Update: Show invite codes)
└── [existing scenes...]
```

---

## Priority Order
1. **Join by ID Button** - Quick win, enables friend joining
2. **Invite Code Display** - Essential for private lobbies
3. **Server Browser Scene** - Full browsing experience
4. **Polish & Error Handling** - Better UX

---

## Next Steps
1. Start with Task 1 (Join by ID button) - 15 minutes
2. Add invite code display - 20 minutes
3. Create server browser scene - 45 minutes
4. Test all flows - 30 minutes

Total estimate: ~2 hours for complete implementation

The backend is 100% ready. These frontend changes will complete the full server browser and friend play experience!

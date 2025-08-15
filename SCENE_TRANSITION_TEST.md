# 🔬 Scene Transition Test Results

## Test Setup
Add debug logging to track scene transitions and state

## Expected vs Actual

### Private Lobby (WORKS)
- MenuScene → GameScene
- Clean, simple transition
- No intermediate state managers

### Instant Play (BREAKS)
- MenuScene → LobbyMenuScene → ConfigureScene → MatchmakingScene → LobbyWaitingScene → GameScene
- Complex chain of transitions
- Multiple state managers and event listeners

## Hypothesis Testing

### Test 1: Scene Cleanup
**Question:** Are previous scenes properly stopped?
**Expected:** Only GameScene should be active
**Actual:** [TO BE TESTED]

### Test 2: Event Listener Accumulation
**Question:** Do socket listeners accumulate through transitions?
**Expected:** Each scene should clean up its listeners
**Actual:** [TO BE TESTED]

### Test 3: LobbyStateManager Interference
**Question:** Is LobbyStateManager still active during gameplay?
**Expected:** Should be destroyed when game starts
**Actual:** [TO BE TESTED]

### Test 4: State Update on Player Join
**Question:** What happens to game state when player 2 joins?
**Expected:** Incremental update (add player only)
**Actual:** [TO BE TESTED - likely full state reset]

## Key Symptoms
1. Walls disappear (suggests full state reset with incomplete data)
2. Players snap to spawn (suggests position reset from server)
3. Movement breaks (suggests client prediction conflict)
4. 127.3px position error (suggests major desync)

## Root Cause Theory
When a new player joins via matchmaking:
1. LobbyStateManager might still be active
2. Previous scenes might not be fully cleaned up
3. Backend might send different events for matchmaking vs private
4. Multiple listeners might be handling the same events
5. A full game state update might be triggered with incomplete data

## Fix Strategy
1. Ensure complete scene cleanup
2. Destroy all lobby-related state when game starts
3. Prevent any lobby events from being processed during gameplay
4. Ensure backend sends incremental updates, not full resets

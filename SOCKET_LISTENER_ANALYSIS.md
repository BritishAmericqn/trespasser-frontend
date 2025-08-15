# Socket Listener Analysis

## From Console Logs

### Initial State (5 listeners)
```
{disconnect: 3, connect_error: 1, authenticated: 1, auth-failed: 1, auth-timeout: 1}
```
This is the base NetworkSystem setup - looks correct.

### After Scene Transitions (45 listeners!)
```
Socket listeners: 45
```
This indicates massive listener accumulation through scene transitions.

## The Problem

Each scene transition in the instant play flow:
1. **ConfigureScene** → adds listeners
2. **MatchmakingScene** → adds MORE listeners
3. **Emergency to GameScene** → doesn't clean up previous
4. **Backend events** → trigger LobbyWaitingScene creation
5. **Back to GameScene** → even MORE listeners

None of these scenes properly remove their listeners on shutdown!

## Specific Issues from Logs

### 1. MatchmakingScene Still Active
```
⚠️ MatchmakingScene not active, ignoring state change
(But it's still trying to handle events!)
```

### 2. Multiple Scene Updates
```
NetworkSystemSingleton: Updating scene from MatchmakingScene to GameScene
NetworkSystemSingleton: Updating scene from GameScene to GameScene
NetworkSystemSingleton: Updating scene from GameScene to LobbyWaitingScene
NetworkSystemSingleton: Updating scene from LobbyWaitingScene to GameScene
```

Each update adds listeners without removing old ones.

### 3. LobbyStateManager Fighting
```
⚠️ LobbyStateManager still has 2 active listeners!
Error in lobby state listener: TypeError: Cannot read properties of null
```

It's trying to update UI elements that were destroyed.

## Socket Events Being Duplicated

From the backend events in console:
- `lobby_state_update`
- `player_joined_lobby` 
- `weapon:equipped`
- `lobby_joined`
- `match_starting`

These are being handled by MULTIPLE listeners in different scenes!

## Memory Leak Pattern

1. Scene A starts → adds 5 listeners
2. Scene B starts → adds 5 more (total: 10)
3. Scene A stops → but listeners remain! 
4. Scene C starts → adds 5 more (total: 15)
5. Backend event → triggers ALL 15 listeners
6. Chaos ensues

This explains the 45 listeners after just a few transitions!

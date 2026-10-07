# Whisker Wars — Real-Time Multiplayer Trivia Territory Battle

🎮 **Live game:** https://whisker-wars.netlify.app/

Whisker Wars is a real-time multiplayer trivia territory battle for 2–8 players. Players create or join a room with a short code, answer trivia questions, and capture or steal territories on a shared map.

## ✨ Features

- 2–8 player multiplayer rooms
- Create/join by room code
- No login required
- Display names for players
- Shared 24-territory map
- Trivia-based territory capture and stealing
- Server-authoritative turn order and scoring
- Strongly consistent room state with conditional writes
- Reconnect/resume support
- Responsive phone and desktop UI
- Three-round matches with a final winner

## 🕹️ How to Play

1. Open the live game.
2. Enter a display name and create or join a room.
3. Share the room code with other players.
4. When at least two players are in the lobby, the host starts the game.
5. On your turn, answer the trivia question and select a neutral or rival territory.
6. A correct answer captures the selected territory; rival territory can be stolen.
7. After three rounds, the player with the most territories wins.

## 🏗️ Architecture

The frontend lives in `web/`. Multiplayer state is handled by the Netlify Function in `netlify/functions/game.ts` and the shared game logic in `netlify/lib/game.js`. Room state is persisted with Netlify Blobs using strong consistency and conditional writes.

The browser stores only the reconnect credential for the individual player; shared game state remains server-side.

## 🧪 Testing

The repository includes an integration-style test covering two players completing three synchronized rounds, including:

- room creation and joining
- synchronized state
- out-of-turn rejection
- territory capture and stealing
- score synchronization
- final winner calculation
- reconnect/resume state

Run:

```bash
npm install
npm test
```

## 🚀 Build

```bash
npm run build
```

The Netlify configuration is included in `netlify.toml`.

## 📁 Project Structure

```text
web/                    # Frontend UI
netlify/functions/      # Netlify serverless entry point
netlify/lib/            # Multiplayer game logic
scripts/                # Build scripts
test/                   # Game integration tests
netlify.toml            # Netlify deployment configuration
package.json            # Project scripts and dependencies
```

## 🌟 Project Story

The goal was to combine the speed of trivia with the strategy of territory control. The biggest technical challenge was keeping turns, territory ownership, scores, and reconnect behavior consistent for players on separate devices while keeping the experience simple enough to pick up immediately.

Built for the Handshake Create a Multiplayer Game mission.

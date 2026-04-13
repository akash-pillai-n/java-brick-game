# Brick Breaker

A full-stack browser-based Brick Breaker arcade game. The original Java/Swing desktop implementation has been re-built as a web application with an HTML5 Canvas game engine and a Node.js REST API backend for score persistence and a live leaderboard.

---

## Project Structure

```
java-brick-game/
├── Java-Game-Brick-Breaker-master/   Original Java/Swing source (reference)
│   └── src/
│       ├── Main.java
│       ├── Gameplay.java
│       └── MapGenerator.java
│
├── backend/
│   ├── package.json                  Node.js dependencies
│   ├── server.js                     Express REST API + static file server
│   └── data/
│       └── scores.json               Score records (auto-created at first run)
│
├── frontend/
│   ├── index.html                    Single-page application shell
│   ├── css/
│   │   └── style.css                 Dark-themed UI styles
│   └── js/
│       ├── api.js                    ApiClient — wraps fetch calls to the backend
│       ├── game.js                   Game engine (canvas rendering, physics, state)
│       └── app.js                    UI controller (screens, HUD, overlays, modal)
│
└── README.md
```

---

## Features

### Game

- Five progressively harder levels — more bricks and a faster ball each level
- Three lives per game session; losing the ball costs a life
- Paddle responds to keyboard arrow keys, WASD, or mouse/touch pointer
- Angle control — where the ball hits the paddle affects its outgoing direction
- Particle burst effect on every brick destroyed
- Smooth 60 fps rendering via `requestAnimationFrame`
- Pause and resume with the `P` key or Escape

### Scoring

- +10 points per brick destroyed
- +5 bonus points when the ball speed exceeds a threshold (rewards aggressive play)
- Personal best stored in `localStorage` and displayed in the HUD during play

### Leaderboard

- Top 10 scores stored server-side in `backend/data/scores.json`
- Scores are submitted by name after a game over or winning all levels
- Leaderboard accessible from the main menu and during a paused game

---

## Tech Stack

| Layer    | Technology                        |
|----------|-----------------------------------|
| Game     | HTML5 Canvas API, vanilla JS ES6  |
| Frontend | HTML5, CSS3 (custom properties)   |
| Backend  | Node.js 18+, Express 4            |
| Storage  | JSON flat-file (no database)      |
| Build    | None — zero bundler required      |

---

## Prerequisites

- **Node.js** 18 or later — [nodejs.org](https://nodejs.org)
- **npm** (included with Node.js)

---

## Getting Started

### 1. Install dependencies

```bash
cd backend
npm install
```

### 2. Start the server

```bash
node server.js
# or, for auto-reload during development:
npx nodemon server.js
```

The server starts on **http://localhost:3001** by default.
To use a different port set the `PORT` environment variable:

```bash
PORT=8080 node server.js
```

### 3. Open the game

Navigate to **http://localhost:3001** in any modern browser.

---

## API Reference

All endpoints are prefixed with `/api`.

### GET /api/scores

Returns the top 10 scores in descending order.

**Response** `200 OK`

```json
[
  {
    "id": "1712345678901",
    "name": "Alice",
    "score": 420,
    "level": 3,
    "date": "2026-04-13T10:22:00.000Z"
  }
]
```

### POST /api/scores

Submits a new score.

**Request body**

```json
{
  "name": "Alice",
  "score": 420,
  "level": 3
}
```

| Field   | Type   | Required | Notes                    |
|---------|--------|----------|--------------------------|
| `name`  | string | yes      | Trimmed, max 20 chars    |
| `score` | number | yes      | Non-negative integer     |
| `level` | number | no       | Defaults to 1 if omitted |

**Response** `201 Created` — the saved entry object.

### DELETE /api/scores/:id

Removes a score by its `id`. Returns `404` if not found.

### GET /api/health

Returns `{ "status": "ok", "timestamp": "..." }`.

---

## Controls

| Action          | Keyboard              | Pointer               |
|-----------------|-----------------------|-----------------------|
| Move paddle     | Arrow Left / Right    | Move mouse over canvas|
| Move paddle     | A / D                 | Touch and drag        |
| Pause / Resume  | P or Escape           | —                     |

---

## Level Progression

| Level | Rows | Cols | Bricks | Ball Speed |
|-------|------|------|--------|------------|
| 1     | 3    | 8    | 24     | Normal     |
| 2     | 4    | 9    | 36     | +15%       |
| 3     | 4    | 10   | 40     | +25%       |
| 4     | 5    | 11   | 55     | +35%       |
| 5     | 5    | 12   | 60     | +50%       |

---

## Original Java Source

The `Java-Game-Brick-Breaker-master/` directory contains the original NetBeans/Ant project. To run it:

```bash
cd Java-Game-Brick-Breaker-master
# With Ant:
ant run
# Or compile and run manually (Java 8+):
javac -d build src/*.java
java -cp build Main
```

---

## Development Notes

- The backend serves the `frontend/` directory as static files, so no separate dev server is needed.
- `backend/data/scores.json` is created automatically on the first request.
- Scores are not validated against replay or cheating — this is an arcade game, not a competitive platform.
- Adding a real database (SQLite, PostgreSQL) is straightforward: replace the `readScores` / `writeScores` functions in `backend/server.js`.

---

## License

MIT

'use strict';

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'scores.json');
const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');

// -----------------------------------------------------------------------
// Middleware
// -----------------------------------------------------------------------

app.use(cors());
app.use(express.json());
app.use(express.static(FRONTEND_DIR));

// -----------------------------------------------------------------------
// Score persistence helpers
// -----------------------------------------------------------------------

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2), 'utf8');
  }
}

function readScores() {
  ensureDataFile();
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeScores(scores) {
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(scores, null, 2), 'utf8');
}

// -----------------------------------------------------------------------
// Routes
// -----------------------------------------------------------------------

// GET /api/scores — return top 10 scores sorted descending
app.get('/api/scores', (req, res) => {
  const scores = readScores();
  const top10 = [...scores]
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
  res.json(top10);
});

// POST /api/scores — submit a new score
app.post('/api/scores', (req, res) => {
  const { name, score, level } = req.body;

  if (typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'name must be a non-empty string' });
  }
  if (typeof score !== 'number' || !Number.isFinite(score)) {
    return res.status(400).json({ error: 'score must be a finite number' });
  }

  const entry = {
    id: Date.now().toString(),
    name: name.trim().slice(0, 20),
    score: Math.max(0, Math.floor(score)),
    level: Number.isInteger(level) ? Math.max(1, level) : 1,
    date: new Date().toISOString(),
  };

  const scores = readScores();
  scores.push(entry);
  writeScores(scores);

  res.status(201).json(entry);
});

// DELETE /api/scores/:id — remove a score by id (admin use)
app.delete('/api/scores/:id', (req, res) => {
  const scores = readScores();
  const filtered = scores.filter(s => s.id !== req.params.id);
  if (filtered.length === scores.length) {
    return res.status(404).json({ error: 'score not found' });
  }
  writeScores(filtered);
  res.status(200).json({ deleted: req.params.id });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve the SPA for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});

// -----------------------------------------------------------------------
// Start server
// -----------------------------------------------------------------------

app.listen(PORT, () => {
  console.log(`Brick Breaker server is running at http://localhost:${PORT}`);
});

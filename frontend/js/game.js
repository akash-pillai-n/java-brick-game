'use strict';

// =========================================================================
// Constants
// =========================================================================

const CANVAS_W = 700;
const CANVAS_H = 520;

const PADDLE_Y       = 468;
const PADDLE_WIDTH   = 100;
const PADDLE_HEIGHT  = 10;
const PADDLE_SPEED   = 7;

const BALL_RADIUS   = 9;
const BALL_START_X  = 350;
const BALL_START_Y  = 360;

const BRICK_AREA_X     = 30;
const BRICK_AREA_Y     = 44;
const BRICK_AREA_WIDTH = 640;
const BRICK_HEIGHT     = 24;
const BRICK_GAP        = 4;
const BRICK_ROW_HEIGHT = BRICK_HEIGHT + BRICK_GAP;

// One colour per row (cycling)
const ROW_COLORS = ['#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#3498db', '#9b59b6'];

// Five progressively harder levels
const LEVELS = [
  { rows: 3, cols: 8,  dx: 2.8, dy: -3.5 },
  { rows: 4, cols: 9,  dx: 3.2, dy: -4.0 },
  { rows: 4, cols: 10, dx: 3.5, dy: -4.2 },
  { rows: 5, cols: 11, dx: 3.8, dy: -4.6 },
  { rows: 5, cols: 12, dx: 4.2, dy: -5.0 },
];

// =========================================================================
// Particle — used for brick-destruction visual effect
// =========================================================================

class Particle {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.vx = (Math.random() - 0.5) * 7;
    this.vy = (Math.random() - 0.5) * 7 - 1.5;
    this.radius = Math.random() * 3.5 + 1.5;
    this.alpha = 1;
    this.decay = Math.random() * 0.025 + 0.018;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += 0.18;
    this.alpha -= this.decay;
  }

  draw(ctx) {
    if (this.alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
    ctx.restore();
  }

  get dead() {
    return this.alpha <= 0;
  }
}

// =========================================================================
// Game
// =========================================================================

class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');

    // Game state
    this.state    = 'idle';
    this.score    = 0;
    this.lives    = 3;
    this.level    = 1;

    // Game objects
    this.ball      = null;
    this.paddle    = null;
    this.bricks    = [];
    this.particles = [];

    // Input tracking
    this.keys   = new Set();
    this.mouseX = null;

    // Loop bookkeeping
    this.animFrame = null;
    this.lastTime  = 0;

    // Bind so removeEventListener works
    this._onKeyDown   = this._onKeyDown.bind(this);
    this._onKeyUp     = this._onKeyUp.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onTouch     = this._onTouch.bind(this);
    this.loop         = this.loop.bind(this);

    this._setupInput();

    // Render the idle backdrop immediately
    this._drawBackground();
  }

  // -----------------------------------------------------------------------
  // Input
  // -----------------------------------------------------------------------

  _setupInput() {
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup',   this._onKeyUp);
    this.canvas.addEventListener('mousemove', this._onMouseMove);
    this.canvas.addEventListener('touchmove', this._onTouch, { passive: false });
  }

  _onKeyDown(e) {
    this.keys.add(e.code);

    if (e.code === 'KeyP' || e.code === 'Escape') {
      if (this.state === 'playing') {
        this.pause();
      } else if (this.state === 'paused') {
        this.resume();
      }
    }

    // Prevent page scroll while playing
    if (
      this.state === 'playing' &&
      ['ArrowLeft', 'ArrowRight', 'Space'].includes(e.key)
    ) {
      e.preventDefault();
    }
  }

  _onKeyUp(e) {
    this.keys.delete(e.code);
  }

  _onMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    this.mouseX = (e.clientX - rect.left) * scaleX;
  }

  _onTouch(e) {
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    this.mouseX = (e.touches[0].clientX - rect.left) * scaleX;
  }

  // -----------------------------------------------------------------------
  // Public lifecycle API (called by app.js)
  // -----------------------------------------------------------------------

  start() {
    this.score    = 0;
    this.lives    = 3;
    this.level    = 1;
    this.particles = [];
    this._initLevel(0);
    this._setState('playing');
    this._emitHud();
    this._startLoop();
  }

  stop() {
    this._stopLoop();
    this._setState('idle');
    this._drawBackground();
  }

  pause() {
    if (this.state !== 'playing') return;
    this._setState('paused');
    this.canvas.dispatchEvent(new CustomEvent('game:paused'));
  }

  resume() {
    if (this.state !== 'paused') return;
    this._setState('playing');
    this.lastTime = performance.now();
    this.canvas.dispatchEvent(new CustomEvent('game:resumed'));
  }

  nextLevel() {
    this.level++;
    const idx = Math.min(this.level - 1, LEVELS.length - 1);
    this.particles = [];
    this._initLevel(idx);
    this._setState('playing');
    this._emitHud();
  }

  destroy() {
    this._stopLoop();
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup',   this._onKeyUp);
    this.canvas.removeEventListener('mousemove', this._onMouseMove);
    this.canvas.removeEventListener('touchmove', this._onTouch);
  }

  // -----------------------------------------------------------------------
  // Level initialisation
  // -----------------------------------------------------------------------

  _initLevel(idx) {
    const cfg = LEVELS[idx];

    this.paddle = {
      x:      (CANVAS_W - PADDLE_WIDTH) / 2,
      y:      PADDLE_Y,
      width:  PADDLE_WIDTH,
      height: PADDLE_HEIGHT,
    };

    const dir = Math.random() > 0.5 ? 1 : -1;
    this.ball = {
      x:      BALL_START_X,
      y:      BALL_START_Y,
      dx:     cfg.dx * dir,
      dy:     cfg.dy,
      radius: BALL_RADIUS,
    };

    this.bricks = [];
    const brickWidth = Math.floor(BRICK_AREA_WIDTH / cfg.cols);

    for (let row = 0; row < cfg.rows; row++) {
      for (let col = 0; col < cfg.cols; col++) {
        this.bricks.push({
          x:     BRICK_AREA_X + col * brickWidth,
          y:     BRICK_AREA_Y + row * BRICK_ROW_HEIGHT,
          width: brickWidth,
          height: BRICK_HEIGHT,
          color: ROW_COLORS[row % ROW_COLORS.length],
          alive: true,
        });
      }
    }
  }

  _resetBall() {
    const cfg = LEVELS[Math.min(this.level - 1, LEVELS.length - 1)];
    const dir = Math.random() > 0.5 ? 1 : -1;
    this.ball.x  = BALL_START_X;
    this.ball.y  = BALL_START_Y;
    this.ball.dx = cfg.dx * dir;
    this.ball.dy = cfg.dy;
    this.paddle.x = (CANVAS_W - PADDLE_WIDTH) / 2;
  }

  // -----------------------------------------------------------------------
  // Game loop
  // -----------------------------------------------------------------------

  _startLoop() {
    this._stopLoop();
    this.lastTime  = performance.now();
    this.animFrame = requestAnimationFrame(this.loop);
  }

  _stopLoop() {
    if (this.animFrame !== null) {
      cancelAnimationFrame(this.animFrame);
      this.animFrame = null;
    }
  }

  loop(timestamp) {
    this.animFrame = requestAnimationFrame(this.loop);
    if (this.state === 'playing') {
      this._update();
    }
    this._draw();
  }

  // -----------------------------------------------------------------------
  // Update — fixed-pixel-step physics (mirrors the original Java timer)
  // -----------------------------------------------------------------------

  _update() {
    this._movePaddle();
    this._moveBall();
    this._checkWalls();
    this._checkPaddle();
    const aliveBricks = this._checkBricks();
    this._updateParticles();
    this._emitHud();
    this._checkEndConditions(aliveBricks);
  }

  _movePaddle() {
    const usingKeys =
      this.keys.has('ArrowLeft')  || this.keys.has('KeyA') ||
      this.keys.has('ArrowRight') || this.keys.has('KeyD');

    if (usingKeys) {
      // Keyboard takes priority; clear mouse so it doesn't fight
      this.mouseX = null;
      if (this.keys.has('ArrowLeft')  || this.keys.has('KeyA')) this.paddle.x -= PADDLE_SPEED;
      if (this.keys.has('ArrowRight') || this.keys.has('KeyD')) this.paddle.x += PADDLE_SPEED;
    } else if (this.mouseX !== null) {
      // Smooth mouse/touch follow
      const target = this.mouseX - this.paddle.width / 2;
      this.paddle.x += (target - this.paddle.x) * 0.22;
    }

    // Clamp to canvas
    this.paddle.x = Math.max(0, Math.min(CANVAS_W - this.paddle.width, this.paddle.x));
  }

  _moveBall() {
    this.ball.x += this.ball.dx;
    this.ball.y += this.ball.dy;
  }

  _checkWalls() {
    const b = this.ball;

    if (b.x - b.radius < 0) {
      b.x  = b.radius;
      b.dx = Math.abs(b.dx);
    }
    if (b.x + b.radius > CANVAS_W) {
      b.x  = CANVAS_W - b.radius;
      b.dx = -Math.abs(b.dx);
    }
    if (b.y - b.radius < 0) {
      b.y  = b.radius;
      b.dy = Math.abs(b.dy);
    }
  }

  _checkPaddle() {
    const b = this.ball;
    const p = this.paddle;

    if (
      b.dy > 0 &&
      b.y + b.radius >= p.y &&
      b.y + b.radius <= p.y + p.height + 6 &&
      b.x >= p.x - b.radius &&
      b.x <= p.x + p.width + b.radius
    ) {
      // Reposition so ball sits just above paddle
      b.y = p.y - b.radius;

      // Angle based on hit position (0 = left edge, 1 = right edge)
      const hitPos = (b.x - p.x) / p.width;
      const speed  = Math.hypot(b.dx, b.dy);
      // Spread: -65° to +65°
      const angle  = (hitPos - 0.5) * Math.PI * 0.72;
      b.dx = speed * Math.sin(angle);
      b.dy = -speed * Math.cos(angle);
    }
  }

  // Returns number of bricks still alive after checking collisions
  _checkBricks() {
    const b = this.ball;
    let alive = 0;

    for (const brick of this.bricks) {
      if (!brick.alive) continue;
      alive++;

      if (!this._ballHitsBrick(brick)) continue;

      brick.alive = false;
      alive--;
      this.score += 10;

      // Particle burst at brick centre
      const cx = brick.x + brick.width  / 2;
      const cy = brick.y + brick.height / 2;
      for (let i = 0; i < 10; i++) {
        this.particles.push(new Particle(cx, cy, brick.color));
      }

      // Score bonus for fast ball (encourages aggressive play)
      const speed = Math.hypot(b.dx, b.dy);
      if (speed > 5) this.score += 5;

      break; // one brick collision per frame prevents tunnelling
    }

    return alive;
  }

  // AABB collision with side-detection and reflection
  _ballHitsBrick(brick) {
    const b = this.ball;
    const bl = b.x - b.radius;
    const br = b.x + b.radius;
    const bt = b.y - b.radius;
    const bb = b.y + b.radius;

    if (br < brick.x || bl > brick.x + brick.width ||
        bb < brick.y || bt > brick.y + brick.height) {
      return false;
    }

    // Determine smallest penetration axis
    const overlapL = br - brick.x;
    const overlapR = (brick.x + brick.width)  - bl;
    const overlapT = bb - brick.y;
    const overlapB = (brick.y + brick.height) - bt;
    const min = Math.min(overlapL, overlapR, overlapT, overlapB);

    if      (min === overlapL) b.dx = -Math.abs(b.dx);
    else if (min === overlapR) b.dx =  Math.abs(b.dx);
    else if (min === overlapT) b.dy = -Math.abs(b.dy);
    else                       b.dy =  Math.abs(b.dy);

    return true;
  }

  _updateParticles() {
    this.particles = this.particles.filter(p => {
      p.update();
      return !p.dead;
    });
  }

  _checkEndConditions(aliveBricks) {
    // Win: all bricks cleared
    if (aliveBricks === 0) {
      if (this.level >= LEVELS.length) {
        this._setState('won');
        this.canvas.dispatchEvent(
          new CustomEvent('game:won', { detail: { score: this.score } })
        );
      } else {
        this._setState('levelcomplete');
        this.canvas.dispatchEvent(
          new CustomEvent('game:levelcomplete', {
            detail: { level: this.level, score: this.score },
          })
        );
      }
      return;
    }

    // Lose a life: ball fell below canvas
    if (this.ball.y - this.ball.radius > CANVAS_H) {
      this.lives--;
      this._emitHud();

      if (this.lives <= 0) {
        this._setState('gameover');
        this.canvas.dispatchEvent(
          new CustomEvent('game:gameover', {
            detail: { score: this.score, level: this.level },
          })
        );
      } else {
        this._resetBall();
      }
    }
  }

  // -----------------------------------------------------------------------
  // Rendering
  // -----------------------------------------------------------------------

  _draw() {
    const ctx = this.ctx;

    // Background
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    this._drawBackground(ctx);

    if (this.state === 'idle') return;

    // Bricks
    for (const brick of this.bricks) {
      if (brick.alive) this._drawBrick(ctx, brick);
    }

    // Particles
    for (const p of this.particles) p.draw(ctx);

    // Paddle
    this._drawPaddle(ctx);

    // Ball (only while playing or paused — not after game over)
    if (this.state === 'playing' || this.state === 'paused') {
      this._drawBall(ctx);
    }
  }

  _drawBackground(ctx) {
    ctx = ctx || this.ctx;
    // Subtle dot-grid
    ctx.fillStyle = 'rgba(255, 255, 255, 0.025)';
    const spacing = 40;
    for (let x = spacing; x < CANVAS_W; x += spacing) {
      for (let y = spacing; y < CANVAS_H; y += spacing) {
        ctx.beginPath();
        ctx.arc(x, y, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Outer border
    ctx.strokeStyle = '#21262d';
    ctx.lineWidth   = 2;
    ctx.strokeRect(1, 1, CANVAS_W - 2, CANVAS_H - 2);
  }

  _drawBrick(ctx, brick) {
    const pad = BRICK_GAP / 2;
    const x   = brick.x + pad;
    const y   = brick.y + pad;
    const w   = brick.width  - BRICK_GAP;
    const h   = brick.height - pad;

    // Base fill
    ctx.fillStyle = brick.color;
    this._fillRoundRect(ctx, x, y, w, h, 4);

    // Top-shine highlight
    const shine = ctx.createLinearGradient(x, y, x, y + h);
    shine.addColorStop(0,   'rgba(255, 255, 255, 0.38)');
    shine.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = shine;
    this._fillRoundRect(ctx, x, y, w, h * 0.52, 4);
  }

  _drawPaddle(ctx) {
    const { x, y, width, height } = this.paddle;

    const grad = ctx.createLinearGradient(x, y, x, y + height);
    grad.addColorStop(0, '#58a6ff');
    grad.addColorStop(1, '#1f6feb');

    ctx.fillStyle = grad;
    this._fillRoundRect(ctx, x, y, width, height, 5);

    // Shine stripe
    ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
    this._fillRoundRect(ctx, x + 5, y + 2, width - 10, height / 2 - 1, 3);
  }

  _drawBall(ctx) {
    const { x, y, radius } = this.ball;

    const grad = ctx.createRadialGradient(
      x - radius * 0.3, y - radius * 0.3, radius * 0.08,
      x, y, radius
    );
    grad.addColorStop(0,   '#ffffff');
    grad.addColorStop(0.4, '#ffeaa7');
    grad.addColorStop(1,   '#fdcb6e');

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.closePath();
  }

  // Rounded-rectangle fill helper (polyfill for older browsers)
  _fillRoundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y,     x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x,     y + h, x,     y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x,     y,     x + r, y);
    ctx.closePath();
    ctx.fill();
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  _setState(state) {
    this.state = state;
  }

  _emitHud() {
    this.canvas.dispatchEvent(
      new CustomEvent('game:hud', {
        detail: { score: this.score, level: this.level, lives: this.lives },
      })
    );
  }
}

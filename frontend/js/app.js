'use strict';

document.addEventListener('DOMContentLoaded', () => {
  // -----------------------------------------------------------------------
  // Core references
  // -----------------------------------------------------------------------

  const canvas = document.getElementById('game-canvas');
  const api    = new ApiClient('/api');
  const game   = new Game(canvas);

  // -----------------------------------------------------------------------
  // Screen management
  // -----------------------------------------------------------------------

  const screens = {
    menu:        document.getElementById('screen-menu'),
    game:        document.getElementById('screen-game'),
    leaderboard: document.getElementById('screen-leaderboard'),
  };

  function showScreen(name) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[name].classList.add('active');
    if (name !== 'game') canvas.focus();
  }

  // -----------------------------------------------------------------------
  // HUD
  // -----------------------------------------------------------------------

  const hudScore = document.getElementById('hud-score');
  const hudLevel = document.getElementById('hud-level');
  const hudLives = document.getElementById('hud-lives');
  const hudBest  = document.getElementById('hud-best');

  let bestScore = parseInt(localStorage.getItem('bb_best') || '0', 10);
  hudBest.textContent = bestScore.toLocaleString();

  canvas.addEventListener('game:hud', (e) => {
    const { score, level, lives } = e.detail;
    hudScore.textContent = score.toLocaleString();
    hudLevel.textContent = level;
    hudLives.textContent = lives;
    if (score > bestScore) {
      bestScore = score;
      localStorage.setItem('bb_best', bestScore);
      hudBest.textContent = bestScore.toLocaleString();
    }
  });

  // -----------------------------------------------------------------------
  // Overlay (pause / level-complete / game-over / win)
  // -----------------------------------------------------------------------

  const overlay        = document.getElementById('game-overlay');
  const overlayTitle   = document.getElementById('overlay-title');
  const overlayMessage = document.getElementById('overlay-message');
  const overlayActions = document.getElementById('overlay-actions');

  // Current overlay handler — set before each showOverlay call.
  // Using a single delegated listener avoids stale-listener bugs.
  let overlayHandler = null;

  overlayActions.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (btn && overlayHandler) overlayHandler(btn.dataset.action);
  });

  function showOverlay(title, message, actions, handler) {
    overlayTitle.textContent   = title;
    overlayMessage.textContent = message;
    overlayActions.innerHTML   = '';
    actions.forEach(({ label, action, primary }) => {
      const btn = document.createElement('button');
      btn.textContent        = label;
      btn.dataset.action     = action;
      btn.className          = primary ? 'btn btn-primary' : 'btn btn-secondary';
      overlayActions.appendChild(btn);
    });
    overlayHandler = handler;
    overlay.classList.remove('hidden');
  }

  function hideOverlay() {
    overlay.classList.add('hidden');
    overlayHandler = null;
  }

  // -----------------------------------------------------------------------
  // Score-submission modal
  // -----------------------------------------------------------------------

  const modal          = document.getElementById('modal-submit');
  const modalScore     = document.getElementById('modal-final-score');
  const nameInput      = document.getElementById('player-name');
  const btnSubmit      = document.getElementById('btn-submit-score');
  const btnSkip        = document.getElementById('btn-skip-score');
  const submitError    = document.getElementById('submit-error');
  const submitSpinner  = document.getElementById('submit-spinner');

  function showModal(score, level, onDone) {
    modalScore.textContent = score.toLocaleString();
    nameInput.value        = '';
    nameInput.classList.remove('error');
    submitError.textContent = '';
    submitSpinner.classList.add('hidden');
    modal.classList.remove('hidden');
    nameInput.focus();

    const cleanup = () => {
      btnSubmit.removeEventListener('click', handleSubmit);
      btnSkip.removeEventListener('click', handleSkip);
      document.querySelector('.modal-backdrop')
              .removeEventListener('click', handleSkip);
    };

    async function handleSubmit() {
      const name = nameInput.value.trim();
      if (!name) {
        nameInput.classList.add('error');
        nameInput.focus();
        return;
      }
      submitSpinner.classList.remove('hidden');
      btnSubmit.disabled = true;
      try {
        await api.submitScore(name, score, level);
      } catch (err) {
        submitError.textContent = 'Could not reach server — score not saved.';
      } finally {
        submitSpinner.classList.add('hidden');
        btnSubmit.disabled = false;
      }
      cleanup();
      modal.classList.add('hidden');
      onDone();
    }

    function handleSkip() {
      cleanup();
      modal.classList.add('hidden');
      onDone();
    }

    btnSubmit.addEventListener('click', handleSubmit);
    btnSkip.addEventListener('click',   handleSkip);
    document.querySelector('.modal-backdrop')
            .addEventListener('click', handleSkip);
    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleSubmit();
      nameInput.classList.remove('error');
    });
  }

  // -----------------------------------------------------------------------
  // Leaderboard
  // -----------------------------------------------------------------------

  const lbBody    = document.getElementById('leaderboard-body');
  const lbEmpty   = document.getElementById('leaderboard-empty');
  const lbTable   = document.getElementById('leaderboard-table');
  const lbLoading = document.getElementById('leaderboard-loading');

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.appendChild(document.createTextNode(str));
    return d.innerHTML;
  }

  async function loadLeaderboard() {
    lbLoading.classList.remove('hidden');
    lbEmpty.classList.add('hidden');
    lbTable.classList.add('hidden');

    try {
      const scores = await api.getScores();
      lbBody.innerHTML = '';

      if (scores.length === 0) {
        lbEmpty.classList.remove('hidden');
      } else {
        lbTable.classList.remove('hidden');
        scores.forEach((entry, i) => {
          const tr    = document.createElement('tr');
          const medal = i === 0 ? 'rank-gold' : i === 1 ? 'rank-silver' : i === 2 ? 'rank-bronze' : '';
          if (medal) tr.classList.add(medal);
          const date = new Date(entry.date).toLocaleDateString(undefined, {
            year: 'numeric', month: 'short', day: 'numeric',
          });
          tr.innerHTML = `
            <td class="col-rank">${i + 1}</td>
            <td class="col-name">${escapeHtml(entry.name)}</td>
            <td class="col-score">${entry.score.toLocaleString()}</td>
            <td class="col-level">${entry.level}</td>
            <td class="col-date">${date}</td>
          `;
          lbBody.appendChild(tr);
        });
      }
    } catch {
      lbEmpty.textContent = 'Failed to load scores. Is the server running?';
      lbEmpty.classList.remove('hidden');
    } finally {
      lbLoading.classList.add('hidden');
    }
  }

  // -----------------------------------------------------------------------
  // Game event listeners
  // -----------------------------------------------------------------------

  canvas.addEventListener('game:paused', () => {
    showOverlay(
      'Paused',
      'Press P or click Resume to continue.',
      [
        { label: 'Resume',      action: 'resume', primary: true  },
        { label: 'Quit to Menu', action: 'quit',   primary: false },
      ],
      (action) => {
        if (action === 'resume') { game.resume(); hideOverlay(); }
        if (action === 'quit')   { game.stop();   hideOverlay(); showScreen('menu'); }
      }
    );
  });

  canvas.addEventListener('game:resumed', hideOverlay);

  canvas.addEventListener('game:levelcomplete', (e) => {
    const { level, score } = e.detail;
    showOverlay(
      `Level ${level} Complete`,
      `Score so far: ${score.toLocaleString()}. Get ready for Level ${level + 1}.`,
      [{ label: 'Next Level', action: 'next', primary: true }],
      (action) => {
        if (action === 'next') { hideOverlay(); game.nextLevel(); }
      }
    );
  });

  canvas.addEventListener('game:gameover', (e) => {
    const { score, level } = e.detail;
    showOverlay(
      'Game Over',
      `You reached Level ${level} with a score of ${score.toLocaleString()}.`,
      [
        { label: 'Submit Score', action: 'submit', primary: true  },
        { label: 'Play Again',   action: 'retry',  primary: false },
        { label: 'Menu',         action: 'menu',   primary: false },
      ],
      (action) => {
        if (action === 'submit') {
          hideOverlay();
          showModal(score, level, () => showScreen('menu'));
        }
        if (action === 'retry') { hideOverlay(); game.start(); }
        if (action === 'menu')  { game.stop();   hideOverlay(); showScreen('menu'); }
      }
    );
  });

  canvas.addEventListener('game:won', (e) => {
    const { score } = e.detail;
    showOverlay(
      'You Beat All 5 Levels!',
      `Outstanding run. Final score: ${score.toLocaleString()}.`,
      [
        { label: 'Submit Score', action: 'submit', primary: true  },
        { label: 'Play Again',   action: 'retry',  primary: false },
      ],
      (action) => {
        if (action === 'submit') {
          hideOverlay();
          showModal(score, 5, () => showScreen('menu'));
        }
        if (action === 'retry') { hideOverlay(); game.start(); }
      }
    );
  });

  // -----------------------------------------------------------------------
  // Button handlers
  // -----------------------------------------------------------------------

  document.getElementById('btn-play').addEventListener('click', () => {
    showScreen('game');
    hideOverlay();
    game.start();
  });

  document.getElementById('btn-leaderboard-menu').addEventListener('click', async () => {
    showScreen('leaderboard');
    await loadLeaderboard();
  });

  document.getElementById('btn-back-leaderboard').addEventListener('click', () => {
    showScreen('menu');
  });

  document.getElementById('btn-leaderboard-game').addEventListener('click', async () => {
    game.pause();
    showScreen('leaderboard');
    await loadLeaderboard();
  });
});

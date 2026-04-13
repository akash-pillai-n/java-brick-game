'use strict';

class ApiClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async getScores() {
    const res = await fetch(`${this.baseUrl}/scores`);
    if (!res.ok) throw new Error(`Failed to fetch scores: ${res.status}`);
    return res.json();
  }

  async submitScore(name, score, level) {
    const res = await fetch(`${this.baseUrl}/scores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, score, level }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to submit score: ${res.status}`);
    }
    return res.json();
  }
}

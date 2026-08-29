import { CHOICES, scoreFor } from './constants.js';

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Splits players into groups of 2 (pairs). If the count is odd, one group
 * of 3 absorbs the extra player for that round instead of leaving anyone out.
 */
export function generateGroups(playerIds) {
  const ids = shuffle(playerIds);
  const groups = [];
  if (ids.length % 2 === 1 && ids.length >= 3) {
    groups.push(ids.splice(0, 3));
  }
  while (ids.length > 0) {
    groups.push(ids.splice(0, 2));
  }
  return groups;
}

/**
 * choices: plain object { playerId: 'COOPERATE' | 'DEFECT' }
 * Returns per-player results. For a 3-player group, each player's score is
 * the rounded average of their two pairwise outcomes against the other two.
 */
export function computeGroupResults(group, choices) {
  return group.map((pid) => {
    const opponents = group.filter((o) => o !== pid);
    const pairScores = opponents.map((o) => scoreFor(choices[pid], choices[o]));
    const raw = pairScores.reduce((s, v) => s + v, 0) / pairScores.length;
    return {
      playerId: pid,
      scoreDelta: Math.round(raw),
      myChoice: choices[pid],
      opponents: opponents.map((o) => ({ playerId: o, choice: choices[o] })),
    };
  });
}

/**
 * players: array of { id, nickname, totalScore, history }
 * history entries: { round, myChoice, opponents: [{playerId, nickname, choice}] }
 */
export function computeFunStats(players) {
  const eligible = players.filter((p) => p.history.length > 0);
  if (eligible.length === 0) return { mostTrusted: null, mostSurpriseBetrayer: null };

  let mostTrusted = null;
  let bestRate = -1;
  for (const p of eligible) {
    const cooperateCount = p.history.filter((h) => h.myChoice === CHOICES.COOPERATE).length;
    const rate = cooperateCount / p.history.length;
    if (rate > bestRate || (rate === bestRate && mostTrusted && p.totalScore > mostTrusted.totalScore)) {
      bestRate = rate;
      mostTrusted = p;
    }
  }

  let mostSurpriseBetrayer = null;
  let bestBetrayCount = 0;
  for (const p of eligible) {
    let count = 0;
    for (const h of p.history) {
      if (h.myChoice !== CHOICES.DEFECT) continue;
      count += h.opponents.filter((o) => o.choice === CHOICES.COOPERATE).length;
    }
    if (count > bestBetrayCount) {
      bestBetrayCount = count;
      mostSurpriseBetrayer = p;
    }
  }

  return {
    mostTrusted: mostTrusted ? { id: mostTrusted.id, nickname: mostTrusted.nickname, cooperateRate: bestRate } : null,
    mostSurpriseBetrayer: mostSurpriseBetrayer
      ? { id: mostSurpriseBetrayer.id, nickname: mostSurpriseBetrayer.nickname, betrayalCount: bestBetrayCount }
      : null,
  };
}

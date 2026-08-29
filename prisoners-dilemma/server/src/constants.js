export const ROUND_DURATION_MS = 15000;
export const RESULT_DISPLAY_HINT_MS = 8000; // client-side hint only, host advances manually
export const MIN_ROUNDS = 3;
export const MAX_ROUNDS = 5;
export const DEFAULT_ROUNDS = 4;

export const CHOICES = {
  COOPERATE: 'COOPERATE',
  DEFECT: 'DEFECT',
};

// 팀 빌딩용으로 우호적으로 조정된 점수 규칙
export function scoreFor(mine, theirs) {
  if (mine === CHOICES.COOPERATE && theirs === CHOICES.COOPERATE) return 3;
  if (mine === CHOICES.DEFECT && theirs === CHOICES.DEFECT) return 1;
  if (mine === CHOICES.DEFECT && theirs === CHOICES.COOPERATE) return 5;
  return 0; // mine === COOPERATE, theirs === DEFECT
}

export const ROOM_CODE_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // no 0/O/1/I to avoid confusion

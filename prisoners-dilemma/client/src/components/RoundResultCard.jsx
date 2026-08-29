const CHOICE_META = {
  COOPERATE: { label: '협력', emoji: '🤝', className: 'bg-cooperate' },
  DEFECT: { label: '배신', emoji: '🗡️', className: 'bg-defect' },
};

function FlipCard({ nickname, choice, delayMs = 0 }) {
  const meta = CHOICE_META[choice];
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`w-20 h-24 rounded-xl flex flex-col items-center justify-center gap-1 text-white font-bold shadow-lg animate-flip ${meta.className}`}
        style={{ animationDelay: `${delayMs}ms`, perspective: '600px' }}
      >
        <span className="text-3xl">{meta.emoji}</span>
        <span className="text-xs">{meta.label}</span>
      </div>
      <span className="text-xs text-gray-400 max-w-[6rem] truncate">{nickname}</span>
    </div>
  );
}

export default function RoundResultCard({ myNickname = '나', myChoice, opponents, scoreDelta }) {
  const scorePositive = scoreDelta > 0;
  return (
    <div className="flex flex-col items-center gap-6 w-full">
      <div className="flex items-center justify-center gap-4 flex-wrap">
        <FlipCard nickname={myNickname} choice={myChoice} />
        <span className="text-xl text-gray-500 font-bold">VS</span>
        <div className="flex gap-3 flex-wrap justify-center">
          {opponents.map((o, i) => (
            <FlipCard key={o.id} nickname={o.nickname} choice={o.choice} delayMs={100 + i * 80} />
          ))}
        </div>
      </div>

      <div className={`text-5xl font-extrabold animate-popIn ${scorePositive ? 'text-cooperate-light' : 'text-gray-400'}`}>
        {scorePositive ? '+' : ''}
        {scoreDelta}점
      </div>
    </div>
  );
}

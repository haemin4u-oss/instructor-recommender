const MEDALS = ['🥇', '🥈', '🥉'];

export default function Leaderboard({ entries, highlightId, compact = false }) {
  if (!entries || entries.length === 0) {
    return <p className="text-gray-500 text-center py-6">아직 참가자가 없습니다.</p>;
  }

  return (
    <ol className="flex flex-col gap-2">
      {entries.map((entry, idx) => {
        const isMe = entry.id === highlightId;
        return (
          <li
            key={entry.id}
            className={[
              'flex items-center justify-between rounded-xl px-4 animate-countUp',
              compact ? 'py-2' : 'py-3',
              isMe ? 'bg-cooperate/20 ring-1 ring-cooperate' : 'bg-gray-800/70',
            ].join(' ')}
            style={{ animationDelay: `${idx * 40}ms` }}
          >
            <span className="flex items-center gap-2 font-medium truncate">
              <span className="w-7 text-center shrink-0">{MEDALS[idx] || idx + 1}</span>
              <span className="truncate">{entry.nickname}</span>
              {isMe && <span className="text-xs text-cooperate-light">(나)</span>}
              {entry.connected === false && <span className="text-xs text-gray-500">· 접속끊김</span>}
            </span>
            <span className="font-bold tabular-nums shrink-0 ml-2">{entry.totalScore}점</span>
          </li>
        );
      })}
    </ol>
  );
}

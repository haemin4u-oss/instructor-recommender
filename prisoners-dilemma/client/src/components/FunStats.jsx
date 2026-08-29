export default function FunStats({ funStats }) {
  if (!funStats) return null;
  const { mostTrusted, mostSurpriseBetrayer } = funStats;
  if (!mostTrusted && !mostSurpriseBetrayer) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
      {mostTrusted && (
        <div className="rounded-2xl bg-cooperate/15 ring-1 ring-cooperate/40 p-4 text-center">
          <div className="text-3xl mb-1">😇</div>
          <div className="text-sm text-gray-300">가장 신뢰받은 사람</div>
          <div className="text-lg font-bold mt-1">{mostTrusted.nickname}</div>
          <div className="text-xs text-gray-400 mt-1">협력률 {Math.round(mostTrusted.cooperateRate * 100)}%</div>
        </div>
      )}
      {mostSurpriseBetrayer && (
        <div className="rounded-2xl bg-defect/15 ring-1 ring-defect/40 p-4 text-center">
          <div className="text-3xl mb-1">🥷</div>
          <div className="text-sm text-gray-300">가장 의외의 배신자</div>
          <div className="text-lg font-bold mt-1">{mostSurpriseBetrayer.nickname}</div>
          <div className="text-xs text-gray-400 mt-1">허를 찌른 배신 {mostSurpriseBetrayer.betrayalCount}회</div>
        </div>
      )}
    </div>
  );
}

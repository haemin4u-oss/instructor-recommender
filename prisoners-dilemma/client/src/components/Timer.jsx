import { useEffect, useState } from 'react';

export default function Timer({ deadline, totalMs = 15000 }) {
  const [remainingMs, setRemainingMs] = useState(() => Math.max(0, deadline - Date.now()));

  useEffect(() => {
    setRemainingMs(Math.max(0, deadline - Date.now()));
    const interval = setInterval(() => {
      setRemainingMs(Math.max(0, deadline - Date.now()));
    }, 100);
    return () => clearInterval(interval);
  }, [deadline]);

  const seconds = Math.ceil(remainingMs / 1000);
  const pct = Math.min(100, Math.max(0, (remainingMs / totalMs) * 100));
  const urgent = seconds <= 5;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1 text-sm">
        <span className="text-gray-400">남은 시간</span>
        <span className={urgent ? 'text-defect-light font-bold' : 'text-gray-300 font-semibold'}>{seconds}초</span>
      </div>
      <div className="h-2 w-full rounded-full bg-gray-800 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-100 ease-linear ${urgent ? 'bg-defect' : 'bg-cooperate'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { socket, emitAsync } from '../socket.js';
import { getHostSession, clearHostSession } from '../storage.js';
import QRCodeBox from '../components/QRCodeBox.jsx';
import Leaderboard from '../components/Leaderboard.jsx';
import Timer from '../components/Timer.jsx';
import FunStats from '../components/FunStats.jsx';

const CHOICE_LABEL = { COOPERATE: '🤝 협력', DEFECT: '🗡️ 배신' };

export default function HostDashboard() {
  const { roomCode } = useParams();
  const [session] = useState(() => getHostSession());
  const [snapshot, setSnapshot] = useState(null);
  const [progress, setProgress] = useState({ answered: 0, total: 0 });
  const [lastResults, setLastResults] = useState(null);
  const [funStats, setFunStats] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const invalidSession = !session || session.roomCode !== roomCode;

  const reconnect = useCallback(async () => {
    if (invalidSession) return;
    const res = await emitAsync('host:reconnect', { roomCode, hostToken: session.hostToken });
    if (!res.ok) {
      setError(res.error || '방을 찾을 수 없습니다.');
      return;
    }
    setError('');
    setSnapshot(res.snapshot);
    if (res.snapshot.funStats) setFunStats(res.snapshot.funStats);
  }, [invalidSession, roomCode, session]);

  useEffect(() => {
    if (invalidSession) return;
    if (!socket.connected) socket.connect();
    reconnect();

    const onConnect = () => reconnect();
    const onRoomUpdate = (data) =>
      setSnapshot((prev) => ({ ...(prev || {}), ...data, roomCode }));
    const onRoundStarted = (data) => {
      setLastResults(null);
      setProgress({ answered: 0, total: data.groups.flat().length });
      setSnapshot((prev) => ({ ...(prev || {}), status: 'active', currentRound: data.round, ...data }));
    };
    const onProgress = (data) => setProgress(data);
    const onRoundResult = (data) => {
      setLastResults(data);
      setSnapshot((prev) => ({ ...(prev || {}), status: 'result', leaderboard: data.leaderboard }));
    };
    const onGameFinished = (data) => {
      setFunStats(data.funStats);
      setSnapshot((prev) => ({ ...(prev || {}), status: 'finished', leaderboard: data.leaderboard }));
    };

    socket.on('connect', onConnect);
    socket.on('host:roomUpdate', onRoomUpdate);
    socket.on('host:roundStarted', onRoundStarted);
    socket.on('host:progress', onProgress);
    socket.on('host:roundResult', onRoundResult);
    socket.on('host:gameFinished', onGameFinished);

    return () => {
      socket.off('connect', onConnect);
      socket.off('host:roomUpdate', onRoomUpdate);
      socket.off('host:roundStarted', onRoundStarted);
      socket.off('host:progress', onProgress);
      socket.off('host:roundResult', onRoundResult);
      socket.off('host:gameFinished', onGameFinished);
    };
  }, [invalidSession, reconnect, roomCode]);

  async function handleAdvance() {
    setBusy(true);
    const res = await emitAsync('host:advance', { roomCode, hostToken: session.hostToken });
    setBusy(false);
    if (!res.ok) setError(res.error || '진행할 수 없습니다.');
  }

  if (invalidSession) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-gray-300">이 브라우저에서 생성한 방이 아니거나 세션이 만료되었습니다.</p>
        <Link to="/host" className="rounded-xl bg-gray-100 text-gray-900 font-bold px-6 py-3">
          새 방 만들기
        </Link>
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        {error ? error : '연결 중...'}
      </div>
    );
  }

  const status = snapshot.status;
  const players = snapshot.players || [];
  const leaderboard = snapshot.leaderboard || [];

  return (
    <div className="min-h-screen px-6 py-8 max-w-4xl mx-auto flex flex-col gap-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-gray-400 text-sm">방 코드</p>
          <p className="text-5xl font-black tracking-[0.3em]">{roomCode}</p>
        </div>
        <div className="text-right">
          <p className="text-gray-400 text-sm">라운드</p>
          <p className="text-2xl font-bold">
            {snapshot.currentRound || 0} / {snapshot.totalRounds}
          </p>
        </div>
      </header>

      {error && <p className="text-defect-light">{error}</p>}

      {status === 'lobby' && (
        <section className="flex flex-col md:flex-row gap-8 items-center md:items-start">
          <QRCodeBox roomCode={roomCode} />
          <div className="flex-1 w-full">
            <p className="text-gray-400 mb-3">참가자 ({players.length}명)</p>
            <div className="flex flex-wrap gap-2 mb-6">
              {players.length === 0 && <p className="text-gray-500">참가자가 입장하면 여기에 표시됩니다.</p>}
              {players.map((p) => (
                <span key={p.id} className="rounded-full bg-gray-800 px-4 py-2 text-sm">
                  {p.nickname} {!p.connected && <span className="text-gray-500">(끊김)</span>}
                </span>
              ))}
            </div>
            <button
              onClick={handleAdvance}
              disabled={busy || players.length < 2}
              className="rounded-2xl bg-cooperate text-white font-bold text-lg px-8 py-4 shadow-lg disabled:opacity-40"
            >
              {players.length < 2 ? '참가자 2명 이상 필요' : '게임 시작'}
            </button>
          </div>
        </section>
      )}

      {status === 'active' && (
        <section className="flex flex-col gap-6">
          <Timer deadline={snapshot.deadline} />
          <p className="text-gray-400">
            응답 {progress.answered} / {progress.total}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(snapshot.groups || []).map((group, i) => (
              <div key={i} className="rounded-xl bg-gray-800/70 px-4 py-3 text-center font-medium">
                {group.map((p) => p.nickname).join(' ⚔️ ')}
              </div>
            ))}
          </div>
        </section>
      )}

      {status === 'result' && (
        <section className="flex flex-col gap-6">
          <h2 className="text-xl font-bold">라운드 {snapshot.currentRound} 결과</h2>
          {lastResults && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {lastResults.results.map((r) => (
                <div key={r.playerId} className="rounded-xl bg-gray-800/70 px-4 py-3 flex items-center justify-between">
                  <span className="font-medium truncate">{r.nickname}</span>
                  <span className="text-sm text-gray-400">{CHOICE_LABEL[r.myChoice]}</span>
                  <span className="font-bold">+{r.scoreDelta}</span>
                </div>
              ))}
            </div>
          )}
          <Leaderboard entries={leaderboard} />
          <button
            onClick={handleAdvance}
            disabled={busy}
            className="self-start rounded-2xl bg-cooperate text-white font-bold text-lg px-8 py-4 shadow-lg disabled:opacity-40"
          >
            {snapshot.currentRound >= snapshot.totalRounds ? '최종 결과 보기' : '다음 라운드'}
          </button>
        </section>
      )}

      {status === 'finished' && (
        <section className="flex flex-col gap-8">
          <h2 className="text-2xl font-extrabold text-center">🏆 최종 결과</h2>
          <FunStats funStats={funStats} />
          <Leaderboard entries={leaderboard} />
          <Link
            to="/host"
            onClick={clearHostSession}
            className="self-center rounded-2xl bg-gray-100 text-gray-900 font-bold px-8 py-4"
          >
            새 게임 만들기
          </Link>
        </section>
      )}
    </div>
  );
}

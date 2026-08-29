import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { socket, emitAsync } from '../socket.js';
import { getPlayerSession, setPlayerSession } from '../storage.js';
import ChoiceButtons from '../components/ChoiceButtons.jsx';
import Timer from '../components/Timer.jsx';
import RoundResultCard from '../components/RoundResultCard.jsx';
import Leaderboard from '../components/Leaderboard.jsx';
import FunStats from '../components/FunStats.jsx';

export default function PlayerGame() {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(() => getPlayerSession());
  const [state, setState] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const invalidSession = !session || session.roomCode !== roomCode;

  const join = useCallback(async () => {
    if (!session) return;
    const res = await emitAsync('player:join', {
      roomCode,
      nickname: session.nickname,
      playerId: session.playerId,
    });
    if (!res.ok) {
      setError(res.error || '입장에 실패했습니다.');
      return;
    }
    setPlayerSession({ roomCode, nickname: res.nickname, playerId: res.playerId });
    setSession({ roomCode, nickname: res.nickname, playerId: res.playerId });
    setError('');
    setState({ ...res.snapshot, playerId: res.playerId });
  }, [roomCode, session]);

  useEffect(() => {
    if (invalidSession) {
      navigate(`/join?code=${roomCode}`);
      return;
    }
    if (!socket.connected) socket.connect();
    join();

    const onConnect = () => join();
    const onRoundStart = (data) =>
      setState((prev) => ({
        ...prev,
        phase: 'choosing',
        round: data.round,
        currentRound: data.round,
        totalRounds: data.totalRounds,
        deadline: data.deadline,
        opponents: data.opponents,
        myChoice: null,
        scoreDelta: null,
      }));
    const onRoundResult = (data) =>
      setState((prev) => ({
        ...prev,
        phase: 'result',
        currentRound: data.round,
        myChoice: data.myChoice,
        scoreDelta: data.scoreDelta,
        totalScore: data.totalScore,
        opponents: data.opponents,
      }));
    const onGameFinished = (data) =>
      setState((prev) => ({
        ...prev,
        phase: 'finished',
        leaderboard: data.leaderboard,
        funStats: data.funStats,
        totalScore: data.totalScore,
      }));

    socket.on('connect', onConnect);
    socket.on('player:roundStart', onRoundStart);
    socket.on('player:roundResult', onRoundResult);
    socket.on('player:gameFinished', onGameFinished);

    return () => {
      socket.off('connect', onConnect);
      socket.off('player:roundStart', onRoundStart);
      socket.off('player:roundResult', onRoundResult);
      socket.off('player:gameFinished', onGameFinished);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invalidSession, roomCode]);

  async function handleChoose(choice) {
    if (submitting) return;
    setSubmitting(true);
    setState((prev) => ({ ...prev, phase: 'submitted', myChoice: choice }));
    const res = await emitAsync('player:submitChoice', { roomCode, playerId: session.playerId, choice });
    setSubmitting(false);
    if (!res.ok) setError(res.error || '선택을 전송하지 못했습니다.');
  }

  if (invalidSession) return null;

  if (!state) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400 px-6 text-center">
        {error || '연결 중...'}
      </div>
    );
  }

  const phase = state.phase;

  return (
    <div className="min-h-screen flex flex-col px-6 py-8 max-w-md mx-auto w-full">
      <header className="flex items-center justify-between mb-8">
        <span className="font-bold">{state.nickname}</span>
        <span className="text-sm text-gray-400">
          라운드 {state.currentRound || 0} / {state.totalRounds}
        </span>
      </header>

      {error && <p className="text-defect-light text-sm text-center mb-4">{error}</p>}

      <div className="flex-1 flex flex-col items-center justify-center gap-8">
        {(phase === 'lobby' || phase === 'spectating') && (
          <div className="text-center flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full border-4 border-gray-700 border-t-cooperate animate-spin" />
            <p className="text-gray-300 text-lg">
              {phase === 'lobby' ? '진행자가 게임을 시작하기를 기다리는 중...' : '다음 라운드를 기다리는 중...'}
            </p>
          </div>
        )}

        {(phase === 'choosing' || phase === 'submitted') && (
          <div className="w-full flex flex-col gap-8">
            <Timer deadline={state.deadline} />
            <p className="text-center text-gray-300">
              상대: <span className="font-bold text-white">{(state.opponents || []).map((o) => o.nickname).join(', ')}</span>
            </p>
            <ChoiceButtons onChoose={handleChoose} disabled={phase === 'submitted'} selected={state.myChoice} />
            {phase === 'submitted' && (
              <p className="text-center text-gray-400 text-sm">선택 완료! 상대의 선택을 기다리는 중...</p>
            )}
          </div>
        )}

        {phase === 'result' && (
          <div className="w-full flex flex-col items-center gap-6">
            <RoundResultCard
              myNickname={state.nickname}
              myChoice={state.myChoice}
              opponents={state.opponents || []}
              scoreDelta={state.scoreDelta ?? 0}
            />
            <p className="text-gray-400">
              누적 점수: <span className="text-white font-bold">{state.totalScore}점</span>
            </p>
            <p className="text-gray-500 text-sm">다음 라운드를 기다리는 중...</p>
          </div>
        )}

        {phase === 'finished' && (
          <div className="w-full flex flex-col items-center gap-8">
            <h2 className="text-2xl font-extrabold">🏁 게임 종료!</h2>
            <p className="text-gray-300">
              나의 최종 점수: <span className="text-white font-bold text-xl">{state.totalScore}점</span>
            </p>
            <FunStats funStats={state.funStats} />
            <div className="w-full">
              <Leaderboard entries={state.leaderboard || []} highlightId={session.playerId} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

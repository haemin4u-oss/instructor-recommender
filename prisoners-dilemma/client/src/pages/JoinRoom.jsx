import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { socket, emitAsync } from '../socket.js';
import { getPlayerSession, setPlayerSession } from '../storage.js';

export default function JoinRoom() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const codeFromQuery = (searchParams.get('code') || '').toUpperCase();

  const [roomCode, setRoomCode] = useState(codeFromQuery);
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const existing = getPlayerSession();
    if (existing && codeFromQuery && existing.roomCode === codeFromQuery) {
      navigate(`/play/${codeFromQuery}`);
    }
  }, [codeFromQuery, navigate]);

  async function handleJoin(e) {
    e.preventDefault();
    if (!roomCode.trim() || !nickname.trim()) return;
    setLoading(true);
    setError('');
    if (!socket.connected) socket.connect();

    const code = roomCode.trim().toUpperCase();
    const res = await emitAsync('player:join', { roomCode: code, nickname: nickname.trim() });
    setLoading(false);
    if (!res.ok) {
      setError(res.error || '입장에 실패했습니다.');
      return;
    }
    setPlayerSession({ roomCode: code, nickname: res.nickname, playerId: res.playerId });
    navigate(`/play/${code}`);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 px-6">
      <h1 className="text-2xl font-extrabold">참가자 입장</h1>

      <form onSubmit={handleJoin} className="w-full max-w-sm flex flex-col gap-4">
        <div>
          <label className="text-sm text-gray-400 mb-1 block">방 코드</label>
          <input
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            maxLength={6}
            placeholder="ABC123"
            className="w-full rounded-xl bg-gray-800 px-4 py-4 text-center text-2xl tracking-[0.3em] font-bold outline-none focus:ring-2 focus:ring-cooperate"
          />
        </div>
        <div>
          <label className="text-sm text-gray-400 mb-1 block">닉네임</label>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={20}
            placeholder="닉네임을 입력하세요"
            className="w-full rounded-xl bg-gray-800 px-4 py-4 text-lg outline-none focus:ring-2 focus:ring-cooperate"
          />
        </div>

        {error && <p className="text-defect-light text-sm text-center">{error}</p>}

        <button
          type="submit"
          disabled={loading || !roomCode.trim() || !nickname.trim()}
          className="rounded-2xl bg-cooperate text-white font-bold text-lg py-4 shadow-lg disabled:opacity-50 active:scale-95 transition-transform"
        >
          {loading ? '입장 중...' : '입장하기'}
        </button>
      </form>
    </div>
  );
}

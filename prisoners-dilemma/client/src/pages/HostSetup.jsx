import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { socket, emitAsync } from '../socket.js';
import { setHostSession } from '../storage.js';

export default function HostSetup() {
  const [rounds, setRounds] = useState(4);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  async function handleCreate() {
    setLoading(true);
    setError('');
    if (!socket.connected) socket.connect();
    const res = await emitAsync('host:createRoom', { rounds });
    setLoading(false);
    if (!res.ok) {
      setError(res.error || '방 생성에 실패했습니다.');
      return;
    }
    setHostSession({ roomCode: res.roomCode, hostToken: res.hostToken });
    navigate(`/host/${res.roomCode}`);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 px-6">
      <h1 className="text-2xl font-extrabold">진행자 설정</h1>

      <div className="w-full max-w-sm flex flex-col gap-6">
        <div>
          <p className="text-sm text-gray-400 mb-3">라운드 수</p>
          <div className="flex gap-2">
            {[3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => setRounds(n)}
                className={[
                  'flex-1 rounded-xl py-3 font-bold border transition-colors',
                  rounds === n ? 'bg-cooperate border-cooperate text-white' : 'border-gray-700 text-gray-300',
                ].join(' ')}
              >
                {n}라운드
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-defect-light text-sm text-center">{error}</p>}

        <button
          onClick={handleCreate}
          disabled={loading}
          className="rounded-2xl bg-gray-100 text-gray-900 font-bold text-lg py-4 shadow-lg disabled:opacity-50 active:scale-95 transition-transform"
        >
          {loading ? '생성 중...' : '방 생성하기'}
        </button>
      </div>
    </div>
  );
}

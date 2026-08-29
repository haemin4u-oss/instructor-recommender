import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 px-6 text-center">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">🤝 죄수의 딜레마</h1>
        <p className="mt-2 text-gray-400">사내 아이스브레이킹 게임</p>
      </div>

      <div className="w-full max-w-xs flex flex-col gap-4">
        <Link
          to="/host"
          className="rounded-2xl bg-gray-100 text-gray-900 font-bold text-lg py-4 shadow-lg active:scale-95 transition-transform"
        >
          🖥️ 진행자로 시작
        </Link>
        <Link
          to="/join"
          className="rounded-2xl bg-cooperate text-white font-bold text-lg py-4 shadow-lg active:scale-95 transition-transform"
        >
          📱 참가자로 입장
        </Link>
      </div>
    </div>
  );
}

export default function ChoiceButtons({ onChoose, disabled, selected }) {
  return (
    <div className="grid grid-cols-2 gap-4 w-full">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChoose('COOPERATE')}
        className={[
          'flex flex-col items-center justify-center gap-2 rounded-3xl py-10 font-extrabold text-xl shadow-xl transition-all',
          'bg-cooperate text-white active:scale-95',
          disabled && selected !== 'COOPERATE' ? 'opacity-40' : '',
          selected === 'COOPERATE' ? 'ring-4 ring-white scale-105' : '',
        ].join(' ')}
      >
        <span className="text-4xl">🤝</span>
        협력
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChoose('DEFECT')}
        className={[
          'flex flex-col items-center justify-center gap-2 rounded-3xl py-10 font-extrabold text-xl shadow-xl transition-all',
          'bg-defect text-white active:scale-95',
          disabled && selected !== 'DEFECT' ? 'opacity-40' : '',
          selected === 'DEFECT' ? 'ring-4 ring-white scale-105' : '',
        ].join(' ')}
      >
        <span className="text-4xl">🗡️</span>
        배신
      </button>
    </div>
  );
}

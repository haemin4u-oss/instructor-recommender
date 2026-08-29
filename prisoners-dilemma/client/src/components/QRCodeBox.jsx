import { QRCodeSVG } from 'qrcode.react';

export default function QRCodeBox({ roomCode }) {
  const joinUrl = `${window.location.origin}/join?code=${roomCode}`;

  return (
    <div className="bg-white rounded-2xl p-4 flex flex-col items-center gap-3 shadow-xl">
      <QRCodeSVG value={joinUrl} size={180} includeMargin={false} />
      <p className="text-gray-500 text-xs break-all text-center">{joinUrl}</p>
    </div>
  );
}

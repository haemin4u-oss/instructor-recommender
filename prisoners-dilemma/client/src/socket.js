import { io } from 'socket.io-client';

// No explicit URL: connects to the page's own origin. In dev this is
// proxied to the backend (see vite.config.js), so it works identically
// whether opened via localhost, a LAN IP, or an ngrok tunnel.
const SERVER_URL = import.meta.env.VITE_SERVER_URL || undefined;

export const socket = io(SERVER_URL, {
  autoConnect: true,
  reconnection: true,
  reconnectionDelay: 500,
  reconnectionDelayMax: 3000,
});

export function emitAsync(event, payload) {
  return new Promise((resolve) => {
    socket.emit(event, payload, (response) => resolve(response ?? { ok: false, error: '서버 응답이 없습니다.' }));
  });
}

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Same-origin Socket.IO in dev: the client connects with no explicit URL,
// so this proxy forwards /socket.io traffic to the backend regardless of
// whether the page was opened via localhost or the host machine's LAN IP.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
      },
    },
  },
});

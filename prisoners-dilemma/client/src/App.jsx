import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home.jsx';
import HostSetup from './pages/HostSetup.jsx';
import HostDashboard from './pages/HostDashboard.jsx';
import JoinRoom from './pages/JoinRoom.jsx';
import PlayerGame from './pages/PlayerGame.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/host" element={<HostSetup />} />
      <Route path="/host/:roomCode" element={<HostDashboard />} />
      <Route path="/join" element={<JoinRoom />} />
      <Route path="/play/:roomCode" element={<PlayerGame />} />
      <Route path="*" element={<Home />} />
    </Routes>
  );
}

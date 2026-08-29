const HOST_KEY = 'pd_host_session';
const PLAYER_KEY = 'pd_player_session';

export function getHostSession() {
  try {
    return JSON.parse(localStorage.getItem(HOST_KEY) || 'null');
  } catch {
    return null;
  }
}

export function setHostSession(session) {
  localStorage.setItem(HOST_KEY, JSON.stringify(session));
}

export function clearHostSession() {
  localStorage.removeItem(HOST_KEY);
}

export function getPlayerSession() {
  try {
    return JSON.parse(localStorage.getItem(PLAYER_KEY) || 'null');
  } catch {
    return null;
  }
}

export function setPlayerSession(session) {
  localStorage.setItem(PLAYER_KEY, JSON.stringify(session));
}

export function clearPlayerSession() {
  localStorage.removeItem(PLAYER_KEY);
}

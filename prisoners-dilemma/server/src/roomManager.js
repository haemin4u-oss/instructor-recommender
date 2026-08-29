import { randomUUID } from 'crypto';
import { ROOM_CODE_CHARS } from './constants.js';

const ROOM_TTL_MS = 6 * 60 * 60 * 1000; // 6h — this is a same-day, in-memory event tool

export class RoomManager {
  constructor() {
    /** @type {Map<string, object>} */
    this.rooms = new Map();
    setInterval(() => this._sweep(), 30 * 60 * 1000).unref();
  }

  _sweep() {
    const now = Date.now();
    for (const [code, room] of this.rooms) {
      if (now - room.createdAt > ROOM_TTL_MS) this.rooms.delete(code);
    }
  }

  _generateCode() {
    let code;
    do {
      code = Array.from({ length: 6 }, () => ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)]).join('');
    } while (this.rooms.has(code));
    return code;
  }

  createRoom(rounds) {
    const code = this._generateCode();
    const room = {
      code,
      hostToken: randomUUID(),
      hostSocketId: null,
      totalRounds: rounds,
      currentRound: 0,
      status: 'lobby', // lobby | active | result | finished
      players: new Map(), // id -> player
      currentGroups: null,
      currentChoices: {},
      roundDeadline: null,
      roundTimer: null,
      createdAt: Date.now(),
    };
    this.rooms.set(code, room);
    return room;
  }

  getRoom(code) {
    return this.rooms.get((code || '').toUpperCase());
  }

  findPlayerByNickname(room, nickname) {
    const normalized = nickname.trim().toLowerCase();
    for (const p of room.players.values()) {
      if (p.nickname.trim().toLowerCase() === normalized) return p;
    }
    return null;
  }

  addOrRestorePlayer(room, { playerId, nickname }) {
    if (playerId && room.players.has(playerId)) {
      return room.players.get(playerId);
    }
    const existingByName = this.findPlayerByNickname(room, nickname);
    if (existingByName) return existingByName;

    const id = randomUUID();
    const player = {
      id,
      nickname: nickname.trim().slice(0, 20),
      socketId: null,
      connected: false,
      totalScore: 0,
      history: [],
      joinedAt: Date.now(),
    };
    room.players.set(id, player);
    return player;
  }

  publicPlayerList(room) {
    return [...room.players.values()]
      .sort((a, b) => a.joinedAt - b.joinedAt)
      .map((p) => ({ id: p.id, nickname: p.nickname, connected: p.connected, totalScore: p.totalScore }));
  }

  leaderboard(room) {
    return [...room.players.values()]
      .map((p) => ({ id: p.id, nickname: p.nickname, totalScore: p.totalScore }))
      .sort((a, b) => b.totalScore - a.totalScore);
  }
}

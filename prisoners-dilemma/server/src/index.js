import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

import { RoomManager } from './roomManager.js';
import { generateGroups, computeGroupResults, computeFunStats } from './gameLogic.js';
import { CHOICES, ROUND_DURATION_MS, MIN_ROUNDS, MAX_ROUNDS, DEFAULT_ROUNDS } from './constants.js';

const PORT = process.env.PORT || 3001;

const app = express();
app.use(cors({ origin: true }));
app.get('/health', (_req, res) => res.json({ ok: true }));

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

const roomManager = new RoomManager();
// socket.id -> { roomCode, isHost, playerId? }
const socketMeta = new Map();

function emitToHost(room, event, payload) {
  if (room.hostSocketId) io.to(room.hostSocketId).emit(event, payload);
}

function emitToPlayer(player, event, payload) {
  if (player.connected && player.socketId) io.to(player.socketId).emit(event, payload);
}

function emitRoomUpdate(room) {
  emitToHost(room, 'host:roomUpdate', {
    status: room.status,
    currentRound: room.currentRound,
    totalRounds: room.totalRounds,
    players: roomManager.publicPlayerList(room),
  });
}

function findPlayerGroup(room, playerId) {
  if (!room.currentGroups) return null;
  return room.currentGroups.find((g) => g.includes(playerId)) || null;
}

function buildPlayerSnapshot(room, player) {
  const base = { nickname: player.nickname, totalScore: player.totalScore, totalRounds: room.totalRounds, currentRound: room.currentRound };

  if (room.status === 'lobby') {
    return { ...base, phase: 'lobby' };
  }

  if (room.status === 'active') {
    const group = findPlayerGroup(room, player.id);
    if (!group) return { ...base, phase: 'spectating' };
    const opponents = group.filter((id) => id !== player.id).map((id) => ({ id, nickname: room.players.get(id).nickname }));
    if (room.currentChoices[player.id] !== undefined) {
      return { ...base, phase: 'submitted', deadline: room.roundDeadline, opponents, myChoice: room.currentChoices[player.id] };
    }
    return { ...base, phase: 'choosing', deadline: room.roundDeadline, opponents };
  }

  if (room.status === 'result') {
    const entry = player.history.find((h) => h.round === room.currentRound);
    if (!entry) return { ...base, phase: 'spectating' };
    return { ...base, phase: 'result', myChoice: entry.myChoice, scoreDelta: entry.scoreDelta, opponents: entry.opponents };
  }

  if (room.status === 'finished') {
    const leaderboard = roomManager.leaderboard(room);
    const funStats = computeFunStats([...room.players.values()]);
    return { ...base, phase: 'finished', leaderboard, funStats };
  }

  return { ...base, phase: 'lobby' };
}

function buildHostSnapshot(room) {
  const snapshot = {
    roomCode: room.code,
    status: room.status,
    currentRound: room.currentRound,
    totalRounds: room.totalRounds,
    players: roomManager.publicPlayerList(room),
    leaderboard: roomManager.leaderboard(room),
  };
  if (room.status === 'active' && room.currentGroups) {
    snapshot.deadline = room.roundDeadline;
    snapshot.groups = room.currentGroups.map((g) => g.map((id) => ({ id, nickname: room.players.get(id).nickname })));
  }
  if (room.status === 'finished') {
    snapshot.funStats = computeFunStats([...room.players.values()]);
  }
  return snapshot;
}

function startRound(room) {
  room.currentRound += 1;
  room.status = 'active';
  room.currentChoices = {};

  const allPlayerIds = [...room.players.keys()];
  room.currentGroups = generateGroups(allPlayerIds);
  room.roundDeadline = Date.now() + ROUND_DURATION_MS;

  for (const group of room.currentGroups) {
    for (const pid of group) {
      const player = room.players.get(pid);
      const opponents = group.filter((o) => o !== pid).map((o) => ({ id: o, nickname: room.players.get(o).nickname }));
      emitToPlayer(player, 'player:roundStart', {
        round: room.currentRound,
        totalRounds: room.totalRounds,
        deadline: room.roundDeadline,
        opponents,
      });
    }
  }

  emitToHost(room, 'host:roundStarted', {
    round: room.currentRound,
    totalRounds: room.totalRounds,
    deadline: room.roundDeadline,
    groups: room.currentGroups.map((g) => g.map((id) => ({ id, nickname: room.players.get(id).nickname }))),
  });
  emitRoomUpdate(room);

  clearTimeout(room.roundTimer);
  room.roundTimer = setTimeout(() => finishRound(room), ROUND_DURATION_MS + 300);
}

function maybeFinishRoundEarly(room) {
  const allPlayerIds = room.currentGroups.flat();
  const allAnswered = allPlayerIds.every((pid) => {
    const player = room.players.get(pid);
    return room.currentChoices[pid] !== undefined || !player.connected;
  });
  if (allAnswered) {
    clearTimeout(room.roundTimer);
    finishRound(room);
  }
}

function finishRound(room) {
  room.roundTimer = null;
  room.status = 'result';

  const allPlayerIds = room.currentGroups.flat();
  for (const pid of allPlayerIds) {
    if (room.currentChoices[pid] === undefined) {
      room.currentChoices[pid] = Math.random() < 0.5 ? CHOICES.COOPERATE : CHOICES.DEFECT;
    }
  }

  const hostResults = [];
  for (const group of room.currentGroups) {
    const groupResults = computeGroupResults(group, room.currentChoices);
    for (const r of groupResults) {
      const player = room.players.get(r.playerId);
      player.totalScore += r.scoreDelta;
      const opponentsWithNames = r.opponents.map((o) => ({
        id: o.playerId,
        nickname: room.players.get(o.playerId).nickname,
        choice: o.choice,
      }));
      player.history.push({
        round: room.currentRound,
        myChoice: r.myChoice,
        scoreDelta: r.scoreDelta,
        opponents: opponentsWithNames,
      });
      emitToPlayer(player, 'player:roundResult', {
        round: room.currentRound,
        myChoice: r.myChoice,
        scoreDelta: r.scoreDelta,
        totalScore: player.totalScore,
        opponents: opponentsWithNames,
      });
      hostResults.push({
        playerId: r.playerId,
        nickname: player.nickname,
        myChoice: r.myChoice,
        scoreDelta: r.scoreDelta,
        totalScore: player.totalScore,
        opponents: opponentsWithNames,
      });
    }
  }

  emitToHost(room, 'host:roundResult', {
    round: room.currentRound,
    results: hostResults,
    leaderboard: roomManager.leaderboard(room),
  });
  emitRoomUpdate(room);
}

function finishGame(room) {
  room.status = 'finished';
  const leaderboard = roomManager.leaderboard(room);
  const funStats = computeFunStats([...room.players.values()]);

  emitToHost(room, 'host:gameFinished', { leaderboard, funStats });
  for (const player of room.players.values()) {
    emitToPlayer(player, 'player:gameFinished', { leaderboard, funStats, totalScore: player.totalScore });
  }
  emitRoomUpdate(room);
}

io.on('connection', (socket) => {
  socket.on('host:createRoom', ({ rounds } = {}, cb) => {
    const safeRounds = Math.min(MAX_ROUNDS, Math.max(MIN_ROUNDS, Number.isFinite(rounds) ? rounds : DEFAULT_ROUNDS));
    const room = roomManager.createRoom(safeRounds);
    room.hostSocketId = socket.id;
    socketMeta.set(socket.id, { roomCode: room.code, isHost: true });
    cb?.({ ok: true, roomCode: room.code, hostToken: room.hostToken });
  });

  socket.on('host:reconnect', ({ roomCode, hostToken } = {}, cb) => {
    const room = roomManager.getRoom(roomCode);
    if (!room || room.hostToken !== hostToken) return cb?.({ ok: false, error: '방을 찾을 수 없습니다.' });
    room.hostSocketId = socket.id;
    socketMeta.set(socket.id, { roomCode: room.code, isHost: true });
    cb?.({ ok: true, snapshot: buildHostSnapshot(room) });
  });

  socket.on('host:advance', ({ roomCode, hostToken } = {}, cb) => {
    const room = roomManager.getRoom(roomCode);
    if (!room || room.hostToken !== hostToken) return cb?.({ ok: false, error: '방을 찾을 수 없습니다.' });

    if (room.status === 'lobby') {
      if (room.players.size < 2) return cb?.({ ok: false, error: '참가자가 2명 이상이어야 시작할 수 있습니다.' });
      startRound(room);
    } else if (room.status === 'result') {
      if (room.currentRound >= room.totalRounds) finishGame(room);
      else startRound(room);
    } else {
      return cb?.({ ok: false, error: '지금은 진행할 수 없는 상태입니다.' });
    }
    cb?.({ ok: true });
  });

  socket.on('player:join', ({ roomCode, nickname, playerId } = {}, cb) => {
    const room = roomManager.getRoom(roomCode);
    if (!room) return cb?.({ ok: false, error: '방 코드를 확인해주세요.' });
    if (!nickname || !nickname.trim()) return cb?.({ ok: false, error: '닉네임을 입력해주세요.' });

    const existing = (playerId && room.players.get(playerId)) || roomManager.findPlayerByNickname(room, nickname);
    if (!existing && room.status !== 'lobby') {
      return cb?.({ ok: false, error: '게임이 이미 시작되어 새로 입장할 수 없습니다.' });
    }

    const player = roomManager.addOrRestorePlayer(room, { playerId, nickname });
    player.socketId = socket.id;
    player.connected = true;
    socketMeta.set(socket.id, { roomCode: room.code, isHost: false, playerId: player.id });

    cb?.({ ok: true, playerId: player.id, nickname: player.nickname, snapshot: buildPlayerSnapshot(room, player) });
    emitRoomUpdate(room);
  });

  socket.on('player:submitChoice', ({ roomCode, playerId, choice } = {}, cb) => {
    const room = roomManager.getRoom(roomCode);
    if (!room) return cb?.({ ok: false, error: '방을 찾을 수 없습니다.' });
    if (room.status !== 'active') return cb?.({ ok: false, error: '지금은 선택할 수 없습니다.' });
    if (choice !== CHOICES.COOPERATE && choice !== CHOICES.DEFECT) return cb?.({ ok: false, error: '잘못된 선택입니다.' });

    const player = room.players.get(playerId);
    if (!player) return cb?.({ ok: false, error: '참가자 정보를 찾을 수 없습니다.' });
    const group = findPlayerGroup(room, playerId);
    if (!group) return cb?.({ ok: false, error: '이번 라운드에는 참여하지 않습니다.' });

    if (room.currentChoices[playerId] === undefined) {
      room.currentChoices[playerId] = choice;
      emitToHost(room, 'host:progress', {
        answered: room.currentGroups.flat().filter((pid) => room.currentChoices[pid] !== undefined).length,
        total: room.currentGroups.flat().length,
      });
      maybeFinishRoundEarly(room);
    }
    cb?.({ ok: true });
  });

  socket.on('disconnect', () => {
    const meta = socketMeta.get(socket.id);
    if (!meta) return;
    socketMeta.delete(socket.id);
    const room = roomManager.getRoom(meta.roomCode);
    if (!room) return;

    if (meta.isHost) {
      if (room.hostSocketId === socket.id) room.hostSocketId = null;
      return;
    }
    const player = room.players.get(meta.playerId);
    if (player && player.socketId === socket.id) {
      player.connected = false;
      emitRoomUpdate(room);
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`Prisoner's Dilemma server listening on http://localhost:${PORT}`);
});

const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    // Polling-first transport order prevents initial cold-start wss:// handshake warning on Render
    transports: ['polling', 'websocket'],
    allowUpgrades: true,
    pingInterval: 10000,
    pingTimeout: 5000
});

const port = process.env.PORT || 3000;
const SERVER_BUILD_VERSION = `v9.0-ctr-${Date.now()}`;

// Disable browser caching so every update appears immediately without manual refresh!
app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    next();
});

app.use(express.static(path.join(__dirname, 'public'), {
    etag: false,
    lastModified: false,
    maxAge: 0
}));

app.get('/version', (req, res) => {
    res.status(200).json({ version: SERVER_BUILD_VERSION });
});

app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        version: SERVER_BUILD_VERSION,
        uptime: process.uptime(),
        playersOnline: Object.keys(players).length,
        activeRooms: Object.keys(rooms).length
    });
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ==================== MULTIPLAYER ROOMS & CTR GAME STATE ====================
const players = {};
const rooms = {};
const PLAYER_COLORS = [0xff0055, 0x00f0ff, 0xffaa00, 0x00ff88, 0xb026ff, 0xff3300];

const DEFAULT_POWERUPS_TEMPLATE = [
    { id: 'pu_1',  type: 'crate', x: 28,  z: 28,  active: true },
    { id: 'pu_2',  type: 'crate', x: -28, z: -28, active: true },
    { id: 'pu_3',  type: 'crate', x: 45,  z: -45, active: true },
    { id: 'pu_4',  type: 'nitro', x: -42, z: 0,   active: true },
    { id: 'pu_5',  type: 'crate', x: 0,   z: 52,  active: true },
    { id: 'pu_6',  type: 'crate', x: 0,   z: -52, active: true },
    { id: 'pu_7',  type: 'crate', x: -45, z: 45,  active: true },
    { id: 'pu_8',  type: 'nitro', x: 42,  z: 0,   active: true },
    { id: 'pu_9',  type: 'crate', x: -45, z: -45, active: true },
    { id: 'pu_10', type: 'nitro', x: 0,   z: 26,  active: true },
    { id: 'pu_11', type: 'nitro', x: 0,   z: -26, active: true },
    { id: 'pu_12', type: 'crate', x: 45,  z: 45,  active: true }
];

const SPAWN_POINTS = [
    { x: 0, z: -40 },
    { x: 40, z: 0 },
    { x: 0, z: 40 },
    { x: -40, z: 0 },
    { x: 35, z: 35 },
    { x: -35, z: -35 },
    { x: 35, z: -35 },
    { x: -35, z: 35 }
];

function getOrCreateRoom(roomId, gameMode = 'race', mapType = 'crash_cove') {
    const cleanId = String(roomId || 'PUBLIC-RACE').trim().toUpperCase();
    if (!rooms[cleanId]) {
        rooms[cleanId] = {
            id: cleanId,
            gameMode: gameMode || 'race',
            mapType: mapType || 'crash_cove',
            teamScores: { blue: 0, red: 0 },
            powerUps: JSON.parse(JSON.stringify(DEFAULT_POWERUPS_TEMPLATE)),
            landmines: {},
            createdAt: Date.now()
        };
    }
    return rooms[cleanId];
}

function getRandomSpawn(team, gameMode, playerIndex = 0) {
    if (gameMode === 'race') {
        return { x: ((playerIndex % 4) - 1.5) * 5.0, z: 8 };
    }
    if (team === 'blue') {
        return { x: (Math.random() - 0.5) * 40, z: -62 + (Math.random() - 0.5) * 10 };
    }
    if (team === 'red') {
        return { x: (Math.random() - 0.5) * 40, z: 62 + (Math.random() - 0.5) * 10 };
    }
    const base = SPAWN_POINTS[Math.floor(Math.random() * SPAWN_POINTS.length)];
    return {
        x: base.x + (Math.random() - 0.5) * 12,
        z: base.z + (Math.random() - 0.5) * 12
    };
}

function getRoomPlayers(roomId) {
    return Object.values(players).filter(p => p.roomId === roomId);
}

function getRoomLeaderboard(roomId) {
    return getRoomPlayers(roomId)
        .map(p => ({
            id: p.id,
            name: p.name,
            team: p.team,
            skin: p.skin,
            kills: p.kills || 0,
            deaths: p.deaths || 0,
            score: p.score || 0,
            color: p.color
        }))
        .sort((a, b) => b.kills - a.kills || a.deaths - b.deaths || b.score - a.score);
}

function getPublicRoomsSummary() {
    const summary = [];
    Object.values(rooms).forEach(r => {
        const rPlayers = getRoomPlayers(r.id);
        if (rPlayers.length > 0) {
            summary.push({
                id: r.id,
                gameMode: r.gameMode,
                mapType: r.mapType,
                playerCount: rPlayers.length,
                playerNames: rPlayers.map(p => p.name)
            });
        } else {
            delete rooms[r.id];
        }
    });
    return summary;
}

function assignBalancedTeam(roomId, gameMode) {
    if (gameMode !== '2v2' && gameMode !== '3v3' && gameMode !== '4v4') {
        return 'ffa';
    }
    const rPlayers = getRoomPlayers(roomId);
    const blueCount = rPlayers.filter(p => p.team === 'blue').length;
    const redCount = rPlayers.filter(p => p.team === 'red').length;
    return blueCount <= redCount ? 'blue' : 'red';
}

io.on('connection', (socket) => {
    console.log(`[Socket.io] Player connected: ${socket.id}`);

    // Send server build version immediately so clients auto-update if needed
    socket.emit('serverVersion', { version: SERVER_BUILD_VERSION });

    const defaultRoom = 'PUBLIC-RACE';
    getOrCreateRoom(defaultRoom, 'race', 'crash_cove');
    socket.join(defaultRoom);

    const spawn = getRandomSpawn('ffa', 'race', Object.keys(players).length);
    const colorIndex = Object.keys(players).length % PLAYER_COLORS.length;

    players[socket.id] = {
        id: socket.id,
        roomId: defaultRoom,
        name: `مقاتل_${socket.id.substring(0, 4)}`,
        skin: 'interceptor',
        paintColor: PLAYER_COLORS[colorIndex],
        wheelStyle: 'standard',
        spoilerStyle: 'gt_wing',
        team: 'ffa',
        gameMode: 'race',
        mapType: 'crash_cove',
        x: spawn.x,
        y: 0,
        z: spawn.z,
        angle: 0,
        speed: 0,
        steer: 0,
        isBoosting: false,
        isDrifting: false,
        health: 100,
        maxHealth: 100,
        shield: 50,
        maxShield: 100,
        damageBoostUntil: 0,
        kills: 0,
        deaths: 0,
        score: 0,
        color: PLAYER_COLORS[colorIndex],
        lastUpdate: Date.now()
    };

    io.emit('roomsUpdate', {
        onlineCount: Object.keys(players).length,
        rooms: getPublicRoomsSummary()
    });

    socket.on('getRooms', () => {
        socket.emit('roomsUpdate', {
            onlineCount: Object.keys(players).length,
            rooms: getPublicRoomsSummary()
        });
    });

    socket.on('joinGame', (data) => {
        const p = players[socket.id];
        if (!p || !data) return;

        const oldRoom = p.roomId;
        if (oldRoom) socket.leave(oldRoom);

        const requestedMode = String(data.gameMode || 'race');
        const requestedMap = String(data.mapType || 'crash_cove');
        const requestedRoom = data.roomId
            ? String(data.roomId).trim().toUpperCase()
            : `PUBLIC-${requestedMode.toUpperCase()}`;

        const room = getOrCreateRoom(requestedRoom, requestedMode, requestedMap);
        socket.join(room.id);

        if (oldRoom && oldRoom !== room.id) {
            socket.to(oldRoom).emit('playerLeft', socket.id);
        }

        p.roomId = room.id;
        p.gameMode = room.gameMode;
        p.mapType = room.mapType;
        if (data.name) p.name = String(data.name).trim().substring(0, 18) || p.name;
        if (data.skin) p.skin = String(data.skin);
        if (data.paintColor !== undefined) {
            p.paintColor = Number(data.paintColor);
            p.color = Number(data.paintColor);
        }
        if (data.wheelStyle) p.wheelStyle = String(data.wheelStyle);
        if (data.spoilerStyle) p.spoilerStyle = String(data.spoilerStyle);

        p.team = assignBalancedTeam(room.id, room.gameMode);

        const rPlayers = getRoomPlayers(room.id);
        const spawnPos = getRandomSpawn(p.team, room.gameMode, rPlayers.length);
        p.x = spawnPos.x;
        p.y = 0;
        p.z = spawnPos.z;
        p.angle = p.team === 'red' ? Math.PI : 0;
        p.health = 100;
        p.shield = 50;

        const roomPlayersMap = {};
        rPlayers.forEach(rp => { roomPlayersMap[rp.id] = rp; });

        socket.emit('initGame', {
            id: socket.id,
            roomId: room.id,
            gameMode: room.gameMode,
            mapType: room.mapType,
            self: p,
            players: roomPlayersMap,
            powerUps: room.powerUps,
            landmines: Object.values(room.landmines),
            teamScores: room.teamScores,
            leaderboard: getRoomLeaderboard(room.id)
        });

        socket.to(room.id).emit('playerJoined', p);
        io.to(room.id).emit('roomPlayersUpdate', {
            roomId: room.id,
            gameMode: room.gameMode,
            mapType: room.mapType,
            players: rPlayers.map(rp => ({
                id: rp.id,
                name: rp.name,
                team: rp.team,
                skin: rp.skin
            }))
        });
        io.to(room.id).emit('leaderboardUpdate', getRoomLeaderboard(room.id));
        io.emit('roomsUpdate', {
            onlineCount: Object.keys(players).length,
            rooms: getPublicRoomsSummary()
        });
    });

    socket.on('startOnlineMatch', () => {
        const p = players[socket.id];
        if (!p || !p.roomId) return;
        io.to(p.roomId).emit('matchStartedByHost', {
            roomId: p.roomId,
            playersCount: getRoomPlayers(p.roomId).length
        });
    });

    const handleMove = (data) => {
        const p = players[socket.id];
        if (!p || !data) return;

        if (data.name) p.name = String(data.name).trim().substring(0, 18) || p.name;
        p.x = typeof data.x === 'number' ? data.x : p.x;
        p.y = typeof data.y === 'number' ? Math.max(0, Math.min(30, data.y)) : 0;
        p.z = typeof data.z === 'number' ? data.z : p.z;
        p.angle = typeof data.angle === 'number' ? data.angle : p.angle;
        p.speed = typeof data.speed === 'number' ? data.speed : p.speed;
        p.steer = typeof data.steer === 'number' ? data.steer : 0;
        p.isBoosting = Boolean(data.isBoosting);
        p.isDrifting = Boolean(data.isDrifting);
        if (data.skin) p.skin = data.skin;
        if (data.paintColor !== undefined) p.paintColor = Number(data.paintColor);
        if (data.wheelStyle) p.wheelStyle = data.wheelStyle;
        if (data.spoilerStyle) p.spoilerStyle = data.spoilerStyle;
        if (typeof data.health === 'number') p.health = data.health;
        p.lastUpdate = Date.now();

        socket.to(p.roomId).emit('playerMoved', {
            id: socket.id,
            name: p.name,
            skin: p.skin,
            paintColor: p.paintColor,
            wheelStyle: p.wheelStyle,
            spoilerStyle: p.spoilerStyle,
            team: p.team,
            x: p.x,
            y: p.y,
            z: p.z,
            angle: p.angle,
            speed: p.speed,
            steer: p.steer,
            isBoosting: p.isBoosting,
            isDrifting: p.isDrifting,
            health: p.health,
            shield: p.shield,
            color: p.color,
            timestamp: p.lastUpdate
        });
    };

    socket.on('playerMove', handleMove);
    socket.on('playerState', handleMove);

    const handleShoot = (data) => {
        const p = players[socket.id];
        if (!p || !data) return;
        const room = rooms[p.roomId];

        const isOverdrive = Date.now() < p.damageBoostUntil;
        const weaponType = data.weaponType || 'missile';

        if (weaponType === 'tnt' && room) {
            const mineId = `tnt_${socket.id}_${Date.now()}`;
            const mineObj = {
                id: mineId,
                ownerId: socket.id,
                ownerName: p.name,
                team: p.team,
                x: typeof data.x === 'number' ? data.x : p.x,
                z: typeof data.z === 'number' ? data.z : p.z,
                createdAt: Date.now()
            };
            room.landmines[mineId] = mineObj;
            socket.to(p.roomId).emit('minePlaced', mineObj);
            return;
        }

        socket.to(p.roomId).emit('laserFired', {
            id: socket.id,
            name: p.name,
            team: p.team,
            x: typeof data.x === 'number' ? data.x : p.x,
            y: typeof data.y === 'number' ? data.y : (p.y + 0.85),
            z: typeof data.z === 'number' ? data.z : p.z,
            angle: typeof data.angle === 'number' ? data.angle : p.angle,
            weaponType: weaponType,
            damageMultiplier: isOverdrive ? 1.5 : 1.0
        });
    };

    socket.on('shootLaser', handleShoot);
    socket.on('fireWeapon', handleShoot);

    socket.on('mineTriggered', (data) => {
        const p = players[socket.id];
        if (!p || !data || !data.mineId) return;
        const room = rooms[p.roomId];
        if (room && room.landmines[data.mineId]) {
            delete room.landmines[data.mineId];
            io.to(p.roomId).emit('mineExploded', { mineId: data.mineId });
        }
    });

    socket.on('playerHit', (data) => {
        if (!data || !data.targetId) return;
        const attacker = players[socket.id];
        const victim = players[data.targetId];
        if (!attacker || !victim || victim.health <= 0 || attacker.roomId !== victim.roomId) return;

        if (attacker.team !== 'ffa' && attacker.team === victim.team) return;

        const room = rooms[attacker.roomId];
        const isOverdrive = Date.now() < attacker.damageBoostUntil;
        const baseDamage = typeof data.damage === 'number' ? Math.min(80, Math.max(5, data.damage)) : 28;
        const finalDamage = Math.round(baseDamage * (isOverdrive ? 1.5 : 1.0));
        const isCrit = isOverdrive || finalDamage >= 35;

        let remainingDamage = finalDamage;
        if (victim.shield > 0) {
            const absorbed = Math.min(victim.shield, remainingDamage);
            victim.shield -= absorbed;
            remainingDamage -= absorbed;
        }
        if (remainingDamage > 0) {
            victim.health = Math.max(0, victim.health - remainingDamage);
        }

        attacker.score += finalDamage;

        io.to(attacker.roomId).emit('playerDamaged', {
            targetId: victim.id,
            attackerId: attacker.id,
            attackerName: attacker.name,
            damage: finalDamage,
            isCrit: isCrit,
            health: victim.health,
            shield: victim.shield,
            x: victim.x,
            y: victim.y,
            z: victim.z
        });

        if (victim.health <= 0) {
            attacker.kills += 1;
            attacker.score += 100;
            victim.deaths += 1;

            if (room) {
                if (attacker.team === 'blue') room.teamScores.blue += 1;
                if (attacker.team === 'red') room.teamScores.red += 1;
            }

            const respawnPos = getRandomSpawn(victim.team, victim.gameMode, 0);
            victim.x = respawnPos.x;
            victim.y = 0;
            victim.z = respawnPos.z;
            victim.health = victim.maxHealth;
            victim.shield = 50;

            io.to(attacker.roomId).emit('playerKilled', {
                killerId: attacker.id,
                killerName: attacker.name,
                killerTeam: attacker.team,
                victimId: victim.id,
                victimName: victim.name,
                victimTeam: victim.team,
                victimDeaths: victim.deaths,
                killerKills: attacker.kills,
                teamScores: room ? room.teamScores : { blue: 0, red: 0 },
                respawnX: victim.x,
                respawnZ: victim.z
            });

            io.to(attacker.roomId).emit('leaderboardUpdate', getRoomLeaderboard(attacker.roomId));
        }
    });

    socket.on('pickupPowerUp', (data) => {
        if (!data || !data.powerUpId) return;
        const p = players[socket.id];
        if (!p) return;
        const room = rooms[p.roomId];
        if (!room) return;

        const pu = room.powerUps.find(item => item.id === data.powerUpId);
        if (!pu || !pu.active) return;

        pu.active = false;
        io.to(p.roomId).emit('powerUpCollected', {
            powerUpId: pu.id,
            playerId: p.id,
            type: pu.type
        });

        setTimeout(() => {
            pu.active = true;
            io.to(p.roomId).emit('powerUpRespawned', { powerUpId: pu.id });
        }, 6500);
    });

    socket.on('disconnect', () => {
        console.log(`[Socket.io] Player disconnected: ${socket.id}`);
        const p = players[socket.id];
        const rId = p ? p.roomId : null;
        delete players[socket.id];

        if (rId) {
            io.to(rId).emit('playerLeft', socket.id);
            io.to(rId).emit('leaderboardUpdate', getRoomLeaderboard(rId));
        }
        io.emit('roomsUpdate', {
            onlineCount: Object.keys(players).length,
            rooms: getPublicRoomsSummary()
        });
    });
});

server.listen(port, () => {
    console.log(`Arena Wheels 3D CTR Edition Server v9.0 listening on port ${port}`);
});

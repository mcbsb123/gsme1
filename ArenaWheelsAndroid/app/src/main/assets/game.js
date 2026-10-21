// ============================================================================
// ARENA WHEELS 3D - CRASH TEAM RACING (CTR) EDITION v9.0 (LEVEL 2 UPGRADE)
// • P0/P1 Fixes: Multi-level WebGLRenderer Fallback + Context Recovery + Strict Null-Safety
// • Complete Offline Mode Isolation + Polling-First Socket.io Reconnection
// • True Multi-Touch Identifier Tracking + Auto Crate Smashing
// • Level 2 Systems:
//   1. 3-Stage CTR Power-Slide Boost (Green -> Yellow -> Fiery Red) + 3x Combo + Sacred Fire
//   2. Wumpa Fruit System (0..10) & Juiced-Up Weapons (+10% Top Speed, 3s TNT Head Trap, Aku-Aku Knockback)
//   3. 5 Distinct Vehicle Classes with Real Physics & Interactive Garage Stat Bars
//   4. 6 Track Environments with Custom Surface Friction & Live 2D Spline Minimap
//   5. Smart AI Bots (Lateral Offset, Mine Dodging, Shortcut AI & Rubber-Banding)
//   6. 3-2-1 Starting Boost, Ghost Mode Replay, Instant Invite Links (?room=), Auto FPS Scaler & Podium
// ============================================================================
console.log("Initializing Arena Wheels 3D - CTR Level 2 Edition v9.0...");

let currentServerVersion = null;

// Core 3D Globals
let scene = null, camera = null, renderer = null, composer = null, starfield = null;
let clock = new THREE.Clock();
let playerVehicle = null;
let playerWheels = [];
let playerSteerWheels = [];
let playerTailLights = [];
let playerHeadlightSpots = [];
let playerTurret = null;
let playerAkuAura = null;
let playerTntHeadMesh = null;
let playerExhaustFlames = [];
let lastManualTurboTime = 0;

// Entities & Arena Collections
let otherPlayers = {};
let aiBots = [];
let powerUpItems = [];
let wumpaItems = [];
let landminesList = [];
let arenaObstacles = [];
let warehouseWalls = [];
let arenaRamps = [];
let boostPads = [];
let shortcutZones = [];
let checkpoints = [];
let projectiles = [];
let particles = [];
let shockwaves = [];
let skidMarks = [];
let socket = null;
let animationFrameId = null;

// Ghost Mode Recording & Playback State
let currentLapRecording = [];
let bestLapRecording = [];
let ghostMesh = null;
let ghostFrameIndex = 0;
let lapStartTime = 0;
let raceStartTime = 0;

// Auto FPS Scaler Monitoring (First 3 Seconds of Gameplay)
let fpsMonitorActive = false;
let fpsMonitorStart = 0;
let fpsFrameCount = 0;

// Player Profile, Room & Custom Car Configuration
let localPlayerName = "";
let currentRoomId = "PUBLIC-RACE";
let fillBotsOption = "fill";
let selectedSkin = "interceptor";
let selectedPaintColor = 0xff5500;
let selectedWheelStyle = "standard";
let selectedSpoilerStyle = "gt_wing";

let gameMode = "race";        // 'race', 'ffa', '2v2', '3v3', '4v4'
let botDifficulty = "medium"; // 'easy', 'medium', 'hard'
let lobbyOption = "online";   // 'online' or 'bot'
let isOfflineMode = false;
let currentMapType = "crash_cove";
let localTeam = "ffa";

// User Settings State
const gameSettings = {
    controlMode: "joystick",
    sensitivity: 1.0,
    bloomEnabled: true,
    cameraShake: false,
    soundEnabled: true
};

// Local Career Stats (Persisted in localStorage)
const careerStats = {
    wins: 0,
    bestLapByMap: {}
};

// Local Vehicle Transform & CTR Level 2 Physics State
let x = 0, y = 0, z = 0;
let vx = 0, vz = 0;
let yVelocity = 0;
let angle = 0;
let cameraAngle = 0;
let speed = 0;
let lateralVelocity = 0;
let steerAngle = 0;
let pitchAngle = 0;
let rollAngle = 0;
let empSlowUntil = 0;

// CTR 3-Stage Power-Slide Drift & Sacred Fire State
let driftCharge = 0;          // 0..100
let driftStage = 0;           // 0, 1 (Green), 2 (Yellow), 3 (Fiery Red)
let driftComboCount = 0;      // Up to 3 consecutive Mini-Turbos
let sacredFireActive = false; // Preserves boost pad speed while drifting!
let autoTurboUntil = 0;
let akuMaskUntil = 0;
const AUTO_TURBO_DURATION = 3600;

// Wumpa Fruit & Juiced-Up State (0..10)
let wumpaCount = 0;
let isJuicedUp = false;

// Sticky TNT Head Trap Countdown State (3 Seconds, Shake off by hopping/drifting 3 times)
let tntStickyUntil = 0;
let tntStickyAttacker = "";
let tntShakeHopsRemaining = 0;

// Starting Boost Window State (3-2-1-GO!)
let startingBoostWindowActive = false;
let startingBoostClaimed = false;

let health = 100, maxHealth = 100;
let shield = 50, maxShield = 100;
let damageBoostUntil = 0;
let kills = 0;
let deaths = 0;
let isControlsEnabled = false;
let isMatchRunning = false;
let isRouletteSpinning = false;
let lastShootTime = 0;
let lastNetworkSync = 0;
let cameraShakeIntensity = 0;

// 3-Lap Winding CTR Track Configuration (2000m per lap × 3 laps = 6000m)
const LAP_LENGTH = 2000;
const TOTAL_LAPS = 3;
let currentLap = 1;
let raceFinished = false;

// Match Timer, Kills & Deaths Tracking
let matchTimerSeconds = 180;
let matchTimerInterval = null;
let killScores = {};
let deathScores = {};
let teamScores = { blue: 0, red: 0 };

// ============================================================================
// 1. BALANCED CTR KART DRIVING CONSTANTS
// ============================================================================
const BASE_MAX_SPEED = 0.62;
const BASE_BOOST_SPEED = 0.94;
const SACRED_FIRE_SPEED = 1.06;
const BASE_ACCEL = 0.017;
const BRAKE_DECEL = 0.028;
const BASE_FRICTION = 0.968;
const TURN_SPEED = 0.034;
const GRAVITY = 0.017;

// ============================================================================
// 5 VEHICLE CLASSES WITH DISTINCT STATS & PHYSICS
// ============================================================================
const CAR_SKINS = {
    interceptor: {
        id: "interceptor",
        name: "كارت كراش الكلاسيكي",
        classLabel: "متوازن (Balanced)",
        defaultColor: 0xff5500,
        accentColor: 0xffdd00,
        maxSpeedMult: 1.00,
        accelMult: 1.02,
        turnMult: 1.00,
        driftChargeMult: 1.05,
        weightClass: 1.0,
        weaponDamageBonus: 1.0,
        armorBonus: 10,
        statsUI: { speed: 82, accel: 82, turn: 84, armor: 75 },
        style: "sports"
    },
    bruiser: {
        id: "bruiser",
        name: "مدرعة تايني الثقيلة",
        classLabel: "ثقيل وسرعة قصوى (Heavy / Speed)",
        defaultColor: 0xff8800,
        accentColor: 0xffdd00,
        maxSpeedMult: 1.08,
        accelMult: 0.90,
        turnMult: 0.86,
        driftChargeMult: 0.95,
        weightClass: 1.45,
        weaponDamageBonus: 1.05,
        armorBonus: 40,
        statsUI: { speed: 96, accel: 68, turn: 64, armor: 98 },
        style: "heavy"
    },
    hypercar: {
        id: "hypercar",
        name: "تيربو كوكو السريع",
        classLabel: "تسارع ودريفت فوري (Acceleration)",
        defaultColor: 0x00c8ff,
        accentColor: 0xff00aa,
        maxSpeedMult: 1.03,
        accelMult: 1.16,
        turnMult: 1.06,
        driftChargeMult: 1.25,
        weightClass: 0.92,
        weaponDamageBonus: 1.0,
        armorBonus: 0,
        statsUI: { speed: 86, accel: 98, turn: 88, armor: 68 },
        style: "hyper"
    },
    enforcer: {
        id: "enforcer",
        name: "مركبة كورتكس الحربية",
        classLabel: "تحكم وقتال هجومي (Handling / Combat)",
        defaultColor: 0xff1133,
        accentColor: 0xffaa00,
        maxSpeedMult: 1.01,
        accelMult: 1.04,
        turnMult: 1.18,
        driftChargeMult: 1.10,
        weightClass: 1.08,
        weaponDamageBonus: 1.18,
        armorBonus: 20,
        statsUI: { speed: 84, accel: 85, turn: 96, armor: 82 },
        style: "muscle"
    },
    phantom: {
        id: "phantom",
        name: "مركبة أوكسايد الفضائية",
        classLabel: "احترافي انسيابي (Advanced / Hover)",
        defaultColor: 0x00ff88,
        accentColor: 0xb026ff,
        maxSpeedMult: 1.07,
        accelMult: 1.10,
        turnMult: 1.12,
        driftChargeMult: 1.15,
        weightClass: 1.05,
        weaponDamageBonus: 1.08,
        armorBonus: 15,
        statsUI: { speed: 94, accel: 90, turn: 92, armor: 78 },
        style: "stealth"
    }
};

// ============================================================================
// CTR WEAPONS ARSENAL (WITH JUICED-UP LEVEL 2 UPGRADES AT 10 WUMPA FRUITS!)
// ============================================================================
const WEAPON_ORDER = ['missile', 'bomb', 'tnt', 'shield_cannon', 'warp_orb', 'aku_mask'];
const WEAPONS = {
    missile: {
        id: "missile",
        icon: "🚀",
        shortName: "صاروخ متتبع",
        juicedName: "صاروخ خارق 🔥",
        cooldown: 460,
        damage: 45,
        speed: 1.38,
        color: 0xff3300,
        homing: true,
        cratesGrant: 3
    },
    bomb: {
        id: "bomb",
        icon: "💣",
        shortName: "قنبلة متدحرجة",
        juicedName: "قنبلة ارتجاجية 💥",
        cooldown: 440,
        damage: 50,
        speed: 1.48,
        color: 0xffaa00,
        homing: false,
        cratesGrant: 3
    },
    tnt: {
        id: "tnt",
        icon: "🧪",
        shortName: "صندوق TNT",
        juicedName: "فخ نيترو أخضر ☢️",
        cooldown: 480,
        damage: 65,
        speed: 0,
        color: 0x00ff44,
        isMine: true,
        cratesGrant: 3
    },
    shield_cannon: {
        id: "shield_cannon",
        icon: "🛡️",
        shortName: "درع الطاقة",
        juicedName: "درع أزرق دائم 🛡️",
        cooldown: 400,
        damage: 38,
        speed: 1.75,
        color: 0x00f0ff,
        isShield: true,
        cratesGrant: 2
    },
    warp_orb: {
        id: "warp_orb",
        icon: "⚡",
        shortName: "صاعقة الموجة",
        juicedName: "كرة الزمكان ⚡",
        cooldown: 680,
        damage: 42,
        speed: 1.65,
        color: 0x00ff88,
        isEmp: true,
        cratesGrant: 2
    },
    aku_mask: {
        id: "aku_mask",
        icon: "🔥",
        shortName: "قناع الحماية",
        juicedName: "قناع كراش الذهبي 👑",
        cooldown: 580,
        damage: 40,
        speed: 1.55,
        color: 0xffdd00,
        isMask: true,
        cratesGrant: 1
    }
};

let currentWeapon = null;
let weaponAmmo = {
    missile: 0,
    bomb: 0,
    tnt: 0,
    shield_cannon: 0,
    warp_orb: 0,
    aku_mask: 0
};

const AI_DIFFICULTY_PROFILES = {
    easy: {
        speedMult: 0.74,
        turnRate: 0.065,
        shootInterval: 3200,
        shootRange: 36,
        leadAimFactor: 0.0,
        seekPowerUps: false,
        useShortcuts: false,
        avoidMines: false,
        rubberBandStrength: 0.04
    },
    medium: {
        speedMult: 0.89,
        turnRate: 0.09,
        shootInterval: 2100,
        shootRange: 48,
        leadAimFactor: 0.45,
        seekPowerUps: true,
        useShortcuts: false,
        avoidMines: true,
        rubberBandStrength: 0.08
    },
    hard: {
        speedMult: 1.01,
        turnRate: 0.12,
        shootInterval: 1350,
        shootRange: 58,
        leadAimFactor: 0.85,
        seekPowerUps: true,
        useShortcuts: true,
        avoidMines: true,
        rubberBandStrength: 0.12
    }
};

// Input State
const keys = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    drift: false,
    shoot: false
};
let joyX = 0;
let joyY = 0;
let wheelSteerInput = 0;
let wheelTouchActive = false;
let gyroSteerInput = 0;
let gyroZeroOffset = 0;
let lastRawGyroAngle = 0;

// ============================================================================
// PROCEDURAL WEB AUDIO API SYNTHESIZER (WITH AUTOPLAY RESUME PROTECTION)
// ============================================================================
const SoundEngine = {
    ctx: null,
    engineOsc1: null,
    engineOsc2: null,
    engineGain: null,
    engineFilter: null,
    noiseBuffer: null,
    lastDriftSound: 0,

    init() {
        if (!gameSettings.soundEnabled) return;
        try {
            if (!this.ctx) {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                if (AudioCtx) this.ctx = new AudioCtx();
            }
            if (this.ctx && this.ctx.state === 'suspended') {
                this.ctx.resume().catch(() => {});
            }
            if (this.ctx && !this.noiseBuffer) {
                const bufferSize = this.ctx.sampleRate;
                this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
                const data = this.noiseBuffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) {
                    data[i] = Math.random() * 2 - 1;
                }
            }
            if (this.ctx && !this.engineOsc1) {
                this.startEngineLoop();
            }
        } catch (e) {}
    },

    startEngineLoop() {
        if (!this.ctx) return;
        try {
            this.engineOsc1 = this.ctx.createOscillator();
            this.engineOsc2 = this.ctx.createOscillator();
            this.engineFilter = this.ctx.createBiquadFilter();
            this.engineGain = this.ctx.createGain();

            this.engineOsc1.type = 'sawtooth';
            this.engineOsc2.type = 'triangle';
            this.engineOsc1.frequency.value = 44;
            this.engineOsc2.frequency.value = 88;

            this.engineFilter.type = 'lowpass';
            this.engineFilter.frequency.value = 200;
            this.engineGain.gain.value = 0.0;

            this.engineOsc1.connect(this.engineFilter);
            this.engineOsc2.connect(this.engineFilter);
            this.engineFilter.connect(this.engineGain);
            this.engineGain.connect(this.ctx.destination);

            this.engineOsc1.start();
            this.engineOsc2.start();
        } catch (e) {}
    },

    updateEngine(currentSpeed, isBoosting, isDrifting) {
        if (!this.ctx || !this.engineOsc1) return;
        try {
            const now = this.ctx.currentTime;
            if (!isControlsEnabled || !gameSettings.soundEnabled) {
                this.engineGain.gain.setTargetAtTime(0.0, now, 0.08);
                return;
            }
            const speedRatio = Math.min(1.6, Math.abs(currentSpeed) / BASE_MAX_SPEED);
            const baseFreq = 44 + speedRatio * 105 + (isBoosting ? 46 : 0);
            this.engineOsc1.frequency.setTargetAtTime(baseFreq, now, 0.05);
            this.engineOsc2.frequency.setTargetAtTime(baseFreq * 1.98, now, 0.05);
            this.engineFilter.frequency.setTargetAtTime(190 + speedRatio * 580 + (isBoosting ? 380 : 0), now, 0.06);
            this.engineGain.gain.setTargetAtTime(0.038 + speedRatio * 0.042, now, 0.08);

            if (isDrifting && Math.abs(currentSpeed) > 0.22 && Date.now() - this.lastDriftSound > 150) {
                this.lastDriftSound = Date.now();
                this.playDriftScreech();
            }
        } catch (e) {}
    },

    playCrateSmash() {
        if (!this.ctx || !gameSettings.soundEnabled) return;
        try {
            const now = this.ctx.currentTime;
            if (this.noiseBuffer) {
                const src = this.ctx.createBufferSource();
                src.buffer = this.noiseBuffer;
                const filter = this.ctx.createBiquadFilter();
                filter.type = 'bandpass';
                filter.frequency.setValueAtTime(920, now);
                const gain = this.ctx.createGain();
                gain.gain.setValueAtTime(0.24, now);
                gain.gain.exponentialRampToValueAtTime(0.008, now + 0.15);
                src.connect(filter);
                filter.connect(gain);
                gain.connect(this.ctx.destination);
                src.start(now);
                src.stop(now + 0.15);
            }
            this.playBeep(880);
        } catch (e) {}
    },

    playWumpaPickup() {
        if (!this.ctx || !gameSettings.soundEnabled) return;
        try {
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(580, now);
            osc.frequency.exponentialRampToValueAtTime(1160, now + 0.11);
            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.006, now + 0.11);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(now);
            osc.stop(now + 0.11);
        } catch (e) {}
    },

    playWeaponSound(weaponType) {
        if (!this.ctx || !gameSettings.soundEnabled) return;
        try {
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            if (weaponType === 'tnt') {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(340, now);
                osc.frequency.setValueAtTime(680, now + 0.08);
                gain.gain.setValueAtTime(0.18, now);
                gain.gain.exponentialRampToValueAtTime(0.005, now + 0.22);
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start(now);
                osc.stop(now + 0.22);
            } else if (weaponType === 'missile' || weaponType === 'bomb') {
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(360, now);
                osc.frequency.exponentialRampToValueAtTime(90, now + 0.3);
                gain.gain.setValueAtTime(0.2, now);
                gain.gain.exponentialRampToValueAtTime(0.005, now + 0.3);
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start(now);
                osc.stop(now + 0.3);
            } else {
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(720, now);
                osc.frequency.exponentialRampToValueAtTime(140, now + 0.18);
                gain.gain.setValueAtTime(0.15, now);
                gain.gain.exponentialRampToValueAtTime(0.005, now + 0.18);
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start(now);
                osc.stop(now + 0.18);
            }
        } catch (e) {}
    },

    playNitro() {
        if (!this.ctx || !gameSettings.soundEnabled) return;
        try {
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(240, now);
            osc.frequency.exponentialRampToValueAtTime(780, now + 0.32);
            gain.gain.setValueAtTime(0.16, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.32);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(now);
            osc.stop(now + 0.32);
        } catch (e) {}
    },

    playDriftScreech() {
        if (!this.ctx || !this.noiseBuffer || !gameSettings.soundEnabled) return;
        try {
            const now = this.ctx.currentTime;
            const src = this.ctx.createBufferSource();
            src.buffer = this.noiseBuffer;
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(1300, now);
            filter.Q.setValueAtTime(4.5, now);
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.032, now);
            gain.gain.exponentialRampToValueAtTime(0.005, now + 0.12);
            src.connect(filter);
            filter.connect(gain);
            gain.connect(this.ctx.destination);
            src.start(now);
            src.stop(now + 0.12);
        } catch (e) {}
    },

    playExplosion(isBig = false) {
        if (!this.ctx || !gameSettings.soundEnabled) return;
        try {
            const now = this.ctx.currentTime;
            const duration = isBig ? 0.55 : 0.28;
            const subOsc = this.ctx.createOscillator();
            const subGain = this.ctx.createGain();
            subOsc.type = 'triangle';
            subOsc.frequency.setValueAtTime(isBig ? 140 : 105, now);
            subOsc.frequency.exponentialRampToValueAtTime(26, now + duration);
            subGain.gain.setValueAtTime(isBig ? 0.28 : 0.18, now);
            subGain.gain.exponentialRampToValueAtTime(0.005, now + duration);
            subOsc.connect(subGain);
            subGain.connect(this.ctx.destination);
            subOsc.start(now);
            subOsc.stop(now + duration);
        } catch (e) {}
    },

    playPickup() {
        if (!this.ctx || !gameSettings.soundEnabled) return;
        try {
            const now = this.ctx.currentTime;
            [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, now + idx * 0.05);
                gain.gain.setValueAtTime(0.11, now + idx * 0.05);
                gain.gain.exponentialRampToValueAtTime(0.005, now + idx * 0.05 + 0.15);
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start(now + idx * 0.05);
                osc.stop(now + idx * 0.05 + 0.15);
            });
        } catch (e) {}
    },

    playBeep(freq = 600) {
        if (!this.ctx || !gameSettings.soundEnabled) return;
        try {
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now);
            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.008, now + 0.12);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(now);
            osc.stop(now + 0.12);
        } catch (e) {}
    }
};

function initWebAudio() {
    SoundEngine.init();
}

// ============================================================================
// 6 CTR-INSPIRED MAPS WITH DISTINCT SURFACE FRICTION, LIGHTING & CURVES
// ============================================================================
const MAP_THEMES = {
    crash_cove: {
        name: "شاطئ جزيرة كراش",
        bg: 0x124878,
        floor: 0xd9a84e,
        sandColor: 0xe6b85c,
        duneColor: 0x348838,
        roadColor: 0x3b342c,
        curb1: 0xff3300,
        curb2: 0xffdd00,
        wall: 0x00f0ff,
        accent: 0xff8800,
        warehouseColor: 0x6b4423,
        fogDensity: 0.0036,
        surfaceFriction: 0.968,
        driftSlideFactor: 1.0,
        curveAmp: 24,
        curveFreq: 0.0062
    },
    pyramid_desert: {
        name: "وادي الأهرامات الصحراوي",
        bg: 0x291507,
        floor: 0xc87d2e,
        sandColor: 0xe09642,
        duneColor: 0xb5671d,
        roadColor: 0x453222,
        curb1: 0xffaa00,
        curb2: 0xff3300,
        wall: 0xffaa00,
        accent: 0xff5500,
        warehouseColor: 0x5c3d22,
        fogDensity: 0.0040,
        surfaceFriction: 0.964,
        driftSlideFactor: 1.08,
        curveAmp: 28,
        curveFreq: 0.0075
    },
    polar_pass: {
        name: "الممر الجليدي المتجمد",
        bg: 0x0a1c36,
        floor: 0xc8e6ff,
        sandColor: 0xdff2ff,
        duneColor: 0x8cc4f2,
        roadColor: 0x263b54,
        curb1: 0x00f0ff,
        curb2: 0xffffff,
        wall: 0x00f0ff,
        accent: 0x0088ff,
        warehouseColor: 0x1e324a,
        fogDensity: 0.0040,
        surfaceFriction: 0.980, // Icy low-friction surface!
        driftSlideFactor: 1.42, // Extra icy slide on turns!
        curveAmp: 26,
        curveFreq: 0.0068
    },
    volcano_mines: {
        name: "مناجم الحمم البركانية",
        bg: 0x1a0502,
        floor: 0x2b1814,
        sandColor: 0x361c16,
        duneColor: 0xff3300,
        roadColor: 0x1c1618,
        curb1: 0xff2200,
        curb2: 0xffaa00,
        wall: 0xff4400,
        accent: 0xffaa00,
        warehouseColor: 0x2e1c18,
        fogDensity: 0.0045,
        surfaceFriction: 0.966,
        driftSlideFactor: 1.05,
        curveAmp: 25,
        curveFreq: 0.007
    },
    cyber_station: {
        name: "محطة أوكسايد النيونية",
        bg: 0x050714,
        floor: 0x0e1329,
        sandColor: 0x1a1433,
        duneColor: 0x2c1b4d,
        roadColor: 0x121629,
        curb1: 0xff0055,
        curb2: 0x00f0ff,
        wall: 0x00f0ff,
        accent: 0xff0055,
        warehouseColor: 0x1a223a,
        fogDensity: 0.0042,
        surfaceFriction: 0.971,
        driftSlideFactor: 0.95,
        curveAmp: 27,
        curveFreq: 0.0072
    },
    sky_castle: {
        name: "قلعة السماء المعلقة",
        bg: 0x140826,
        floor: 0x26173d,
        sandColor: 0x321e4f,
        duneColor: 0x482873,
        roadColor: 0x1c142e,
        curb1: 0xb026ff,
        curb2: 0x00ff88,
        wall: 0xb026ff,
        accent: 0x00ff88,
        warehouseColor: 0x251842,
        fogDensity: 0.0042,
        surfaceFriction: 0.970,
        driftSlideFactor: 1.02,
        curveAmp: 28,
        curveFreq: 0.0078
    }
};

// ============================================================================
// WINDING CURVE & SHORTCUT GEOMETRY FUNCTIONS FOR CTR RACE MODE
// ============================================================================
function getTrackCenterX(zPos) {
    if (gameMode !== 'race') return 0;
    const theme = MAP_THEMES[currentMapType] || MAP_THEMES.crash_cove;
    let envelope = 1.0;
    if (zPos < 140) envelope = Math.max(0, zPos / 140);
    else if (zPos > LAP_LENGTH - 140) envelope = Math.max(0, (LAP_LENGTH - zPos) / 140);

    return envelope * (
        Math.sin(zPos * theme.curveFreq) * theme.curveAmp +
        Math.sin(zPos * theme.curveFreq * 0.5) * (theme.curveAmp * 0.4)
    );
}

function getTrackTangentAngle(zPos) {
    const dx = getTrackCenterX(zPos + 4) - getTrackCenterX(zPos - 4);
    return Math.atan2(dx, 8);
}

function isInsideShortcut(px, pz) {
    for (let i = 0; i < shortcutZones.length; i++) {
        const sc = shortcutZones[i];
        if (pz >= sc.minZ && pz <= sc.maxZ && Math.abs(px - sc.centerX) <= sc.halfWidth) {
            return true;
        }
    }
    return false;
}

function pauseGameLoop() {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
}

// ============================================================================
// P0 FIX: MULTI-LEVEL SAFE WEBGL INITIALIZATION & CONTEXT LOSS RECOVERY
// ============================================================================
function initScene(mapType) {
    return init3D(mapType || currentMapType);
}

function init3D(mapType) {
    currentMapType = MAP_THEMES[mapType] ? mapType : 'crash_cove';
    const theme = MAP_THEMES[currentMapType];
    const container = document.getElementById("canvas-container");
    if (container) container.innerHTML = "";

    const npContainer = document.getElementById("nameplates-container");
    if (npContainer) npContainer.innerHTML = "";

    aiBots = [];
    powerUpItems = [];
    wumpaItems = [];
    landminesList = [];
    arenaObstacles = [];
    warehouseWalls = [];
    arenaRamps = [];
    boostPads = [];
    shortcutZones = [];
    checkpoints = [];
    projectiles = [];
    particles = [];
    shockwaves = [];
    skidMarks = [];
    ghostMesh = null;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(theme.bg);
    scene.fog = new THREE.FogExp2(theme.bg, theme.fogDensity);

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1400);

    // Multi-level try/catch WebGLRenderer Creation (Prevents P0 Black Canvas Bug!)
    renderer = null;
    try {
        renderer = new THREE.WebGLRenderer({
            antialias: true,
            powerPreference: "high-performance",
            alpha: false
        });
    } catch (errPrimary) {
        console.warn("Primary WebGLRenderer failed, attempting safe fallback:", errPrimary);
        try {
            renderer = new THREE.WebGLRenderer({
                antialias: false,
                powerPreference: "default",
                precision: "mediump",
                failIfMajorPerformanceCaveat: false
            });
        } catch (errFallback) {
            console.error("Critical WebGL initialization error:", errFallback);
        }
    }

    if (renderer) {
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        try {
            renderer.shadowMap.enabled = true;
            renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            renderer.toneMapping = THREE.ACESFilmicToneMapping;
            renderer.toneMappingExposure = 1.2;
        } catch (e) {}

        if (container) {
            container.innerHTML = "";
            container.appendChild(renderer.domElement);
        }

        // WebGL Context Lost & Restored Listeners for Mobile GPUs
        renderer.domElement.addEventListener('webglcontextlost', (e) => {
            e.preventDefault();
            pauseGameLoop();
        }, false);

        renderer.domElement.addEventListener('webglcontextrestored', () => {
            initScene(currentMapType);
            if (isMatchRunning) {
                spawnAIBotsForMode();
                animate();
            }
        }, false);
    }

    // Independent try/catch for Post-Processing (EffectComposer + UnrealBloomPass)
    composer = null;
    if (renderer && typeof THREE.EffectComposer !== 'undefined' && typeof THREE.UnrealBloomPass !== 'undefined') {
        try {
            composer = new THREE.EffectComposer(renderer);
            const renderPass = new THREE.RenderPass(scene, camera);
            composer.addPass(renderPass);

            const bloomPass = new THREE.UnrealBloomPass(
                new THREE.Vector2(window.innerWidth, window.innerHeight),
                0.92,
                0.4,
                0.86
            );
            composer.addPass(bloomPass);
        } catch (bloomErr) {
            console.warn("Post-processing disabled, falling back to direct WebGLRenderer:", bloomErr);
            composer = null;
        }
    }

    const ambientLight = new THREE.AmbientLight(0xffefff, 0.84);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(theme.wall, theme.bg, 0.52);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.35);
    dirLight.position.set(45, 95, 45);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    scene.add(dirLight);

    createStarfieldSky(theme);

    if (gameMode === 'race') {
        createWindingCTRTrackWithShortcuts(theme);
        createGhostVehicleIfAvailable();
    } else {
        createBattleArenaFloorAndStreets(theme);
        createArenaBorders(theme);
        createSandDunesAndRocks(theme);
        createWarehousesAndHidingBunkers(theme);
        createArenaStructures(theme);

        const defaultPowerUps = [
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
        defaultPowerUps.forEach(p => createPowerUpMesh(p));

        // Scatter glowing Wumpa fruits in the battle arena
        [
            { x: -18, z: 0 }, { x: 18, z: 0 }, { x: 0, z: -18 }, { x: 0, z: 18 },
            { x: -35, z: 20 }, { x: 35, z: -20 }, { x: -35, z: -20 }, { x: 35, z: 20 }
        ].forEach((wf, idx) => createWumpaFruitMesh(`arena_wumpa_${idx}`, wf.x, wf.z));
    }

    Object.values(otherPlayers).forEach(op => {
        const reb = createVehicleMesh({
            skin: op.skin || 'interceptor',
            paintColor: op.paintColor,
            wheelStyle: op.wheelStyle || 'standard',
            spoilerStyle: op.spoilerStyle || 'gt_wing',
            team: op.team || 'ffa',
            isLocalPlayer: false
        });
        reb.group.position.set(op.x || 0, op.y || 0, op.z || 0);
        scene.add(reb.group);
        op.mesh = reb.group;
        op.wheels = reb.wheels;
    });

    const playerBuild = createVehicleMesh({
        skin: selectedSkin,
        paintColor: selectedPaintColor,
        wheelStyle: selectedWheelStyle,
        spoilerStyle: selectedSpoilerStyle,
        team: localTeam,
        isLocalPlayer: true
    });
    playerVehicle = playerBuild.group;
    playerWheels = playerBuild.wheels;
    playerSteerWheels = playerBuild.steerWheels;
    playerTailLights = playerBuild.tailLights;
    playerHeadlightSpots = playerBuild.spotLights;
    playerTurret = playerBuild.turret;
    playerAkuAura = playerBuild.akuAura;
    playerTntHeadMesh = playerBuild.tntHeadMesh;
    playerExhaustFlames = playerBuild.exhaustFlames || [];
    playerVehicle.position.set(x, y, z);
    scene.add(playerVehicle);

    window.addEventListener('resize', onWindowResize);
}

function createStarfieldSky(theme) {
    const starsGeo = new THREE.BufferGeometry();
    const count = 2200;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    const c1 = new THREE.Color(0xffffff);
    const c2 = new THREE.Color(theme.wall);
    const c3 = new THREE.Color(theme.accent);

    for (let i = 0; i < count * 3; i += 3) {
        positions[i] = (Math.random() - 0.5) * 800;
        positions[i + 1] = Math.random() * 280 + 22;
        positions[i + 2] = (Math.random() - 0.25) * 2400;

        const chosen = Math.random() > 0.35 ? c1 : (Math.random() > 0.5 ? c2 : c3);
        colors[i] = chosen.r;
        colors[i + 1] = chosen.g;
        colors[i + 2] = chosen.b;
    }

    starsGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starsGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const starsMat = new THREE.PointsMaterial({ size: 1.25, vertexColors: true, transparent: true, opacity: 0.9 });
    starfield = new THREE.Points(starsGeo, starsMat);
    scene.add(starfield);
}

// ============================================================================
// WINDING CTR RACE TRACK WITH S-CURVES, SHORTCUTS, WUMPA FRUITS & '?' CRATES
// ============================================================================
function createWindingCTRTrackWithShortcuts(theme) {
    const roadHalfWidth = 15.5;
    const totalLength = LAP_LENGTH + 180;

    const terrainGeo = new THREE.PlaneGeometry(500, totalLength + 300);
    const terrainMat = new THREE.MeshStandardMaterial({
        color: theme.sandColor,
        roughness: 0.82,
        metalness: 0.12
    });
    const terrain = new THREE.Mesh(terrainGeo, terrainMat);
    terrain.rotation.x = -Math.PI / 2;
    terrain.position.set(0, -0.05, LAP_LENGTH / 2);
    scene.add(terrain);

    const stepZ = 8;
    const numSteps = Math.floor(totalLength / stepZ);
    const roadVertices = [];
    const roadIndices = [];

    for (let i = 0; i <= numSteps; i++) {
        const zPos = -20 + i * stepZ;
        const cx = getTrackCenterX(zPos);
        roadVertices.push(cx - roadHalfWidth, 0.03, zPos);
        roadVertices.push(cx + roadHalfWidth, 0.03, zPos);

        if (i < numSteps) {
            const base = i * 2;
            roadIndices.push(base, base + 1, base + 2);
            roadIndices.push(base + 1, base + 3, base + 2);
        }
    }

    const roadBufferGeo = new THREE.BufferGeometry();
    roadBufferGeo.setAttribute('position', new THREE.Float32BufferAttribute(roadVertices, 3));
    roadBufferGeo.setIndex(roadIndices);
    roadBufferGeo.computeVertexNormals();

    const roadMat = new THREE.MeshStandardMaterial({
        color: theme.roadColor,
        roughness: currentMapType === 'polar_pass' ? 0.16 : 0.36,
        metalness: currentMapType === 'polar_pass' ? 0.78 : 0.55,
        side: THREE.DoubleSide
    });
    const windingRoad = new THREE.Mesh(roadBufferGeo, roadMat);
    windingRoad.receiveShadow = true;
    scene.add(windingRoad);

    const curbGeo = new THREE.BoxGeometry(1.1, 0.75, stepZ * 1.95);
    const curbMat1 = new THREE.MeshBasicMaterial({ color: theme.curb1 });
    const curbMat2 = new THREE.MeshBasicMaterial({ color: theme.curb2 });
    const dashGeo = new THREE.PlaneGeometry(0.5, 6.0);
    const dashMat = new THREE.MeshBasicMaterial({ color: 0xffdd00, side: THREE.DoubleSide });
    const duneMat = new THREE.MeshStandardMaterial({ color: theme.duneColor, roughness: 0.85 });
    const whMat = new THREE.MeshStandardMaterial({ color: theme.warehouseColor, metalness: 0.65, roughness: 0.35 });

    for (let zPos = 0; zPos <= LAP_LENGTH; zPos += 16) {
        const cx = getTrackCenterX(zPos);
        const tangentAngle = getTrackTangentAngle(zPos);
        const cMat = (Math.floor(zPos / 16) % 2 === 0) ? curbMat1 : curbMat2;

        [-roadHalfWidth, roadHalfWidth].forEach(offset => {
            const curb = new THREE.Mesh(curbGeo, cMat);
            curb.position.set(cx + offset, 0.38, zPos);
            curb.rotation.y = tangentAngle;
            scene.add(curb);
        });

        const dash = new THREE.Mesh(dashGeo, dashMat);
        dash.rotation.x = -Math.PI / 2;
        dash.rotation.z = -tangentAngle;
        dash.position.set(cx, 0.06, zPos);
        scene.add(dash);

        if (zPos % 160 === 0 && zPos > 0) {
            const sideSign = (zPos % 320 === 0) ? 1 : -1;
            const hill = new THREE.Mesh(new THREE.ConeGeometry(20, 9.5, currentMapType === 'pyramid_desert' ? 4 : 12), duneMat);
            hill.position.set(cx + sideSign * 42, 4.5, zPos);
            scene.add(hill);

            const wh = new THREE.Mesh(new THREE.BoxGeometry(14, 7, 20), whMat);
            wh.position.set(cx - sideSign * 38, 3.5, zPos - 50);
            scene.add(wh);
        }
    }

    // 3 Secret CTR Shortcuts
    const shortcutDefs = [
        { minZ: 420,  maxZ: 560,  centerX: 0, halfWidth: 7.5 },
        { minZ: 980,  maxZ: 1120, centerX: 0, halfWidth: 7.5 },
        { minZ: 1500, maxZ: 1640, centerX: 0, halfWidth: 7.5 }
    ];

    const scRoadMat = new THREE.MeshStandardMaterial({
        color: 0x1e3d28,
        emissive: 0x003311,
        roughness: 0.4
    });
    const scArchMat = new THREE.MeshBasicMaterial({ color: 0x00ff88 });

    shortcutDefs.forEach((sc, idx) => {
        shortcutZones.push(sc);
        const scLen = sc.maxZ - sc.minZ;
        const midZ = (sc.minZ + sc.maxZ) / 2;

        const scMesh = new THREE.Mesh(new THREE.PlaneGeometry(sc.halfWidth * 2, scLen), scRoadMat);
        scMesh.rotation.x = -Math.PI / 2;
        scMesh.position.set(sc.centerX, 0.05, midZ);
        scene.add(scMesh);

        const rampGroup = new THREE.Group();
        const rMesh = new THREE.Mesh(
            new THREE.BoxGeometry(9.0, 1.3, 10.0),
            new THREE.MeshStandardMaterial({ color: 0x00aa55, metalness: 0.8 })
        );
        rampGroup.add(rMesh);
        rampGroup.position.set(sc.centerX, 0.7, sc.minZ + 8);
        rampGroup.rotation.x = -0.2;
        scene.add(rampGroup);
        arenaRamps.push({ x: sc.centerX, z: sc.minZ + 8, width: 9.0, length: 10.0, height: 2.4, dirZ: 1 });

        const arch = new THREE.Mesh(new THREE.TorusGeometry(6.5, 0.35, 8, 20, Math.PI), scArchMat);
        arch.position.set(sc.centerX, 0.2, sc.minZ + 2);
        scene.add(arch);

        createSingleBoostPad(sc.centerX, midZ, 0);
        createPowerUpMesh({
            id: `sc_crate_${idx}`,
            type: 'crate',
            x: sc.centerX,
            z: midZ + 20,
            active: true
        });
        createWumpaFruitMesh(`sc_wumpa_${idx}`, sc.centerX, midZ - 18);
    });

    checkpoints = [];
    for (let i = 1; i <= 10; i++) {
        const cpZ = i * (LAP_LENGTH / 10);
        const cx = getTrackCenterX(cpZ);
        const isLapGate = i === 10;

        const archGroup = new THREE.Group();
        const pillarGeo = new THREE.BoxGeometry(1.3, 10.5, 1.3);
        const archColor = isLapGate ? 0x00ff88 : (i % 2 === 0 ? theme.curb1 : theme.curb2);
        const archMat = new THREE.MeshBasicMaterial({ color: archColor });

        const pL = new THREE.Mesh(pillarGeo, archMat);
        pL.position.set(-roadHalfWidth + 0.6, 5.2, 0);
        const pR = pL.clone();
        pR.position.x = roadHalfWidth - 0.6;

        const topBeam = new THREE.Mesh(new THREE.BoxGeometry(roadHalfWidth * 2, isLapGate ? 2.4 : 1.1, 1.3), archMat);
        topBeam.position.set(0, 10.5, 0);

        archGroup.add(pL, pR, topBeam);
        archGroup.position.set(cx, 0, cpZ);
        archGroup.rotation.y = getTrackTangentAngle(cpZ);
        scene.add(archGroup);

        checkpoints.push({ index: i, x: cx, z: cpZ, isLapGate });

        // Row of 3 CTR '?' Weapon Crates every 200m
        const crateZ = cpZ - 110;
        const crateCenterX = getTrackCenterX(crateZ);
        [-7.5, 0, 7.5].forEach((offsetX, cIdx) => {
            createPowerUpMesh({
                id: `track_crate_${i}_${cIdx}`,
                type: 'crate',
                x: crateCenterX + offsetX,
                z: crateZ,
                active: true
            });
        });

        // Glowing Wumpa Fruit line on curves
        const wumpaZ = cpZ - 150;
        const wumpaCenterX = getTrackCenterX(wumpaZ);
        [-4.5, 4.5].forEach((wOff, wIdx) => {
            createWumpaFruitMesh(`track_wumpa_${i}_${wIdx}`, wumpaCenterX + wOff, wumpaZ);
        });

        // Green CTR Turbo Pad
        const padZ = cpZ - 55;
        const padCenterX = getTrackCenterX(padZ) + ((i % 2 === 0 ? 1 : -1) * 5.5);
        createSingleBoostPad(padCenterX, padZ, getTrackTangentAngle(padZ));
    }
}

function createWumpaFruitMesh(id, wx, wz) {
    if (!scene) return;
    const wGroup = new THREE.Group();
    const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.68, 12, 12),
        new THREE.MeshStandardMaterial({
            color: 0xffaa00,
            emissive: 0xff4400,
            emissiveIntensity: 0.65,
            roughness: 0.25
        })
    );
    wGroup.add(sphere);

    const leaf = new THREE.Mesh(
        new THREE.ConeGeometry(0.28, 0.5, 5),
        new THREE.MeshBasicMaterial({ color: 0x00ff66 })
    );
    leaf.position.y = 0.72;
    wGroup.add(leaf);

    wGroup.position.set(wx, 1.05, wz);
    scene.add(wGroup);

    wumpaItems.push({
        id,
        x: wx,
        z: wz,
        active: true,
        mesh: wGroup
    });
}

function createBattleArenaFloorAndStreets(theme) {
    const floorGeo = new THREE.PlaneGeometry(210, 210);
    const floorMat = new THREE.MeshStandardMaterial({
        color: theme.floor,
        roughness: 0.65,
        metalness: 0.25
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const asphaltMat = new THREE.MeshStandardMaterial({
        color: theme.roadColor,
        roughness: 0.35,
        metalness: 0.68
    });
    const roadWidth = 18;

    const roadNS = new THREE.Mesh(new THREE.PlaneGeometry(roadWidth, 198), asphaltMat);
    roadNS.rotation.x = -Math.PI / 2;
    roadNS.position.y = 0.03;
    roadNS.receiveShadow = true;
    scene.add(roadNS);

    const roadEW = new THREE.Mesh(new THREE.PlaneGeometry(198, roadWidth), asphaltMat);
    roadEW.rotation.x = -Math.PI / 2;
    roadEW.position.y = 0.035;
    roadEW.receiveShadow = true;
    scene.add(roadEW);

    const dashMat = new THREE.MeshBasicMaterial({ color: 0xffdd00, side: THREE.DoubleSide });
    const curbMat = new THREE.MeshBasicMaterial({ color: theme.wall, side: THREE.DoubleSide });

    for (let pos = -90; pos <= 90; pos += 14) {
        if (Math.abs(pos) < 12) continue;
        const dNS = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 5.5), dashMat);
        dNS.rotation.x = -Math.PI / 2;
        dNS.position.set(0, 0.06, pos);
        scene.add(dNS);

        const dEW = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 0.4), dashMat);
        dEW.rotation.x = -Math.PI / 2;
        dEW.position.set(pos, 0.06, 0);
        scene.add(dEW);
    }

    const ringGeo = new THREE.RingGeometry(11.5, 12.6, 40);
    const centerRing = new THREE.Mesh(ringGeo, curbMat);
    centerRing.rotation.x = -Math.PI / 2;
    centerRing.position.y = 0.06;
    scene.add(centerRing);
}

function createSandDunesAndRocks(theme) {
    const sandMat = new THREE.MeshStandardMaterial({ color: theme.sandColor, roughness: 0.88, metalness: 0.08 });
    const duneMat = new THREE.MeshStandardMaterial({ color: theme.duneColor, roughness: 0.85, metalness: 0.1 });

    [
        { x: -72, z: -72, r: 18, h: 4.5 },
        { x: 72,  z: -72, r: 16, h: 4.2 },
        { x: -72, z: 72,  r: 17, h: 4.2 },
        { x: 72,  z: 72,  r: 19, h: 4.8 },
        { x: -75, z: -25, r: 13, h: 3.0 },
        { x: 75,  z: 25,  r: 14, h: 3.2 },
        { x: -25, z: 76,  r: 13, h: 2.8 },
        { x: 25,  z: -76, r: 14, h: 3.0 }
    ].forEach((d, idx) => {
        const duneGeo = new THREE.ConeGeometry(d.r, d.h, currentMapType === 'pyramid_desert' ? 4 : 16);
        const dune = new THREE.Mesh(duneGeo, idx % 2 === 0 ? sandMat : duneMat);
        dune.position.set(d.x, d.h / 2 - 0.3, d.z);
        dune.receiveShadow = true;
        scene.add(dune);
    });
}

function createWarehousesAndHidingBunkers(theme) {
    const warehouseLocations = [
        { x: -45, z: -45 },
        { x: 45,  z: -45 },
        { x: -45, z: 45 },
        { x: 45,  z: 45 }
    ];

    const wallMat = new THREE.MeshStandardMaterial({ color: theme.warehouseColor, metalness: 0.72, roughness: 0.35 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x141829, metalness: 0.8, roughness: 0.3 });
    const neonSignMat = new THREE.MeshBasicMaterial({ color: theme.accent });

    const whWidth = 16;
    const whLength = 20;
    const whHeight = 6.2;

    warehouseLocations.forEach(loc => {
        const whGroup = new THREE.Group();

        const sideWallGeo = new THREE.BoxGeometry(1.2, whHeight, whLength);
        const leftWall = new THREE.Mesh(sideWallGeo, wallMat);
        leftWall.position.set(-whWidth / 2, whHeight / 2, 0);
        whGroup.add(leftWall);

        const rightWall = new THREE.Mesh(sideWallGeo, wallMat);
        rightWall.position.set(whWidth / 2, whHeight / 2, 0);
        whGroup.add(rightWall);

        const roof = new THREE.Mesh(new THREE.BoxGeometry(whWidth + 1.8, 0.7, whLength + 1.0), roofMat);
        roof.position.set(0, whHeight + 0.35, 0);
        whGroup.add(roof);

        [-whLength / 2, whLength / 2].forEach(zEnd => {
            const topHeader = new THREE.Mesh(new THREE.BoxGeometry(whWidth + 1.4, 0.55, 0.55), neonSignMat);
            topHeader.position.set(0, whHeight, zEnd);
            whGroup.add(topHeader);
        });

        whGroup.position.set(loc.x, 0, loc.z);
        scene.add(whGroup);

        warehouseWalls.push(
            {
                minX: loc.x - whWidth / 2 - 1.1,
                maxX: loc.x - whWidth / 2 + 1.1,
                minZ: loc.z - whLength / 2,
                maxZ: loc.z + whLength / 2
            },
            {
                minX: loc.x + whWidth / 2 - 1.1,
                maxX: loc.x + whWidth / 2 + 1.1,
                minZ: loc.z - whLength / 2,
                maxZ: loc.z + whLength / 2
            }
        );
    });
}

function createArenaBorders(theme) {
    const wallSpecs = [
        { pos: [0, 3.0, -100], rot: [0, 0, 0] },
        { pos: [0, 3.0, 100], rot: [0, 0, 0] },
        { pos: [-100, 3.0, 0], rot: [0, Math.PI / 2, 0] },
        { pos: [100, 3.0, 0], rot: [0, Math.PI / 2, 0] }
    ];

    const barrierGeo = new THREE.BoxGeometry(200, 6.0, 1.2);
    const barrierMat = new THREE.MeshBasicMaterial({ color: theme.wall, wireframe: true, transparent: true, opacity: 0.65 });
    const beamGeo = new THREE.BoxGeometry(200, 0.35, 1.5);
    const beamMat = new THREE.MeshBasicMaterial({ color: theme.accent });

    wallSpecs.forEach(w => {
        const wallGroup = new THREE.Group();
        wallGroup.add(new THREE.Mesh(barrierGeo, barrierMat));
        const topBeam = new THREE.Mesh(beamGeo, beamMat);
        topBeam.position.y = 2.9;
        wallGroup.add(topBeam);
        wallGroup.position.set(...w.pos);
        wallGroup.rotation.set(...w.rot);
        scene.add(wallGroup);
    });
}

function createArenaStructures(theme) {
    const rampConfigs = [
        { x: -24, z: 0, width: 8, length: 11, height: 2.5, dirZ: 1 },
        { x: 24,  z: 0, width: 8, length: 11, height: 2.5, dirZ: -1 },
        { x: 0,   z: -34, width: 8, length: 11, height: 2.5, dirZ: 1 },
        { x: 0,   z: 34,  width: 8, length: 11, height: 2.5, dirZ: -1 }
    ];

    const rampMat = new THREE.MeshStandardMaterial({ color: 0x1c2238, metalness: 0.82, roughness: 0.25 });
    rampConfigs.forEach(rc => {
        const rampGroup = new THREE.Group();
        rampGroup.add(new THREE.Mesh(new THREE.BoxGeometry(rc.width, 1.4, rc.length), rampMat));
        rampGroup.position.set(rc.x, 0.85, rc.z);
        rampGroup.rotation.x = rc.dirZ * -0.22;
        scene.add(rampGroup);
        arenaRamps.push(rc);
    });

    [
        { x: -72, z: 0, rot: Math.PI / 2 },
        { x: 72,  z: 0, rot: Math.PI / 2 },
        { x: 0,   z: -72, rot: 0 },
        { x: 0,   z: 72,  rot: 0 }
    ].forEach(pc => createSingleBoostPad(pc.x, pc.z, pc.rot));
}

function createSingleBoostPad(px, pz, rot) {
    const padGroup = new THREE.Group();
    const baseGeo = new THREE.PlaneGeometry(5.5, 9.5);
    const baseMat = new THREE.MeshBasicMaterial({
        color: 0x00ff66,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.58
    });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.rotation.x = -Math.PI / 2;
    padGroup.add(base);

    padGroup.position.set(px, 0.07, pz);
    padGroup.rotation.y = rot;
    scene.add(padGroup);

    boostPads.push({ x: px, z: pz, radius: 4.5, mesh: padGroup, lastTriggered: 0 });
}

// ============================================================================
// CUSTOM CAR BUILDER (WITH AKU-AKU AURA & STICKY TNT HEAD MESH)
// ============================================================================
function createVehicleMesh(config = {}) {
    const skinKey = config.skin || 'interceptor';
    const skin = CAR_SKINS[skinKey] || CAR_SKINS.interceptor;
    const bodyColor = config.paintColor !== undefined ? Number(config.paintColor) : skin.defaultColor;
    const wheelStyle = config.wheelStyle || 'standard';
    const spoilerStyle = config.spoilerStyle || 'gt_wing';
    const team = config.team || 'ffa';
    const isLocalPlayer = Boolean(config.isLocalPlayer);
    const isGhost = Boolean(config.isGhost);

    const group = new THREE.Group();
    group.rotation.order = 'YXZ';

    const trimColor = team === 'blue' ? 0x00f0ff : (team === 'red' ? 0xff2244 : skin.accentColor);

    const chassisMat = isGhost
        ? new THREE.MeshBasicMaterial({ color: 0x00f0ff, wireframe: false, transparent: true, opacity: 0.35 })
        : new THREE.MeshStandardMaterial({ color: bodyColor, metalness: 0.85, roughness: 0.2 });
    const darkArmorMat = isGhost
        ? new THREE.MeshBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.28 })
        : new THREE.MeshStandardMaterial({ color: 0x121521, metalness: 0.85, roughness: 0.28 });
    const neonTrimMat = new THREE.MeshBasicMaterial({ color: trimColor, transparent: isGhost, opacity: isGhost ? 0.45 : 1.0 });

    const isHeavy = skin.style === 'heavy';
    const isHyper = skin.style === 'hyper';
    const isStealth = skin.style === 'stealth';
    const isMonster = wheelStyle === 'monster';

    const chassisW = isHeavy ? 2.65 : (isHyper ? 2.45 : 2.35);
    const chassisH = isHeavy ? 0.78 : (isHyper ? 0.44 : 0.55);
    const chassisL = isHeavy ? 4.9 : 4.6;
    const rideHeightOffset = isMonster ? 0.18 : 0.0;

    const chassis = new THREE.Mesh(new THREE.BoxGeometry(chassisW, chassisH, chassisL), chassisMat);
    chassis.position.y = 0.52 + rideHeightOffset;
    chassis.castShadow = !isGhost;
    chassis.receiveShadow = !isGhost;
    group.add(chassis);

    const upperBody = new THREE.Mesh(
        new THREE.BoxGeometry(chassisW * 0.88, isHeavy ? 0.52 : 0.34, chassisL * 0.76),
        chassisMat
    );
    upperBody.position.set(0, (isHeavy ? 0.98 : 0.82) + rideHeightOffset, -0.15);
    group.add(upperBody);

    const skirt = new THREE.Mesh(new THREE.BoxGeometry(chassisW + 0.22, 0.26, chassisL * 0.85), darkArmorMat);
    skirt.position.y = 0.32 + rideHeightOffset;
    group.add(skirt);

    const neonTrim = new THREE.Mesh(new THREE.BoxGeometry(chassisW + 0.26, 0.08, chassisL * 0.82), neonTrimMat);
    neonTrim.position.y = 0.24 + rideHeightOffset;
    group.add(neonTrim);

    const cockpit = new THREE.Mesh(
        new THREE.BoxGeometry(isStealth ? 1.5 : 1.7, isHyper ? 0.45 : 0.55, 2.15),
        new THREE.MeshStandardMaterial({
            color: 0x050811,
            metalness: 0.65,
            roughness: 0.08,
            transparent: true,
            opacity: isGhost ? 0.25 : 0.88
        })
    );
    cockpit.position.set(0, (isHeavy ? 1.38 : 1.16) + rideHeightOffset, -0.25);
    group.add(cockpit);

    const spoilerBaseY = (isHeavy ? 1.62 : 1.42) + rideHeightOffset;
    if (spoilerStyle === 'gt_wing') {
        const spoilerWing = new THREE.Mesh(new THREE.BoxGeometry(chassisW + 0.1, 0.1, 0.65), darkArmorMat);
        spoilerWing.position.set(0, spoilerBaseY, -chassisL / 2 + 0.25);
        group.add(spoilerWing);

        [-0.8, 0.8].forEach(px => {
            const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.45, 0.25), darkArmorMat);
            pillar.position.set(px, spoilerBaseY - 0.22, -chassisL / 2 + 0.25);
            group.add(pillar);
        });
    } else if (spoilerStyle === 'twin_fin') {
        [-chassisW / 2 + 0.2, chassisW / 2 - 0.2].forEach(fx => {
            const fin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.65, 1.1), chassisMat);
            fin.position.set(fx, spoilerBaseY - 0.1, -chassisL / 2 + 0.5);
            group.add(fin);
        });
    } else if (spoilerStyle === 'heavy_rack') {
        const rack = new THREE.Mesh(new THREE.BoxGeometry(chassisW * 0.85, 0.42, 0.85), darkArmorMat);
        rack.position.set(0, spoilerBaseY - 0.12, -chassisL / 2 + 0.45);
        group.add(rack);
    }

    const turretGroup = new THREE.Group();
    turretGroup.position.set(0, (isHeavy ? 1.72 : 1.52) + rideHeightOffset, -0.15);
    group.add(turretGroup);

    // Golden Aku-Aku Shield Aura Ring (Visible when Aku Mask is active)
    let akuAura = null;
    let tntHeadMesh = null;
    const exhaustFlames = [];
    if (isLocalPlayer && !isGhost) {
        const flameGeo = new THREE.ConeGeometry(0.22, 1.15, 10);
        flameGeo.rotateX(-Math.PI / 2);
        [-0.55, 0.55].forEach(exOffset => {
            const flameMat = new THREE.MeshBasicMaterial({
                color: 0x00f0ff,
                transparent: true,
                opacity: 0.85
            });
            const flameMesh = new THREE.Mesh(flameGeo, flameMat);
            flameMesh.position.set(exOffset, 0.42 + rideHeightOffset, -chassisL / 2 - 0.55);
            flameMesh.visible = false;
            group.add(flameMesh);
            exhaustFlames.push(flameMesh);
        });
    }

    if (isLocalPlayer) {
        akuAura = new THREE.Mesh(
            new THREE.TorusGeometry(2.6, 0.16, 10, 32),
            new THREE.MeshBasicMaterial({ color: 0xffdd00, transparent: true, opacity: 0.85 })
        );
        akuAura.rotation.x = Math.PI / 2;
        akuAura.position.y = 0.9;
        akuAura.visible = false;
        group.add(akuAura);

        // Sticky TNT Crate above Player's Kart Roof (Level 2 Feature)
        tntHeadMesh = new THREE.Mesh(
            new THREE.BoxGeometry(1.15, 1.15, 1.15),
            new THREE.MeshStandardMaterial({ color: 0xff2200, emissive: 0xaa0000, roughness: 0.3 })
        );
        tntHeadMesh.position.set(0, 2.45 + rideHeightOffset, 0);
        tntHeadMesh.visible = false;
        group.add(tntHeadMesh);
    }

    const spotLights = [];
    if (isLocalPlayer && !isGhost) {
        const mainSpot = new THREE.SpotLight(0xd8f8ff, 1.8, 52, Math.PI / 4, 0.45, 1.2);
        mainSpot.position.set(0, 0.95 + rideHeightOffset, 2.2);
        const targetObj = new THREE.Object3D();
        targetObj.position.set(0, 0.2, 18);
        group.add(targetObj);
        mainSpot.target = targetObj;
        group.add(mainSpot);
        spotLights.push(mainSpot);
    }

    const tailGeo = new THREE.BoxGeometry(0.48, 0.16, 0.12);
    const tailMatL = new THREE.MeshBasicMaterial({ color: 0x990022 });
    const tailMatR = new THREE.MeshBasicMaterial({ color: 0x990022 });
    const tailL = new THREE.Mesh(tailGeo, tailMatL);
    tailL.position.set(-0.82, 0.66 + rideHeightOffset, -chassisL / 2 - 0.02);
    const tailR = new THREE.Mesh(tailGeo, tailMatR);
    tailR.position.set(0.82, 0.66 + rideHeightOffset, -chassisL / 2 - 0.02);
    group.add(tailL, tailR);

    const wheelRadius = isMonster ? 0.68 : 0.50;
    const wheelWidth = isMonster ? 0.52 : 0.36;
    const wheelGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelWidth, 18);
    const tireMat = new THREE.MeshStandardMaterial({
        color: wheelStyle === 'cyber_glow' ? 0x0a1024 : 0x141418,
        roughness: 0.72,
        transparent: isGhost,
        opacity: isGhost ? 0.35 : 1.0
    });
    const rimMat = wheelStyle === 'cyber_glow'
        ? new THREE.MeshBasicMaterial({ color: trimColor })
        : new THREE.MeshStandardMaterial({ color: 0xd8e2ff, metalness: 0.95, roughness: 0.12 });

    const useSixWheels = wheelStyle === 'hexa' || (skin.style === 'heavy' && wheelStyle === 'standard');
    const wheelX = chassisW / 2 + (isMonster ? 0.22 : 0.08);
    const wheelCoords = useSixWheels
        ? [
            { pos: [-wheelX, wheelRadius, 1.55], isFront: true },
            { pos: [wheelX, wheelRadius, 1.55], isFront: true },
            { pos: [-wheelX, wheelRadius, 0.0], isFront: false },
            { pos: [wheelX, wheelRadius, 0.0], isFront: false },
            { pos: [-wheelX, wheelRadius, -1.55], isFront: false },
            { pos: [wheelX, wheelRadius, -1.55], isFront: false }
        ]
        : [
            { pos: [-wheelX, wheelRadius, 1.42], isFront: true },
            { pos: [wheelX, wheelRadius, 1.42], isFront: true },
            { pos: [-wheelX, wheelRadius, -1.42], isFront: false },
            { pos: [wheelX, wheelRadius, -1.42], isFront: false }
        ];

    const allWheels = [];
    const steerWheels = [];

    wheelCoords.forEach(wc => {
        const steerPivot = new THREE.Group();
        steerPivot.position.set(...wc.pos);

        const spinGroup = new THREE.Group();
        const tire = new THREE.Mesh(wheelGeo, tireMat);
        tire.rotation.z = Math.PI / 2;
        spinGroup.add(tire);

        const rim = new THREE.Mesh(new THREE.CylinderGeometry(wheelRadius * 0.62, wheelRadius * 0.62, wheelWidth + 0.02, 8), rimMat);
        rim.rotation.z = Math.PI / 2;
        spinGroup.add(rim);

        steerPivot.add(spinGroup);
        group.add(steerPivot);

        allWheels.push(spinGroup);
        if (wc.isFront) steerWheels.push(steerPivot);
    });

    return {
        group,
        wheels: allWheels,
        steerWheels,
        tailLights: [tailMatL, tailMatR],
        spotLights,
        turret: turretGroup,
        akuAura,
        tntHeadMesh,
        exhaustFlames
    };
}

function createGhostVehicleIfAvailable() {
    if (!scene || gameMode !== 'race') return;
    try {
        const savedGhostStr = localStorage.getItem(`ARENA_GHOST_${currentMapType}`);
        if (savedGhostStr) {
            const parsed = JSON.parse(savedGhostStr);
            if (Array.isArray(parsed) && parsed.length > 10) {
                bestLapRecording = parsed;
            }
        }
    } catch (e) {}

    if (bestLapRecording.length > 10) {
        const ghostBuild = createVehicleMesh({
            skin: selectedSkin,
            paintColor: 0x00f0ff,
            wheelStyle: 'cyber_glow',
            spoilerStyle: 'gt_wing',
            isGhost: true
        });
        ghostMesh = ghostBuild.group;
        ghostMesh.position.set(bestLapRecording[0].x, bestLapRecording[0].y || 0, bestLapRecording[0].z);
        scene.add(ghostMesh);
    }
}

// ============================================================================
// WUMPA FRUIT HUD, MYSTERY (?) CRATES & JUICED-UP WEAPON ROULETTE
// ============================================================================
function addWumpaFruit(amount = 1) {
    const prevJuiced = isJuicedUp;
    wumpaCount = Math.min(10, Math.max(0, wumpaCount + amount));
    isJuicedUp = wumpaCount >= 10;

    updateWumpaHUD();
    SoundEngine.playWumpaPickup();

    if (!prevJuiced && isJuicedUp) {
        spawnFloatingText(new THREE.Vector3(x, y + 2.6, z), "🥭 10/10 أسلحة خارقة وسرعة +10%!", "crit");
        SoundEngine.playPickup();
        updateCircularWeaponUI();
    }
}

function updateWumpaHUD() {
    const countEl = document.getElementById("wumpa-count-val");
    const badgeEl = document.getElementById("wumpa-badge");
    const juicedTag = document.getElementById("juiced-tag");
    if (countEl) countEl.innerText = `${wumpaCount}/10`;
    if (badgeEl) {
        if (isJuicedUp) badgeEl.classList.add("juiced-up");
        else badgeEl.classList.remove("juiced-up");
    }
    if (juicedTag) {
        juicedTag.style.display = isJuicedUp ? "inline-block" : "none";
    }
}

function createPowerUpMesh(puData) {
    if (!scene) return;
    const isCrate = puData.type === 'crate' || puData.type === 'weapon';
    const puGroup = new THREE.Group();

    if (isCrate) {
        const crateGeo = new THREE.BoxGeometry(1.65, 1.65, 1.65);
        const crateMat = new THREE.MeshStandardMaterial({
            color: 0xd97724,
            emissive: 0x662b00,
            emissiveIntensity: 0.45,
            roughness: 0.4,
            metalness: 0.3
        });
        const crateBox = new THREE.Mesh(crateGeo, crateMat);
        puGroup.add(crateBox);

        const edges = new THREE.EdgesGeometry(crateGeo);
        const edgeLines = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xffdd00 }));
        puGroup.add(edgeLines);
    } else {
        const core = new THREE.Mesh(
            new THREE.OctahedronGeometry(1.25, 0),
            new THREE.MeshBasicMaterial({ color: 0x00ff88 })
        );
        puGroup.add(core);
    }

    puGroup.position.set(puData.x, 1.35, puData.z);
    puGroup.visible = puData.active !== false;
    scene.add(puGroup);

    powerUpItems.push({
        id: puData.id,
        type: isCrate ? 'crate' : puData.type,
        x: puData.x,
        z: puData.z,
        active: puData.active !== false,
        mesh: puGroup
    });
}

function triggerAutoTurbo(durationMs = AUTO_TURBO_DURATION, grantSacredFire = false) {
    autoTurboUntil = Math.max(autoTurboUntil, Date.now() + durationMs);
    if (grantSacredFire) sacredFireActive = true;
    const targetBoostSpeed = sacredFireActive ? SACRED_FIRE_SPEED : BASE_BOOST_SPEED * 1.06;
    speed = Math.max(speed, targetBoostSpeed);
    SoundEngine.playNitro();
    window.NetworkConfig.triggerHaptic(65, 200);
}

function triggerCTRMysteryCrateRoulette() {
    SoundEngine.playCrateSmash();
    window.NetworkConfig.triggerHaptic(60, 190);
    // Wood splinter burst VFX
    spawnExplosionVFX(new THREE.Vector3(x, y + 1.2, z), 0xd97724, 16, false);

    // Every crate also grants +2 Wumpa fruits!
    addWumpaFruit(2);

    if (isRouletteSpinning) return;
    isRouletteSpinning = true;

    const wheelBtn = document.getElementById("btn-weapon-wheel");
    const iconEl = document.getElementById("cur-weapon-icon");
    const nameEl = document.getElementById("cur-weapon-name");
    const shootBtn = document.getElementById("btn-shoot");
    const shootIconEl = document.getElementById("shoot-btn-icon");
    const shootTextEl = document.getElementById("shoot-btn-text");

    if (wheelBtn) wheelBtn.classList.add("spinning");
    if (shootBtn) shootBtn.classList.add("spinning");

    // 1-Second (1000ms = 10 ticks x 100ms) Fast Weapon Roulette Directly on the Shoot Button!
    let ticks = 0;
    const maxTicks = 10;
    const spinTimer = setInterval(() => {
        ticks++;
        const tempKey = WEAPON_ORDER[ticks % WEAPON_ORDER.length];
        const tempSpec = WEAPONS[tempKey];
        if (iconEl) iconEl.innerText = tempSpec.icon;
        if (nameEl) nameEl.innerText = "🎲 سحب...";
        if (shootIconEl) shootIconEl.innerText = tempSpec.icon;
        if (shootTextEl) shootTextEl.innerText = "🎲...";
        SoundEngine.playBeep(500 + (ticks * 52));

        if (ticks >= maxTicks) {
            clearInterval(spinTimer);
            isRouletteSpinning = false;
            if (wheelBtn) wheelBtn.classList.remove("spinning");
            if (shootBtn) shootBtn.classList.remove("spinning");

            const chosenKey = WEAPON_ORDER[Math.floor(Math.random() * WEAPON_ORDER.length)];
            const chosenSpec = WEAPONS[chosenKey];
            const bonusAmmo = isJuicedUp ? 1 : 0;
            weaponAmmo[chosenKey] = (weaponAmmo[chosenKey] || 0) + (chosenSpec.cratesGrant || 2) + bonusAmmo;
            currentWeapon = chosenKey;
            updateCircularWeaponUI();
            SoundEngine.playPickup();
            const displayWeaponName = isJuicedUp ? chosenSpec.juicedName : chosenSpec.shortName;
            spawnFloatingText(new THREE.Vector3(x, y + 2.4, z), `${chosenSpec.icon} ${displayWeaponName}!`, "crit");
        }
    }, 100);
}

function applyPowerUpEffect(pu) {
    if (pu.type === 'crate' || pu.type === 'weapon') {
        triggerCTRMysteryCrateRoulette();
    } else if (pu.type === 'nitro') {
        triggerAutoTurbo(AUTO_TURBO_DURATION, true);
        addWumpaFruit(1);
        spawnFloatingText(new THREE.Vector3(x, y + 2.4, z), "⚡ تيربو كراش!", "crit");
    } else if (pu.type === 'shield') {
        shield = Math.min(maxShield, shield + 50);
        updateVitalsHUD();
    } else if (pu.type === 'repair') {
        health = Math.min(maxHealth, health + 45);
        updateVitalsHUD();
    }
}

function deployLandmine(mx, mz, ownerId, ownerName, ownerTeam, mineId = null, juicedTrap = false) {
    if (!scene) return;
    const id = mineId || `tnt_${Date.now()}_${Math.random()}`;
    const mineGroup = new THREE.Group();

    const trapColor = juicedTrap ? 0x00ff44 : 0xff2200;
    const tntBox = new THREE.Mesh(
        new THREE.BoxGeometry(1.4, 1.4, 1.4),
        new THREE.MeshStandardMaterial({ color: trapColor, emissive: juicedTrap ? 0x005511 : 0x550000, roughness: 0.3 })
    );
    tntBox.position.y = 0.7;
    mineGroup.add(tntBox);

    const warnRing = new THREE.Mesh(
        new THREE.RingGeometry(1.6, 1.85, 24),
        new THREE.MeshBasicMaterial({ color: trapColor, side: THREE.DoubleSide, transparent: true, opacity: 0.7 })
    );
    warnRing.rotation.x = -Math.PI / 2;
    warnRing.position.y = 0.05;
    mineGroup.add(warnRing);

    mineGroup.position.set(mx, 0, mz);
    scene.add(mineGroup);

    landminesList.push({
        id,
        x: mx,
        z: mz,
        ownerId,
        ownerName: ownerName || ownerId,
        team: ownerTeam || 'ffa',
        isJuiced: juicedTrap,
        armedAt: Date.now() + 550,
        mesh: mineGroup,
        coreLight: tntBox
    });
}

function updateCircularWeaponUI() {
    const iconEl = document.getElementById("cur-weapon-icon");
    const nameEl = document.getElementById("cur-weapon-name");
    const ammoEl = document.getElementById("cur-weapon-ammo");

    const shootBtn = document.getElementById("btn-shoot");
    const shootIconEl = document.getElementById("shoot-btn-icon");
    const shootTextEl = document.getElementById("shoot-btn-text");
    const shootAmmoEl = document.getElementById("shoot-btn-ammo");

    if (!currentWeapon || !weaponAmmo[currentWeapon] || weaponAmmo[currentWeapon] <= 0) {
        const available = WEAPON_ORDER.find(k => weaponAmmo[k] > 0);
        currentWeapon = available || null;
    }

    if (!currentWeapon) {
        if (iconEl) iconEl.innerText = "⚡";
        if (nameEl) nameEl.innerText = "تيربو جاهز";
        if (ammoEl) ammoEl.innerText = "FOV";

        if (shootBtn) shootBtn.classList.remove("has-weapon");
        if (shootIconEl) shootIconEl.innerText = "🔥";
        if (shootTextEl) shootTextEl.innerText = "إطلاق";
        if (shootAmmoEl) shootAmmoEl.style.display = "none";
        return;
    }

    const wSpec = WEAPONS[currentWeapon];
    const curAmmo = weaponAmmo[currentWeapon] || 0;
    if (iconEl) iconEl.innerText = wSpec.icon;
    if (nameEl) nameEl.innerText = isJuicedUp ? wSpec.juicedName : wSpec.shortName;
    if (ammoEl) ammoEl.innerText = curAmmo;

    // Lock current weapon icon & ammo directly inside the primary Shoot button!
    if (shootBtn) shootBtn.classList.add("has-weapon");
    if (shootIconEl) shootIconEl.innerText = wSpec.icon;
    if (shootTextEl) shootTextEl.innerText = wSpec.shortName;
    if (shootAmmoEl) {
        shootAmmoEl.style.display = "inline-block";
        shootAmmoEl.innerText = curAmmo;
    }
}

function selectWeapon(wKey) {
    if (!WEAPONS[wKey] || (weaponAmmo[wKey] || 0) <= 0) return;
    currentWeapon = wKey;
    updateCircularWeaponUI();
    SoundEngine.playBeep(780);
}

function cycleNextWeapon() {
    const owned = WEAPON_ORDER.filter(k => (weaponAmmo[k] || 0) > 0);
    if (owned.length === 0) {
        // Smart Turbo Ready Trigger: expands Camera FOV (60 -> 68) and ignites rear exhaust flames!
        const now = Date.now();
        if (isControlsEnabled && (driftCharge >= 20 || now - lastManualTurboTime > 5000)) {
            lastManualTurboTime = now;
            triggerAutoTurbo(2200, driftStage >= 2);
            driftCharge = 0;
            driftStage = 0;
            spawnFloatingText(new THREE.Vector3(x, y + 2.2, z), "⚡ تيربو جاهز مُفعّل!", "shield");
        }
        updateCircularWeaponUI();
        return;
    }
    const curIdx = owned.indexOf(currentWeapon);
    const nextKey = owned[(curIdx + 1) % owned.length];
    selectWeapon(nextKey);
}

function shootWeapon(shooterInfo) {
    if (shooterInfo === 'player') {
        if (!isControlsEnabled || isRouletteSpinning) return;
        if (!currentWeapon || (weaponAmmo[currentWeapon] || 0) <= 0) {
            // If player presses Fire while holding drift boost, release the boost!
            if (driftStage >= 1) {
                releaseDriftMiniTurbo();
                return;
            }
            spawnFloatingText(new THREE.Vector3(x, y + 2.2, z), "📦 اصطدم بصندوق (?) للحصول على سلاح!", "normal");
            SoundEngine.playBeep(300);
            return;
        }

        const wSpec = WEAPONS[currentWeapon];
        const now = Date.now();
        if (now - lastShootTime < wSpec.cooldown) return;
        lastShootTime = now;

        weaponAmmo[currentWeapon] = Math.max(0, weaponAmmo[currentWeapon] - 1);
        updateCircularWeaponUI();

        SoundEngine.playWeaponSound(wSpec.id);
        window.NetworkConfig.triggerHaptic(45, 175);

        const skinSpec = CAR_SKINS[selectedSkin] || CAR_SKINS.interceptor;
        const dmgMult = (skinSpec.weaponDamageBonus || 1.0) * (isJuicedUp ? 1.25 : 1.0);

        // 1. Aku-Aku Super Mask (Grants Invincibility + Knockback Aura + Super Speed!)
        if (wSpec.isMask) {
            const maskDuration = isJuicedUp ? 9500 : 6500;
            shield = maxShield;
            health = maxHealth;
            akuMaskUntil = now + maskDuration;
            damageBoostUntil = now + maskDuration;
            triggerAutoTurbo(maskDuration, true);
            updateVitalsHUD();
            spawnFloatingText(
                new THREE.Vector3(x, y + 2.5, z),
                isJuicedUp ? "👑 قناع كراش الذهبي الخارق!" : "🔥 قناع الحماية والتيربو نشط!",
                "crit"
            );
            return;
        }

        // 2. Power Shield
        if (wSpec.isShield) {
            shield = Math.min(maxShield, shield + (isJuicedUp ? 85 : 50));
            updateVitalsHUD();
        }

        // 3. TNT / Juiced-Up Nitro Crate Trap
        if (wSpec.isMine) {
            const dropX = x - Math.sin(angle) * 3.2;
            const dropZ = z - Math.cos(angle) * 3.2;
            const myId = socket && socket.id ? socket.id : 'player';
            deployLandmine(dropX, dropZ, myId, localPlayerName, localTeam, null, isJuicedUp);
            spawnFloatingText(
                new THREE.Vector3(dropX, 1.5, dropZ),
                isJuicedUp ? "☢️ صندوق نيترو متفجر!" : "🧪 فخ صندوق TNT!",
                "crit"
            );

            if (!isOfflineMode && socket && socket.connected) {
                socket.emit('shootLaser', { x: dropX, z: dropZ, weaponType: 'tnt', team: localTeam });
            }
            return;
        }

        // 4. Warp Shock Orb
        if (wSpec.isEmp) {
            triggerEmpBlast(x, y + 1.0, z, 'player', localTeam, dmgMult * 1.15);
        }

        spawnProjectile(x, y + 1.1, z, angle, 'player', localTeam, wSpec.id, dmgMult, isJuicedUp);

        if (!isOfflineMode && socket && socket.connected) {
            socket.emit('shootLaser', {
                x,
                y: y + 1.1,
                z,
                angle,
                team: localTeam,
                weaponType: wSpec.id
            });
        }
    } else if (shooterInfo && typeof shooterInfo === 'object') {
        const wType = shooterInfo.weaponType || 'missile';
        if (wType === 'tnt' || wType === 'mine') {
            deployLandmine(shooterInfo.x, shooterInfo.z, shooterInfo.id, shooterInfo.name, shooterInfo.team);
            return;
        }
        if (wType === 'warp_orb' || wType === 'emp') {
            triggerEmpBlast(shooterInfo.x, 1.0, shooterInfo.z, shooterInfo.id || 'enemy', shooterInfo.team || 'ffa', 1.0);
        }
        spawnProjectile(
            shooterInfo.x,
            shooterInfo.y || 1.1,
            shooterInfo.z,
            shooterInfo.angle,
            shooterInfo.id || 'enemy',
            shooterInfo.team || 'ffa',
            wType,
            1.0,
            false
        );
    }
}

function triggerEmpBlast(bx, by, bz, ownerId, ownerTeam, dmgMult) {
    spawnExplosionVFX(new THREE.Vector3(bx, by, bz), 0x00ff88, 22, true);

    const empRadius = isJuicedUp && ownerId === 'player' ? 30.0 : 22.0;
    const dmg = Math.round(36 * dmgMult);
    const myId = socket && socket.id ? socket.id : 'player';

    aiBots.forEach(bot => {
        if (!bot || bot.health <= 0 || ownerId === bot.name) return;
        if (ownerTeam !== 'ffa' && ownerTeam === bot.team) return;

        if (Math.hypot(bot.x - bx, bot.z - bz) < empRadius) {
            bot.empSlowUntil = Date.now() + 3200;
            damageBot(bot, dmg, ownerId, true);
        }
    });

    if (ownerId !== 'player' && ownerId !== myId && ownerId !== localPlayerName) {
        if (ownerTeam === 'ffa' || ownerTeam !== localTeam) {
            if (Math.hypot(x - bx, z - bz) < empRadius) {
                empSlowUntil = Date.now() + 2800;
                applyLocalDamage(dmg, ownerId, true);
                spawnFloatingText(new THREE.Vector3(x, y + 2.6, z), "⚡ صاعقة إبطاء!", "shield");
            }
        }
    }
}

function spawnProjectile(px, py, pz, pAngle, ownerId, ownerTeam = 'ffa', weaponType = 'missile', dmgMult = 1.0, juiced = false) {
    if (!scene) return;
    const wSpec = WEAPONS[weaponType] || WEAPONS.missile;
    const boltGroup = new THREE.Group();

    if (weaponType === 'bomb') {
        const bombMesh = new THREE.Mesh(
            new THREE.SphereGeometry(juiced ? 0.85 : 0.65, 14, 14),
            new THREE.MeshStandardMaterial({
                color: juiced ? 0xff2200 : 0x222222,
                emissive: juiced ? 0xffaa00 : 0xff5500,
                emissiveIntensity: 0.6,
                metalness: 0.8
            })
        );
        boltGroup.add(bombMesh);
    } else if (weaponType === 'missile') {
        const body = new THREE.Mesh(
            new THREE.CylinderGeometry(0.18, 0.24, 2.3, 10),
            new THREE.MeshStandardMaterial({
                color: juiced ? 0x00f0ff : 0xff2200,
                emissive: juiced ? 0x00ff88 : 0xff6600,
                emissiveIntensity: 0.75
            })
        );
        body.rotation.x = Math.PI / 2;
        boltGroup.add(body);
    } else {
        const orb = new THREE.Mesh(
            new THREE.SphereGeometry(0.52, 12, 12),
            new THREE.MeshBasicMaterial({ color: wSpec.color || 0x00f0ff })
        );
        boltGroup.add(orb);
    }

    const projSpeed = juiced ? wSpec.speed * 1.24 : wSpec.speed;
    const startX = px + Math.sin(pAngle) * 2.8;
    const startZ = pz + Math.cos(pAngle) * 2.8;
    boltGroup.position.set(startX, py, startZ);
    boltGroup.rotation.y = pAngle;

    const velocity = new THREE.Vector3(Math.sin(pAngle) * projSpeed, 0, Math.cos(pAngle) * projSpeed);
    scene.add(boltGroup);

    projectiles.push({
        mesh: boltGroup,
        velocity,
        angle: pAngle,
        speed: projSpeed,
        life: juiced ? 90 : 75,
        owner: ownerId,
        team: ownerTeam,
        weaponType,
        isJuiced: juiced,
        homing: Boolean(wSpec.homing),
        homingRate: juiced ? 0.15 : 0.09,
        damage: Math.round(wSpec.damage * dmgMult),
        isCrit: true
    });
}

// ============================================================================
// PARTICLE VFX, 3-STAGE DRIFT EXHAUST COLORS & FLOATING NAMEPLATES
// ============================================================================
function spawnSkidMark(px, pz, pAngle, isBoosting) {
    if (!scene) return;
    const markColor = driftStage === 3 ? 0xff2200 : (driftStage === 2 ? 0xffdd00 : (isBoosting ? 0xff5500 : 0x00ff88));
    const markGeo = new THREE.PlaneGeometry(0.26, 0.8);
    const markMat = new THREE.MeshBasicMaterial({
        color: markColor,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.55
    });

    [-1.1, 1.1].forEach(wheelOffset => {
        const mark = new THREE.Mesh(markGeo, markMat.clone());
        const wx = px - Math.sin(pAngle) * 1.3 + Math.cos(pAngle) * wheelOffset;
        const wz = pz - Math.cos(pAngle) * 1.3 - Math.sin(pAngle) * wheelOffset;
        mark.position.set(wx, 0.05, wz);
        mark.rotation.x = -Math.PI / 2;
        mark.rotation.z = -pAngle;
        scene.add(mark);
        skidMarks.push({ mesh: mark, life: 60 });
    });
}

function spawnExhaustParticles(px, py, pz, pAngle, isBoost, isDrift, currentDriftStage = 0) {
    if (!scene || (Math.abs(speed) < 0.05 && !isBoost)) return;
    const isBigFlame = isBoost || currentDriftStage >= 2;
    const pGeo = new THREE.SphereGeometry(isBigFlame ? 0.25 : 0.13, 6, 6);

    // 3-Stage Drift Exhaust Colors: Stage 1 Green -> Stage 2 Yellow -> Stage 3 Fiery Red!
    let color = 0x00f0ff;
    if (isDrift) {
        if (currentDriftStage === 3) color = 0xff2200;
        else if (currentDriftStage === 2) color = 0xffdd00;
        else color = 0x00ff88;
    } else if (isBoost) {
        color = sacredFireActive ? 0x00ffff : 0xffaa00;
    }

    const pMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 });
    const pMesh = new THREE.Mesh(pGeo, pMat);

    const exX = px - Math.sin(pAngle) * 2.4;
    const exZ = pz - Math.cos(pAngle) * 2.4;
    pMesh.position.set(exX + (Math.random() - 0.5) * 0.4, py + 0.38, exZ + (Math.random() - 0.5) * 0.4);

    const vel = new THREE.Vector3(
        -Math.sin(pAngle) * (isBigFlame ? 0.28 : 0.12),
        Math.random() * 0.05,
        -Math.cos(pAngle) * (isBigFlame ? 0.28 : 0.12)
    );
    scene.add(pMesh);
    particles.push({ mesh: pMesh, velocity: vel, life: isBigFlame ? 15 : 10 });
}

function spawnExplosionVFX(pos, colorHex = 0xff5500, count = 16, isKill = false, doubleShockwave = false) {
    if (!scene || !pos) return;
    for (let i = 0; i < count; i++) {
        const pGeo = new THREE.SphereGeometry(isKill ? 0.26 : 0.16, 6, 6);
        const pMat = new THREE.MeshBasicMaterial({
            color: i % 2 === 0 ? colorHex : 0xffdd00,
            transparent: true,
            opacity: 1.0
        });
        const pMesh = new THREE.Mesh(pGeo, pMat);
        pMesh.position.copy(pos);

        const speedScale = isKill ? 0.55 : 0.32;
        const vel = new THREE.Vector3(
            (Math.random() - 0.5) * speedScale * 2,
            Math.random() * speedScale * 1.3 + 0.06,
            (Math.random() - 0.5) * speedScale * 2
        );

        scene.add(pMesh);
        particles.push({ mesh: pMesh, velocity: vel, life: isKill ? 28 : 16, gravity: 0.012 });
    }

    const ringGeo = new THREE.RingGeometry(0.4, doubleShockwave ? 1.4 : 0.85, 24);
    const ringMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.set(pos.x, Math.max(0.15, pos.y), pos.z);
    ring.rotation.x = -Math.PI / 2;
    scene.add(ring);
    shockwaves.push({ mesh: ring, scaleRate: doubleShockwave ? 1.42 : (isKill ? 1.22 : 1.15), life: 16 });
}

function spawnFloatingText(worldPos, textStr, styleClass = 'normal') {
    const container = document.getElementById("floating-damage-container");
    if (!container || !camera || !worldPos) return;

    const proj = worldPos.clone();
    proj.project(camera);
    if (proj.z > 1) return;

    const screenX = (proj.x * 0.5 + 0.5) * window.innerWidth;
    const screenY = (-(proj.y * 0.5) + 0.5) * window.innerHeight;

    const el = document.createElement("div");
    el.className = `floating-dmg ${styleClass}`;
    el.style.left = `${screenX}px`;
    el.style.top = `${screenY}px`;
    el.innerText = textStr;

    container.appendChild(el);
    setTimeout(() => {
        if (el.parentNode) el.parentNode.removeChild(el);
    }, 900);
}

function updateFloatingNameplates() {
    const container = document.getElementById("nameplates-container");
    if (!container || !camera) return;

    const activeTargets = [];

    Object.values(otherPlayers).forEach(op => {
        if (op && op.mesh && op.mesh.visible) {
            activeTargets.push({
                key: `np_p_${op.id}`,
                name: op.name || "متسابق",
                hpPct: Math.max(0, Math.min(100, op.health || 100)),
                isEnemy: localTeam === 'ffa' || op.team !== localTeam,
                pos: new THREE.Vector3(op.x, (op.y || 0) + 2.65, op.z)
            });
        }
    });

    aiBots.forEach((bot, idx) => {
        if (bot && bot.mesh && bot.mesh.visible && bot.health > 0) {
            activeTargets.push({
                key: `np_b_${idx}`,
                name: bot.name,
                hpPct: Math.max(0, Math.min(100, Math.round((bot.health / bot.maxHealth) * 100))),
                isEnemy: localTeam === 'ffa' || bot.team !== localTeam,
                pos: new THREE.Vector3(bot.x, (bot.y || 0) + 2.65, bot.z)
            });
        }
    });

    const seenKeys = new Set();
    activeTargets.forEach(t => {
        seenKeys.add(t.key);
        const proj = t.pos.clone().project(camera);
        let el = document.getElementById(t.key);

        if (proj.z > 1 || proj.z < -1) {
            if (el) el.style.display = "none";
            return;
        }

        const sx = (proj.x * 0.5 + 0.5) * window.innerWidth;
        const sy = (-(proj.y * 0.5) + 0.5) * window.innerHeight;

        if (!el) {
            el = document.createElement("div");
            el.id = t.key;
            el.className = `player-nameplate ${t.isEnemy ? 'enemy-plate' : ''}`;
            el.innerHTML = `<div class="np-name"></div><div class="np-hp-track"><div class="np-hp-fill"></div></div>`;
            container.appendChild(el);
        }

        el.style.display = "block";
        el.style.left = `${sx}px`;
        el.style.top = `${sy}px`;
        el.querySelector('.np-name').innerText = t.name;
        el.querySelector('.np-hp-fill').style.width = `${t.hpPct}%`;
    });

    Array.from(container.children).forEach(child => {
        if (!seenKeys.has(child.id)) {
            container.removeChild(child);
        }
    });
}

// ============================================================================
// DAMAGE, STICKY 3s TNT HEAD COUNTDOWN & AKU-AKU INVINCIBILITY
// ============================================================================
function attachStickyTNTToPlayer(attackerName) {
    if (Date.now() < akuMaskUntil) {
        spawnFloatingText(new THREE.Vector3(x, y + 2.4, z), "🛡️ القناع صد صندوق TNT!", "shield");
        return;
    }
    if (tntStickyUntil > Date.now()) return;

    tntStickyUntil = Date.now() + 3000;
    tntStickyAttacker = attackerName || "فخ TNT";
    tntShakeHopsRemaining = 3;
    if (playerTntHeadMesh) playerTntHeadMesh.visible = true;

    const warnEl = document.getElementById("tnt-head-warning");
    if (warnEl) warnEl.style.display = "block";
    SoundEngine.playBeep(760);
    spawnFloatingText(new THREE.Vector3(x, y + 2.6, z), "🧨 صندوق TNT فوق رأسك! اقفز/دريفت 3 مرات!", "crit");
}

function tryShakeOffStickyTNT() {
    if (tntStickyUntil <= Date.now()) return;
    yVelocity = Math.max(yVelocity, 0.24);
    tntShakeHopsRemaining--;
    SoundEngine.playBeep(900);

    if (tntShakeHopsRemaining <= 0) {
        tntStickyUntil = 0;
        if (playerTntHeadMesh) playerTntHeadMesh.visible = false;
        const warnEl = document.getElementById("tnt-head-warning");
        if (warnEl) warnEl.style.display = "none";
        spawnFloatingText(new THREE.Vector3(x, y + 2.5, z), "✅ تخلصت من صندوق الـ TNT!", "shield");
    } else {
        spawnFloatingText(new THREE.Vector3(x, y + 2.3, z), `🔄 باقي ${tntShakeHopsRemaining} قفزات!`, "normal");
    }
}

function updateCenterKillsDeathsBadge() {
    if (gameMode === 'race') return;
    const mb = document.getElementById("mode-hud-badge");
    if (mb) {
        mb.innerText = `⚔️${kills} 💀${deaths}`;
    }
}

function damageBot(bot, dmg, attackerId, isCrit = false, doubleShockwave = false) {
    if (!bot) return;
    if (bot.shield > 0) {
        const abs = Math.min(bot.shield, dmg);
        bot.shield -= abs;
        dmg -= abs;
    }
    bot.health -= dmg;
    bot.speed *= 0.25;

    SoundEngine.playExplosion(bot.health <= 0);
    if (bot.mesh) {
        spawnExplosionVFX(bot.mesh.position, 0xffaa00, bot.health <= 0 ? 22 : 12, bot.health <= 0, doubleShockwave);
    }

    const myId = socket && socket.id ? socket.id : 'player';
    if (attackerId === 'player' || attackerId === myId || attackerId === localPlayerName) {
        spawnFloatingText(
            new THREE.Vector3(bot.x, 2.2, bot.z),
            isCrit ? `💥 -${dmg}` : `-${dmg}`,
            isCrit ? 'crit' : 'normal'
        );
    }

    if (bot.health <= 0) {
        bot.deaths = (bot.deaths || 0) + 1;
        deathScores[bot.name] = bot.deaths;

        const killerLabel = (attackerId === 'player' || attackerId === myId) ? localPlayerName : attackerId;
        if (killerLabel === localPlayerName) {
            kills++;
            killScores[localPlayerName] = kills;
            updateCenterKillsDeathsBadge();
        } else if (killScores[killerLabel] !== undefined) {
            killScores[killerLabel]++;
        }

        if (bot.team === 'red') teamScores.blue++;
        else if (bot.team === 'blue') teamScores.red++;

        updateTeamScoreboardUI();
        addKillFeedNotification(killerLabel, bot.name);
        updateLiveLeaderboard();

        if (gameMode === 'race') {
            bot.health = bot.maxHealth;
            bot.speed = 0;
            bot.empSlowUntil = Date.now() + 1400;
        } else if (bot.mesh) {
            bot.mesh.visible = false;
            setTimeout(() => {
                bot.health = bot.maxHealth;
                bot.shield = 40;
                bot.x = (Math.random() - 0.5) * 60;
                bot.z = (Math.random() - 0.5) * 60;
                if (bot.mesh) bot.mesh.visible = true;
            }, 2800);
        }
    }
}

function applyLocalDamage(damageAmount, attackerName, isCrit = false) {
    if (Date.now() < akuMaskUntil) {
        spawnFloatingText(new THREE.Vector3(x, y + 2.4, z), "👑 محصن بقناع كراش!", "shield");
        return;
    }

    let rem = damageAmount;
    if (shield > 0) {
        const absorbed = Math.min(shield, rem);
        shield -= absorbed;
        rem -= absorbed;
    }
    if (rem > 0) {
        health = Math.max(0, health - rem);
    }

    // Lose 2 Wumpa fruits when hit heavily
    if (wumpaCount > 0) {
        wumpaCount = Math.max(0, wumpaCount - 2);
        isJuicedUp = wumpaCount >= 10;
        updateWumpaHUD();
    }

    sacredFireActive = false;
    speed *= 0.35;
    yVelocity = Math.max(yVelocity, 0.28);

    SoundEngine.playExplosion(health <= 0);
    window.NetworkConfig.triggerHaptic(150, 240);

    const flashEl = document.getElementById("damage-flash");
    if (flashEl) {
        flashEl.style.opacity = "1";
        setTimeout(() => { flashEl.style.opacity = "0"; }, 160);
    }

    spawnFloatingText(
        new THREE.Vector3(x, y + 2.2, z),
        isCrit ? `💥 -${damageAmount}` : `-${damageAmount}`,
        isCrit ? 'crit' : 'normal'
    );
    updateVitalsHUD();

    if (health <= 0) {
        deaths++;
        deathScores[localPlayerName] = deaths;
        updateCenterKillsDeathsBadge();

        spawnExplosionVFX(new THREE.Vector3(x, y + 1.0, z), 0xff5500, 24, true);
        if (attackerName && killScores[attackerName] !== undefined) {
            killScores[attackerName]++;
        }
        if (localTeam === 'blue') teamScores.red++;
        else if (localTeam === 'red') teamScores.blue++;

        updateTeamScoreboardUI();
        if (attackerName) {
            addKillFeedNotification(attackerName, localPlayerName);
        }
        updateLiveLeaderboard();

        if (gameMode === 'race') {
            x = getTrackCenterX(z);
            angle = getTrackTangentAngle(z);
        } else if (localTeam === 'blue') {
            x = (Math.random() - 0.5) * 40;
            z = -65;
            angle = 0;
        } else {
            x = (Math.random() - 0.5) * 65;
            z = (Math.random() - 0.5) * 65;
        }
        y = 0;
        speed = 0;
        health = maxHealth;
        shield = 50;
        updateVitalsHUD();
    }
}

function updateTeamScoreboardUI() {
    const bEl = document.getElementById("score-blue");
    const rEl = document.getElementById("score-red");
    if (bEl) bEl.innerText = teamScores.blue;
    if (rEl) rEl.innerText = teamScores.red;
}

// ============================================================================
// LEVEL 2 SMART AI BOTS (LATERAL OFFSET, MINE DODGING, SHORTCUTS & RUBBER-BANDING)
// ============================================================================
function spawnAIBotsForMode() {
    if (!scene) return;
    aiBots = [];
    killScores[localPlayerName] = kills;
    deathScores[localPlayerName] = deaths;

    if (!isOfflineMode && lobbyOption === 'online' && fillBotsOption === 'none') {
        updateLiveLeaderboard();
        return;
    }

    const wheelStyles = ['standard', 'monster', 'hexa', 'cyber_glow'];
    const spoilerStyles = ['gt_wing', 'twin_fin', 'heavy_rack'];

    const onlineTeammates = Object.values(otherPlayers).filter(p => p && p.team === localTeam && localTeam !== 'ffa').length;
    const onlineEnemies = Object.values(otherPlayers).filter(p => p && (p.team !== localTeam || localTeam === 'ffa')).length;

    let botDefinitions = [];
    if (gameMode === '2v2' || gameMode === '3v3' || gameMode === '4v4') {
        const teamSize = gameMode === '2v2' ? 2 : (gameMode === '3v3' ? 3 : 4);
        const myTeamNeeded = Math.max(0, (teamSize - 1) - onlineTeammates);
        const enemyTeamNeeded = Math.max(0, teamSize - onlineEnemies);
        const enemyTeamColor = localTeam === 'blue' ? 'red' : 'blue';

        for (let i = 0; i < myTeamNeeded; i++) {
            botDefinitions.push({
                name: `حليف_${i + 1} 🤖`,
                team: localTeam,
                skin: i % 2 === 0 ? 'bruiser' : 'phantom',
                color: localTeam === 'blue' ? 0x00f0ff : 0xff2244
            });
        }
        for (let i = 0; i < enemyTeamNeeded; i++) {
            botDefinitions.push({
                name: `خصم_${i + 1} 🤖`,
                team: enemyTeamColor,
                skin: i % 2 === 0 ? 'enforcer' : 'hypercar',
                color: enemyTeamColor === 'red' ? 0xff1133 : 0x00f0ff
            });
        }
    } else {
        const needed = Math.max(0, 3 - onlineEnemies);
        const ffaPresets = [
            { name: 'كورتكس 🤖', team: 'ffa', skin: 'enforcer', color: 0xff1133 },
            { name: 'كوكو 🤖', team: 'ffa', skin: 'hypercar', color: 0x00f0ff },
            { name: 'تايني 🤖', team: 'ffa', skin: 'bruiser', color: 0xff8800 }
        ];
        botDefinitions = ffaPresets.slice(0, needed);
    }

    botDefinitions.forEach((def, idx) => {
        killScores[def.name] = 0;
        deathScores[def.name] = 0;

        const botBuild = createVehicleMesh({
            skin: def.skin,
            paintColor: def.color,
            wheelStyle: wheelStyles[idx % wheelStyles.length],
            spoilerStyle: spoilerStyles[idx % spoilerStyles.length],
            team: def.team,
            isLocalPlayer: false
        });

        // Distinct lateral offset per bot so bots never stack on top of each other!
        const lateralOffset = ((idx - 1) * 6.2) + ((Math.random() - 0.5) * 1.8);

        let bx = 0, bz = 0, bAngle = 0;
        if (gameMode === 'race') {
            bx = lateralOffset;
            bz = 8;
            bAngle = 0;
        } else if (def.team === 'blue') {
            bx = (idx + 1) * 14 - 20;
            bz = -65;
            bAngle = 0;
        } else if (def.team === 'red') {
            bx = (idx - 1) * 14;
            bz = 65;
            bAngle = Math.PI;
        } else {
            bx = (idx - 1) * 26;
            bz = idx % 2 === 0 ? 55 : -55;
            bAngle = Math.random() * Math.PI * 2;
        }

        botBuild.group.position.set(bx, 0, bz);
        botBuild.group.rotation.y = bAngle;
        scene.add(botBuild.group);

        const skinSpec = CAR_SKINS[def.skin] || CAR_SKINS.interceptor;
        const maxHp = 100 + skinSpec.armorBonus;
        aiBots.push({
            mesh: botBuild.group,
            wheels: botBuild.wheels,
            skin: def.skin,
            team: def.team,
            x: bx,
            y: 0,
            z: bz,
            vx: 0,
            vz: 0,
            angle: bAngle,
            speed: 0.45,
            lap: 1,
            lateralOffset,
            autoTurboUntil: 0,
            heldWeapon: null,
            health: maxHp,
            maxHealth: maxHp,
            shield: 40,
            deaths: 0,
            empSlowUntil: 0,
            lastShoot: 0,
            name: def.name
        });
    });

    updateLiveLeaderboard();
}

function updateAIBots(dt = 1) {
    if (!Array.isArray(aiBots) || aiBots.length === 0) return;
    const now = Date.now();
    const diffProfile = AI_DIFFICULTY_PROFILES[botDifficulty] || AI_DIFFICULTY_PROFILES.medium;
    const playerTotalProgress = ((currentLap - 1) * LAP_LENGTH) + z;

    aiBots.forEach((bot, botIdx) => {
        if (!bot || bot.health <= 0 || !bot.mesh) return;

        const skinSpec = CAR_SKINS[bot.skin] || CAR_SKINS.interceptor;
        const isEmpSlowed = now < (bot.empSlowUntil || 0);
        const isBotTurbo = now < (bot.autoTurboUntil || 0);
        let baseSpeed = BASE_MAX_SPEED * skinSpec.maxSpeedMult * diffProfile.speedMult * (isEmpSlowed ? 0.45 : 1.0);

        // Rubber-Banding in Race Mode to keep races competitive and exciting!
        if (gameMode === 'race') {
            const botTotalProgress = ((bot.lap - 1) * LAP_LENGTH) + bot.z;
            const gap = playerTotalProgress - botTotalProgress;
            if (gap > 90) {
                baseSpeed *= (1 + Math.min(0.18, (gap / 500) * diffProfile.rubberBandStrength * 2));
            } else if (gap < -120) {
                baseSpeed *= 0.93;
            }
        }

        if (Array.isArray(boostPads)) {
            boostPads.forEach(bp => {
                if (bp && Math.hypot(bot.x - bp.x, bot.z - bp.z) < bp.radius) {
                    bot.autoTurboUntil = now + 3000;
                }
            });
        }

        if (Array.isArray(powerUpItems)) {
            powerUpItems.forEach(pu => {
                if (pu && pu.active && Math.hypot(bot.x - pu.x, bot.z - pu.z) < 2.9) {
                    pu.active = false;
                    if (pu.mesh) pu.mesh.visible = false;
                    if (pu.type === 'crate') {
                        bot.heldWeapon = WEAPON_ORDER[Math.floor(Math.random() * 3)];
                    } else if (pu.type === 'nitro') {
                        bot.autoTurboUntil = now + AUTO_TURBO_DURATION;
                    }
                    setTimeout(() => {
                        pu.active = true;
                        if (pu.mesh) pu.mesh.visible = true;
                    }, 6500);
                }
            });
        }

        if (gameMode === 'race') {
            const lookAheadZ = bot.z + 32;
            let targetX = getTrackCenterX(lookAheadZ) + (bot.lateralOffset || ((botIdx - 1) * 5.5));

            // Hard AI takes Secret Shortcuts!
            if (diffProfile.useShortcuts && Array.isArray(shortcutZones)) {
                shortcutZones.forEach(sc => {
                    if (bot.z >= sc.minZ - 35 && bot.z <= sc.maxZ) {
                        targetX = sc.centerX;
                    }
                });
            }

            // Smart Mine & Obstacle Avoidance
            if (diffProfile.avoidMines && Array.isArray(landminesList)) {
                landminesList.forEach(m => {
                    if (m && m.z > bot.z && m.z - bot.z < 24 && Math.abs(m.x - targetX) < 4.2) {
                        targetX += (m.x >= 0 ? -5.5 : 5.5);
                    }
                });
            }

            const dx = targetX - bot.x;
            const dz = lookAheadZ - bot.z;
            const targetAngle = Math.atan2(dx, dz);

            bot.angle = lerpAngleShortest(bot.angle, targetAngle, diffProfile.turnRate);
            const curBotSpeed = (isBotTurbo ? baseSpeed * 1.32 : baseSpeed) * dt;

            bot.vx = Math.sin(bot.angle) * curBotSpeed;
            bot.vz = Math.cos(bot.angle) * curBotSpeed;
            bot.x += bot.vx;
            bot.z += bot.vz;

            if (isBotTurbo) {
                spawnExhaustParticles(bot.x, 0, bot.z, bot.angle, true, false, 2);
            }

            if (bot.heldWeapon && z > bot.z && (z - bot.z) < 55 && (now - bot.lastShoot > diffProfile.shootInterval)) {
                bot.lastShoot = now;
                if (bot.heldWeapon === 'tnt') {
                    deployLandmine(bot.x, bot.z - 3.0, bot.name, bot.name, bot.team);
                } else {
                    const aimToPlayer = Math.atan2(x - bot.x, z - bot.z);
                    spawnProjectile(bot.x, 1.1, bot.z, aimToPlayer, bot.name, bot.team, bot.heldWeapon, 1.0, false);
                }
                bot.heldWeapon = null;
            }

            if (bot.z >= LAP_LENGTH && !raceFinished) {
                if (bot.lap < TOTAL_LAPS) {
                    bot.lap++;
                    bot.z -= LAP_LENGTH;
                } else {
                    raceFinished = true;
                    endMatchAndShowLeaderboard(bot.name);
                }
            }
        } else {
            let nearestEnemy = null;
            let minDist = Infinity;

            if (bot.team === 'ffa' || bot.team !== localTeam) {
                const dPlayer = Math.hypot(x - bot.x, z - bot.z);
                minDist = dPlayer;
                nearestEnemy = { x, z, vx, vz, name: localPlayerName };
            }

            aiBots.forEach(otherBot => {
                if (otherBot && otherBot !== bot && otherBot.health > 0) {
                    if (bot.team === 'ffa' || bot.team !== otherBot.team) {
                        const d = Math.hypot(otherBot.x - bot.x, otherBot.z - bot.z);
                        if (d < minDist) {
                            minDist = d;
                            nearestEnemy = otherBot;
                        }
                    }
                }
            });

            if (!nearestEnemy) return;

            let goalX = nearestEnemy.x + (bot.lateralOffset || 0) * 0.5;
            let goalZ = nearestEnemy.z;

            if (!bot.heldWeapon && Array.isArray(powerUpItems)) {
                let bestCrate = null;
                let bestDist = 60;
                powerUpItems.forEach(pu => {
                    if (pu && pu.active && pu.type === 'crate') {
                        const d = Math.hypot(pu.x - bot.x, pu.z - bot.z);
                        if (d < bestDist) {
                            bestDist = d;
                            bestCrate = pu;
                        }
                    }
                });
                if (bestCrate) {
                    goalX = bestCrate.x;
                    goalZ = bestCrate.z;
                }
            }

            const moveAngle = Math.atan2(goalX - bot.x, goalZ - bot.z);
            const aimAngle = Math.atan2(nearestEnemy.x - bot.x, nearestEnemy.z - bot.z);

            bot.angle = lerpAngleShortest(bot.angle, moveAngle, diffProfile.turnRate);
            const curBotSpeed = (isBotTurbo ? baseSpeed * 1.32 : baseSpeed) * dt;

            bot.vx = Math.sin(bot.angle) * curBotSpeed;
            bot.vz = Math.cos(bot.angle) * curBotSpeed;
            bot.x = Math.max(-93, Math.min(93, bot.x + bot.vx));
            bot.z = Math.max(-93, Math.min(93, bot.z + bot.vz));

            resolveWarehouseWallCollision(bot);

            if (bot.heldWeapon && minDist < diffProfile.shootRange && (now - bot.lastShoot > diffProfile.shootInterval)) {
                bot.lastShoot = now;
                if (bot.heldWeapon === 'tnt') {
                    deployLandmine(bot.x - Math.sin(bot.angle) * 3.0, bot.z - Math.cos(bot.angle) * 3.0, bot.name, bot.name, bot.team);
                } else {
                    spawnProjectile(bot.x, 1.1, bot.z, aimAngle, bot.name, bot.team, bot.heldWeapon, 1.0, false);
                }
                bot.heldWeapon = null;
            }
        }

        bot.mesh.position.set(bot.x, 0, bot.z);
        bot.mesh.rotation.y = bot.angle;
        if (Array.isArray(bot.wheels)) {
            bot.wheels.forEach(w => { if (w) w.rotation.x += bot.speed * 0.75 * dt; });
        }
    });
}

function resolveWarehouseWallCollision(entity) {
    if (!entity || !Array.isArray(warehouseWalls)) return;
    const r = 1.65;
    warehouseWalls.forEach(w => {
        if (!w) return;
        const closestX = Math.max(w.minX, Math.min(entity.x, w.maxX));
        const closestZ = Math.max(w.minZ, Math.min(entity.z, w.maxZ));
        const dx = entity.x - closestX;
        const dz = entity.z - closestZ;
        const dist = Math.hypot(dx, dz);
        if (dist < r && dist > 0.0001) {
            entity.x = closestX + (dx / dist) * r;
            entity.z = closestZ + (dz / dist) * r;
            if (entity === playerVehicle) speed *= 0.6;
        }
    });
}

// ============================================================================
// P2 FIX: TRUE MULTI-TOUCH TRACKING BY TOUCH IDENTIFIER
// ============================================================================
function applyControlSchemeUI() {
    const mode = gameSettings.controlMode;
    const jZone = document.getElementById("joystick-zone");
    const sZone = document.getElementById("steering-zone");
    const gZone = document.getElementById("gyro-zone");

    if (jZone) jZone.style.display = mode === 'joystick' ? 'flex' : 'none';
    if (sZone) sZone.style.display = mode === 'steering' ? 'flex' : 'none';
    if (gZone) gZone.style.display = mode === 'gyro' ? 'block' : 'none';

    if (mode === 'gyro') {
        requestGyroPermission();
    }
}

function requestGyroPermission() {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission().catch(() => {});
    }
}

function checkStartingBoostTrigger() {
    if (startingBoostWindowActive && !startingBoostClaimed) {
        startingBoostClaimed = true;
        triggerAutoTurbo(3200, true);
        spawnFloatingText(new THREE.Vector3(x, y + 2.5, z), "🚀 انطلاقة صاروخية مثالية!", "crit");
    }
}

let controlsInitialized = false;
function setupControls() {
    if (controlsInitialized) return;
    controlsInitialized = true;

    window.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
            keys.forward = true;
            checkStartingBoostTrigger();
        }
        if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') keys.backward = true;
        if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = true;
        if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = true;
        if (e.key === 'Shift') {
            if (!keys.drift) tryShakeOffStickyTNT();
            keys.drift = true;
        }
        if (e.code === 'Space' || e.key === 'f' || e.key === 'F' || e.key === 'Enter') {
            if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
            e.preventDefault();
            tryShakeOffStickyTNT();
            keys.shoot = true;
            shootWeapon('player');
        }
        if (e.key === 'q' || e.key === 'Q' || e.key === 'e' || e.key === 'E') cycleNextWeapon();
    });

    window.addEventListener('keyup', (e) => {
        if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') keys.forward = false;
        if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') keys.backward = false;
        if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = false;
        if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = false;
        if (e.key === 'Shift') keys.drift = false;
        if (e.code === 'Space' || e.key === 'f' || e.key === 'F' || e.key === 'Enter') keys.shoot = false;
    });

    const joyZone = document.getElementById("joystick-zone");
    const joyBase = document.getElementById("joystick-base");
    const joyStick = document.getElementById("joystick-stick");
    let joyTouchId = null;
    const maxRadius = 42;

    function updateJoystickVisual(clientX, clientY) {
        if (!joyBase || !joyStick) return;
        const rect = joyBase.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        let dx = clientX - centerX;
        let dy = clientY - centerY;
        const dist = Math.hypot(dx, dy);
        if (dist > maxRadius) {
            dx = (dx / dist) * maxRadius;
            dy = (dy / dist) * maxRadius;
        }
        joyStick.style.transform = `translate(${dx}px, ${dy}px)`;
        joyX = dx / maxRadius;
        joyY = -(dy / maxRadius);
        if (joyY > 0.25) checkStartingBoostTrigger();
    }

    function resetJoystick() {
        joyTouchId = null;
        joyX = 0;
        joyY = 0;
        if (joyStick) joyStick.style.transform = `translate(0px, 0px)`;
    }

    if (joyZone) {
        joyZone.addEventListener('touchstart', (e) => {
            e.preventDefault();
            initWebAudio();
            if (joyTouchId === null && e.changedTouches.length > 0) {
                const t = e.changedTouches[0];
                joyTouchId = t.identifier;
                updateJoystickVisual(t.clientX, t.clientY);
            }
        }, { passive: false });

        joyZone.addEventListener('touchmove', (e) => {
            e.preventDefault();
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === joyTouchId) {
                    updateJoystickVisual(e.changedTouches[i].clientX, e.changedTouches[i].clientY);
                    break;
                }
            }
        }, { passive: false });

        const endJoy = (e) => {
            e.preventDefault();
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === joyTouchId) {
                    resetJoystick();
                    break;
                }
            }
        };
        joyZone.addEventListener('touchend', endJoy, { passive: false });
        joyZone.addEventListener('touchcancel', endJoy, { passive: false });
    }

    const steerZone = document.getElementById("steering-zone");
    const wheelEl = document.getElementById("steering-wheel-el");
    let steerTouchId = null;

    function updateSteeringWheel(clientX) {
        if (!wheelEl) return;
        const rect = wheelEl.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const normX = Math.max(-1, Math.min(1, (clientX - centerX) / (rect.width * 0.48)));
        wheelSteerInput = normX;
        wheelTouchActive = true;
        checkStartingBoostTrigger();
        const deg = Math.round(normX * 115);
        wheelEl.style.transform = `rotate(${deg}deg)`;
    }

    function resetSteeringWheel() {
        steerTouchId = null;
        wheelSteerInput = 0;
        wheelTouchActive = false;
        if (wheelEl) wheelEl.style.transform = `rotate(0deg)`;
    }

    if (steerZone) {
        steerZone.addEventListener('touchstart', (e) => {
            e.preventDefault();
            initWebAudio();
            if (steerTouchId === null && e.changedTouches.length > 0) {
                const t = e.changedTouches[0];
                steerTouchId = t.identifier;
                updateSteeringWheel(t.clientX);
            }
        }, { passive: false });

        steerZone.addEventListener('touchmove', (e) => {
            e.preventDefault();
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === steerTouchId) {
                    updateSteeringWheel(e.changedTouches[i].clientX);
                    break;
                }
            }
        }, { passive: false });

        const endSteer = (e) => {
            e.preventDefault();
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === steerTouchId) {
                    resetSteeringWheel();
                    break;
                }
            }
        };
        steerZone.addEventListener('touchend', endSteer, { passive: false });
        steerZone.addEventListener('touchcancel', endSteer, { passive: false });
    }

    window.addEventListener('deviceorientation', (e) => {
        if (gameSettings.controlMode !== 'gyro') return;
        const orient = window.screen && window.screen.orientation ? window.screen.orientation.angle : window.orientation;
        let tiltDeg = 0;
        if (orient === 90) tiltDeg = e.beta || 0;
        else if (orient === -90 || orient === 270) tiltDeg = -(e.beta || 0);
        else tiltDeg = e.gamma || 0;

        lastRawGyroAngle = tiltDeg;
        const calibrated = tiltDeg - gyroZeroOffset;
        gyroSteerInput = Math.max(-1, Math.min(1, calibrated / 28));

        const bubble = document.getElementById("gyro-bubble");
        if (bubble) bubble.style.left = `calc(${50 + gyroSteerInput * 38}% - 10px)`;
    });

    const calBtn = document.getElementById("btn-calibrate-gyro");
    if (calBtn) {
        calBtn.addEventListener('click', () => {
            gyroZeroOffset = lastRawGyroAngle;
            SoundEngine.playBeep(880);
        });
    }

    bindMultiTouchHoldButton('btn-drift', (active) => {
        if (active && !keys.drift) tryShakeOffStickyTNT();
        keys.drift = active;
    });
    bindMultiTouchHoldButton('btn-shoot', (active) => {
        keys.shoot = active;
        if (active) {
            tryShakeOffStickyTNT();
            checkStartingBoostTrigger();
            shootWeapon('player');
        }
    });

    const weaponBtn = document.getElementById('btn-weapon-wheel');
    const holdRing = document.getElementById('weapon-hold-ring');
    let holdCycleInterval = null;
    let holdProgressInterval = null;
    let holdProgress = 0;
    let weaponTouchId = null;

    function startWeaponHold(e) {
        e.preventDefault();
        initWebAudio();
        if (e.changedTouches && e.changedTouches.length > 0 && weaponTouchId === null) {
            weaponTouchId = e.changedTouches[0].identifier;
        }
        weaponBtn.classList.add('active');
        cycleNextWeapon();
        holdProgress = 0;

        if (holdProgressInterval) clearInterval(holdProgressInterval);
        holdProgressInterval = setInterval(() => {
            holdProgress += 20;
            const ratio = (holdProgress % 420) / 420;
            if (holdRing) {
                holdRing.style.strokeDashoffset = String(Math.round(182 * (1 - ratio)));
            }
        }, 20);

        if (holdCycleInterval) clearInterval(holdCycleInterval);
        holdCycleInterval = setInterval(() => {
            cycleNextWeapon();
        }, 420);
    }

    function stopWeaponHold(e) {
        if (e) e.preventDefault();
        if (e && e.changedTouches && weaponTouchId !== null) {
            let matched = false;
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === weaponTouchId) {
                    matched = true;
                    break;
                }
            }
            if (!matched) return;
        }
        weaponTouchId = null;
        weaponBtn.classList.remove('active');
        if (holdCycleInterval) { clearInterval(holdCycleInterval); holdCycleInterval = null; }
        if (holdProgressInterval) { clearInterval(holdProgressInterval); holdProgressInterval = null; }
        if (holdRing) holdRing.style.strokeDashoffset = "182";
    }

    if (weaponBtn) {
        weaponBtn.addEventListener('touchstart', startWeaponHold, { passive: false });
        weaponBtn.addEventListener('touchend', stopWeaponHold, { passive: false });
        weaponBtn.addEventListener('touchcancel', stopWeaponHold, { passive: false });
        weaponBtn.addEventListener('mousedown', startWeaponHold);
        weaponBtn.addEventListener('mouseup', stopWeaponHold);
        weaponBtn.addEventListener('mouseleave', stopWeaponHold);
    }
}

// Multi-Touch Safe Hold Button Binder (Tracks exact touch.identifier per button)
function bindMultiTouchHoldButton(btnId, callback) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    const activeTouchIds = new Set();

    btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        initWebAudio();
        for (let i = 0; i < e.changedTouches.length; i++) {
            activeTouchIds.add(e.changedTouches[i].identifier);
        }
        btn.classList.add('active');
        window.NetworkConfig.triggerHaptic(20, 90);
        callback(true);
    }, { passive: false });

    const onTouchEnd = (e) => {
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
            activeTouchIds.delete(e.changedTouches[i].identifier);
        }
        if (activeTouchIds.size === 0) {
            btn.classList.remove('active');
            callback(false);
        }
    };

    btn.addEventListener('touchend', onTouchEnd, { passive: false });
    btn.addEventListener('touchcancel', onTouchEnd, { passive: false });

    btn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        initWebAudio();
        btn.classList.add('active');
        callback(true);
    });
    const onMouseUp = (e) => {
        if (e) e.preventDefault();
        if (activeTouchIds.size === 0) {
            btn.classList.remove('active');
            callback(false);
        }
    };
    btn.addEventListener('mouseup', onMouseUp);
    btn.addEventListener('mouseleave', onMouseUp);
}

// ============================================================================
// HUD, COMPACT RADAR & COLLAPSIBLE LEADERBOARD
// ============================================================================
function updateVitalsHUD() {
    const hpBar = document.getElementById("health-bar");
    if (hpBar) {
        const hpPct = Math.max(0, Math.min(100, Math.round((health / maxHealth) * 100)));
        hpBar.style.width = `${hpPct}%`;
        if (hpPct < 30) hpBar.style.background = "#ff0055";
        else if (hpPct < 60) hpBar.style.background = "#ffaa00";
        else hpBar.style.background = "linear-gradient(90deg, #00ff88, #00f0ff)";
    }

    const shBar = document.getElementById("shield-bar");
    if (shBar) {
        const shPct = Math.max(0, Math.min(100, Math.round((shield / maxShield) * 100)));
        shBar.style.width = `${shPct}%`;
    }

    const turboIcon = document.getElementById("turbo-active-icon");
    if (turboIcon) {
        turboIcon.style.display = Date.now() < autoTurboUntil ? "inline-block" : "none";
    }

    const buffBadge = document.getElementById("buff-badge");
    if (buffBadge) {
        buffBadge.style.display = Date.now() < damageBoostUntil ? "inline-block" : "none";
    }
}

function addKillFeedNotification(killerName, victimName) {
    const container = document.getElementById("kill-feed");
    if (!container) return;

    const item = document.createElement("div");
    item.className = "kill-feed-item";
    item.innerHTML = `💥 <b>${killerName}</b> ⬅️ <b>${victimName}</b>`;
    container.prepend(item);

    while (container.children.length > 2) {
        container.removeChild(container.lastChild);
    }

    setTimeout(() => {
        if (item.parentNode) item.parentNode.removeChild(item);
    }, 3000);
}

function updateLiveLeaderboard() {
    const container = document.getElementById("live-lb-rows");
    if (!container) return;

    const entries = Object.keys(killScores)
        .map(name => ({
            name,
            kills: killScores[name] || 0,
            deaths: deathScores[name] || 0
        }))
        .sort((a, b) => b.kills - a.kills || a.deaths - b.deaths)
        .slice(0, 4);

    container.innerHTML = entries.map((e, i) => {
        const isMe = e.name === localPlayerName;
        const badge = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "•";
        return `<div class="lb-row ${isMe ? 'is-me' : ''}">
            <span>${badge} ${e.name}</span>
            <span class="ltr-text">${e.kills}⚔️/${e.deaths}💀</span>
        </div>`;
    }).join("");
}

function updateMinimap() {
    const canvas = document.getElementById("minimap-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;

    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = "rgba(8, 12, 26, 0.85)";
    ctx.beginPath();
    ctx.arc(cx, cy, w / 2 - 2, 0, Math.PI * 2);
    ctx.fill();

    if (gameMode === 'race') {
        // Draw Winding Track Spline on 2D Minimap
        ctx.strokeStyle = "rgba(255, 170, 0, 0.38)";
        ctx.lineWidth = 6;
        ctx.beginPath();
        for (let py = 10; py <= h - 10; py += 4) {
            const ratio = 1 - (py - 10) / (h - 20);
            const zSample = ratio * LAP_LENGTH;
            const curveX = cx + (getTrackCenterX(zSample) / 35) * 14;
            if (py === 10) ctx.moveTo(curveX, py);
            else ctx.lineTo(curveX, py);
        }
        ctx.stroke();

        // Draw Yellow Dots for Active Mystery Crates on Track
        powerUpItems.forEach(pu => {
            if (pu && pu.active) {
                const puRatio = 1 - Math.max(0, Math.min(1, pu.z / LAP_LENGTH));
                const py = 10 + puRatio * (h - 20);
                ctx.fillStyle = "#ffdd00";
                ctx.beginPath();
                ctx.arc(cx + (pu.x / 35) * 14, py, 1.5, 0, Math.PI * 2);
                ctx.fill();
            }
        });

        const totalTrackDist = LAP_LENGTH * TOTAL_LAPS;
        aiBots.forEach(bot => {
            if (!bot) return;
            const botTotalZ = ((bot.lap - 1) * LAP_LENGTH) + bot.z;
            const bz = 1 - Math.max(0, Math.min(1, botTotalZ / totalTrackDist));
            const py = 10 + bz * (h - 20);
            ctx.fillStyle = "#ff3366";
            ctx.beginPath();
            ctx.arc(cx + (bot.x / 35) * 14, py, 2.6, 0, Math.PI * 2);
            ctx.fill();
        });

        const playerTotalZ = ((currentLap - 1) * LAP_LENGTH) + z;
        const pzRatio = 1 - Math.max(0, Math.min(1, playerTotalZ / totalTrackDist));
        const playerPy = 10 + pzRatio * (h - 20);
        ctx.fillStyle = "#00ff88";
        ctx.beginPath();
        ctx.arc(cx + (x / 35) * 14, playerPy, 3.3, 0, Math.PI * 2);
        ctx.fill();
        return;
    }

    const scale = (w / 2 - 6) / 100;

    powerUpItems.forEach(pu => {
        if (pu && pu.active) {
            ctx.fillStyle = pu.type === 'crate' ? "#ffdd00" : "#00ff88";
            ctx.beginPath();
            ctx.arc(cx + pu.x * scale, cy + pu.z * scale, 1.8, 0, Math.PI * 2);
            ctx.fill();
        }
    });

    aiBots.forEach(bot => {
        if (bot && bot.health > 0) {
            ctx.fillStyle = bot.team === 'blue' ? "#00f0ff" : "#ff3366";
            ctx.beginPath();
            ctx.arc(cx + bot.x * scale, cy + bot.z * scale, 2.5, 0, Math.PI * 2);
            ctx.fill();
        }
    });

    Object.values(otherPlayers).forEach(op => {
        if (!op) return;
        ctx.fillStyle = op.team === 'blue' ? "#00f0ff" : "#ffaa00";
        ctx.beginPath();
        ctx.arc(cx + op.x * scale, cy + op.z * scale, 2.8, 0, Math.PI * 2);
        ctx.fill();
    });

    const px = cx + x * scale;
    const pz = cy + z * scale;
    ctx.save();
    ctx.translate(px, pz);
    ctx.rotate(-angle + Math.PI);
    ctx.fillStyle = "#00ff88";
    ctx.beginPath();
    ctx.moveTo(0, -4.5);
    ctx.lineTo(3.2, 3.5);
    ctx.lineTo(-3.2, 3.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

// ============================================================================
// CTR 3-STAGE POWER-SLIDE BOOST RELEASE & MODULAR NULL-SAFE PHYSICS
// ============================================================================
function releaseDriftMiniTurbo() {
    if (driftStage <= 0) {
        driftCharge = 0;
        driftComboCount = 0;
        return;
    }

    driftComboCount = Math.min(3, driftComboCount + 1);
    const stageDur = driftStage === 3 ? 2800 : (driftStage === 2 ? 2000 : 1400);
    const comboBonus = driftComboCount * 350;
    const preserveSacred = driftStage >= 2 || sacredFireActive;

    triggerAutoTurbo(stageDur + comboBonus, preserveSacred);

    const stageLabel = driftStage === 3
        ? `🔥 تيربو ناري x${driftComboCount}!`
        : (driftStage === 2 ? `⚡ تيربو أصفر x${driftComboCount}!` : `💨 دفعة دريفت!`);
    spawnFloatingText(new THREE.Vector3(x, y + 2.2, z), stageLabel, driftStage >= 2 ? "crit" : "shield");

    driftCharge = 0;
    driftStage = 0;
}

function lerpAngleShortest(a, b, t) {
    let diff = b - a;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    return a + diff * t;
}

function updateRemotePlayersInterpolation() {
    Object.values(otherPlayers).forEach(op => {
        if (!op || !op.mesh) return;
        op.x = THREE.MathUtils.lerp(op.x, op.targetX, 0.22);
        op.y = THREE.MathUtils.lerp(op.y, op.targetY || 0, 0.22);
        op.z = THREE.MathUtils.lerp(op.z, op.targetZ, 0.22);
        op.angle = lerpAngleShortest(op.angle, op.targetAngle, 0.22);

        op.mesh.position.set(op.x, op.y, op.z);
        op.mesh.rotation.y = op.angle;

        if (op.wheels) {
            op.wheels.forEach(w => { if (w) w.rotation.x += (op.speed || 0.3) * 0.8; });
        }
    });
}

// Guard-Clause Protected Vehicle Physics (Prevents P0 Null Vehicle Bug!)
function updateVehiclePhysics(dt) {
    if (!playerVehicle || !scene) return;

    const now = Date.now();
    const skinSpec = CAR_SKINS[selectedSkin] || CAR_SKINS.interceptor;
    const theme = MAP_THEMES[currentMapType] || MAP_THEMES.crash_cove;
    const isEmpSlowed = now < empSlowUntil;
    const isBoostingActive = now < autoTurboUntil;
    const isAkuActive = now < akuMaskUntil;

    if (!isBoostingActive) {
        sacredFireActive = false;
    }

    if (playerAkuAura) {
        playerAkuAura.visible = isAkuActive;
        if (isAkuActive) playerAkuAura.rotation.z += 0.08 * dt;
    }

    // Sticky TNT Head Countdown Check (3 Seconds)
    if (tntStickyUntil > 0) {
        const remMs = tntStickyUntil - now;
        const warnEl = document.getElementById("tnt-head-warning");
        if (remMs > 0) {
            const sec = Math.ceil(remMs / 1000);
            if (warnEl) warnEl.innerText = `🧨 صندوق TNT فوقك (${sec})! اضغط دريفت/قفز للنجاة!`;
            if (playerTntHeadMesh) {
                playerTntHeadMesh.visible = true;
                playerTntHeadMesh.scale.setScalar(1 + Math.sin(now * 0.025) * 0.15);
            }
        } else {
            tntStickyUntil = 0;
            if (playerTntHeadMesh) playerTntHeadMesh.visible = false;
            if (warnEl) warnEl.style.display = "none";
            applyLocalDamage(WEAPONS.tnt.damage, tntStickyAttacker, true);
        }
    }

    let throttleInput = 0;
    let brakeInput = 0;

    if (keys.forward) {
        throttleInput = 1;
    } else if (gameSettings.controlMode === 'joystick' && joyY > 0.08) {
        throttleInput = joyY;
    } else if (gameSettings.controlMode === 'steering' && wheelTouchActive) {
        throttleInput = 0.92;
    } else if (gameSettings.controlMode === 'gyro') {
        throttleInput = 0.88;
    } else if (isBoostingActive) {
        throttleInput = 0.92;
    }

    if (keys.backward) {
        brakeInput = 1;
    } else if (gameSettings.controlMode === 'joystick' && joyY < -0.08) {
        brakeInput = -joyY;
    }

    // Juiced-Up (10 Wumpa) grants +10% Top Speed!
    const juicedSpeedBonus = isJuicedUp ? 1.10 : 1.0;
    const rawTopSpeed = isBoostingActive
        ? (sacredFireActive ? SACRED_FIRE_SPEED : BASE_BOOST_SPEED)
        : BASE_MAX_SPEED;
    const maxSpd = rawTopSpeed * skinSpec.maxSpeedMult * juicedSpeedBonus * (isEmpSlowed ? 0.52 : 1.0);
    const accelRate = (isBoostingActive ? BASE_ACCEL * 1.65 : BASE_ACCEL) * skinSpec.accelMult * dt;

    if (throttleInput > 0) {
        speed = Math.min(speed + accelRate * throttleInput, maxSpd);
    }
    if (brakeInput > 0) {
        speed = Math.max(speed - BRAKE_DECEL * brakeInput * dt, -BASE_MAX_SPEED * 0.52);
    }

    const trackFriction = theme.surfaceFriction || BASE_FRICTION;
    speed *= Math.pow(trackFriction, dt);
    if (Math.abs(speed) < 0.002) speed = 0;

    const isBraking = brakeInput > 0 || (throttleInput === 0 && Math.abs(speed) > 0.1);
    playerTailLights.forEach(mat => {
        if (mat) mat.color.setHex(isBraking ? 0xff0044 : 0x660018);
    });

    let turnInput = 0;
    if (keys.left) turnInput += 1;
    if (keys.right) turnInput -= 1;

    if (turnInput === 0) {
        if (gameSettings.controlMode === 'joystick' && Math.abs(joyX) > 0.06) {
            turnInput = -joyX;
        } else if (gameSettings.controlMode === 'steering' && Math.abs(wheelSteerInput) > 0.04) {
            turnInput = -wheelSteerInput;
        } else if (gameSettings.controlMode === 'gyro' && Math.abs(gyroSteerInput) > 0.05) {
            turnInput = -gyroSteerInput;
        }
    }
    turnInput *= gameSettings.sensitivity;

    // CTR 3-Stage Power-Slide Drift Charging (Green -> Yellow -> Fiery Red)
    const isDriftingActive = keys.drift && Math.abs(speed) > 0.20 && Math.abs(turnInput) > 0.08;
    const driftMeter = document.getElementById("ctr-drift-meter");
    const driftFill = document.getElementById("ctr-drift-fill");
    const driftLabel = document.getElementById("ctr-drift-label") || document.getElementById("ctr-drift-stage-label");

    if (isDriftingActive) {
        if (driftMeter) driftMeter.style.display = "flex";
        driftCharge = Math.min(100, driftCharge + (1.75 * (skinSpec.driftChargeMult || 1.0)) * dt);

        if (driftCharge >= 88) {
            driftStage = 3; // Stage 3: Fiery Red
            if (driftFill) driftFill.style.background = "linear-gradient(90deg, #ffaa00, #ff0022)";
            if (driftLabel) driftLabel.innerText = `🔥 المرحلة 3 (أحمر ناري - أفلِت الدريفت!)`;
        } else if (driftCharge >= 55) {
            driftStage = 2; // Stage 2: Yellow
            if (driftFill) driftFill.style.background = "linear-gradient(90deg, #00ff88, #ffdd00)";
            if (driftLabel) driftLabel.innerText = `⚡ المرحلة 2 (أصفر - ممتاز!)`;
        } else if (driftCharge >= 25) {
            driftStage = 1; // Stage 1: Green
            if (driftFill) driftFill.style.background = "#00ff88";
            if (driftLabel) driftLabel.innerText = `💨 المرحلة 1 (أخضر)`;
        } else {
            driftStage = 0;
            if (driftFill) driftFill.style.background = "#00f0ff";
            if (driftLabel) driftLabel.innerText = `شحن دريفت...`;
        }

        if (driftFill) driftFill.style.width = `${Math.round(driftCharge)}%`;

        if (driftCharge >= 100) {
            releaseDriftMiniTurbo();
        }
    } else {
        if (driftStage >= 1) {
            releaseDriftMiniTurbo();
        } else {
            driftCharge = 0;
            driftStage = 0;
            driftComboCount = 0;
        }
        if (driftMeter) driftMeter.style.display = "none";
    }

    const effectiveTurnRate = TURN_SPEED * (skinSpec.turnMult || 1.0) * (isDriftingActive ? 1.35 : 1.0) * dt;

    if (Math.abs(speed) > 0.012) {
        const dir = speed >= 0 ? 1 : -1;
        angle += turnInput * effectiveTurnRate * dir;
    }

    steerAngle = THREE.MathUtils.lerp(steerAngle, Math.max(-0.5, Math.min(0.5, turnInput * 0.42)), 0.25);
    playerSteerWheels.forEach(sw => { if (sw) sw.rotation.y = steerAngle; });

    const slideMult = theme.driftSlideFactor || 1.0;
    if (isDriftingActive) {
        lateralVelocity = THREE.MathUtils.lerp(lateralVelocity, -turnInput * 0.16 * slideMult, 0.12);
        spawnSkidMark(x, z, angle, isBoostingActive);
    } else {
        lateralVelocity *= (currentMapType === 'polar_pass' ? 0.91 : 0.84);
    }

    vx = (Math.sin(angle) * speed + Math.cos(angle) * lateralVelocity) * dt;
    vz = (Math.cos(angle) * speed - Math.sin(angle) * lateralVelocity) * dt;
    x += vx;
    z += vz;

    y += yVelocity * dt;
    if (y > 0) {
        yVelocity -= GRAVITY * dt;
        pitchAngle = THREE.MathUtils.lerp(pitchAngle, -yVelocity * 0.38, 0.15);
    } else {
        y = 0;
        yVelocity = 0;
        pitchAngle = THREE.MathUtils.lerp(pitchAngle, 0, 0.2);
    }

    rollAngle = THREE.MathUtils.lerp(rollAngle, turnInput * Math.abs(speed) * (isDriftingActive ? 0.16 : 0.07), 0.18);
    playerVehicle.position.set(x, y, z);
    playerVehicle.rotation.set(pitchAngle, angle - lateralVelocity * 0.55, rollAngle);

    playerWheels.forEach(w => { if (w) w.rotation.x += speed * 0.85 * dt; });

    // Update 3D Twin Exhaust Flame Cones directly on the back of the car!
    if (Array.isArray(playerExhaustFlames)) {
        const showFlames = isBoostingActive || isDriftingActive || Math.abs(speed) > 0.35;
        let flameHex = 0x00f0ff;
        if (isDriftingActive) {
            flameHex = driftStage === 3 ? 0xff2200 : (driftStage === 2 ? 0xffdd00 : 0x00ff88);
        } else if (isBoostingActive) {
            flameHex = sacredFireActive ? 0x00ffff : 0xff5500;
        }
        const flameScaleZ = isBoostingActive ? (1.45 + Math.sin(now * 0.04) * 0.35) : (isDriftingActive ? 1.15 : 0.65);
        playerExhaustFlames.forEach(fl => {
            if (!fl) return;
            fl.visible = showFlames;
            if (showFlames) {
                fl.material.color.setHex(flameHex);
                fl.scale.set(1, 1, flameScaleZ);
            }
        });
    }

    spawnExhaustParticles(x, y, z, angle, isBoostingActive, isDriftingActive, driftStage);
    SoundEngine.updateEngine(speed, isBoostingActive, isDriftingActive);

    // Record Lap Frame for Ghost Replay Mode
    if (gameMode === 'race' && !raceFinished) {
        currentLapRecording.push({ x: Number(x.toFixed(2)), y: Number(y.toFixed(2)), z: Number(z.toFixed(2)), angle: Number(angle.toFixed(3)) });
        if (ghostMesh && bestLapRecording.length > 0) {
            const gFrame = bestLapRecording[Math.min(ghostFrameIndex, bestLapRecording.length - 1)];
            if (gFrame) {
                ghostMesh.position.set(gFrame.x, gFrame.y || 0, gFrame.z);
                ghostMesh.rotation.y = gFrame.angle || 0;
            }
            ghostFrameIndex++;
        }
    }
}

// Guard-Clause Protected Collision Detection (Auto Crate Smashing, Wumpa, Weight Knockback)
function checkCollisions(dt) {
    if (!playerVehicle || !scene) return;
    const now = Date.now();
    const mySkin = CAR_SKINS[selectedSkin] || CAR_SKINS.interceptor;
    const isAkuActive = now < akuMaskUntil;

    if (Array.isArray(arenaRamps)) {
        arenaRamps.forEach(r => {
            if (r && Math.abs(x - r.x) < r.width / 2 && Math.abs(z - r.z) < r.length / 2) {
                if (y < 1.8 && Math.abs(speed) > 0.25) {
                    yVelocity = Math.max(yVelocity, Math.abs(speed) * 0.45);
                }
            }
        });
    }

    if (Array.isArray(arenaObstacles)) {
        arenaObstacles.forEach(ob => {
            if (!ob) return;
            const dx = x - ob.x;
            const dz = z - ob.z;
            const dist = Math.hypot(dx, dz);
            const minSep = ob.radius + 1.6;
            if (dist < minSep && dist > 0.001 && y < 3.5) {
                x = ob.x + (dx / dist) * minSep;
                z = ob.z + (dz / dist) * minSep;
                speed *= -0.45;
                spawnExplosionVFX(new THREE.Vector3(x, y + 0.8, z), 0xffaa00, 6, false);
            }
        });
    }

    const playerPosProxy = { x, z };
    resolveWarehouseWallCollision(playerPosProxy);
    if (playerPosProxy.x !== x || playerPosProxy.z !== z) {
        x = playerPosProxy.x;
        z = playerPosProxy.z;
        speed *= 0.72;
    }

    // Boost Pads grant Sacred Fire speed!
    if (Array.isArray(boostPads)) {
        boostPads.forEach(bp => {
            if (bp && Math.hypot(x - bp.x, z - bp.z) < bp.radius && now - bp.lastTriggered > 1200) {
                bp.lastTriggered = now;
                triggerAutoTurbo(AUTO_TURBO_DURATION, true);
                spawnFloatingText(new THREE.Vector3(x, y + 2.0, z), "🔥 منصة تيربو Sacred Fire!", "shield");
            }
        });
    }

    // Vehicle-to-Vehicle Weight Knockback & Aku-Aku Mask Ramming!
    if (Array.isArray(aiBots)) {
        aiBots.forEach(bot => {
            if (!bot || bot.health <= 0) return;
            const dx = bot.x - x;
            const dz = bot.z - z;
            const dist = Math.hypot(dx, dz);
            if (dist < 3.2 && dist > 0.01) {
                const botSkin = CAR_SKINS[bot.skin] || CAR_SKINS.interceptor;
                const pushAngle = Math.atan2(dx, dz);
                if (isAkuActive) {
                    // Aku-Aku Mask knocks enemy karts away and deals collision damage!
                    bot.x += Math.sin(pushAngle) * 4.5;
                    bot.z += Math.cos(pushAngle) * 4.5;
                    damageBot(bot, 35, 'player', true);
                } else {
                    const weightRatio = (mySkin.weightClass || 1.0) / (botSkin.weightClass || 1.0);
                    bot.x += Math.sin(pushAngle) * 1.4 * weightRatio;
                    bot.z += Math.cos(pushAngle) * 1.4 * weightRatio;
                    x -= Math.sin(pushAngle) * (1.1 / weightRatio);
                    z -= Math.cos(pushAngle) * (1.1 / weightRatio);
                }
            }
        });
    }

    // Automatic Mystery Crate Smashing on Collision!
    if (Array.isArray(powerUpItems)) {
        powerUpItems.forEach(pu => {
            if (!pu) return;
            if (pu.active && Math.hypot(x - pu.x, z - pu.z) < 3.2) {
                pu.active = false;
                if (pu.mesh) pu.mesh.visible = false;
                applyPowerUpEffect(pu);

                if (!isOfflineMode && socket && socket.connected) {
                    socket.emit('pickupPowerUp', { powerUpId: pu.id });
                } else {
                    setTimeout(() => {
                        pu.active = true;
                        if (pu.mesh) pu.mesh.visible = true;
                    }, 6500);
                }
            }
            if (pu.active && pu.mesh) {
                pu.mesh.rotation.y += 0.04 * dt;
            }
        });
    }

    // Automatic Wumpa Fruit Pickup on Track
    if (Array.isArray(wumpaItems)) {
        wumpaItems.forEach(wf => {
            if (!wf) return;
            if (wf.active && Math.hypot(x - wf.x, z - wf.z) < 2.8) {
                wf.active = false;
                if (wf.mesh) wf.mesh.visible = false;
                addWumpaFruit(1);
                spawnFloatingText(new THREE.Vector3(x, y + 2.0, z), "+1 🥭 وومبا", "normal");
                setTimeout(() => {
                    wf.active = true;
                    if (wf.mesh) wf.mesh.visible = true;
                }, 8000);
            }
            if (wf.active && wf.mesh) {
                wf.mesh.rotation.y += 0.05 * dt;
            }
        });
    }

    // Track Boundaries & Lap Completion
    if (gameMode === 'race') {
        const roadCenterX = getTrackCenterX(z);
        const distFromRoadCenter = x - roadCenterX;
        const onShortcut = isInsideShortcut(x, z);

        if (!onShortcut && Math.abs(distFromRoadCenter) > 15.0) {
            x = roadCenterX + Math.sign(distFromRoadCenter) * 15.0;
            speed *= 0.92;
        }
        z = Math.max(-15, z);

        if (z >= LAP_LENGTH && !raceFinished) {
            // Save Best Lap Time & Ghost Recording
            const lapTimeSec = Number(((now - lapStartTime) / 1000).toFixed(2));
            lapStartTime = now;
            const prevBest = careerStats.bestLapByMap[currentMapType];
            if (!prevBest || lapTimeSec < prevBest) {
                careerStats.bestLapByMap[currentMapType] = lapTimeSec;
                bestLapRecording = currentLapRecording.slice(0, 1800);
                saveCareerAndSettings();
                try {
                    localStorage.setItem(`ARENA_GHOST_${currentMapType}`, JSON.stringify(bestLapRecording));
                } catch (e) {}
                if (!ghostMesh) createGhostVehicleIfAvailable();
            }
            currentLapRecording = [];
            ghostFrameIndex = 0;

            if (currentLap < TOTAL_LAPS) {
                currentLap++;
                z -= LAP_LENGTH;
                triggerAutoTurbo(AUTO_TURBO_DURATION, true);
                SoundEngine.playPickup();
                spawnFloatingText(new THREE.Vector3(x, y + 2.5, z), `🏁 الدورة ${currentLap}/${TOTAL_LAPS} (${lapTimeSec}s)!`, "crit");

                powerUpItems.forEach(pu => {
                    if (pu) {
                        pu.active = true;
                        if (pu.mesh) pu.mesh.visible = true;
                    }
                });
            } else {
                raceFinished = true;
                kills += 10;
                killScores[localPlayerName] = 100;
                endMatchAndShowLeaderboard(localPlayerName);
            }
        }

        const totalRaceDist = LAP_LENGTH * TOTAL_LAPS;
        const myTotalDist = ((currentLap - 1) * LAP_LENGTH) + z;
        const progPct = Math.max(0, Math.min(100, Math.round((myTotalDist / totalRaceDist) * 100)));

        const progFill = document.getElementById("race-prog-fill");
        if (progFill) progFill.style.width = `${progPct}%`;

        let myRank = 1;
        aiBots.forEach(b => {
            if (!b) return;
            const bTotalDist = ((b.lap - 1) * LAP_LENGTH) + b.z;
            if (bTotalDist > myTotalDist) myRank++;
        });

        const timerEl = document.getElementById("timer-badge");
        if (timerEl) timerEl.innerText = `🏁 ${currentLap}/${TOTAL_LAPS}`;

        const mb = document.getElementById("mode-hud-badge");
        if (mb) mb.innerText = `المركز ${myRank}/4 (${progPct}%)`;
    } else {
        if (Math.abs(x) > 95) { x = Math.sign(x) * 95; speed *= 0.75; }
        if (Math.abs(z) > 95) { z = Math.sign(z) * 95; speed *= 0.75; }
    }
}

// Guard-Clause Protected Camera Chase Update
function updateCamera() {
    if (!camera || !playerVehicle) return;
    const now = Date.now();
    const isBoostingActive = now < autoTurboUntil;
    // Smoothly widen Camera FOV from 60 to 68 when Turbo / Drift Charge is active!
    const targetFOV = isBoostingActive ? 68 : (driftStage >= 2 ? 65 : (driftStage === 1 ? 63 : 60));
    if (Math.abs(camera.fov - targetFOV) > 0.05) {
        camera.fov = THREE.MathUtils.lerp(camera.fov, targetFOV, 0.12);
        camera.updateProjectionMatrix();
    }

    cameraAngle = lerpAngleShortest(cameraAngle, angle, 0.14);

    const camDist = 10.2;
    const camHeight = 4.5 + y * 0.6;

    camera.position.set(
        x - Math.sin(cameraAngle) * camDist,
        camHeight,
        z - Math.cos(cameraAngle) * camDist
    );

    camera.lookAt(
        x + Math.sin(cameraAngle) * 4.0,
        y + 1.2,
        z + Math.cos(cameraAngle) * 4.0
    );
}

// ============================================================================
// MAIN GAME LOOP (WITH AUTO FPS SCALER & STRICT NULL SAFETY)
// ============================================================================
function animate() {
    animationFrameId = requestAnimationFrame(animate);

    const now = Date.now();
    // P0 Fix: Cap delta at 0.1s to prevent physics jumps on tab switch
    const rawDelta = Math.min(clock.getDelta(), 0.1);
    const dt = rawDelta * 60;

    // Auto FPS Scaler during the first 3 seconds of active gameplay
    if (fpsMonitorActive && isControlsEnabled) {
        fpsFrameCount++;
        const elapsed = now - fpsMonitorStart;
        if (elapsed >= 3000) {
            const avgFps = (fpsFrameCount * 1000) / elapsed;
            fpsMonitorActive = false;
            if (avgFps < 40) {
                gameSettings.bloomEnabled = false;
                if (renderer) renderer.setPixelRatio(1);
                console.log(`Auto FPS Scaler triggered (${Math.round(avgFps)} FPS): disabled Bloom & set pixelRatio(1).`);
            }
        }
    }

    if (starfield) {
        starfield.rotation.y += 0.0002 * dt;
    }

    if (isControlsEnabled && playerVehicle) {
        updateVehiclePhysics(dt);
        checkCollisions(dt);
        updateAIBots(dt);
        updateVitalsHUD();
    }

    // Update TNT / Juiced-Up Nitro Crate Traps
    const myId = socket && socket.id ? socket.id : 'player';
    for (let i = landminesList.length - 1; i >= 0; i--) {
        const m = landminesList[i];
        if (!m) continue;
        if (m.coreLight) {
            m.coreLight.rotation.y += 0.05;
        }
        if (now < m.armedAt) continue;

        let triggered = false;

        aiBots.forEach(bot => {
            if (!triggered && bot && bot.health > 0 && m.ownerId !== bot.name && (m.team === 'ffa' || m.team !== bot.team)) {
                if (Math.hypot(bot.x - m.x, bot.z - m.z) < 3.6) {
                    triggered = true;
                    damageBot(bot, WEAPONS.tnt.damage, m.ownerId, true, m.isJuiced);
                }
            }
        });

        if (!triggered && isControlsEnabled && m.ownerId !== myId && m.ownerId !== 'player' && m.ownerName !== localPlayerName) {
            if (m.team === 'ffa' || m.team !== localTeam) {
                if (Math.hypot(x - m.x, z - m.z) < 3.6) {
                    triggered = true;
                    if (m.isJuiced) {
                        yVelocity = 0.48;
                        applyLocalDamage(WEAPONS.tnt.damage + 15, m.ownerName, true);
                    } else {
                        // Classic CTR 3-Second TNT Head Countdown (can be shaken off by hopping 3 times!)
                        attachStickyTNTToPlayer(m.ownerName);
                    }
                }
            }
        }

        if (triggered) {
            spawnExplosionVFX(new THREE.Vector3(m.x, 0.8, m.z), 0x00ff44, 24, true, m.isJuiced);
            SoundEngine.playExplosion(true);
            if (!isOfflineMode && socket && socket.connected) {
                socket.emit('mineTriggered', { mineId: m.id });
            }
            if (scene && m.mesh) scene.remove(m.mesh);
            landminesList.splice(i, 1);
        }
    }

    updateRemotePlayersInterpolation();
    updateFloatingNameplates();

    for (let i = particles.length - 1; i >= 0; i--) {
        const pt = particles[i];
        if (!pt || !pt.mesh) continue;
        pt.mesh.position.add(pt.velocity);
        if (pt.gravity) pt.velocity.y -= pt.gravity;
        pt.life--;
        pt.mesh.scale.multiplyScalar(0.93);
        if (pt.life <= 0) {
            if (scene) scene.remove(pt.mesh);
            particles.splice(i, 1);
        }
    }

    for (let i = shockwaves.length - 1; i >= 0; i--) {
        const sw = shockwaves[i];
        if (!sw || !sw.mesh) continue;
        sw.mesh.scale.multiplyScalar(sw.scaleRate);
        sw.mesh.material.opacity *= 0.88;
        sw.life--;
        if (sw.life <= 0) {
            if (scene) scene.remove(sw.mesh);
            shockwaves.splice(i, 1);
        }
    }

    for (let i = skidMarks.length - 1; i >= 0; i--) {
        const sm = skidMarks[i];
        if (!sm || !sm.mesh) continue;
        sm.life--;
        if (sm.life < 20) sm.mesh.material.opacity = sm.life / 35;
        if (sm.life <= 0) {
            if (scene) scene.remove(sm.mesh);
            skidMarks.splice(i, 1);
        }
    }

    for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        if (!p || !p.mesh) continue;

        if (p.homing && p.life > 10) {
            let bestTarget = null;
            let bestDist = p.isJuiced ? 68 : 52;

            aiBots.forEach(bot => {
                if (bot && bot.health > 0 && p.owner !== bot.name && (p.team === 'ffa' || p.team !== bot.team)) {
                    const d = Math.hypot(bot.x - p.mesh.position.x, bot.z - p.mesh.position.z);
                    if (d < bestDist) {
                        bestDist = d;
                        bestTarget = bot;
                    }
                }
            });

            Object.values(otherPlayers).forEach(op => {
                if (op && p.owner !== op.id && (p.team === 'ffa' || p.team !== op.team)) {
                    const d = Math.hypot(op.x - p.mesh.position.x, op.z - p.mesh.position.z);
                    if (d < bestDist) {
                        bestDist = d;
                        bestTarget = op;
                    }
                }
            });

            if (bestTarget) {
                const desiredAngle = Math.atan2(bestTarget.x - p.mesh.position.x, bestTarget.z - p.mesh.position.z);
                p.angle = lerpAngleShortest(p.angle, desiredAngle, p.homingRate || 0.09);
                p.velocity.set(Math.sin(p.angle) * p.speed, 0, Math.cos(p.angle) * p.speed);
                p.mesh.rotation.y = p.angle;
            }
        }

        p.mesh.position.add(p.velocity);
        p.life--;

        for (let j = 0; j < arenaObstacles.length; j++) {
            const ob = arenaObstacles[j];
            if (ob && Math.hypot(p.mesh.position.x - ob.x, p.mesh.position.z - ob.z) < ob.radius + 0.5) {
                p.life = 0;
                spawnExplosionVFX(p.mesh.position, 0xffaa00, 8, false, p.isJuiced);
                break;
            }
        }

        if (p.life > 0) {
            for (let wIdx = 0; wIdx < warehouseWalls.length; wIdx++) {
                const w = warehouseWalls[wIdx];
                if (w && p.mesh.position.x >= w.minX && p.mesh.position.x <= w.maxX &&
                    p.mesh.position.z >= w.minZ && p.mesh.position.z <= w.maxZ) {
                    p.life = 0;
                    spawnExplosionVFX(p.mesh.position, 0xffaa00, 8, false, p.isJuiced);
                    break;
                }
            }
        }

        const hitRadius = (p.weaponType === 'bomb' && p.isJuiced) ? 4.2 : 2.6;

        if (p.life > 0 && p.owner !== 'player' && p.owner !== myId && p.owner !== localPlayerName && isControlsEnabled && playerVehicle) {
            if (p.team === 'ffa' || p.team !== localTeam) {
                if (p.mesh.position.distanceTo(playerVehicle.position) < hitRadius) {
                    p.life = 0;
                    spawnExplosionVFX(p.mesh.position, 0xff5500, 14, false, p.isJuiced);
                    if (isOfflineMode || !socket || !socket.connected || String(p.owner).includes('🤖')) {
                        applyLocalDamage(p.damage || 28, p.owner, p.isCrit);
                    }
                }
            }
        }

        if (p.life > 0 && (p.owner === 'player' || p.owner === myId)) {
            Object.values(otherPlayers).forEach(op => {
                if (op && op.mesh && (p.team === 'ffa' || p.team !== op.team)) {
                    if (p.mesh.position.distanceTo(op.mesh.position) < hitRadius) {
                        p.life = 0;
                        spawnExplosionVFX(p.mesh.position, 0x00f0ff, 16, false, p.isJuiced);
                        SoundEngine.playExplosion(false);
                        if (!isOfflineMode && socket && socket.connected) {
                            socket.emit('playerHit', { targetId: op.id, damage: p.damage || 28 });
                        }
                    }
                }
            });
        }

        if (p.life > 0) {
            aiBots.forEach(bot => {
                if (bot && bot.mesh && p.owner !== bot.name && bot.health > 0) {
                    if (p.team === 'ffa' || p.team !== bot.team) {
                        if (p.mesh.position.distanceTo(bot.mesh.position) < hitRadius) {
                            p.life = 0;
                            damageBot(bot, p.damage || 28, p.owner, p.isCrit, p.isJuiced);
                        }
                    }
                }
            });
        }

        if (p.life <= 0) {
            if (scene) scene.remove(p.mesh);
            projectiles.splice(i, 1);
        }
    }

    updateCamera();

    const kmh = Math.round(Math.abs(speed) * 190);
    const speedDisplay = document.getElementById("speed-display");
    if (speedDisplay) speedDisplay.innerText = kmh;

    updateMinimap();

    if (!isOfflineMode && socket && socket.connected && isControlsEnabled && (now - lastNetworkSync > 45)) {
        lastNetworkSync = now;
        socket.emit('playerMove', {
            name: localPlayerName,
            x,
            y,
            z,
            angle,
            speed,
            steer: steerAngle,
            health,
            skin: selectedSkin,
            paintColor: selectedPaintColor,
            wheelStyle: selectedWheelStyle,
            spoilerStyle: selectedSpoilerStyle,
            team: localTeam,
            isBoosting: now < autoTurboUntil,
            isDrifting: keys.drift && Math.abs(speed) > 0.22
        });
    }

    if (composer && gameSettings.bloomEnabled) {
        try {
            composer.render();
        } catch (e) {
            if (renderer && scene && camera) renderer.render(scene, camera);
        }
    } else if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
}

function onWindowResize() {
    if (!camera || !renderer) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (composer) composer.setSize(window.innerWidth, window.innerHeight);
}

// ============================================================================
// MATCH FLOW, STARTING BOOST COUNTDOWN, PODIUM & LOCALSTORAGE PERSISTENCE
// ============================================================================
function loadCareerAndSettings() {
    try {
        const savedName = localStorage.getItem('ARENA_PLAYER_NAME');
        if (savedName) {
            const nameInput = document.getElementById("username-input");
            if (nameInput) nameInput.value = savedName;
        }
        const savedCareer = localStorage.getItem('ARENA_CAREER_STATS_V9');
        if (savedCareer) {
            const parsed = JSON.parse(savedCareer);
            if (typeof parsed.wins === 'number') careerStats.wins = parsed.wins;
            if (parsed.bestLapByMap) careerStats.bestLapByMap = parsed.bestLapByMap;
        }
        const savedSettings = localStorage.getItem('ARENA_SETTINGS_V9');
        if (savedSettings) {
            const parsed = JSON.parse(savedSettings);
            Object.assign(gameSettings, parsed);
        }
    } catch (e) {}
    updateCareerBadgeUI();
}

function saveCareerAndSettings() {
    try {
        localStorage.setItem('ARENA_CAREER_STATS_V9', JSON.stringify(careerStats));
        localStorage.setItem('ARENA_SETTINGS_V9', JSON.stringify(gameSettings));
    } catch (e) {}
    updateCareerBadgeUI();
}

function updateCareerBadgeUI() {
    const winsEl = document.getElementById("career-wins-val");
    const bestLapEl = document.getElementById("career-best-lap");
    if (winsEl) winsEl.innerText = careerStats.wins || 0;
    if (bestLapEl) {
        const bestSec = careerStats.bestLapByMap[currentMapType];
        bestLapEl.innerText = bestSec ? `${bestSec}s` : "--:--";
    }
}

function updateGarageStatsUI(skinKey) {
    const spec = CAR_SKINS[skinKey] || CAR_SKINS.interceptor;
    const s = spec.statsUI || { speed: 80, accel: 80, turn: 80, armor: 80 };
    const badgeEl = document.getElementById("stat-class-badge");
    const bSpd = document.getElementById("stat-speed-bar");
    const bAcc = document.getElementById("stat-accel-bar");
    const bTrn = document.getElementById("stat-turn-bar");
    const bArm = document.getElementById("stat-weight-bar") || document.getElementById("stat-armor-bar");

    if (badgeEl) badgeEl.innerText = spec.classLabel;
    if (bSpd) bSpd.style.width = `${s.speed}%`;
    if (bAcc) bAcc.style.width = `${s.accel}%`;
    if (bTrn) bTrn.style.width = `${s.turn}%`;
    if (bArm) bArm.style.width = `${s.armor}%`;
}

function startMatchTimer() {
    matchTimerSeconds = 180;
    if (matchTimerInterval) clearInterval(matchTimerInterval);

    matchTimerInterval = setInterval(() => {
        if (!isControlsEnabled) return;
        matchTimerSeconds--;

        const mins = Math.floor(matchTimerSeconds / 60);
        const secs = matchTimerSeconds % 60;
        const timeStr = `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;

        const timerBadge = document.getElementById("timer-badge");
        if (timerBadge) timerBadge.innerText = timeStr;

        if (matchTimerSeconds <= 0) {
            clearInterval(matchTimerInterval);
            endMatchAndShowLeaderboard();
        }
    }, 1000);
}

function returnToMainMenu() {
    isControlsEnabled = false;
    isMatchRunning = false;
    tntStickyUntil = 0;
    if (matchTimerInterval) clearInterval(matchTimerInterval);
    SoundEngine.updateEngine(0, false, false);

    const npContainer = document.getElementById("nameplates-container");
    if (npContainer) npContainer.innerHTML = "";
    const warnEl = document.getElementById("tnt-head-warning");
    if (warnEl) warnEl.style.display = "none";

    document.getElementById("settings-modal").style.display = "none";
    document.getElementById("result-screen").style.display = "none";
    document.getElementById("lobby-screen").style.display = "none";
    document.getElementById("countdown-screen").style.display = "none";
    document.getElementById("hud-overlay").style.display = "none";
    document.getElementById("start-screen").style.display = "flex";

    updateCareerBadgeUI();

    if (!isOfflineMode && socket && socket.connected) {
        socket.emit('getRooms');
    }
}

function renderTop3Podium(standings) {
    const podiumEl = document.getElementById("podium-container");
    if (!podiumEl) return;

    const first = standings[0] || { name: "---", stat: "" };
    const second = standings[1] || { name: "---", stat: "" };
    const third = standings[2] || { name: "---", stat: "" };

    podiumEl.innerHTML = `
        <div class="podium-step rank-2">
            <div class="podium-medal">🥈</div>
            <div class="podium-name">${second.name}</div>
            <div class="podium-stat ltr-text">${second.stat}</div>
        </div>
        <div class="podium-step rank-1">
            <div class="podium-medal">🥇</div>
            <div class="podium-name">${first.name}</div>
            <div class="podium-stat ltr-text">${first.stat}</div>
        </div>
        <div class="podium-step rank-3">
            <div class="podium-medal">🥉</div>
            <div class="podium-name">${third.name}</div>
            <div class="podium-stat ltr-text">${third.stat}</div>
        </div>
    `;
}

function endMatchAndShowLeaderboard(raceWinnerName = null) {
    isControlsEnabled = false;
    isMatchRunning = false;
    if (matchTimerInterval) clearInterval(matchTimerInterval);
    SoundEngine.updateEngine(0, false, false);
    SoundEngine.playExplosion(true);

    const titleEl = document.getElementById("result-title");
    const subEl = document.getElementById("result-subtitle");
    const listEl = document.getElementById("leaderboard-list");

    if (gameMode === 'race') {
        const won = raceWinnerName === localPlayerName;
        if (won) {
            careerStats.wins = (careerStats.wins || 0) + 1;
            saveCareerAndSettings();
        }
        const totalRaceSec = ((Date.now() - raceStartTime) / 1000).toFixed(1);
        titleEl.innerText = won ? "🏁 مبروك! فزت بسباق كراش CTR بالمركز الأول! 🏆" : `🏁 انتهى السباق! الفائز: ${raceWinnerName}`;
        titleEl.style.color = won ? "#00ff88" : "#ffaa00";
        if (subEl) subEl.innerText = `زمن السباق: ${totalRaceSec}s | أفضل دورة: ${careerStats.bestLapByMap[currentMapType] || '--'}s`;

        const totalTrackDist = LAP_LENGTH * TOTAL_LAPS;
        const racers = [
            { name: localPlayerName, dist: Math.min(totalTrackDist, Math.round(((currentLap - 1) * LAP_LENGTH) + z)), deaths: deaths },
            ...aiBots.map(b => ({ name: b.name, dist: Math.min(totalTrackDist, Math.round(((b.lap - 1) * LAP_LENGTH) + b.z)), deaths: b.deaths || 0 }))
        ].sort((a, b) => b.dist - a.dist);

        renderTop3Podium(racers.map(r => ({
            name: r.name,
            stat: `${Math.round((r.dist / totalTrackDist) * 100)}%`
        })));

        listEl.innerHTML = racers.map((r, rank) => {
            const medal = rank === 0 ? "🥇" : rank === 1 ? "🥈" : rank === 2 ? "🥉" : "🏎️";
            const pct = Math.round((r.dist / totalTrackDist) * 100);
            return `<div style="display:flex; justify-content:space-between; margin-bottom:6px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:4px;">
                <span>${medal} ${rank + 1}. ${r.name}</span>
                <span class="ltr-text" style="color:#00ff88;">${pct}% | 💀 ${r.deaths}</span>
            </div>`;
        }).join("");
    } else {
        const sortedStandings = Object.keys(killScores).sort((a, b) => (killScores[b] || 0) - (killScores[a] || 0));
        if (sortedStandings[0] === localPlayerName) {
            careerStats.wins = (careerStats.wins || 0) + 1;
            saveCareerAndSettings();
        }
        renderTop3Podium(sortedStandings.map(name => ({
            name,
            stat: `⚔️${killScores[name] || 0}`
        })));

        listEl.innerHTML = sortedStandings.map((name, rank) => {
            const medal = rank === 0 ? "🥇" : rank === 1 ? "🥈" : rank === 2 ? "🥉" : "🚙";
            const k = killScores[name] || 0;
            const d = deathScores[name] || 0;
            return `<div style="display:flex; justify-content:space-between; margin-bottom:6px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:4px;">
                <span>${medal} ${rank + 1}. ${name}</span>
                <span class="ltr-text" style="color:#ffaa00;">⚔️ ${k} | 💀 ${d}</span>
            </div>`;
        }).join("");
    }

    document.getElementById("hud-overlay").style.display = "none";
    document.getElementById("result-screen").style.display = "flex";
}

// CTR 3-2-1 Traffic Light Countdown + Starting Boost Window!
function startMatchCountdown(callback) {
    const screen = document.getElementById("countdown-screen");
    const numEl = document.getElementById("countdown-number");
    const l1 = document.getElementById("ctr-light-1");
    const l2 = document.getElementById("ctr-light-2");
    const l3 = document.getElementById("ctr-light-3");

    startingBoostWindowActive = false;
    startingBoostClaimed = false;

    if (l1) l1.className = "ctr-light red";
    if (l2) l2.className = "ctr-light";
    if (l3) l3.className = "ctr-light";

    screen.style.display = "flex";
    let count = 3;
    numEl.innerText = count;
    SoundEngine.playBeep(520);

    const timer = setInterval(() => {
        count--;
        if (count === 2) {
            numEl.innerText = count;
            if (l2) l2.className = "ctr-light red";
            SoundEngine.playBeep(520);
        } else if (count === 1) {
            numEl.innerText = count;
            if (l3) l3.className = "ctr-light amber";
            SoundEngine.playBeep(680);
            // Open Starting Boost timing window right before GREEN!
            startingBoostWindowActive = true;
        } else if (count === 0) {
            numEl.innerText = "انطلق! 🏁";
            if (l1) l1.className = "ctr-light green";
            if (l2) l2.className = "ctr-light green";
            if (l3) l3.className = "ctr-light green";
            SoundEngine.playBeep(1150);
            window.NetworkConfig.triggerHaptic(120, 240);

            if (keys.forward || joyY > 0.25 || wheelTouchActive) {
                checkStartingBoostTrigger();
            }
        } else {
            clearInterval(timer);
            startingBoostWindowActive = false;
            screen.style.display = "none";
            isControlsEnabled = true;
            lapStartTime = Date.now();
            raceStartTime = Date.now();
            fpsMonitorActive = true;
            fpsMonitorStart = Date.now();
            fpsFrameCount = 0;

            if (gameMode !== 'race') startMatchTimer();
            if (callback) callback();
        }
    }, 750);
}

// ============================================================================
// P1 FIX: POLLING-FIRST SOCKET.IO & COMPLETE OFFLINE MODE ISOLATION
// ============================================================================
function addOrUpdateRemotePlayer(pData) {
    if (!pData || !pData.id || (socket && pData.id === socket.id)) return;

    const configChanged = otherPlayers[pData.id] && (
        (pData.skin && pData.skin !== otherPlayers[pData.id].skin) ||
        (pData.paintColor !== undefined && Number(pData.paintColor) !== otherPlayers[pData.id].paintColor) ||
        (pData.wheelStyle && pData.wheelStyle !== otherPlayers[pData.id].wheelStyle) ||
        (pData.spoilerStyle && pData.spoilerStyle !== otherPlayers[pData.id].spoilerStyle)
    );

    if (!otherPlayers[pData.id] || configChanged) {
        if (otherPlayers[pData.id] && otherPlayers[pData.id].mesh && scene) {
            scene.remove(otherPlayers[pData.id].mesh);
        }
        let meshObj = null;
        let wheelsArr = [];
        if (scene) {
            const remoteBuild = createVehicleMesh({
                skin: pData.skin || 'interceptor',
                paintColor: pData.paintColor !== undefined ? Number(pData.paintColor) : undefined,
                wheelStyle: pData.wheelStyle || 'standard',
                spoilerStyle: pData.spoilerStyle || 'gt_wing',
                team: pData.team || 'ffa',
                isLocalPlayer: false
            });
            remoteBuild.group.position.set(pData.x || 0, pData.y || 0, pData.z || 0);
            scene.add(remoteBuild.group);
            meshObj = remoteBuild.group;
            wheelsArr = remoteBuild.wheels;
        }

        otherPlayers[pData.id] = {
            id: pData.id,
            name: pData.name || `مقاتل_${pData.id.substring(0, 4)}`,
            skin: pData.skin || 'interceptor',
            paintColor: pData.paintColor !== undefined ? Number(pData.paintColor) : 0x00f0ff,
            wheelStyle: pData.wheelStyle || 'standard',
            spoilerStyle: pData.spoilerStyle || 'gt_wing',
            team: pData.team || 'ffa',
            health: pData.health || 100,
            mesh: meshObj,
            wheels: wheelsArr,
            x: pData.x || 0,
            y: pData.y || 0,
            z: pData.z || 0,
            angle: pData.angle || 0,
            targetX: pData.x || 0,
            targetY: pData.y || 0,
            targetZ: pData.z || 0,
            targetAngle: pData.angle || 0,
            speed: pData.speed || 0
        };
    } else {
        const op = otherPlayers[pData.id];
        if (pData.name) op.name = pData.name;
        if (pData.team) op.team = pData.team;
        if (typeof pData.x === 'number') op.targetX = pData.x;
        if (typeof pData.y === 'number') op.targetY = pData.y;
        if (typeof pData.z === 'number') op.targetZ = pData.z;
        if (typeof pData.angle === 'number') op.targetAngle = pData.angle;
        if (typeof pData.speed === 'number') op.speed = pData.speed;
        if (typeof pData.health === 'number') op.health = pData.health;
    }

    const rName = otherPlayers[pData.id].name;
    if (rName) {
        if (killScores[rName] === undefined) killScores[rName] = pData.kills || 0;
        if (deathScores[rName] === undefined) deathScores[rName] = pData.deaths || 0;
        updateLiveLeaderboard();
    }
}

function initSocket() {
    ensureSocketConnected();
}

function ensureSocketConnected() {
    if (isOfflineMode) return;
    const serverUrl = window.NetworkConfig.SERVER_URL;
    if (typeof io === 'undefined') return;
    if (socket && socket.connected) return;

    // P1 Fix: Polling-first fallback before upgrading to WebSocket (prevents Render cold-start WSS errors)
    socket = io(serverUrl, {
        transports: ['polling', 'websocket'],
        upgrade: true,
        rememberUpgrade: false,
        reconnectionAttempts: 5,
        reconnectionDelay: 2000,
        timeout: 10000
    });

    socket.on('serverVersion', (data) => {
        if (data && data.version) {
            if (currentServerVersion && currentServerVersion !== data.version) {
                window.location.reload(true);
            }
            currentServerVersion = data.version;
        }
    });

    socket.on('connect', () => {
        const menuPill = document.getElementById("menu-online-pill");
        if (menuPill) {
            menuPill.innerText = "متصل بالسيرفر أونلاين 🟢";
            menuPill.style.color = "#00ff88";
        }
        const dot = document.getElementById("status-dot");
        if (dot) dot.style.background = "#00ff88";
        socket.emit('getRooms');
    });

    const handleOfflineFallback = () => {
        const menuPill = document.getElementById("menu-online-pill");
        if (menuPill) {
            menuPill.innerText = "وضع أوفلاين محلي (جاهز للعب الفوري) 🟠";
            menuPill.style.color = "#ffaa00";
        }
        const dot = document.getElementById("status-dot");
        if (dot) dot.style.background = "#ffaa00";
    };

    socket.on('connect_error', handleOfflineFallback);
    socket.on('reconnect_failed', () => {
        isOfflineMode = true;
        handleOfflineFallback();
    });

    socket.on('roomsUpdate', (data) => {
        if (!data) return;
        const menuPill = document.getElementById("menu-online-pill");
        if (menuPill) {
            menuPill.innerText = `متصل أونلاين (${data.onlineCount || 1} لاعب) 🟢`;
        }
        const listEl = document.getElementById("active-rooms-list");
        if (listEl && Array.isArray(data.rooms)) {
            if (data.rooms.length === 0) {
                listEl.innerHTML = `<span>لا توجد غرف حالياً — اضغط انطلاق لإنشاء غرفتك</span>`;
            } else {
                listEl.innerHTML = data.rooms.map(r =>
                    `<span class="room-chip" data-room="${r.id}" data-mode="${r.gameMode}" data-map="${r.mapType}">
                        🔑 ${r.id} (${r.playerCount} 👥)
                    </span>`
                ).join("");

                listEl.querySelectorAll('.room-chip').forEach(chip => {
                    chip.addEventListener('click', () => {
                        document.getElementById("room-code-input").value = chip.getAttribute('data-room');
                        document.getElementById("mode-select").value = chip.getAttribute('data-mode') || 'race';
                        document.getElementById("map-select").value = chip.getAttribute('data-map') || 'crash_cove';
                        document.getElementById("lobby-option-select").value = 'online';
                        initWebAudio();
                        SoundEngine.playBeep(820);
                    });
                });
            }
        }
    });

    socket.on('initGame', (data) => {
        if (!data) return;
        currentRoomId = data.roomId || currentRoomId;
        if (data.self && data.self.team) {
            localTeam = data.self.team;
        }
        otherPlayers = {};
        if (data.players) {
            Object.values(data.players).forEach(p => {
                if (p.id !== socket.id) addOrUpdateRemotePlayer(p);
            });
        }
        if (scene && Array.isArray(data.landmines)) {
            data.landmines.forEach(m => deployLandmine(m.x, m.z, m.ownerId, m.ownerName, m.team, m.id));
        }
    });

    socket.on('roomPlayersUpdate', (data) => {
        if (!data || !Array.isArray(data.players)) return;
        const numEl = document.getElementById("lobby-player-num");
        if (numEl) numEl.innerText = data.players.length;

        const titleEl = document.getElementById("lobby-room-title");
        if (titleEl) titleEl.innerText = `كود الغرفة: ${data.roomId} | الطور: ${data.gameMode.toUpperCase()}`;

        const listEl = document.getElementById("lobby-player-list");
        if (listEl) {
            listEl.innerHTML = data.players.map(p => {
                const isMe = socket && p.id === socket.id;
                const tBadge = p.team === 'blue' ? '🔵' : (p.team === 'red' ? '🔴' : '🏁');
                return `<div style="padding:4px 0; border-bottom:1px solid rgba(255,255,255,0.08);">
                    ${tBadge} <strong>${p.name}</strong> ${isMe ? '(أنت)' : '🌐'}
                </div>`;
            }).join("");
        }
    });

    socket.on('matchStartedByHost', () => {
        if (!isMatchRunning) {
            launchActiveGameplay();
        }
    });

    socket.on('playerJoined', addOrUpdateRemotePlayer);
    socket.on('playerUpdated', addOrUpdateRemotePlayer);
    socket.on('playerMoved', addOrUpdateRemotePlayer);
    socket.on('laserFired', (data) => shootWeapon(data));

    socket.on('minePlaced', (m) => {
        if (m && (!socket || m.ownerId !== socket.id) && scene) {
            deployLandmine(m.x, m.z, m.ownerId, m.ownerName, m.team, m.id);
        }
    });

    socket.on('mineExploded', (data) => {
        if (!data || !data.mineId) return;
        const idx = landminesList.findIndex(item => item.id === data.mineId);
        if (idx !== -1) {
            if (scene && landminesList[idx].mesh) scene.remove(landminesList[idx].mesh);
            landminesList.splice(idx, 1);
        }
    });

    socket.on('playerDamaged', (data) => {
        if (!data) return;
        if (socket && data.targetId === socket.id) {
            health = data.health;
            shield = data.shield;
            updateVitalsHUD();
            SoundEngine.playExplosion(false);
            spawnFloatingText(
                new THREE.Vector3(x, y + 2.2, z),
                data.isCrit ? `💥 -${data.damage}` : `-${data.damage}`,
                data.isCrit ? 'crit' : 'normal'
            );
        } else if (otherPlayers[data.targetId]) {
            otherPlayers[data.targetId].health = data.health;
        }
    });

    socket.on('playerKilled', (data) => {
        if (!data) return;
        addKillFeedNotification(data.killerName || 'متسابق', data.victimName || 'متسابق');
        if (data.teamScores) {
            teamScores = data.teamScores;
            updateTeamScoreboardUI();
        }
        if (data.victimName) {
            deathScores[data.victimName] = (deathScores[data.victimName] || 0) + 1;
        }
        if (data.killerName) {
            killScores[data.killerName] = (killScores[data.killerName] || 0) + 1;
        }
        if (socket && data.killerId === socket.id) {
            kills = killScores[localPlayerName] || (kills + 1);
            updateCenterKillsDeathsBadge();
        }
        if (socket && data.victimId === socket.id) {
            deaths = deathScores[localPlayerName] || (deaths + 1);
            updateCenterKillsDeathsBadge();
            x = typeof data.respawnX === 'number' ? data.respawnX : 0;
            z = typeof data.respawnZ === 'number' ? data.respawnZ : -40;
            health = maxHealth;
            shield = 50;
            updateVitalsHUD();
        }
        updateLiveLeaderboard();
    });

    socket.on('leaderboardUpdate', (lbArray) => {
        if (Array.isArray(lbArray)) {
            lbArray.forEach(entry => {
                if (entry.name) {
                    killScores[entry.name] = entry.kills || 0;
                    deathScores[entry.name] = entry.deaths || 0;
                }
            });
            updateLiveLeaderboard();
        }
    });

    socket.on('playerLeft', (leftId) => {
        if (otherPlayers[leftId]) {
            if (otherPlayers[leftId].mesh && scene) scene.remove(otherPlayers[leftId].mesh);
            delete otherPlayers[leftId];
        }
    });
}

// ============================================================================
// INSTANT INVITE LINK PARSER (?room=CTR99) & UI EVENT LISTENERS
// ============================================================================
function parseUrlInviteParams() {
    try {
        const params = new URLSearchParams(window.location.search);
        const invitedRoom = params.get('room');
        const invitedMode = params.get('mode');
        const invitedMap = params.get('map');
        if (invitedRoom) {
            const roomInput = document.getElementById("room-code-input");
            if (roomInput) roomInput.value = invitedRoom.trim().toUpperCase();
            const lobbySelect = document.getElementById("lobby-option-select");
            if (lobbySelect) lobbySelect.value = 'online';
        }
        if (invitedMode && document.getElementById("mode-select")) {
            document.getElementById("mode-select").value = invitedMode;
        }
        if (invitedMap && document.getElementById("map-select")) {
            document.getElementById("map-select").value = invitedMap;
            currentMapType = invitedMap;
        }
    } catch (e) {}
}

function copyInstantInviteLink() {
    const roomInput = document.getElementById("room-code-input");
    let roomCode = (roomInput && roomInput.value ? roomInput.value : "").trim().toUpperCase();
    if (!roomCode) {
        roomCode = `CTR-${Math.floor(100 + Math.random() * 900)}`;
        if (roomInput) roomInput.value = roomCode;
    }
    const modeVal = document.getElementById("mode-select") ? document.getElementById("mode-select").value : "race";
    const mapVal = document.getElementById("map-select") ? document.getElementById("map-select").value : "crash_cove";
    const baseUrl = window.location.origin && window.location.protocol.startsWith('http')
        ? `${window.location.origin}${window.location.pathname}`
        : 'https://gsme1.onrender.com/';
    const inviteUrl = `${baseUrl}?room=${encodeURIComponent(roomCode)}&mode=${encodeURIComponent(modeVal)}&map=${encodeURIComponent(mapVal)}`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(inviteUrl).catch(() => {});
    }
    initWebAudio();
    SoundEngine.playPickup();

    const msgEl = document.getElementById("invite-copied-msg");
    if (msgEl) {
        msgEl.style.display = "block";
        msgEl.innerText = `✅ تم نسخ رابط الغرفة (${roomCode})! أرسله لصديقك الآن`;
        setTimeout(() => { msgEl.style.display = "none"; }, 3500);
    }
}

window.addEventListener('load', () => {
    loadCareerAndSettings();
    parseUrlInviteParams();
    updateGarageStatsUI(selectedSkin);
    updateCareerBadgeUI();
    ensureSocketConnected();
});

document.querySelectorAll('.skin-card').forEach(card => {
    card.addEventListener('click', () => {
        document.querySelectorAll('.skin-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        selectedSkin = card.getAttribute('data-skin') || 'interceptor';
        const hiddenInput = document.getElementById('skin-select');
        if (hiddenInput) hiddenInput.value = selectedSkin;
        updateGarageStatsUI(selectedSkin);
        initWebAudio();
        SoundEngine.playBeep(720);
    });
});

const mapSelectEl = document.getElementById("map-select");
if (mapSelectEl) {
    mapSelectEl.addEventListener("change", (e) => {
        currentMapType = e.target.value || "crash_cove";
        updateCareerBadgeUI();
    });
}

const copyInviteBtn = document.getElementById("btn-copy-invite");
if (copyInviteBtn) {
    copyInviteBtn.addEventListener("click", copyInstantInviteLink);
}

const lobbyInviteBtn = document.getElementById("btn-lobby-copy-link") || document.getElementById("btn-lobby-copy-invite");
if (lobbyInviteBtn) {
    lobbyInviteBtn.addEventListener("click", copyInstantInviteLink);
}

document.getElementById("btn-toggle-lb").addEventListener("click", () => {
    const lb = document.getElementById("live-leaderboard");
    if (lb) {
        lb.style.display = lb.style.display === "none" ? "block" : "none";
    }
});

document.getElementById("btn-home-hud").addEventListener("click", () => {
    returnToMainMenu();
});

document.getElementById("btn-settings-hud").addEventListener("click", () => {
    document.getElementById("settings-control-select").value = gameSettings.controlMode;
    document.getElementById("settings-bloom").value = gameSettings.bloomEnabled ? 'on' : 'off';
    document.getElementById("settings-shake").value = gameSettings.cameraShake ? 'on' : 'off';
    document.getElementById("settings-sound").value = gameSettings.soundEnabled ? 'on' : 'off';
    document.getElementById("settings-difficulty").value = botDifficulty;
    document.getElementById("settings-modal").style.display = "flex";
});

document.getElementById("settings-sensitivity").addEventListener("input", (e) => {
    const val = parseInt(e.target.value, 10) || 100;
    document.getElementById("sens-val").innerText = `${val}%`;
    gameSettings.sensitivity = val / 100;
});

document.getElementById("btn-resume-game").addEventListener("click", () => {
    gameSettings.controlMode = document.getElementById("settings-control-select").value;
    gameSettings.bloomEnabled = document.getElementById("settings-bloom").value === 'on';
    gameSettings.cameraShake = document.getElementById("settings-shake").value === 'on';
    gameSettings.soundEnabled = document.getElementById("settings-sound").value === 'on';
    botDifficulty = document.getElementById("settings-difficulty").value;

    document.getElementById("difficulty-select").value = botDifficulty;
    saveCareerAndSettings();

    applyControlSchemeUI();
    document.getElementById("settings-modal").style.display = "none";
});

document.getElementById("btn-quit-to-menu").addEventListener("click", () => {
    returnToMainMenu();
});

document.getElementById("restart-btn").addEventListener("click", () => {
    returnToMainMenu();
});

const rematchBtn = document.getElementById("btn-rematch");
if (rematchBtn) {
    rematchBtn.addEventListener("click", () => {
        document.getElementById("result-screen").style.display = "none";
        resetMatchStateForLaunch();
        launchActiveGameplay();
    });
}

document.getElementById("btn-cancel-lobby").addEventListener("click", () => {
    returnToMainMenu();
});

document.getElementById("btn-start-online-now").addEventListener("click", () => {
    if (!isOfflineMode && socket && socket.connected) {
        socket.emit('startOnlineMatch');
    }
    launchActiveGameplay();
});

function resetMatchStateForLaunch() {
    const isTeamMode = gameMode === '2v2' || gameMode === '3v3' || gameMode === '4v4';
    localTeam = isTeamMode ? 'blue' : 'ffa';

    const skinSpec = CAR_SKINS[selectedSkin] || CAR_SKINS.interceptor;
    maxHealth = 100 + skinSpec.armorBonus + (selectedWheelStyle === 'hexa' ? 15 : 0);
    health = maxHealth;
    shield = 50;
    autoTurboUntil = 0;
    akuMaskUntil = 0;
    tntStickyUntil = 0;
    driftCharge = 0;
    driftStage = 0;
    driftComboCount = 0;
    sacredFireActive = false;
    wumpaCount = 0;
    isJuicedUp = false;
    kills = 0;
    deaths = 0;
    currentLap = 1;
    raceFinished = false;
    isMatchRunning = false;
    currentLapRecording = [];
    ghostFrameIndex = 0;
    teamScores = { blue: 0, red: 0 };

    weaponAmmo = { missile: 0, bomb: 0, tnt: 0, shield_cannon: 0, warp_orb: 0, aku_mask: 0 };
    currentWeapon = null;

    if (gameMode === 'race') {
        x = -3.5; y = 0; z = 8; angle = 0; cameraAngle = 0; speed = 0;
    } else if (isTeamMode) {
        x = 0; y = 0; z = -65; angle = 0; cameraAngle = 0; speed = 0;
    } else {
        x = 0; y = 0; z = -22; angle = 0; cameraAngle = 0; speed = 0;
    }
}

function startGame() {
    launchActiveGameplay();
}

function launchActiveGameplay() {
    if (isMatchRunning) return;
    isMatchRunning = true;

    document.getElementById("start-screen").style.display = "none";
    document.getElementById("lobby-screen").style.display = "none";
    document.getElementById("result-screen").style.display = "none";
    document.getElementById("hud-overlay").style.display = "flex";

    const isTeamMode = gameMode === '2v2' || gameMode === '3v3' || gameMode === '4v4';
    const teamInline = document.getElementById("team-score-inline");
    const raceCard = document.getElementById("race-progress-card");

    if (isTeamMode) {
        if (teamInline) teamInline.style.display = "inline-flex";
        if (raceCard) raceCard.style.display = "none";
        updateTeamScoreboardUI();
        document.getElementById("timer-badge").innerText = "03:00";
        updateCenterKillsDeathsBadge();
    } else if (gameMode === 'race') {
        if (teamInline) teamInline.style.display = "none";
        if (raceCard) raceCard.style.display = "flex";
        document.getElementById("timer-badge").innerText = `🏁 1/${TOTAL_LAPS}`;
        document.getElementById("mode-hud-badge").innerText = `المركز 1/4`;
    } else {
        if (teamInline) teamInline.style.display = "none";
        if (raceCard) raceCard.style.display = "none";
        document.getElementById("timer-badge").innerText = "03:00";
        updateCenterKillsDeathsBadge();
    }

    // P0 Fix: Always ensure scene, renderer, and playerVehicle exist before starting loop
    initScene(currentMapType);
    setupControls();
    applyControlSchemeUI();
    updateCircularWeaponUI();
    updateWumpaHUD();
    updateVitalsHUD();
    spawnAIBotsForMode();

    startMatchCountdown();

    clock.start();
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    animate();
}

document.getElementById("connect-btn").addEventListener("click", () => {
    const nameInput = document.getElementById("username-input");
    const errEl = document.getElementById("name-error-msg");
    const enteredName = (nameInput.value || "").trim();

    if (!enteredName) {
        if (errEl) errEl.style.display = "block";
        nameInput.style.borderColor = "#ff0055";
        nameInput.focus();
        window.NetworkConfig.triggerHaptic(120, 250);
        return;
    }

    if (errEl) errEl.style.display = "none";
    nameInput.style.borderColor = "rgba(255, 255, 255, 0.18)";
    localPlayerName = enteredName;
    try { localStorage.setItem('ARENA_PLAYER_NAME', localPlayerName); } catch (e) {}

    // P3 Fix: Resume AudioContext directly inside user click handler
    initWebAudio();

    selectedSkin = document.getElementById("skin-select").value || "interceptor";
    selectedPaintColor = Number(document.getElementById("paint-color-select").value || 0xff5500);
    selectedWheelStyle = document.getElementById("wheel-style-select").value || "standard";
    selectedSpoilerStyle = document.getElementById("spoiler-style-select").value || "gt_wing";

    lobbyOption = document.getElementById("lobby-option-select").value || "online";
    fillBotsOption = document.getElementById("fill-bots-select").value || "fill";
    gameMode = document.getElementById("mode-select").value || "race";
    botDifficulty = document.getElementById("difficulty-select").value || "medium";
    currentMapType = document.getElementById("map-select").value || "crash_cove";

    const customRoomCode = (document.getElementById("room-code-input").value || "").trim().toUpperCase();
    currentRoomId = customRoomCode || `PUBLIC-${gameMode.toUpperCase()}`;

    resetMatchStateForLaunch();

    // P1 Fix: Complete Offline Mode Isolation when choosing Quick Play with Bots
    if (lobbyOption === 'bot') {
        isOfflineMode = true;
        launchActiveGameplay();
        return;
    }

    isOfflineMode = false;
    ensureSocketConnected();

    if (socket && socket.connected) {
        socket.emit('joinGame', {
            roomId: currentRoomId,
            name: localPlayerName,
            skin: selectedSkin,
            paintColor: selectedPaintColor,
            wheelStyle: selectedWheelStyle,
            spoilerStyle: selectedSpoilerStyle,
            gameMode: gameMode,
            mapType: currentMapType
        });

        document.getElementById("start-screen").style.display = "none";
        document.getElementById("lobby-screen").style.display = "flex";
        document.getElementById("lobby-room-title").innerText = `كود الغرفة: ${currentRoomId} | الطور: ${gameMode.toUpperCase()}`;
        document.getElementById("lobby-player-list").innerHTML = `<div>🏁 <strong>${localPlayerName}</strong> (أنت)</div>`;
    } else {
        // Automatic fallback to local offline gameplay if server is asleep or unreachable
        isOfflineMode = true;
        launchActiveGameplay();
    }
});

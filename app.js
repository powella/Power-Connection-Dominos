/* ============================================================
   POWER CONNECTION — a spatial domino circuit puzzle
   Vanilla JS, no build step, no dependencies.
   ============================================================ */
(function () {
  'use strict';

  /* ------------------------------------------------------------ constants */

  const N = 13;                 // grid is N x N cells
  const HAND_SIZE = 5;
  const STORE_KEY = 'power-connection-v1';
  const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const PCT = 100 / N;

  // Standard pip layouts on a 3x3 lattice.
  const PIP_DOTS = {
    0: [],
    1: [[1, 1]],
    2: [[0, 0], [2, 2]],
    3: [[0, 0], [1, 1], [2, 2]],
    4: [[0, 0], [2, 0], [0, 2], [2, 2]],
    5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],
    6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]]
  };

  // Every tile of a double-six set, pip-sorted.
  const ALL_TILES = (() => {
    const out = [];
    for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) out.push([a, b]);
    return out;
  })();

  /* Levels 1-7. One power core, 1-4 appliances, 0-3 obstacles.
     Grid coordinates are [row, col] with row 0 at the top. */
  const LEVELS = [
    {
      id: 1, name: 'First Light',
      brief: 'A lone appliance and a dead-simple core. Learn how current travels.',
      source: { pips: [0, 0], r: 6, c: 5, dir: 'h' },
      appliances: [{ pips: [3, 3], r: 6, c: 9, dir: 'h' }],
      obstacles: []
    },
    {
      id: 2, name: 'Twin Outputs',
      brief: 'Two appliances on opposite flanks of the 1-1 core.',
      source: { pips: [1, 1], r: 5, c: 6, dir: 'v' },
      appliances: [
        { pips: [4, 2], r: 6, c: 1, dir: 'h' },
        { pips: [5, 3], r: 6, c: 10, dir: 'h' }
      ],
      obstacles: []
    },
    {
      id: 3, name: 'Blocked Conduit',
      brief: 'A coolant block sits in the lane. Route around it.',
      source: { pips: [2, 2], r: 6, c: 6, dir: 'v' },
      appliances: [
        { pips: [1, 5], r: 4, c: 5, dir: 'h' },
        { pips: [6, 3], r: 9, c: 6, dir: 'v' }
      ],
      obstacles: [{ r: 6, c: 3 }]
    },
    {
      id: 4, name: 'Crossed Wires',
      brief: 'Three loads spread across the board and two dead zones.',
      source: { pips: [3, 3], r: 6, c: 6, dir: 'h' },
      appliances: [
        { pips: [0, 5], r: 3, c: 3, dir: 'v' },
        { pips: [6, 2], r: 3, c: 9, dir: 'h' },
        { pips: [4, 1], r: 9, c: 5, dir: 'h' }
      ],
      obstacles: [{ r: 6, c: 4 }, { r: 7, c: 9 }]
    },
    {
      id: 5, name: 'Deep Circuit',
      brief: 'The 4-4 core feeds three distant appliances. Long chains pay off.',
      source: { pips: [4, 4], r: 6, c: 6, dir: 'h' },
      appliances: [
        { pips: [5, 0], r: 2, c: 6, dir: 'h' },
        { pips: [2, 2], r: 6, c: 1, dir: 'h' },
        { pips: [1, 6], r: 10, c: 6, dir: 'h' }
      ],
      obstacles: [{ r: 4, c: 4 }, { r: 8, c: 9 }, { r: 6, c: 9 }]
    },
    {
      id: 6, name: 'Grid Surge',
      brief: 'Four appliances, two blocks, one very busy 5-5 core.',
      source: { pips: [5, 5], r: 6, c: 6, dir: 'v' },
      appliances: [
        { pips: [2, 6], r: 2, c: 3, dir: 'h' },
        { pips: [0, 3], r: 2, c: 9, dir: 'v' },
        { pips: [1, 4], r: 10, c: 4, dir: 'h' },
        { pips: [2, 4], r: 10, c: 9, dir: 'v' }
      ],
      obstacles: [{ r: 4, c: 7 }, { r: 8, c: 6 }]
    },
    {
      id: 7, name: 'Overload',
      brief: 'The 6-6 core must reach four corners of the board. Everything counts.',
      source: { pips: [6, 6], r: 6, c: 6, dir: 'h' },
      appliances: [
        { pips: [1, 0], r: 2, c: 6, dir: 'h' },
        { pips: [3, 4], r: 6, c: 11, dir: 'v' },
        { pips: [2, 5], r: 10, c: 6, dir: 'h' },
        { pips: [4, 6], r: 6, c: 1, dir: 'h' }
      ],
      obstacles: [{ r: 4, c: 4 }, { r: 4, c: 9 }, { r: 8, c: 9 }]
    }
  ];

  /* ------------------------------------------------------------ tiny helpers */

  const $ = (sel, root = document) => root.querySelector(sel);
  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
  const inBounds = (r, c) => r >= 0 && r < N && c >= 0 && c < N;
  const shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };
  const sameTile = (p, q) => {
    const a = [p[0], p[1]].sort((x, y) => x - y);
    const b = [q[0], q[1]].sort((x, y) => x - y);
    return a[0] === b[0] && a[1] === b[1];
  };

  let uid = 0;

  /* ------------------------------------------------------------ sound */

  const Sound = {
    enabled: true,
    ctx: null,
    ac() {
      if (!this.enabled) return null;
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        this.ctx = new AC();
      }
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return this.ctx;
    },
    blip(freq, dur, type, gain, slideTo, when) {
      const ctx = this.ac();
      if (!ctx) return;
      const t0 = ctx.currentTime + (when || 0);
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(gain || 0.05, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.03);
    },
    click() { this.blip(640, 0.05, 'square', 0.025); },
    select() { this.blip(520, 0.07, 'triangle', 0.04, 760); },
    place() {
      this.blip(220, 0.1, 'triangle', 0.06, 150);
      this.blip(880, 0.06, 'square', 0.02, 660, 0.02);
    },
    draw() { this.blip(300, 0.12, 'sawtooth', 0.03, 520); this.blip(420, 0.08, 'triangle', 0.03, 300, 0.07); },
    error() { this.blip(150, 0.16, 'sawtooth', 0.04, 90); },
    power() {
      [392, 523, 659, 784].forEach((f, i) => this.blip(f, 0.22, 'sine', 0.045, f * 1.02, i * 0.06));
      this.blip(110, 0.5, 'triangle', 0.03, 220);
    },
    win() {
      [523, 659, 784, 1046, 1318].forEach((f, i) => this.blip(f, 0.34, 'triangle', 0.05, f, i * 0.11));
    },
    fail() {
      [330, 262, 196].forEach((f, i) => this.blip(f, 0.3, 'sawtooth', 0.04, f * 0.9, i * 0.13));
    }
  };

  /* ------------------------------------------------------------ state */

  const state = {
    mode: 'solo',
    playerCount: 2,
    names: ['Player 1', 'Player 2', 'Player 3', 'Player 4'],
    levelIdx: 0,
    players: [],
    turn: 0,
    boneyard: [],
    boardTiles: [],
    grid: [],
    selectedId: null,
    orientation: 'h',
    hover: null,
    drawState: null,
    lastPlacedUid: null,
    handRevealed: true,
    phase: 'setup',
    log: [],
    roundStartTotals: [],
    progress: { best: {}, cleared: [], sound: true }
  };

  /* ------------------------------------------------------------ DOM refs */

  const dom = {
    board: $('#board'),
    tileLayer: $('#tileLayer'),
    statusHint: $('#statusHint'),
    chipLevel: $('#chipLevel'),
    chipBoneyard: $('#chipBoneyard'),
    chipCircuit: $('#chipCircuit'),
    brandSub: $('#brandSub'),
    turnName: $('#turnName'),
    turnSub: $('#turnSub'),
    handCount: $('#handCount'),
    powerFill: $('#powerFill'),
    powerText: $('#powerText'),
    handGrid: $('#handGrid'),
    handCover: $('#handCover'),
    handCoverText: $('#handCoverText'),
    btnReveal: $('#btnReveal'),
    btnRotate: $('#btnRotate'),
    btnDraw: $('#btnDraw'),
    btnEnd: $('#btnEnd'),
    scoreCard: $('#scoreCard'),
    logList: $('#logList'),
    setupScreen: $('#setupScreen'),
    resultScreen: $('#resultScreen'),
    resultBody: $('#resultBody'),
    howModal: $('#howModal'),
    wildModal: $('#wildModal'),
    wildRows: $('#wildRows'),
    toast: $('#toast'),
    btnSound: $('#btnSound')
  };

  const cellEls = [];
  let ghostEl = null;
  let wildPending = null;
  let wildDecl = [];
  let toastTimer = null;

  /* ------------------------------------------------------------ model helpers */

  function makeTile(a, b) {
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    return { uid: 't' + (++uid), a: lo, b: hi, pips: [lo, hi] };
  }

  function gridAt(r, c) {
    if (!inBounds(r, c)) return null;
    return state.grid[r * N + c];
  }

  function cellsFor(r, c, dir) {
    return dir === 'h' ? [{ r, c }, { r, c: c + 1 }] : [{ r, c }, { r: r + 1, c }];
  }

  function anchorFor(r, c, dir) {
    // Keep placements on the board when the cursor sits in the last column/row.
    if (dir === 'h' && c >= N - 1) return { r, c: N - 2 };
    if (dir === 'v' && r >= N - 1) return { r: N - 2, c };
    return { r, c };
  }

  function currentPlayer() { return state.players[state.turn] || null; }
  function appliances() { return state.boardTiles.filter((t) => t.kind === 'appliance'); }
  function poweredCount() { return appliances().filter((t) => t.powered).length; }
  function allPowered() { return appliances().every((t) => t.powered); }
  function matchPips(a, b) { return a === b || a === 0 || b === 0; }

  function addLog(msg) {
    state.log.push(msg);
    if (state.log.length > 40) state.log.shift();
  }

  function toast(msg, kind) {
    dom.toast.textContent = msg;
    dom.toast.className = 'toast show' + (kind ? ' ' + kind : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { dom.toast.className = 'toast'; }, 2600);
  }

  /* ------------------------------------------------------------ legality */

  function canPlace(tile, r, c, dir) {
    const cells = cellsFor(r, c, dir);
    for (const cc of cells) {
      if (!inBounds(cc.r, cc.c)) return { ok: false, reason: 'That placement runs off the board.' };
    }
    for (const cc of cells) {
      const g = gridAt(cc.r, cc.c);
      if (g.obstacle) return { ok: false, reason: 'An obstacle block fills that cell.' };
      if (g.tile) return { ok: false, reason: 'Those cells are already occupied.' };
    }
    let links = 0;
    for (let i = 0; i < cells.length; i++) {
      const cc = cells[i];
      for (const d of DIRS) {
        const nb = gridAt(cc.r + d[0], cc.c + d[1]);
        if (!nb || !nb.tile) continue;
        if (matchPips(tile.pips[i], nb.tile.pips[nb.half])) links++;
      }
    }
    if (!links) return { ok: false, reason: 'Must touch a placed domino with a matching pip.' };
    return { ok: true, links };
  }

  function checkPlacement(tile, r, c, dir) {
    const a = anchorFor(r, c, dir);
    const res = canPlace(tile, a.r, a.c, dir);
    res.anchor = a;
    return res;
  }

  function hasAnyPlacement(tile) {
    if (!tile) return false;
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        if (canPlace(tile, r, c, 'h').ok) return true;
        if (canPlace(tile, r, c, 'v').ok) return true;
      }
    }
    return false;
  }

  function handPenalty(hand) {
    return hand.reduce((sum, t) => sum + (t.a === 0 ? 10 : t.a) + (t.b === 0 ? 10 : t.b), 0);
  }

  /* ------------------------------------------------------------ power tracing */

  function computePower() {
    state.grid.forEach((g) => { g.powered = false; });
    state.boardTiles.forEach((t) => { t.powered = false; });

    const src = state.boardTiles.find((t) => t.kind === 'source');
    if (!src) return false;

    const seen = new Set();
    const queue = [];
    src.powered = true;
    src.cells.forEach((cc) => {
      const k = cc.r * N + cc.c;
      seen.add(k);
      queue.push(cc);
      gridAt(cc.r, cc.c).powered = true;
    });

    while (queue.length) {
      const cur = queue.shift();
      const here = gridAt(cur.r, cur.c);
      if (!here || !here.tile) continue;
      const myVal = here.tile.pips[here.half];

      for (const d of DIRS) {
        const nr = cur.r + d[0];
        const nc = cur.c + d[1];
        const nb = gridAt(nr, nc);
        if (!nb || !nb.tile) continue;
        if (!matchPips(myVal, nb.tile.pips[nb.half])) continue;

        nb.tile.powered = true;
        nb.powered = true;

        const k = nr * N + nc;
        if (seen.has(k)) continue;
        seen.add(k);
        queue.push({ r: nr, c: nc });

        const other = nb.tile.cells.find((x) => x.r !== nr || x.c !== nc);
        if (other) {
          const ok = other.r * N + other.c;
          if (!seen.has(ok)) {
            seen.add(ok);
            gridAt(other.r, other.c).powered = true;
            queue.push(other);
          }
        }
      }
    }
    return allPowered();
  }

  /* ------------------------------------------------------------ level setup */

  function addBaseTile(pips, r, c, dir, kind) {
    const tile = {
      uid: 'base' + (++uid),
      a: pips[0], b: pips[1],
      pips: [pips[0], pips[1]],
      cells: cellsFor(r, c, dir),
      dir,
      kind,
      powered: false,
      declared: [null, null],
      owner: null
    };
    state.boardTiles.push(tile);
    tile.cells.forEach((cc, i) => {
      const g = gridAt(cc.r, cc.c);
      g.tile = tile;
      g.half = i;
    });
    return tile;
  }

  function startLevel(idx, totals) {
    const L = LEVELS[idx];
    if (!L) return;
    const count = state.mode === 'solo' ? 1 : state.playerCount;

    state.levelIdx = idx;
    state.phase = 'playing';
    state.selectedId = null;
    state.hover = null;
    state.drawState = null;
    state.orientation = 'h';
    state.lastPlacedUid = null;
    state.boneyard = [];
    state.boardTiles = [];
    state.log = [];

    state.grid = [];
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        state.grid.push({ r, c, obstacle: false, tile: null, half: 0, powered: false });
      }
    }

    addBaseTile(L.source.pips, L.source.r, L.source.c, L.source.dir, 'source');
    L.appliances.forEach((a) => addBaseTile(a.pips, a.r, a.c, a.dir, 'appliance'));
    L.obstacles.forEach((o) => { gridAt(o.r, o.c).obstacle = true; });

    const excluded = [L.source.pips, ...L.appliances.map((a) => a.pips)];
    const deck = ALL_TILES
      .filter((pair) => !excluded.some((p) => sameTile(p, [pair[0], pair[1]])))
      .map((pair) => makeTile(pair[0], pair[1]));
    shuffle(deck);

    const names = state.mode === 'solo'
      ? ['You']
      : state.names.slice(0, count).map((n, i) => (n && n.trim()) || `Player ${i + 1}`);

    state.players = Array.from({ length: count }, (_, i) => ({
      name: names[i],
      hand: [],
      total: totals ? (totals[i] || 0) : 0
    }));

    state.turn = 0;
    for (let k = 0; k < HAND_SIZE; k++) {
      for (const p of state.players) if (deck.length) p.hand.push(deck.pop());
    }
    state.boneyard = deck;
    state.handRevealed = state.mode === 'solo';
    state.roundStartTotals = state.players.map((p) => p.total);

    computePower();
    addLog(`Level ${L.id} · ${L.name} — ${state.mode === 'solo' ? 'solo puzzle' : count + ' player pass & play'}.`);
    addLog(`Core ${L.source.pips[0]}-${L.source.pips[1]} online. ${L.appliances.length} appliance${L.appliances.length > 1 ? 's' : ''} to power.`);
    if (state.mode === 'multi') addLog(`${state.players[0].name} starts.`);

    renderAll();
  }

  /* ------------------------------------------------------------ turn flow */

  function drawOne() {
    return state.boneyard.length ? state.boneyard.pop() : null;
  }

  function commitPlace(tile, r, c, dir, declared) {
    const p = currentPlayer();
    if (!p) return;
    const idx = p.hand.findIndex((t) => t.uid === tile.uid);
    if (idx < 0) return;

    const check = checkPlacement(tile, r, c, dir);
    if (!check.ok) { toast(check.reason, 'error'); Sound.error(); return; }

    const a = check.anchor;
    p.hand.splice(idx, 1);

    const placed = {
      uid: 'p' + (++uid),
      a: tile.a, b: tile.b,
      pips: [tile.a, tile.b],
      cells: cellsFor(a.r, a.c, dir),
      dir,
      kind: 'player',
      powered: false,
      declared: declared.slice(),
      owner: state.turn
    };
    state.boardTiles.push(placed);
    placed.cells.forEach((cc, i) => {
      const g = gridAt(cc.r, cc.c);
      g.tile = placed;
      g.half = i;
    });

    state.lastPlacedUid = placed.uid;
    state.selectedId = null;
    state.drawState = null;
    state.hover = null;

    const before = poweredCount();
    addLog(`${tile.a}-${tile.b} placed by ${p.name}.`);
    Sound.place();

    const allOn = computePower();
    const after = poweredCount();
    if (after > before) {
      setTimeout(() => Sound.power(), 140);
      toast(`Appliance online — ${after}/${appliances().length} powered.`, 'good');
    }

    renderAll();
    afterMove(allOn);
  }

  function afterMove(allOn) {
    const p = currentPlayer();
    if (!p) return;

    if (p.hand.length === 0) {
      if (allOn) { finishRound('out'); return; }
      if (state.boneyard.length) {
        const t = drawOne();
        if (t) {
          p.hand.push(t);
          addLog('Out of tiles with the circuit incomplete — drawing 1 tile.');
          toast('Hand empty but the circuit is incomplete: you must draw 1 tile.', 'error');
        }
      }
      if (state.mode === 'multi') { endTurn(); return; }
      checkSoloStall();
      renderAll();
      return;
    }

    if (state.mode === 'multi') { endTurn(); return; }
    checkSoloStall();
    renderAll();
  }

  function endTurn() {
    state.selectedId = null;
    state.drawState = null;
    state.hover = null;
    state.orientation = 'h';
    state.turn = (state.turn + 1) % state.players.length;
    state.handRevealed = state.mode === 'solo';
    const p = currentPlayer();
    if (p) addLog(`Turn: ${p.name}.`);
    if (state.mode === 'multi' && isStalemate()) { finishRound('stalled'); return; }
    renderAll();
  }

  function isStalemate() {
    if (state.boneyard.length > 0) return false;
    return state.players.every((p) => !p.hand.some((t) => hasAnyPlacement(t)));
  }

  function checkSoloStall() {
    if (state.mode !== 'solo' || state.phase !== 'playing') return;
    if (state.boneyard.length > 0) return;
    const p = currentPlayer();
    if (!p) return;
    if (p.hand.length === 0) {
      if (!allPowered()) finishRound('stalled');
      return;
    }
    if (!p.hand.some((t) => hasAnyPlacement(t))) finishRound('stalled');
  }

  function finishRound(kind) {
    if (state.phase !== 'playing') return;
    state.phase = 'over';
    state.selectedId = null;
    state.drawState = null;
    computePower();
    const L = LEVELS[state.levelIdx];

    if (state.mode === 'solo') {
      if (kind === 'out') {
        const score = state.boneyard.length;
        const prevBest = state.progress.best[L.id] || 0;
        const newBest = score > prevBest;
        if (newBest) state.progress.best[L.id] = score;
        if (!state.progress.cleared.includes(L.id)) state.progress.cleared.push(L.id);
        saveProgress();
        Sound.win();
        addLog(`Circuit complete — boneyard score ${score}.`);
        renderAll();
        showResult({ type: 'solo-win', score, best: Math.max(prevBest, score), newBest });
      } else {
        Sound.fail();
        addLog('Circuit stalled — no legal moves and an empty boneyard.');
        renderAll();
        showResult({ type: 'solo-stall' });
      }
      return;
    }

    const penalties = state.players.map((p, i) => (
      kind === 'out' && i === state.turn ? 0 : handPenalty(p.hand)
    ));
    state.players.forEach((p, i) => { p.total += penalties[i]; });

    if (kind === 'out') {
      Sound.win();
      addLog(`Complete circuit — ${state.players[state.turn].name} went out. Round over.`);
    } else {
      Sound.fail();
      addLog('Circuit stalled — nobody can move.');
    }
    renderAll();
    showResult({
      type: kind === 'out' ? 'multi-win' : 'multi-stall',
      penalties,
      winner: kind === 'out' ? state.turn : -1
    });
  }

  /* ------------------------------------------------------------ renders */

  function pipSvg(v) {
    const dots = PIP_DOTS[v] || [];
    return '<svg viewBox="0 0 300 300" aria-hidden="true">' + dots.map(([x, y]) => (
      `<circle cx="${60 + x * 90}" cy="${60 + y * 90}" r="27"/>`
    )).join('') + '</svg>';
  }

  function halfEl(value, declared) {
    const h = document.createElement('div');
    h.className = 'half';
    h.innerHTML = pipSvg(value);
    if (value === 0 && declared != null) {
      const b = document.createElement('span');
      b.className = 'declared';
      b.textContent = declared;
      h.appendChild(b);
    }
    return h;
  }

  function badgeEl(kind, on) {
    const b = document.createElement('span');
    b.className = 'tile-badge ' + kind + (on ? ' on' : '');
    b.innerHTML = kind === 'source'
      ? '<svg viewBox="0 0 24 24"><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" fill="currentColor"/></svg>'
      : '<svg viewBox="0 0 24 24"><path d="M12 2a6.5 6.5 0 0 0-3.8 11.8V17h7.6v-3.2A6.5 6.5 0 0 0 12 2Z" fill="currentColor"/><rect x="9" y="18.6" width="6" height="2.2" rx="1.1" fill="currentColor"/><rect x="10" y="21.4" width="4" height="1.4" rx="0.7" fill="currentColor"/></svg>';
    return b;
  }

  function makeTileEl(t, extra) {
    const dir = t.dir;
    const c0 = t.cells[0];
    const node = document.createElement('div');
    node.className = 'tile ' + dir +
      (t.kind ? ' kind-' + t.kind : '') +
      (t.powered ? ' powered' : '') +
      (extra ? ' ' + extra : '');
    node.style.left = (c0.c * PCT) + '%';
    node.style.top = (c0.r * PCT) + '%';
    node.style.width = ((dir === 'h' ? 2 : 1) * PCT) + '%';
    node.style.height = ((dir === 'v' ? 2 : 1) * PCT) + '%';
    if (t.uid) node.dataset.uid = t.uid;

    const body = document.createElement('div');
    body.className = 'tile-body';
    for (let i = 0; i < 2; i++) {
      body.appendChild(halfEl(t.pips[i], t.declared ? t.declared[i] : null));
    }
    node.appendChild(body);

    if (t.kind === 'source') node.appendChild(badgeEl('source', false));
    if (t.kind === 'appliance') node.appendChild(badgeEl('appliance', t.powered));
    return node;
  }

  function activeTile() {
    const p = currentPlayer();
    if (!p) return null;
    if (state.drawState) return p.hand.find((t) => t.uid === state.drawState.tileId) || null;
    if (!state.selectedId) return null;
    return p.hand.find((t) => t.uid === state.selectedId) || null;
  }

  function hintCells() {
    const set = new Set();
    const tile = activeTile();
    if (!tile || state.phase !== 'playing') return set;
    if (state.mode === 'multi' && !state.handRevealed) return set;
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        if (checkPlacement(tile, r, c, state.orientation).ok) set.add(r * N + c);
      }
    }
    return set;
  }

  function renderBoard() {
    const hints = hintCells();
    for (let i = 0; i < state.grid.length; i++) {
      const g = state.grid[i];
      const cell = cellEls[i];
      if (!cell) continue;
      cell.classList.toggle('obstacle', g.obstacle);
      cell.classList.toggle('powered', !!g.powered);
      cell.classList.toggle('hint', hints.has(i) && !g.tile && !g.obstacle);
    }

    dom.tileLayer.innerHTML = '';
    state.boardTiles.forEach((t) => dom.tileLayer.appendChild(makeTileEl(t)));
    dom.board.classList.toggle('has-selection', !!activeTile());

    if (state.lastPlacedUid) {
      const uidAtRender = state.lastPlacedUid;
      const fresh = dom.tileLayer.querySelector('[data-uid="' + uidAtRender + '"]');
      if (fresh) fresh.classList.add('fresh');
      setTimeout(() => {
        if (state.lastPlacedUid === uidAtRender) state.lastPlacedUid = null;
      }, 450);
    }
  }

  function renderHand() {
    const p = currentPlayer();
    dom.handGrid.innerHTML = '';
    if (!p) return;

    const hidden = state.mode === 'multi' && !state.handRevealed && state.phase === 'playing';
    dom.handCover.hidden = !hidden;
    dom.handCoverText.textContent = p.name + ' — reveal your hand when ready.';
    dom.btnReveal.textContent = 'Reveal ' + p.name + "'s hand";

    if (hidden) {
      for (let i = 0; i < p.hand.length; i++) {
        const back = document.createElement('div');
        back.className = 'hand-back';
        dom.handGrid.appendChild(back);
      }
      return;
    }

    p.hand.forEach((t, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'hand-tile';
      const playable = state.phase === 'playing' && hasAnyPlacement(t);
      const allowed = !state.drawState || state.drawState.tileId === t.uid;
      btn.classList.toggle('playable', playable);
      btn.classList.toggle('dead', !playable);
      btn.classList.toggle('selected', state.selectedId === t.uid);
      btn.disabled = !allowed || state.phase !== 'playing';

      const key = document.createElement('span');
      key.className = 'ht-key';
      key.textContent = String(i + 1);

      const body = document.createElement('div');
      body.className = 'ht-body';
      body.appendChild(halfEl(t.a, null));
      body.appendChild(halfEl(t.b, null));

      btn.appendChild(body);
      btn.appendChild(key);
      btn.addEventListener('click', () => selectTile(t));
      dom.handGrid.appendChild(btn);
    });

    if (!p.hand.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-hand';
      empty.textContent = 'No tiles left.';
      dom.handGrid.appendChild(empty);
    }
  }

  function renderHud() {
    const L = LEVELS[state.levelIdx] || LEVELS[0];
    const p = currentPlayer();
    const apps = appliances();
    const on = apps.filter((t) => t.powered).length;

    dom.brandSub.textContent = 'Level ' + L.id + ' · ' + L.name;
    dom.chipLevel.textContent = L.id + ' / ' + LEVELS.length;
    dom.chipBoneyard.textContent = String(state.boneyard.length);
    dom.chipCircuit.textContent = on + '/' + apps.length;
    dom.handCount.textContent = p ? String(p.hand.length) : '0';

    dom.turnName.textContent = p ? p.name : '—';
    dom.turnSub.textContent = state.mode === 'solo'
      ? 'Solo circuit'
      : (state.handRevealed ? 'Your turn' : 'Hand hidden');

    const pctDone = apps.length ? (on / apps.length) * 100 : 0;
    dom.powerFill.style.width = pctDone + '%';
    dom.powerText.textContent = on + '/' + apps.length;
    document.body.classList.toggle('power-complete', apps.length > 0 && on === apps.length);
  }

  function renderControls() {
    const p = currentPlayer();
    const hidden = state.mode === 'multi' && !state.handRevealed;
    const playing = state.phase === 'playing';
    const tile = activeTile();
    const legalHand = p ? p.hand.some((t) => hasAnyPlacement(t)) : false;

    dom.btnRotate.disabled = !playing || hidden || !tile;
    dom.btnRotate.textContent = state.orientation === 'h' ? 'Rotate ⇄' : 'Rotate ⇅';

    dom.btnDraw.disabled = !playing || hidden || !!state.drawState || legalHand || state.boneyard.length === 0;
    dom.btnDraw.classList.toggle('attention', playing && !hidden && !state.drawState && !legalHand && state.boneyard.length > 0);

    const canEnd = playing && !hidden && state.mode === 'multi' &&
      (!!state.drawState || (!legalHand && state.boneyard.length === 0));
    dom.btnEnd.disabled = !canEnd;
    dom.btnEnd.hidden = state.mode !== 'multi';
  }

  function renderScore() {
    const L = LEVELS[state.levelIdx];
    if (state.mode === 'solo') {
      const best = state.progress.best[L.id] || 0;
      dom.scoreCard.innerHTML =
        '<div class="card-head"><h2>Score</h2><span class="tag">Solo</span></div>' +
        '<div class="score-row"><span class="p-name">Boneyard left</span><strong>' + state.boneyard.length + '</strong></div>' +
        '<div class="score-row"><span class="p-name">Best on this level</span><strong>' + (best || '—') + '</strong></div>' +
        '<p class="score-note">Clear the level with the most tiles still in the boneyard.</p>';
      return;
    }
    const rows = state.players.map((p, i) => (
      '<div class="score-row' + (i === state.turn && state.phase === 'playing' ? ' active' : '') + '">' +
        '<span class="p-name"><i class="dot"></i>' + escapeHtml(p.name) + '</span>' +
        '<span class="p-hand">' + p.hand.length + ' tiles</span>' +
        '<strong>' + p.total + '</strong>' +
      '</div>'
    )).join('');
    dom.scoreCard.innerHTML =
      '<div class="card-head"><h2>Match totals</h2><span class="tag">Low wins</span></div>' +
      rows +
      '<p class="score-note">Blanks count as 10 penalty points. Lowest total after level 7 wins.</p>';
  }

  function renderLog() {
    dom.logList.innerHTML = state.log.slice(-7).reverse()
      .map((line) => '<li>' + escapeHtml(line) + '</li>').join('');
  }

  function renderAll() {
    if (!state.players.length) return;
    renderHud();
    renderHand();
    renderControls();
    renderScore();
    renderLog();
    renderBoard();
    updatePreview();
  }

  /* ------------------------------------------------------------ preview + status */

  function setStatusDefault() {
    const p = currentPlayer();
    if (!p) return;
    if (state.drawState) {
      const t = p.hand.find((x) => x.uid === state.drawState.tileId);
      if (t && !hasAnyPlacement(t)) {
        dom.statusHint.textContent = 'The drawn tile has no legal home — end your turn.';
        return;
      }
    }
    if (state.mode === 'multi' && !state.handRevealed) {
      dom.statusHint.textContent = 'Waiting for ' + p.name + ' to reveal their hand.';
      return;
    }
    if (!p.hand.length) {
      dom.statusHint.textContent = 'Hand empty.';
      return;
    }
    if (!p.hand.some((t) => hasAnyPlacement(t))) {
      dom.statusHint.textContent = state.boneyard.length
        ? 'No legal moves — draw a tile.'
        : 'No legal moves and the boneyard is empty.';
      return;
    }
    dom.statusHint.textContent = state.selectedId
      ? 'Hover a cell to preview, click to place. R rotates.'
      : 'Select a domino from your hand.';
  }

  function updatePreview() {
    if (ghostEl) { ghostEl.remove(); ghostEl = null; }
    cellEls.forEach((c) => c.classList.remove('pv-ok', 'pv-bad'));

    const tile = activeTile();
    if (!tile || !state.hover || state.phase !== 'playing') { setStatusDefault(); return; }

    const res = checkPlacement(tile, state.hover.r, state.hover.c, state.orientation);
    const cells = cellsFor(res.anchor.r, res.anchor.c, state.orientation);
    cells.forEach((cc) => {
      const cell = gridAt(cc.r, cc.c);
      if (!cell) return;
      const node = cellEls[cc.r * N + cc.c];
      if (node) node.classList.add(res.ok ? 'pv-ok' : 'pv-bad');
    });

    if (cells.every((cc) => inBounds(cc.r, cc.c))) {
      ghostEl = makeTileEl({
        uid: '', pips: tile.pips, dir: state.orientation, cells,
        kind: 'ghost', declared: [null, null]
      }, 'ghost ' + (res.ok ? 'ok' : 'bad'));
      dom.tileLayer.appendChild(ghostEl);
    }

    dom.statusHint.textContent = res.ok
      ? 'Link ready — ' + res.links + ' matching edge' + (res.links > 1 ? 's' : '') + '. Click to place.'
      : res.reason;
  }

  /* ------------------------------------------------------------ interactions */

  function rotate() {
    if (state.phase !== 'playing') return;
    state.orientation = state.orientation === 'h' ? 'v' : 'h';
    Sound.click();
    renderAll();
  }

  function selectTile(tile) {
    if (state.phase !== 'playing') return;
    if (state.mode === 'multi' && !state.handRevealed) { toast('Reveal your hand first.'); return; }
    if (state.drawState && tile.uid !== state.drawState.tileId) {
      toast('You drew this turn — play the drawn tile or end your turn.');
      return;
    }
    if (state.selectedId === tile.uid) { rotate(); return; }
    if (!hasAnyPlacement(tile)) {
      toast('That domino has nowhere legal to go.', 'error');
      Sound.error();
      return;
    }
    state.selectedId = tile.uid;
    Sound.select();
    renderAll();
  }

  function tryPlace(r, c) {
    if (state.phase !== 'playing') return;
    if (state.mode === 'multi' && !state.handRevealed) { toast('Reveal your hand first.'); return; }
    const tile = activeTile();
    if (!tile) { toast('Select a domino from your hand first.'); return; }

    const res = checkPlacement(tile, r, c, state.orientation);
    if (!res.ok) { Sound.error(); toast(res.reason, 'error'); return; }

    if (tile.a === 0 || tile.b === 0) { openWild(tile, res.anchor.r, res.anchor.c, state.orientation); return; }
    commitPlace(tile, res.anchor.r, res.anchor.c, state.orientation, [null, null]);
  }

  function onDraw() {
    if (state.phase !== 'playing') return;
    if (state.mode === 'multi' && !state.handRevealed) { toast('Reveal your hand first.'); return; }
    if (state.drawState) { toast('You already drew this turn.'); return; }
    const p = currentPlayer();
    if (!p) return;
    if (p.hand.some((t) => hasAnyPlacement(t))) { toast('You still have a legal move — play a domino.'); return; }
    if (!state.boneyard.length) { toast('The boneyard is empty.', 'error'); return; }

    const t = drawOne();
    p.hand.push(t);
    const playable = hasAnyPlacement(t);
    state.drawState = { tileId: t.uid };
    state.selectedId = playable ? t.uid : null;
    addLog(`${t.a}-${t.b} drawn by ${p.name}.`);
    Sound.draw();

    if (state.mode === 'solo' && !playable) {
      // A solo player has no one to pass to: allow another draw instead of dead-ending.
      state.drawState = null;
      state.selectedId = null;
      toast('That tile cannot be placed — draw again.', 'error');
      if (state.boneyard.length === 0) { checkSoloStall(); return; }
      renderAll();
      return;
    }

    if (playable) toast('The drawn tile is playable — place it or end your turn.', 'good');
    else toast('That tile cannot be placed — end your turn.', 'error');
    renderAll();
  }

  function onEndTurn() {
    if (state.phase !== 'playing' || state.mode !== 'multi') return;
    if (!state.handRevealed) { toast('Reveal your hand first.'); return; }
    const p = currentPlayer();
    if (!p) return;
    const legal = p.hand.some((t) => hasAnyPlacement(t));
    if (state.drawState) { addLog(`Turn ended (${p.name}).`); endTurn(); return; }
    if (!legal && state.boneyard.length === 0) { addLog(`No legal move — turn passed (${p.name}).`); endTurn(); return; }
    toast('Place a domino or draw first.');
  }

  function revealHand() {
    if (state.mode !== 'multi' || state.handRevealed) return;
    state.handRevealed = true;
    Sound.click();
    renderAll();
  }

  /* ------------------------------------------------------------ wild modal */

  function openWild(tile, r, c, dir) {
    wildPending = { tile, r, c, dir };
    wildDecl = tile.pips.map((v) => (v === 0 ? null : undefined));
    dom.wildRows.innerHTML = '';
    tile.pips.forEach((v, i) => {
      if (v !== 0) return;
      const row = document.createElement('div');
      row.className = 'wild-row';
      const label = document.createElement('span');
      label.className = 'wild-label';
      label.textContent = 'Blank half ' + (i + 1) + ' — declared value';
      const opts = document.createElement('div');
      opts.className = 'wild-opts';
      for (let n = 1; n <= 6; n++) {
        const b = document.createElement('button');
        b.type = 'button';
        b.dataset.half = String(i);
        b.dataset.val = String(n);
        b.textContent = String(n);
        opts.appendChild(b);
      }
      const w = document.createElement('button');
      w.type = 'button';
      w.dataset.half = String(i);
      w.dataset.val = 'wild';
      w.className = 'active';
      w.textContent = 'Wild';
      opts.appendChild(w);
      row.appendChild(label);
      row.appendChild(opts);
      dom.wildRows.appendChild(row);
    });
    dom.wildModal.hidden = false;
    Sound.click();
  }

  function closeWild() {
    wildPending = null;
    dom.wildModal.hidden = true;
  }

  /* ------------------------------------------------------------ results */

  function showResult(payload) {
    const L = LEVELS[state.levelIdx];
    const hasNext = state.levelIdx + 1 < LEVELS.length;
    const nextBtn = hasNext
      ? '<button class="btn primary" data-act="next" type="button">Next level ▸</button>'
      : '';
    let html = '';

    if (payload.type === 'solo-win') {
      html =
        '<span class="result-badge">Circuit complete</span>' +
        '<h2>Level ' + L.id + ' cleared</h2>' +
        '<p class="result-sub">Every appliance is powered and your hand is empty. The tiles still resting in the boneyard are your score.</p>' +
        '<div class="result-score"><span>Boneyard score</span><strong>' + payload.score + '</strong>' +
        (payload.newBest ? '<em>new best</em>' : '<em>best ' + payload.best + '</em>') + '</div>' +
        '<div class="screen-actions">' + nextBtn +
        '<button class="btn" data-act="replay" type="button">Replay level</button>' +
        '<button class="btn ghost" data-act="menu" type="button">Menu</button></div>';
    } else if (payload.type === 'solo-stall') {
      html =
        '<span class="result-badge stall">Circuit stalled</span>' +
        '<h2>Out of moves</h2>' +
        '<p class="result-sub">The boneyard is empty and no tile in your hand fits anywhere on the board. Try a different order of play, or restart the level.</p>' +
        '<div class="screen-actions">' +
        '<button class="btn primary" data-act="replay" type="button">Replay level</button>' +
        '<button class="btn ghost" data-act="menu" type="button">Menu</button></div>';
    } else {
      const totals = state.players.map((p, i) => ({ name: p.name, total: p.total, penalty: payload.penalties[i], i }));
      const lead = Math.min(...totals.map((t) => t.total));
      const rows = totals.map((t) => {
        const cls = [t.i === payload.winner ? 'out' : '', t.total === lead ? 'leader' : ''].filter(Boolean).join(' ');
        return '<tr class="' + cls + '">' +
          '<td>' + escapeHtml(t.name) + (t.i === payload.winner ? ' ⚡' : '') + '</td>' +
          '<td>' + t.penalty + '</td>' +
          '<td>' + t.total + '</td></tr>';
      }).join('');

      html =
        '<span class="result-badge' + (payload.type === 'multi-stall' ? ' stall' : '') + '">' +
        (payload.type === 'multi-win' ? 'Level complete' : 'Stalled') + '</span>' +
        '<h2>' + (payload.type === 'multi-win'
          ? escapeHtml(state.players[payload.winner].name) + ' goes out'
          : 'Nobody can move') + '</h2>' +
        '<p class="result-sub">' +
        (payload.type === 'multi-win'
          ? 'The circuit is complete. Opponents score the pips left in their hands — blanks count as 10.'
          : 'The boneyard is empty and no player has a legal move. Everyone scores their remaining hand.') +
        '</p>' +
        '<table class="result-table"><thead><tr><th>Player</th><th>This level</th><th>Total</th></tr></thead><tbody>' +
        rows + '</tbody></table>' +
        '<p class="result-note">Lowest cumulative total leads' + (hasNext ? ' — carry the totals into the next level.' : ' — final standings.') + '</p>' +
        '<div class="screen-actions">' + nextBtn +
        '<button class="btn" data-act="replay" type="button">Replay level</button>' +
        '<button class="btn ghost" data-act="menu" type="button">Menu</button></div>';
    }

    dom.resultBody.innerHTML = html;
    dom.resultScreen.hidden = false;
  }

  /* ------------------------------------------------------------ setup screen */

  function modeNoteText() {
    if (state.mode === 'solo') {
      return 'Solo: clear the board before the boneyard runs dry. Your score is the number of tiles still left in the boneyard.';
    }
    return 'Pass and play: hands are hidden between turns. The first player out with a complete circuit ends the level; everyone else scores their leftover pips (blanks = 10). Lowest total wins.';
  }

  function renderLevelRail() {
    const rail = $('#levelRail');
    rail.innerHTML = '';
    LEVELS.forEach((L, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'level-btn' + (i === state.levelIdx ? ' active' : '') +
        (state.progress.cleared.includes(L.id) ? ' cleared' : '');
      btn.dataset.idx = String(i);
      btn.innerHTML =
        '<span class="lv-num">LEVEL ' + String(L.id).padStart(2, '0') + '</span>' +
        '<span class="lv-name">' + escapeHtml(L.name) + '</span>' +
        '<span class="lv-pips">core ' + L.source.pips[0] + '-' + L.source.pips[1] + '</span>';
      rail.appendChild(btn);
    });
  }

  function updateLevelPreview() {
    const L = LEVELS[state.levelIdx];
    const players = state.mode === 'solo' ? 1 : state.playerCount;
    const boneyard = 28 - 1 - L.appliances.length - players * HAND_SIZE;
    $('#levelPreview').innerHTML =
      '<div class="preview-head"><strong>Level ' + L.id + '</strong><span>' + escapeHtml(L.name) + '</span></div>' +
      '<p class="preview-brief">' + escapeHtml(L.brief) + '</p>' +
      '<div class="preview-stats">' +
        '<div><span>Core</span><strong>' + L.source.pips[0] + '-' + L.source.pips[1] + '</strong></div>' +
        '<div><span>Appliances</span><strong>' + L.appliances.length + '</strong></div>' +
        '<div><span>Obstacles</span><strong>' + L.obstacles.length + '</strong></div>' +
        '<div><span>Boneyard</span><strong>' + Math.max(0, boneyard) + '</strong></div>' +
      '</div>';
  }

  function buildNames() {
    const list = $('#nameList');
    const count = state.playerCount;
    if (state.mode !== 'multi') { list.innerHTML = ''; return; }
    if (list.children.length === count) return;
    list.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const row = document.createElement('label');
      const tag = document.createElement('span');
      tag.textContent = 'P' + (i + 1);
      const input = document.createElement('input');
      input.type = 'text';
      input.maxLength = 14;
      input.value = state.names[i] || ('Player ' + (i + 1));
      input.addEventListener('input', () => {
        state.names[i] = input.value.trim() || ('Player ' + (i + 1));
      });
      row.appendChild(tag);
      row.appendChild(input);
      list.appendChild(row);
    }
  }

  function syncSetup() {
    $('#modeSeg').querySelectorAll('button').forEach((b) => {
      b.classList.toggle('active', b.dataset.mode === state.mode);
    });
    $('#countSeg').querySelectorAll('button').forEach((b) => {
      b.classList.toggle('active', Number(b.dataset.count) === state.playerCount);
    });
    $('#multiOpts').hidden = state.mode !== 'multi';
    $('#modeNote').textContent = modeNoteText();
    buildNames();
    renderLevelRail();
    updateLevelPreview();
  }

  function openSetup() {
    state.phase = 'setup';
    state.players = [];
    dom.resultScreen.hidden = true;
    closeWild();
    dom.setupScreen.hidden = false;
    document.body.classList.remove('power-complete');
    syncSetup();
  }

  function startGame() {
    state.progress.mode = state.mode;
    state.progress.count = state.playerCount;
    saveProgress();
    dom.setupScreen.hidden = true;
    dom.resultScreen.hidden = true;
    Sound.click();
    startLevel(state.levelIdx, null);
  }

  /* ------------------------------------------------------------ persistence */

  function saveProgress() {
    state.progress.level = state.levelIdx;
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state.progress));
    } catch (err) { /* storage may be unavailable */ }
  }

  function loadProgress() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
      state.progress = Object.assign({ best: {}, cleared: [], sound: true }, raw);
      if (!state.progress.best || typeof state.progress.best !== 'object') state.progress.best = {};
      if (!Array.isArray(state.progress.cleared)) state.progress.cleared = [];
      if (typeof state.progress.level === 'number') {
        state.levelIdx = Math.min(LEVELS.length - 1, Math.max(0, state.progress.level));
      }
      if (state.progress.mode === 'multi') state.mode = 'multi';
      if (typeof state.progress.count === 'number') {
        state.playerCount = Math.min(4, Math.max(2, state.progress.count));
      }
      Sound.enabled = state.progress.sound !== false;
    } catch (err) { /* ignore corrupt storage */ }
  }

  function updateSoundBtn() {
    dom.btnSound.textContent = Sound.enabled ? '🔊' : '🔇';
    dom.btnSound.setAttribute('aria-label', Sound.enabled ? 'Mute sound' : 'Enable sound');
  }

  /* ------------------------------------------------------------ events */

  function buildBoard() {
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.r = String(r);
        cell.dataset.c = String(c);
        cell.setAttribute('role', 'gridcell');
        dom.board.appendChild(cell);
        cellEls.push(cell);
      }
    }
  }

  function bindEvents() {
    dom.board.addEventListener('mouseover', (e) => {
      const cell = e.target.closest ? e.target.closest('.cell') : null;
      if (!cell) return;
      const r = Number(cell.dataset.r);
      const c = Number(cell.dataset.c);
      if (state.hover && state.hover.r === r && state.hover.c === c) return;
      state.hover = { r, c };
      updatePreview();
    });

    dom.board.addEventListener('mouseleave', () => {
      state.hover = null;
      updatePreview();
    });

    dom.board.addEventListener('click', (e) => {
      const cell = e.target.closest ? e.target.closest('.cell') : null;
      if (!cell) return;
      tryPlace(Number(cell.dataset.r), Number(cell.dataset.c));
    });

    dom.btnRotate.addEventListener('click', rotate);
    dom.btnDraw.addEventListener('click', onDraw);
    dom.btnEnd.addEventListener('click', onEndTurn);
    dom.btnReveal.addEventListener('click', revealHand);

    $('#btnHow').addEventListener('click', () => { dom.howModal.hidden = false; Sound.click(); });
    $('#btnHow2').addEventListener('click', () => { dom.howModal.hidden = false; Sound.click(); });
    $('#btnHowClose').addEventListener('click', () => { dom.howModal.hidden = true; });
    dom.howModal.addEventListener('click', (e) => {
      if (e.target === dom.howModal) dom.howModal.hidden = true;
    });

    $('#modeSeg').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-mode]');
      if (!b) return;
      state.mode = b.dataset.mode;
      Sound.click();
      syncSetup();
    });

    $('#countSeg').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-count]');
      if (!b) return;
      state.playerCount = Number(b.dataset.count);
      Sound.click();
      syncSetup();
    });

    $('#levelRail').addEventListener('click', (e) => {
      const b = e.target.closest('.level-btn');
      if (!b) return;
      state.levelIdx = Number(b.dataset.idx);
      Sound.click();
      syncSetup();
    });

    $('#btnStart').addEventListener('click', startGame);
    $('#btnMenu').addEventListener('click', openSetup);

    dom.btnSound.addEventListener('click', () => {
      Sound.enabled = !Sound.enabled;
      state.progress.sound = Sound.enabled;
      saveProgress();
      updateSoundBtn();
      if (Sound.enabled) Sound.click();
    });

    dom.wildRows.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-half]');
      if (!b) return;
      const half = Number(b.dataset.half);
      wildDecl[half] = b.dataset.val === 'wild' ? null : Number(b.dataset.val);
      const row = b.parentElement;
      row.querySelectorAll('button').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      Sound.click();
    });

    $('#wildCancel').addEventListener('click', closeWild);
    $('#wildConfirm').addEventListener('click', () => {
      if (!wildPending) { closeWild(); return; }
      const pend = wildPending;
      const decl = wildDecl.slice();
      closeWild();
      commitPlace(pend.tile, pend.r, pend.c, pend.dir, decl);
    });

    dom.wildModal.addEventListener('click', (e) => {
      if (e.target === dom.wildModal) closeWild();
    });

    dom.resultScreen.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const act = b.dataset.act;
      dom.resultScreen.hidden = true;
      if (act === 'next') {
        const totals = state.mode === 'multi' ? state.players.map((p) => p.total) : null;
        startLevel(Math.min(LEVELS.length - 1, state.levelIdx + 1), totals);
      } else if (act === 'replay') {
        startLevel(state.levelIdx, state.mode === 'multi' ? state.roundStartTotals.slice() : null);
      } else if (act === 'menu') {
        openSetup();
      }
    });

    document.addEventListener('keydown', (e) => {
      const anyModal = !dom.howModal.hidden || !dom.wildModal.hidden;

      if (e.key === 'Escape') {
        if (!dom.wildModal.hidden) { closeWild(); return; }
        if (!dom.howModal.hidden) { dom.howModal.hidden = true; return; }
        if (state.selectedId) { state.selectedId = null; renderAll(); return; }
        return;
      }

      if (anyModal || state.phase !== 'playing') return;
      if (!dom.setupScreen.hidden || !dom.resultScreen.hidden) return;

      const target = e.target;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;

      const key = e.key.toLowerCase();
      if (key === 'r') { rotate(); e.preventDefault(); }
      else if (key === 'd') { onDraw(); e.preventDefault(); }
      else if (key === 'e') { onEndTurn(); e.preventDefault(); }
      else if (/^[1-5]$/.test(key)) {
        const p = currentPlayer();
        if (!p) return;
        const t = p.hand[Number(key) - 1];
        if (t) selectTile(t);
        e.preventDefault();
      }
    });
  }

  /* ------------------------------------------------------------ boot */

  loadProgress();
  buildBoard();
  bindEvents();
  updateSoundBtn();
  openSetup();
})();

/**
 * Dynamic Crossword Grid Generator with Rebus & Progressive Clues
 */

const THEMES = [
  {
    theme: "Decentralized Systems & AI",
    title: "The Consensus Matrix",
    author: "x402 Autonomous Architect",
    dimensions: { rows: 6, cols: 6 },
    rebus: { row: 2, col: 2, word: "NODE", clueHint: "Core network participant [REBUS: 4 letters in one cell]" },
    words: [
      { id: "1A", num: 1, dir: "across", r: 0, c: 0, sol: "BLOCK", clue: "Foundational chain unit (Unlocks progressive wing!)", secret: false, unlocks: "1A" },
      { id: "6A", num: 6, dir: "across", r: 1, c: 0, sol: "AGENT", clue: "Autonomous AI executor navigating web protocols", secret: false },
      { id: "7A", num: 7, dir: "across", r: 2, c: 0, sol: "SY NODE C", clue: "Coordinated network sync point containing a central nexus", secret: false, isRebus: true },
      { id: "8A", num: 8, dir: "across", r: 3, c: 0, sol: "STATE", clue: "Ledger status persisted across verified transitions", secret: false },
      { id: "9A", num: 9, dir: "across", r: 4, c: 0, sol: "TOKEN", clue: "Digital asset passed in x402 headers", secret: false },
      { id: "10A", num: 10, dir: "across", r: 5, c: 0, sol: "YIELD", clue: "Productivity metric or return on computational capital", secret: true, unlockCondition: "1A" },
      
      { id: "1D", num: 1, dir: "down", r: 0, c: 0, sol: "BASIS", clue: "Foundational ground truth or L2 infrastructure", secret: false },
      { id: "2D", num: 2, dir: "down", r: 0, c: 1, sol: "LOGIC", clue: "Algorithmic decision tree powering smart contracts", secret: false },
      { id: "3D", num: 3, dir: "down", r: 0, c: 2, sol: "O NODE AY", clue: "Interconnected consensus line intersecting the central nexus", secret: false, isRebus: true },
      { id: "4D", num: 4, dir: "down", r: 0, c: 3, sol: "CATER", clue: "To serve agentic micro-requests with low latency", secret: false },
      { id: "5D", num: 5, dir: "down", r: 0, c: 4, sol: "KTEEN", clue: "Cryptographic cipher salt prefix", secret: false },
      { id: "11D", num: 11, dir: "down", r: 0, c: 5, sol: "SHADOW", clue: "Secret secondary channel unveiled by solving 1-Across", secret: true, unlockCondition: "1A" }
    ],
    progressive: {
      triggerClueId: "1A",
      revealsGridCells: [
        { row: 0, col: 5 },
        { row: 1, col: 5 },
        { row: 2, col: 5 },
        { row: 3, col: 5 },
        { row: 4, col: 5 },
        { row: 5, col: 5 }
      ],
      revealsClueIds: ["10A", "11D"],
      bannerMessage: "⚡ PROGRESSIVE UNLOCK: Solving 1-Across unlocked the Hidden Consensus Column (#6) and Secret Clue 11-Down!"
    }
  },
  {
    theme: "Celestial Navigation",
    title: "The Stellar Vault",
    author: "x402 Celestial Cartographer",
    dimensions: { rows: 6, cols: 6 },
    rebus: { row: 2, col: 2, word: "STAR", clueHint: "Luminous celestial body [REBUS: 4 letters in one cell]" },
    words: [
      { id: "1A", num: 1, dir: "across", r: 0, c: 0, sol: "SOLAR", clue: "Pertaining to our home luminary (Unlocks outer orbit!)", secret: false, unlocks: "1A" },
      { id: "6A", num: 6, dir: "across", r: 1, c: 0, sol: "ORBIT", clue: "Curved gravitational trajectory through space", secret: false },
      { id: "7A", num: 7, dir: "across", r: 2, c: 0, sol: "A P STAR L E", clue: "Mythical fruit shaped like the North star", secret: false, isRebus: true },
      { id: "8A", num: 8, dir: "across", r: 3, c: 0, sol: "RADAR", clue: "Echo-location instrument scanning planetary rings", secret: false },
      { id: "9A", num: 9, dir: "across", r: 4, c: 0, sol: "TITAN", clue: "Saturn's methane moon and cosmic monolith", secret: false },
      { id: "10A", num: 10, dir: "across", r: 5, c: 0, sol: "ZENITH", clue: "The highest astronomical point overhead", secret: true, unlockCondition: "1A" },
      
      { id: "1D", num: 1, dir: "down", r: 0, c: 0, sol: "SONAR", clue: "Sub-surface wave pinging deep ice moons", secret: false },
      { id: "2D", num: 2, dir: "down", r: 0, c: 1, sol: "OPERA", clue: "Cosmic symphonic drama played in vacuum", secret: false },
      { id: "3D", num: 3, dir: "down", r: 0, c: 2, sol: "L B STAR D N", clue: "Stellar beacon crossroad", secret: false, isRebus: true },
      { id: "4D", num: 4, dir: "down", r: 0, c: 3, sol: "A T A T T", clue: "Mechanical surveyor units walking rocky asteroids", secret: false },
      { id: "5D", num: 5, dir: "down", r: 0, c: 4, sol: "ROTOR", clue: "Spinning gyroscope stabilizing satellite attitude", secret: false },
      { id: "11D", num: 11, dir: "down", r: 0, c: 5, sol: "PULSAR", clue: "Rapidly rotating neutron star revealed by orbital solution", secret: true, unlockCondition: "1A" }
    ],
    progressive: {
      triggerClueId: "1A",
      revealsGridCells: [
        { row: 0, col: 5 },
        { row: 1, col: 5 },
        { row: 2, col: 5 },
        { row: 3, col: 5 },
        { row: 4, col: 5 },
        { row: 5, col: 5 }
      ],
      revealsClueIds: ["10A", "11D"],
      bannerMessage: "🌟 COSMIC UNLOCK: 1-Across ignited the Pulsar Array and uncovered the Deep Space Column!"
    }
  }
];

export function generateCrosswordPuzzle(options = {}) {
  const selectedTheme = options.theme 
    ? THEMES.find(t => t.theme.toLowerCase().includes(options.theme.toLowerCase())) || THEMES[0]
    : THEMES[Math.floor(Math.random() * THEMES.length)];

  const { rows, cols } = selectedTheme.dimensions;
  const grid = [];

  // Build grid matrix
  for (let r = 0; r < rows; r++) {
    const rowCells = [];
    for (let c = 0; c < cols; c++) {
      const isProgressiveCol = (c === cols - 1);
      const isRebusCell = (r === selectedTheme.rebus.row && c === selectedTheme.rebus.col);

      // Find across and down clues passing through this cell
      const acrossClue = selectedTheme.words.find(w => w.dir === "across" && w.r === r);
      const downClue = selectedTheme.words.find(w => w.dir === "down" && w.c === c);

      let solutionChar = " ";
      if (isRebusCell) {
        solutionChar = selectedTheme.rebus.word;
      } else if (acrossClue && acrossClue.sol[c]) {
        solutionChar = acrossClue.sol[c];
      } else if (downClue && downClue.sol[r]) {
        solutionChar = downClue.sol[r];
      }

      // Cell clue number assignment
      let cellNumber = null;
      const clueStartingHere = selectedTheme.words.find(w => w.r === r && w.c === c);
      if (clueStartingHere) {
        cellNumber = clueStartingHere.num;
      }

      rowCells.push({
        row: r,
        col: c,
        solution: solutionChar,
        isBlocked: false,
        number: cellNumber,
        acrossClueId: acrossClue ? acrossClue.id : null,
        downClueId: downClue ? downClue.id : null,
        isRebus: isRebusCell,
        rebusValue: isRebusCell ? selectedTheme.rebus.word : null,
        isUnlocked: !isProgressiveCol,
        unlockCondition: isProgressiveCol ? "1A" : null
      });
    }
    grid.push(rowCells);
  }

  // Format Clues
  const clues = selectedTheme.words.map(w => ({
    id: w.id,
    number: w.num,
    direction: w.dir,
    text: w.clue,
    solution: w.sol,
    row: w.r,
    col: w.c,
    length: w.sol.length,
    isRebus: Boolean(w.isRebus),
    isSecret: Boolean(w.secret),
    isUnlocked: !w.secret,
    unlockCondition: w.unlockCondition || null,
    progressiveHints: [
      { stage: 1, hint: "Category / Domain: " + selectedTheme.theme },
      { stage: 2, hint: "Starting Letter: " + w.sol[0] + ", Length: " + w.sol.length },
      { stage: 3, hint: "Direct Clue: " + w.clue }
    ]
  }));

  return {
    id: `x402-cw-${Date.now()}`,
    title: selectedTheme.title,
    theme: selectedTheme.theme,
    difficulty: options.difficulty || "medium",
    author: selectedTheme.author,
    dimensions: { rows, cols },
    grid,
    clues,
    progressiveTriggers: [selectedTheme.progressive],
    features: {
      hasRebus: true,
      rebusLocation: { row: selectedTheme.rebus.row, col: selectedTheme.rebus.col, word: selectedTheme.rebus.word },
      hasProgressiveUnlocks: true,
      unlockTriggerCount: 1,
      secretCluesCount: clues.filter(c => c.isSecret).length
    },
    generatedAt: new Date().toISOString()
  };
}

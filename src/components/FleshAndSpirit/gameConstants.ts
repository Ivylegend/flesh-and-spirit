// gameConstants.ts

export const COLS = 6;
export const TOTAL_TILES = 34;
export const START_TILE = 1;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 4;
export const HOLY_SPIRIT_CARDS_PER_PLAYER = 3;

// ─── Types ────────────────────────────────────────────────────────────────────

export type TokenColor = "red" | "blue" | "green" | "yellow";

export interface HolySpiritCard {
  id: string;
  attribute: string;
  steps: number;
}

export interface Player {
  id: string;
  name: string;
  color: TokenColor;
  position: number;
  cards: HolySpiritCard[];
  hasWon: boolean;
}

export interface GameState {
  phase: "setup" | "playing" | "won";
  players: Player[];
  currentPlayerIndex: number;
  diceValue: number | null;
  isRolling: boolean;
  lastEvent: GameEvent | null;
  pendingHolySpiritChoice: boolean;
}

export type GameEventType =
  | "dice_rolled"
  | "moved"
  | "sin_triggered"
  | "holy_spirit_triggered"
  | "card_used"
  | "won";

export interface GameEvent {
  type: GameEventType;
  playerName: string;
  playerColor: TokenColor;
  message: string;
  fromTile?: number;
  toTile?: number;
  sinName?: string;
  cardAttribute?: string;
  cardSteps?: number;
}

export interface TileData {
  num: number;
  gridRow: number;
  gridCol: number;
}

// ─── Board Layout ─────────────────────────────────────────────────────────────

export function buildLayout(): TileData[] {
  const layout: TileData[] = [];

  function addRow(start: number, gridRow: number, ltr: boolean) {
    for (let i = 0; i < COLS; i++) {
      layout.push({
        num: start + i,
        gridRow,
        gridCol: ltr ? i + 1 : COLS - i,
      });
    }
  }

  function addBridge(num: number, gridCol: number, gridRow: number) {
    layout.push({ num, gridRow, gridCol });
  }

  addRow(1,  9, true);
  addBridge(7,  6, 8);
  addRow(8,  7, false);
  addBridge(14, 1, 6);
  addRow(15, 5, true);
  addBridge(21, 6, 4);
  addRow(22, 3, false);
  addBridge(28, 1, 2);
  addRow(29, 1, true);

  return layout;
}

export const LAYOUT = buildLayout();

export const TILE_MAP: Record<number, { gridRow: number; gridCol: number }> =
  Object.fromEntries(LAYOUT.map((t) => [t.num, { gridRow: t.gridRow, gridCol: t.gridCol }]));

// ─── Sin Tiles ────────────────────────────────────────────────────────────────

export interface SinTile {
  name: string;
  returnsTo: number;
}

export const SIN_TILES: Record<number, SinTile> = {
  4:  { name: "Lying",          returnsTo: 1  },
  7:  { name: "Cheating",       returnsTo: 6  },
  9:  { name: "Stealing",       returnsTo: 4  },
  12: { name: "Disobedience",   returnsTo: 1  },
  15: { name: "Gluttony",       returnsTo: 11 },
  20: { name: "Anger",          returnsTo: 8  },
  22: { name: "Jealousy",       returnsTo: 11 },
  26: { name: "Fighting",       returnsTo: 14 },
  30: { name: "Hatred/Murder",  returnsTo: 18 },
  32: { name: "Lust",           returnsTo: 10 },
};

// Resolve sin chains: tile 9 → tile 4 → tile 1
export function resolveSinChain(tile: number): { finalTile: number; chain: number[] } {
  const chain: number[] = [];
  let current = tile;
  const visited = new Set<number>();
  while (SIN_TILES[current] && !visited.has(current)) {
    visited.add(current);
    chain.push(current);
    current = SIN_TILES[current].returnsTo;
  }
  return { finalTile: current, chain };
}

// ─── Holy Spirit Tiles ────────────────────────────────────────────────────────

export const HOLY_SPIRIT_TILES = new Set([3, 13, 17, 21, 24, 28]);

// ─── Holy Spirit Card Deck ────────────────────────────────────────────────────

export const HOLY_SPIRIT_ATTRIBUTES: { attribute: string; steps: number }[] = [
  { attribute: "Love",         steps: 4  },
  { attribute: "Joy",          steps: 5  },
  { attribute: "Peace",        steps: 6  },
  { attribute: "Patience",     steps: 7  },
  { attribute: "Kindness",     steps: 8  },
  { attribute: "Goodness",     steps: 9  },
  { attribute: "Faithfulness", steps: 10 },
  { attribute: "Gentleness",   steps: 11 },
  { attribute: "Self-control", steps: 12 },
];

export function createDeck(): HolySpiritCard[] {
  const deck: HolySpiritCard[] = [];
  let id = 0;
  for (let copy = 0; copy < 4; copy++) {
    for (const { attribute, steps } of HOLY_SPIRIT_ATTRIBUTES) {
      deck.push({ id: `card_${id++}`, attribute, steps });
    }
  }
  return shuffleDeck(deck);
}

export function shuffleDeck(deck: HolySpiritCard[]): HolySpiritCard[] {
  const d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

// ─── Token Colors ─────────────────────────────────────────────────────────────

export const TOKEN_COLORS: Record<TokenColor, {
  bg: string; border: string; text: string; ring: string; label: string; hex: string;
}> = {
  red:    { bg: "bg-red-500",    border: "border-red-600",    text: "text-red-600",    ring: "ring-red-400",    label: "Red",    hex: "#ef4444" },
  blue:   { bg: "bg-blue-500",   border: "border-blue-600",   text: "text-blue-600",   ring: "ring-blue-400",   label: "Blue",   hex: "#3b82f6" },
  green:  { bg: "bg-green-500",  border: "border-green-600",  text: "text-green-600",  ring: "ring-green-400",  label: "Green",  hex: "#22c55e" },
  yellow: { bg: "bg-yellow-400", border: "border-yellow-500", text: "text-yellow-600", ring: "ring-yellow-300", label: "Yellow", hex: "#facc15" },
};

export const ALL_COLORS: TokenColor[] = ["red", "blue", "green", "yellow"];

// ─── Tile type helper ─────────────────────────────────────────────────────────

export type TileType = "crown" | "start" | "flesh" | "spirit" | "normal";

export function getTileType(num: number): TileType {
  if (num === TOTAL_TILES)        return "crown";
  if (num === START_TILE)         return "start";
  if (SIN_TILES[num])             return "flesh";
  if (HOLY_SPIRIT_TILES.has(num)) return "spirit";
  return "normal";
}

// Build ordered path of tile numbers from → to (for animation)
export function buildPath(from: number, to: number): number[] {
  if (to >= from) return Array.from({ length: to - from + 1 }, (_, i) => from + i);
  return Array.from({ length: from - to + 1 }, (_, i) => from - i);
}
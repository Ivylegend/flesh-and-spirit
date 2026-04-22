// GameBoard.tsx
// Board with per-tile token rendering and bounce animation highlight

import {
  LAYOUT,
  SIN_TILES,
  TOKEN_COLORS,
  Player,
  getTileType,
  TileType,
} from "./gameConstants";
import { AnimatingToken } from "./useGameLogic";

// ─── Tile styling ─────────────────────────────────────────────────────────────

function getTileStyle(type: TileType): string {
  switch (type) {
    case "crown":
      return "bg-amber-50  border-amber-400";
    case "start":
      return "bg-gray-100  border-gray-300";
    case "flesh":
      return "bg-orange-50 border-orange-300";
    case "spirit":
      return "bg-emerald-50 border-emerald-300";
    default:
      return "bg-white border-gray-200";
  }
}

// ─── Tile inner content ───────────────────────────────────────────────────────

function TileContent({ num, type }: { num: number; type: TileType }) {
  switch (type) {
    case "crown":
      return (
        <div className="flex flex-col items-center">
          <span className="text-lg leading-none">👑</span>
          <span className="text-[6px] font-bold text-amber-700 mt-0.5 tracking-wider">
            CROWN
          </span>
        </div>
      );
    case "start":
      return (
        <span className="text-[9px] font-bold text-gray-400 tracking-widest">
          START
        </span>
      );
    case "flesh":
      return (
        <div className="flex flex-col items-center w-full">
          <span className="text-[7px] text-orange-300 font-mono self-start pl-0.5 leading-none">
            {num}
          </span>
          <span className="text-sm leading-none">🔥</span>
          <span className="text-[6px] font-semibold text-orange-700 mt-0.5 text-center leading-tight px-0.5 truncate w-full">
            {SIN_TILES[num].name}
          </span>
        </div>
      );
    case "spirit":
      return (
        <div className="flex flex-col items-center w-full">
          <span className="text-[7px] text-emerald-300 font-mono self-start pl-0.5 leading-none">
            {num}
          </span>
          <span className="text-sm leading-none">🕊️</span>
          <span className="text-[6px] font-semibold text-emerald-700 mt-0.5 text-center leading-none">
            Spirit
          </span>
        </div>
      );
    default:
      return (
        <span className="text-[11px] font-medium text-gray-400">{num}</span>
      );
  }
}

// ─── Player tokens stacked on a tile ─────────────────────────────────────────

function PlayerTokens({
  players,
  animating,
}: {
  players: Player[];
  animating: boolean;
}) {
  if (players.length === 0) return null;
  return (
    <div className="absolute bottom-0.5 right-0.5 flex flex-wrap gap-0.5 justify-end">
      {players.map((p) => {
        const tc = TOKEN_COLORS[p.color];
        return (
          <div
            key={p.id}
            title={p.name}
            className={`
              w-3.5 h-3.5 rounded-full border-2 shadow flex-shrink-0 transition-all duration-100
              ${tc.bg} ${tc.border}
              ${animating ? "scale-125 shadow-md" : "scale-100"}
            `}
          />
        );
      })}
    </div>
  );
}

// ─── Main board ───────────────────────────────────────────────────────────────

interface GameBoardProps {
  players: Player[];
  getDisplayPosition: (player: Player) => number;
  animatingToken: AnimatingToken | null;
}

export default function GameBoard({
  players,
  getDisplayPosition,
  animatingToken,
}: GameBoardProps) {
  const COLS = 6;
  const ROWS = 9;

  // Build per-tile player list using display positions (respects animation)
  const playersOnTile: Record<number, Player[]> = {};
  for (const p of players) {
    const pos = getDisplayPosition(p);
    if (!playersOnTile[pos]) playersOnTile[pos] = [];
    playersOnTile[pos].push(p);
  }

  return (
    <div
      className="w-full grid gap-1 p-2 rounded-2xl bg-amber-50 border border-amber-100"
      style={{
        gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${ROWS}, minmax(0, 1fr))`,
        aspectRatio: `${COLS} / ${ROWS}`,
      }}
    >
      {/* Empty spacers */}
      {Array.from({ length: ROWS }, (_, r) =>
        Array.from({ length: COLS }, (_, c) => {
          const row = r + 1;
          const col = c + 1;
          const occupied = LAYOUT.some(
            (t) => t.gridRow === row && t.gridCol === col,
          );
          if (occupied) return null;
          return (
            <div
              key={`empty-${row}-${col}`}
              style={{ gridRow: row, gridColumn: col }}
              className="rounded-lg bg-amber-100/30"
            />
          );
        }),
      )}

      {/* Tiles */}
      {LAYOUT.map(({ num, gridRow, gridCol }) => {
        const type = getTileType(num);
        const tileStyle = getTileStyle(type);
        const tilePlayers = playersOnTile[num] ?? [];

        // Is the animating token currently on this tile?
        const isAnimatingHere =
          animatingToken !== null && animatingToken.visibleTile === num;

        return (
          <div
            key={num}
            style={{ gridRow, gridColumn: gridCol }}
            className={`
              relative flex flex-col items-center justify-center
              rounded-lg border transition-all duration-150
              ${tileStyle}
              ${isAnimatingHere ? "ring-2 ring-offset-1 ring-amber-400 scale-105 z-10 shadow-md" : ""}
            `}
          >
            <TileContent num={num} type={type} />
            <PlayerTokens players={tilePlayers} animating={isAnimatingHere} />
          </div>
        );
      })}
    </div>
  );
}

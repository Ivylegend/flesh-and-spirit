// GameBoard.tsx
// Board with per-tile token rendering and bounce animation highlight

import Image from "next/image";

import {
  COLS,
  LAYOUT,
  SIN_TILES,
  TILE_MAP,
  TOKEN_COLORS,
  Player,
  getTileType,
  TileType,
} from "./gameConstants";
import { AnimatingToken } from "./useGameLogic";

const ROWS = 9;
const BOARD_WIDTH = COLS * 100;
const BOARD_HEIGHT = ROWS * 100;

type AnchorPosition =
  | "top"
  | "right"
  | "bottom"
  | "left"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | "center";

type BoardPoint = {
  x: number;
  y: number;
};

type ThunderboltConnectionConfig = {
  id: string;
  fromTile: keyof typeof SIN_TILES;
  startAnchor: AnchorPosition;
  endAnchor: AnchorPosition;
  waypoints: BoardPoint[];
  width: number;
};

const ANCHOR_OFFSETS: Record<AnchorPosition, BoardPoint> = {
  top: { x: 0, y: -48 },
  right: { x: 48, y: 0 },
  bottom: { x: 0, y: 48 },
  left: { x: -48, y: 0 },
  "top-left": { x: -34, y: -34 },
  "top-right": { x: 34, y: -34 },
  "bottom-left": { x: -34, y: 34 },
  "bottom-right": { x: 34, y: 34 },
  center: { x: 0, y: 0 },
};

const thunderboltConnections: ThunderboltConnectionConfig[] = [
  {
    id: "hatred-murder-to-tile-18",
    fromTile: 30,
    startAnchor: "bottom-right",
    endAnchor: "top-left",
    waypoints: [
      { x: 255, y: 165 },
      { x: 275, y: 245 },
      { x: 338, y: 272 },
      { x: 306, y: 358 },
      { x: 352, y: 438 },
    ],
    width: 7.5,
  },
  {
    id: "lust-to-tile-10",
    fromTile: 32,
    startAnchor: "bottom",
    endAnchor: "top",
    waypoints: [
      { x: 372, y: 182 },
      { x: 405, y: 282 },
      { x: 378, y: 378 },
      { x: 352, y: 514 },
      { x: 404, y: 595 },
    ],
    width: 8,
  },
  {
    id: "fighting-to-tile-14",
    fromTile: 26,
    startAnchor: "bottom-left",
    endAnchor: "right",
    waypoints: [
      { x: 112, y: 320 },
      { x: 72, y: 356 },
      { x: 98, y: 418 },
      { x: 64, y: 470 },
      { x: 46, y: 555 },
    ],
    width: 7.5,
  },
  {
    id: "jealousy-to-tile-11",
    fromTile: 22,
    startAnchor: "left",
    endAnchor: "top-right",
    waypoints: [
      { x: 468, y: 270 },
      { x: 420, y: 318 },
      { x: 402, y: 404 },
      { x: 344, y: 454 },
      { x: 312, y: 548 },
    ],
    width: 8,
  },
  {
    id: "gluttony-to-tile-11",
    fromTile: 15,
    startAnchor: "right",
    endAnchor: "left",
    waypoints: [
      { x: 82, y: 488 },
      { x: 144, y: 468 },
      { x: 196, y: 514 },
      { x: 255, y: 486 },
      { x: 310, y: 532 },
    ],
    width: 8,
  },
  {
    id: "anger-to-tile-8",
    fromTile: 20,
    startAnchor: "bottom",
    endAnchor: "top",
    waypoints: [
      { x: 515, y: 490 },
      { x: 540, y: 555 },
      { x: 506, y: 610 },
      { x: 545, y: 680 },
    ],
    width: 7.5,
  },
  {
    id: "disobedience-to-start",
    fromTile: 12,
    startAnchor: "bottom-left",
    endAnchor: "top-right",
    waypoints: [
      { x: 125, y: 684 },
      { x: 88, y: 748 },
      { x: 138, y: 792 },
      { x: 86, y: 842 },
    ],
    width: 8,
  },
  {
    id: "stealing-to-lying",
    fromTile: 9,
    startAnchor: "bottom-left",
    endAnchor: "top-right",
    waypoints: [
      { x: 426, y: 678 },
      { x: 376, y: 720 },
      { x: 336, y: 686 },
      { x: 286, y: 742 },
      { x: 245, y: 704 },
    ],
    width: 7.5,
  },
  {
    id: "cheating-to-tile-6",
    fromTile: 7,
    startAnchor: "bottom-left",
    endAnchor: "top",
    waypoints: [
      { x: 526, y: 760 },
      { x: 552, y: 808 },
      { x: 530, y: 848 },
    ],
    width: 7,
  },
  {
    id: "lying-to-start",
    fromTile: 4,
    startAnchor: "left",
    endAnchor: "right",
    waypoints: [
      { x: 318, y: 824 },
      { x: 265, y: 860 },
      { x: 204, y: 830 },
      { x: 145, y: 858 },
    ],
    width: 7.5,
  },
];

// ─── Tile styling ─────────────────────────────────────────────────────────────

function getTileStyle(): string {
  return "bg-white border-pink-500";
}

// ─── Tile inner content ───────────────────────────────────────────────────────

function CircularSinLabel({ tile, label }: { tile: number; label: string }) {
  const pathId = `sin-label-${tile}`;

  return (
    <svg
      viewBox="0 0 100 100"
      className="pointer-events-none absolute inset-0 z-20 overflow-visible"
      aria-hidden="true"
    >
      <defs>
        <path
          id={pathId}
          d="M 14 50 A 36 36 0 0 1 86 50"
        />
      </defs>
      <text className="fill-slate-950 text-[8.5px] font-black uppercase tracking-normal">
        <textPath
          href={`#${pathId}`}
          startOffset="50%"
          textAnchor="middle"
        >
          {label}
        </textPath>
      </text>
    </svg>
  );
}

function TileContent({ num, type }: { num: number; type: TileType }) {
  switch (type) {
    case "crown":
      return (
        <div className="relative flex h-full w-full items-center justify-center">
          <Image
            src="/assets/new-crown.png"
            alt="Crown"
            fill
            sizes="(max-width: 640px) 16vw, 90px"
            className="object-contain p-1 drop-shadow-md"
            priority
          />
        </div>
      );
    case "start":
      return (
        <span className="absolute bottom-1 left-1 text-[8px] font-black tracking-[0.18em] text-red-600 sm:text-[10px]">
          START
        </span>
      );
    case "flesh": {
      const sin = SIN_TILES[num];
      return (
        <div className="pointer-events-none absolute inset-[-22%] z-30 flex items-center justify-center">
          <div className="relative aspect-square w-[124%] rounded-full border border-yellow-300 bg-yellow-300 shadow-[0_5px_12px_rgba(0,0,0,0.22)]">
            <CircularSinLabel tile={num} label={sin.name.toUpperCase()} />
            <div className="absolute inset-[18%] overflow-hidden rounded-full bg-white">
              <Image
                src={sin.imageSrc}
                alt={sin.name}
                fill
                sizes="(max-width: 640px) 18vw, 100px"
                className="object-contain p-0.5"
              />
            </div>
          </div>
        </div>
      );
    }
    case "spirit":
      return (
        <div className="relative flex h-full w-full items-center justify-center">
          <Image
            src="/assets/new-holy-spirit.png"
            alt="Holy Spirit"
            fill
            sizes="(max-width: 640px) 16vw, 90px"
            className="object-contain p-1.5"
          />
          <span className="sr-only">Holy Spirit tile</span>
        </div>
      );
    default:
      return null;
  }
}

function getTileCenter(tile: number) {
  const position = TILE_MAP[tile];
  return {
    x: (position.gridCol - 0.5) * 100,
    y: (position.gridRow - 0.5) * 100,
  };
}

function getAnchorPoint(tile: number, anchor: AnchorPosition) {
  const center = getTileCenter(tile);
  const offset = ANCHOR_OFFSETS[anchor];
  return {
    x: center.x + offset.x,
    y: center.y + offset.y,
  };
}

function getSegmentNormal(from: BoardPoint, to: BoardPoint) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  return { x: -dy / length, y: dx / length };
}

function buildThunderboltShape(
  centerPoints: BoardPoint[],
  width: number,
) {
  const left: BoardPoint[] = [];
  const right: BoardPoint[] = [];

  centerPoints.forEach((point, index) => {
    const previous = centerPoints[index - 1];
    const next = centerPoints[index + 1];
    const normal =
      previous && next
        ? getSegmentNormal(previous, next)
        : next
          ? getSegmentNormal(point, next)
          : previous
            ? getSegmentNormal(previous, point)
            : { x: 0, y: 1 };
    const widthNoise = index % 3 === 0 ? 1.12 : index % 3 === 1 ? 0.82 : 1;
    const isTerminal = index === 0 || index === centerPoints.length - 1;
    const pointWidth = isTerminal ? 0.15 : width * widthNoise;

    left.push({
      x: point.x + normal.x * pointWidth,
      y: point.y + normal.y * pointWidth,
    });
    right.push({
      x: point.x - normal.x * pointWidth,
      y: point.y - normal.y * pointWidth,
    });
  });

  const points = [...left, ...right.reverse()];
  return `M ${points.map((point) => `${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" L ")} Z`;
}

function buildThunderboltCenterline(config: ThunderboltConnectionConfig) {
  const destinationTile = SIN_TILES[config.fromTile].returnsTo;
  return [
    getAnchorPoint(config.fromTile, config.startAnchor),
    ...config.waypoints,
    getAnchorPoint(destinationTile, config.endAnchor),
  ];
}

function ThunderboltConnection({
  config,
}: {
  config: ThunderboltConnectionConfig;
}) {
  const centerline = buildThunderboltCenterline(config);
  const outlinePath = buildThunderboltShape(
    centerline,
    config.width,
  );
  const highlightPath = buildThunderboltShape(
    centerline.slice(1, -1).length > 1 ? centerline.slice(1, -1) : centerline,
    Math.max(config.width * 0.28, 2.1),
  );

  return (
    <g>
      <path
        d={outlinePath}
        fill="#f97316"
        stroke="#2f2516"
        strokeWidth="3.4"
        strokeLinejoin="miter"
      />
      <path
        d={highlightPath}
        fill="#fbbf24"
        opacity="0.9"
        stroke="#f59e0b"
        strokeWidth="0.9"
        strokeLinejoin="miter"
      />
    </g>
  );
}

function LightningOverlay() {
  return (
    <svg
      viewBox={`0 0 ${BOARD_WIDTH} ${BOARD_HEIGHT}`}
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-4 z-40 overflow-visible opacity-95 sm:inset-5"
      aria-hidden="true"
    >
      {thunderboltConnections.map((connection) => (
        <ThunderboltConnection key={connection.id} config={connection} />
      ))}
    </svg>
  );
}

function EmptyBoardSpace({
  row,
  col,
}: {
  row: number;
  col: number;
}) {
  return (
    <div
      style={{ gridRow: row, gridColumn: col }}
      className="bg-[radial-gradient(circle_at_center,rgba(253,224,71,0.42),rgba(245,158,11,0.18)_52%,rgba(217,119,6,0.08))]"
    >
      <span className="sr-only">Empty board space</span>
    </div>
  );
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
    <div className="absolute bottom-0.5 right-0.5 z-50 flex flex-wrap justify-end gap-0.5">
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
  onTileClick?: (tile: number) => void;
}

export default function GameBoard({
  players,
  getDisplayPosition,
  animatingToken,
  onTileClick,
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
      className="relative grid h-full w-full gap-0 overflow-hidden border-[3px] border-pink-500 bg-amber-400 p-4 shadow-[inset_0_0_70px_rgba(255,244,138,0.7)] sm:p-5"
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
            <EmptyBoardSpace key={`empty-${row}-${col}`} row={row} col={col} />
          );
        }),
      )}

      <LightningOverlay />

      {/* Tiles */}
      {LAYOUT.map(({ num, gridRow, gridCol }) => {
        const type = getTileType(num);
        const tileStyle = getTileStyle();
        const tilePlayers = playersOnTile[num] ?? [];

        // Is the animating token currently on this tile?
        const isAnimatingHere =
          animatingToken !== null && animatingToken.visibleTile === num;

        return (
          <button
            type="button"
            key={num}
            style={{ gridRow, gridColumn: gridCol }}
            onClick={() => onTileClick?.(num)}
            className={`
              relative flex min-h-0 min-w-0 flex-col items-center justify-center overflow-visible
              rounded-none border-[3px] transition-all duration-150
              ${tileStyle}
              ${isAnimatingHere ? "z-30 scale-105 ring-2 ring-amber-400 ring-offset-1 shadow-md" : ""}
            `}
          >
            <TileContent num={num} type={type} />
            <PlayerTokens players={tilePlayers} animating={isAnimatingHere} />
          </button>
        );
      })}
    </div>
  );
}

// GameControls.tsx
// Dice, player strips, Holy Spirit card picker, event log

import { useState, useEffect, useRef } from "react";
import {
  Player,
  HolySpiritCard,
  GameEvent,
  TOKEN_COLORS,
} from "./gameConstants";

// ─── Animated dice ────────────────────────────────────────────────────────────

const DICE_DOTS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[28, 28], [50, 50], [72, 72]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[28, 25], [72, 25], [28, 50], [72, 50], [28, 75], [72, 75]],
};

function DiceFace({ value, rolling }: { value: number | null; rolling: boolean }) {
  // While rolling, cycle through random faces rapidly
  const [displayVal, setDisplayVal] = useState<number>(1);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (rolling) {
      intervalRef.current = setInterval(() => {
        setDisplayVal(Math.floor(Math.random() * 6) + 1);
      }, 80);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (value) setDisplayVal(value);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [rolling, value]);

  const dots = DICE_DOTS[displayVal] ?? [];

  return (
    <div className={`transition-all duration-150 ${rolling ? "rotate-12 scale-110" : "rotate-0 scale-100"}`}>
      <svg viewBox="0 0 100 100" className="w-14 h-14 drop-shadow">
        <rect x="4" y="4" width="92" height="92" rx="18" fill="white" stroke="#e5e7eb" strokeWidth="2.5" />
        {dots.map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r="7.5" fill="#1f2937" />
        ))}
        {!value && !rolling && (
          <text x="50" y="60" textAnchor="middle" fontSize="36" fill="#d1d5db" fontFamily="sans-serif">?</text>
        )}
      </svg>
    </div>
  );
}

// ─── Player status strip ──────────────────────────────────────────────────────

function PlayerStrip({ player, isActive }: { player: Player; isActive: boolean }) {
  const tc = TOKEN_COLORS[player.color];
  return (
    <div className={`
      flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all text-sm
      ${isActive ? "border-amber-400 bg-amber-50 shadow-sm" : "border-gray-100 bg-white"}
    `}>
      <div className={`w-4 h-4 rounded-full flex-shrink-0 border-2 ${tc.bg} ${tc.border}`} />
      <span className={`font-semibold truncate ${isActive ? "text-gray-800" : "text-gray-500"}`}>
        {player.name}
      </span>
      <span className="text-gray-400 text-xs ml-auto shrink-0">Tile {player.position}</span>
      <span className="text-xs text-emerald-600 font-medium shrink-0">🕊 ×{player.cards.length}</span>
      {isActive && (
        <span className="text-[9px] bg-amber-400 text-amber-900 font-bold px-1.5 py-0.5 rounded-full shrink-0">
          TURN
        </span>
      )}
    </div>
  );
}

// ─── Holy Spirit card picker ──────────────────────────────────────────────────

function HolySpiritPicker({
  cards,
  playerName,
  onUseCard,
}: {
  cards: HolySpiritCard[];
  playerName: string;
  onUseCard: (cardId: string) => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-2xl animate-in slide-in-from-bottom-4 duration-200">
        <div className="text-center mb-4">
          <div className="text-3xl mb-1">✨</div>
          <h3 className="text-base font-bold text-gray-800">Holy Spirit Tile!</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {playerName}, choose a card to move forward
          </p>
        </div>

        <div className="space-y-2.5">
          {cards.map((card) => (
            <button
              key={card.id}
              onClick={() => onUseCard(card.id)}
              className="
                w-full flex items-center justify-between
                px-4 py-3.5 rounded-xl border border-emerald-200
                bg-emerald-50 hover:bg-emerald-100
                active:scale-95 transition-all duration-100
                group
              "
            >
              <div className="text-left">
                <div className="text-sm font-bold text-emerald-800 group-hover:text-emerald-900">
                  🕊️ {card.attribute}
                </div>
                <div className="text-[10px] text-emerald-500 mt-0.5">Fruit of the Spirit</div>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-xl font-black text-emerald-600">+{card.steps}</span>
                <span className="text-[9px] text-emerald-400">steps</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Event log ────────────────────────────────────────────────────────────────

function EventLog({ event }: { event: GameEvent | null }) {
  if (!event) return null;

  const styles: Record<string, string> = {
    sin_triggered:         "bg-orange-50 border-orange-200 text-orange-800",
    holy_spirit_triggered: "bg-emerald-50 border-emerald-200 text-emerald-800",
    card_used:             "bg-emerald-50 border-emerald-200 text-emerald-800",
    won:                   "bg-amber-50 border-amber-300 text-amber-800",
    moved:                 "bg-gray-50 border-gray-200 text-gray-600",
    dice_rolled:           "bg-blue-50 border-blue-200 text-blue-700",
  };

  return (
    <div className={`text-xs px-3 py-2.5 rounded-xl border leading-relaxed ${styles[event.type] ?? "bg-gray-50 border-gray-200 text-gray-600"}`}>
      {event.message}
    </div>
  );
}

// ─── Main controls panel ──────────────────────────────────────────────────────

interface GameControlsProps {
  players: Player[];
  currentPlayer: Player | null;
  diceValue: number | null;
  isRolling: boolean;
  isAnimating: boolean;
  lastEvent: GameEvent | null;
  pendingHolySpiritChoice: boolean;
  onRoll: () => void;
  onUseCard: (cardId: string) => void;
  onReset: () => void;
  gamePhase: "playing" | "won" | "setup";
}

export default function GameControls({
  players,
  currentPlayer,
  diceValue,
  isRolling,
  isAnimating,
  lastEvent,
  pendingHolySpiritChoice,
  onRoll,
  onUseCard,
  onReset,
  gamePhase,
}: GameControlsProps) {
  const canRoll =
    !isRolling &&
    !pendingHolySpiritChoice &&
    !isAnimating &&
    gamePhase === "playing";

  return (
    <>
      {pendingHolySpiritChoice && currentPlayer && (
        <HolySpiritPicker
          cards={currentPlayer.cards}
          playerName={currentPlayer.name}
          onUseCard={onUseCard}
        />
      )}

      <div className="space-y-3">
        {/* Player strips */}
        <div className="space-y-1.5">
          {players.map((p) => (
            <PlayerStrip
              key={p.id}
              player={p}
              isActive={p.id === currentPlayer?.id && gamePhase === "playing"}
            />
          ))}
        </div>

        {/* Dice + roll */}
        {gamePhase === "playing" && currentPlayer && (
          <div className="flex items-center gap-4 bg-white rounded-2xl border border-gray-100 px-4 py-4">
            <DiceFace value={diceValue} rolling={isRolling} />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-gray-400 mb-0.5 uppercase tracking-wider">Current turn</p>
              <p className="text-sm font-bold text-gray-800 truncate">{currentPlayer.name}</p>
              <button
                onClick={onRoll}
                disabled={!canRoll}
                className={`
                  mt-2 w-full py-2.5 rounded-xl text-sm font-bold transition-all duration-150
                  ${canRoll
                    ? "bg-amber-500 hover:bg-amber-600 active:scale-95 text-white shadow-sm"
                    : "bg-gray-100 text-gray-300 cursor-not-allowed"
                  }
                `}
              >
                {isRolling ? "Rolling…" : isAnimating ? "Moving…" : "Roll Dice 🎲"}
              </button>
            </div>
          </div>
        )}

        {/* Event log */}
        <EventLog event={lastEvent} />

        {/* Win state */}
        {gamePhase === "won" && (
          <div className="bg-amber-50 border border-amber-300 rounded-2xl p-5 text-center">
            <div className="text-5xl mb-2">👑</div>
            <h3 className="text-lg font-bold text-amber-800">
              {players.find((p) => p.hasWon)?.name} Wins!
            </h3>
            <p className="text-xs text-amber-600 mt-1 mb-4">
              Walking in the Spirit — reached the Crown!
            </p>
            <button
              onClick={onReset}
              className="w-full py-3 rounded-xl bg-amber-800 text-amber-50 font-bold text-sm hover:bg-amber-900 active:scale-95 transition-all"
            >
              Play Again 🎮
            </button>
          </div>
        )}

        {/* End game button */}
        {gamePhase === "playing" && (
          <button
            onClick={onReset}
            className="w-full py-2 rounded-xl border border-gray-200 text-gray-400 text-xs hover:border-red-200 hover:text-red-400 transition-all"
          >
            End Game
          </button>
        )}
      </div>
    </>
  );
}
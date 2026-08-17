"use client"
// GameControls.tsx
// Dice, player strips, Holy Spirit card picker, event log

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { toast } from "sonner";
import {
  Player,
  HolySpiritCard,
  GameEvent,
  TOKEN_COLORS,
  getHolySpiritCardImage,
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
  const [rollingValue, setRollingValue] = useState<number>(1);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (rolling) {
      intervalRef.current = setInterval(() => {
        setRollingValue(Math.floor(Math.random() * 6) + 1);
      }, 80);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [rolling, value]);

  const displayVal = rolling ? rollingValue : (value ?? 1);
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
      <div className="w-full max-w-3xl rounded-2xl bg-white p-4 shadow-2xl animate-in slide-in-from-bottom-4 duration-200 sm:p-5">
        <div className="text-center mb-4">
          <div className="text-3xl mb-1">✨</div>
          <h3 className="text-base font-bold text-gray-800">Holy Spirit Tile!</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {playerName}, choose a card to move forward
          </p>
        </div>

        <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:thin] sm:-mx-5 sm:gap-4 sm:px-5">
          {cards.map((card) => {
            const imageSrc = getHolySpiritCardImage(card);

            return (
              <button
                key={card.id}
                onClick={() => onUseCard(card.id)}
                aria-label={`Use ${card.attribute} card to move forward ${card.steps} steps`}
                className="
                  group relative aspect-[1166/1618] w-[72vw] max-w-[230px] shrink-0 snap-center
                  overflow-hidden rounded-xl border border-emerald-200 bg-emerald-50 shadow-sm
                  transition-all duration-150 hover:-translate-y-0.5 hover:border-emerald-400 hover:shadow-lg
                  active:scale-[0.98] sm:w-[220px]
                "
              >
                {imageSrc ? (
                  <Image
                    src={imageSrc}
                    alt={`${card.attribute} Holy Spirit card`}
                    fill
                    sizes="(max-width: 640px) 72vw, 230px"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center p-4 text-center">
                    <div className="text-4xl">🕊️</div>
                    <div className="mt-2 text-lg font-black text-emerald-800">
                      {card.attribute}
                    </div>
                    <div className="mt-2 text-sm font-semibold text-emerald-600">
                      Move ahead {card.steps} steps
                    </div>
                  </div>
                )}
                <span className="pointer-events-none absolute inset-0 rounded-xl ring-0 ring-emerald-400 transition group-hover:ring-4" />
              </button>
            );
          })}
        </div>
      </div>
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
  canRoll?: boolean;
  canUseCards?: boolean;
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
  canRoll: canRollOverride,
  canUseCards = true,
}: GameControlsProps) {
  const canRoll =
    !isRolling &&
    !pendingHolySpiritChoice &&
    !isAnimating &&
    gamePhase === "playing" &&
    (canRollOverride ?? true);
  const lastToastRef = useRef<string | null>(null);

  useEffect(() => {
    if (!lastEvent) return;

    const eventKey = [
      lastEvent.type,
      lastEvent.playerName,
      lastEvent.message,
      lastEvent.fromTile ?? "",
      lastEvent.toTile ?? "",
    ].join("|");

    if (lastToastRef.current === eventKey) return;
    lastToastRef.current = eventKey;

    const title: Record<GameEvent["type"], string> = {
      dice_rolled: "Dice Rolled",
      moved: "Token Moved",
      sin_triggered: "Sin Tile",
      holy_spirit_triggered: "Holy Spirit Tile",
      card_used: "Card Used",
      won: "Game Won",
    };

    const toastOptions = {
      description: lastEvent.message,
      duration: lastEvent.type === "won" ? 6000 : 3600,
    };

    if (lastEvent.type === "sin_triggered") {
      toast.warning(title[lastEvent.type], toastOptions);
      return;
    }

    if (
      lastEvent.type === "holy_spirit_triggered" ||
      lastEvent.type === "card_used" ||
      lastEvent.type === "won"
    ) {
      toast.success(title[lastEvent.type], toastOptions);
      return;
    }

    toast.info(title[lastEvent.type], toastOptions);
  }, [lastEvent]);

  return (
    <>
      {pendingHolySpiritChoice && currentPlayer && canUseCards && (
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

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import GameBoard from "@/components/FleshAndSpirit/GameBoard";
import GameControls from "@/components/FleshAndSpirit/GameControls";
import { Button } from "@/components/ui/button";
import { useGameLogic } from "@/components/FleshAndSpirit/useGameLogic";

const LOCAL_STORAGE_KEY = "flesh-spirit-local-game";

export default function LocalGameRoute() {
  const router = useRouter();
  const {
    state,
    currentPlayer,
    rollDice,
    useCard,
    resetGame,
    getDisplayPosition,
  } = useGameLogic({ storageKey: LOCAL_STORAGE_KEY });

  if (state.phase === "setup") {
    return (
      <div className="min-h-screen bg-amber-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-3xl border border-amber-100 bg-white p-6 shadow-sm space-y-4 text-center">
          <h1 className="text-2xl font-bold text-amber-800">No local game started</h1>
          <p className="text-sm text-amber-700">
            Set up players first to begin a local match.
          </p>
          <div className="flex gap-3">
            <Button asChild className="flex-1 bg-amber-800 text-amber-50 hover:bg-amber-900">
              <Link href="/local">Go To Setup</Link>
            </Button>
            <Button asChild variant="outline" className="flex-1">
              <Link href="/">Home</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-amber-50">
      <header className="bg-white border-b border-amber-100 px-4 py-3 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="rounded-full border border-amber-200 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-amber-800 transition hover:bg-amber-100"
          >
            Home
          </button>
          <h1 className="text-base font-bold text-amber-800 tracking-tight">
            Flesh &amp; Spirit
          </h1>
        </div>
        <span className="text-xs text-gray-400">Local Play</span>
      </header>

      <div className="flex flex-col lg:flex-row lg:h-[calc(100vh-53px)]">
        <div className="flex-1 p-3 flex items-start justify-center lg:overflow-auto lg:items-center">
          <div className="w-full max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg">
            <GameBoard
              players={state.players}
              getDisplayPosition={getDisplayPosition}
              animatingToken={state.animatingToken}
            />
          </div>
        </div>

        <div className="w-full lg:w-80 xl:w-96 lg:border-l border-amber-100 bg-white lg:overflow-y-auto">
          <div className="p-4">
            <GameControls
              players={state.players}
              currentPlayer={currentPlayer}
              diceValue={state.diceValue}
              isRolling={state.isRolling}
              isAnimating={!!state.animatingToken}
              lastEvent={state.lastEvent}
              pendingHolySpiritChoice={state.pendingHolySpiritChoice}
              onRoll={rollDice}
              onUseCard={useCard}
              onReset={() => {
                resetGame();
                router.push("/local");
              }}
              gamePhase={state.phase as "playing" | "won" | "setup"}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

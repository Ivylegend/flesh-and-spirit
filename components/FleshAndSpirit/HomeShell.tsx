"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

import GameBoard from "@/components/FleshAndSpirit/GameBoard";
import GameControls from "@/components/FleshAndSpirit/GameControls";
import ModeSelectScreen from "@/components/FleshAndSpirit/ModeSelectScreen";
import OnlinePlayScreen from "@/components/FleshAndSpirit/OnlinePlayScreen";
import SetupScreen from "@/components/FleshAndSpirit/SetupScreen";
import { useGameLogic } from "@/components/FleshAndSpirit/useGameLogic";

type HomeView = "landing" | "local" | "online";

export default function HomeShell() {
  const searchParams = useSearchParams();
  const [view, setView] = useState<HomeView>("landing");
  const {
    state,
    currentPlayer,
    availableColors,
    addPlayer,
    removePlayer,
    startGame,
    rollDice,
    useCard,
    resetGame,
    getDisplayPosition,
  } = useGameLogic();

  const forcedOnline = searchParams.get("mode") === "online";
  const activeView = view === "landing" && forcedOnline ? "online" : view;

  const goHome = () => {
    if (typeof window !== "undefined") {
      window.history.replaceState({}, "", "/");
    }
    setView("landing");
  };

  if (activeView === "landing") {
    return (
      <ModeSelectScreen
        onSelectLocal={() => setView("local")}
        onSelectOnline={() => setView("online")}
      />
    );
  }

  if (activeView === "online") {
    return <OnlinePlayScreen onBack={goHome} />;
  }

  if (state.phase === "setup") {
    return (
      <SetupScreen
        players={state.players}
        availableColors={availableColors}
        onAddPlayer={addPlayer}
        onRemovePlayer={removePlayer}
        onStartGame={startGame}
        onBack={goHome}
      />
    );
  }

  return (
    <div className="min-h-screen bg-amber-50">
      <header className="bg-white border-b border-amber-100 px-4 py-3 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={goHome}
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
              onReset={resetGame}
              gamePhase={state.phase as "playing" | "won" | "setup"}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

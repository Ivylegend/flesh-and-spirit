"use client";
// Index.tsx

import GameBoard from "@/components/FleshAndSpirit/GameBoard";
import GameControls from "@/components/FleshAndSpirit/GameControls";
import SetupScreen from "@/components/FleshAndSpirit/SetupScreen";
import { useGameLogic } from "@/components/FleshAndSpirit/useGameLogic";

export default function Index() {
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

  if (state.phase === "setup") {
    return (
      <SetupScreen
        players={state.players}
        availableColors={availableColors}
        onAddPlayer={addPlayer}
        onRemovePlayer={removePlayer}
        onStartGame={startGame}
      />
    );
  }

  return (
    <div className="min-h-screen bg-amber-50">
      <header className="bg-white border-b border-amber-100 px-4 py-3 flex items-center justify-between sticky top-0 z-20">
        <h1 className="text-base font-bold text-amber-800 tracking-tight">
          Flesh &amp; Spirit
        </h1>
        <span className="text-xs text-gray-400">Local Play</span>
      </header>

      {/*
        Mobile:  board stacked above controls (scroll naturally)
        Desktop: board left, controls right sidebar (both fill viewport height)
      */}
      <div className="flex flex-col lg:flex-row lg:h-[calc(100vh-53px)]">
        {/* Board */}
        <div className="flex-1 p-3 flex items-start justify-center lg:overflow-auto lg:items-center">
          <div className="w-full max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg">
            <GameBoard
              players={state.players}
              getDisplayPosition={getDisplayPosition}
              animatingToken={state.animatingToken}
            />
          </div>
        </div>

        {/* Controls */}
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

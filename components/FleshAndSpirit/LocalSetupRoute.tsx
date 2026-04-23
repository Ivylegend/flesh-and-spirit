"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import SetupScreen from "@/components/FleshAndSpirit/SetupScreen";
import { Button } from "@/components/ui/button";
import { useGameLogic } from "@/components/FleshAndSpirit/useGameLogic";

const LOCAL_STORAGE_KEY = "flesh-spirit-local-game";

export default function LocalSetupRoute() {
  const router = useRouter();
  const {
    state,
    availableColors,
    addPlayer,
    removePlayer,
    startGame,
  } = useGameLogic({ storageKey: LOCAL_STORAGE_KEY });

  if (state.phase !== "setup") {
    return (
      <div className="min-h-screen bg-amber-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-3xl border border-amber-100 bg-white p-6 shadow-sm space-y-4 text-center">
          <h1 className="text-2xl font-bold text-amber-800">Local game in progress</h1>
          <p className="text-sm text-amber-700">
            There is already a saved local match. You can jump back in or return home.
          </p>
          <div className="flex gap-3">
            <Button asChild className="flex-1 bg-amber-800 text-amber-50 hover:bg-amber-900">
              <Link href="/local/game">Open Game</Link>
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
    <SetupScreen
      players={state.players}
      availableColors={availableColors}
      onAddPlayer={addPlayer}
      onRemovePlayer={removePlayer}
      onStartGame={() => {
        startGame();
        router.push("/local/game");
      }}
      onBackHref="/"
    />
  );
}

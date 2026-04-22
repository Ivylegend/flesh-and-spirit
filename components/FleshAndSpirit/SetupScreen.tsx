"use client";
// SetupScreen.tsx

import { useState } from "react";
import {
  TokenColor,
  TOKEN_COLORS,
  MIN_PLAYERS,
  MAX_PLAYERS,
  Player,
} from "./gameConstants";

interface SetupScreenProps {
  players: Player[];
  availableColors: TokenColor[];
  onAddPlayer: (name: string, color: TokenColor) => void;
  onRemovePlayer: (id: string) => void;
  onStartGame: () => void;
  onBack?: () => void;
}

export default function SetupScreen({
  players,
  availableColors,
  onAddPlayer,
  onRemovePlayer,
  onStartGame,
  onBack,
}: SetupScreenProps) {
  const [name, setName] = useState("");
  const [selectedColor, setSelectedColor] = useState<TokenColor | null>(null);

  const canAdd = name.trim().length > 0 && selectedColor !== null && players.length < MAX_PLAYERS;
  const canStart = players.length >= MIN_PLAYERS;

  function handleAdd() {
    if (!canAdd || !selectedColor) return;
    onAddPlayer(name.trim(), selectedColor);
    setName("");
    setSelectedColor(null);
  }

  return (
    <div className="min-h-screen bg-amber-50 flex flex-col items-center justify-center p-4">
      {onBack && (
        <div className="mb-6 w-full max-w-md">
          <button
            type="button"
            onClick={onBack}
            className="rounded-full border border-amber-200 bg-white px-4 py-2 text-sm font-medium text-amber-800 shadow-sm transition hover:border-amber-300 hover:bg-amber-100"
          >
            Change Mode
          </button>
        </div>
      )}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-extrabold text-amber-800 tracking-tight">Flesh &amp; Spirit</h1>
        <p className="text-amber-600 mt-1 text-sm">{MIN_PLAYERS}–{MAX_PLAYERS} players · Local play</p>
      </div>

      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-amber-100 p-6 space-y-6">
        {/* Player list */}
        <div>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Players ({players.length}/{MAX_PLAYERS})
          </h2>
          {players.length === 0 && (
            <p className="text-sm text-gray-300 italic">No players added yet.</p>
          )}
          <ul className="space-y-2">
            {players.map((p) => {
              const tc = TOKEN_COLORS[p.color];
              return (
                <li key={p.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                  <div className="flex items-center gap-3">
                    <span className={`w-5 h-5 rounded-full border-2 flex-shrink-0 ${tc.bg} ${tc.border}`} />
                    <span className="font-medium text-gray-800 text-sm">{p.name}</span>
                    <span className={`text-xs ${tc.text} font-medium`}>{tc.label}</span>
                  </div>
                  <button
                    onClick={() => onRemovePlayer(p.id)}
                    className="text-gray-300 hover:text-red-400 transition-colors text-xl leading-none"
                  >×</button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Add player form */}
        {players.length < MAX_PLAYERS && (
          <div className="space-y-3">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Add Player</h2>
            <input
              type="text"
              placeholder="Player name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              maxLength={20}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-amber-300"
            />
            <div className="flex gap-2">
              {availableColors.map((color) => {
                const tc = TOKEN_COLORS[color];
                const isSelected = selectedColor === color;
                return (
                  <button
                    key={color}
                    onClick={() => setSelectedColor(color)}
                    className={`
                      flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition-all
                      ${isSelected ? `${tc.border} bg-gray-50 scale-105` : "border-gray-100 hover:border-gray-200"}
                    `}
                  >
                    <span className={`w-6 h-6 rounded-full ${tc.bg} border-2 ${tc.border}`} />
                    <span className="text-[10px] font-medium text-gray-500">{tc.label}</span>
                  </button>
                );
              })}
            </div>
            <button
              onClick={handleAdd}
              disabled={!canAdd}
              className={`w-full py-3 rounded-xl font-semibold text-sm transition-all ${canAdd ? "bg-amber-500 hover:bg-amber-600 text-white active:scale-95" : "bg-gray-100 text-gray-300 cursor-not-allowed"}`}
            >
              Add Player
            </button>
          </div>
        )}

        <div className="pt-1">
          {!canStart && (
            <p className="text-xs text-center text-gray-400 mb-3">
              Add at least {MIN_PLAYERS} players to start
            </p>
          )}
          <button
            onClick={onStartGame}
            disabled={!canStart}
            className={`w-full py-4 rounded-xl font-bold text-base transition-all ${canStart ? "bg-amber-800 hover:bg-amber-900 text-amber-50 shadow-md active:scale-95" : "bg-gray-100 text-gray-300 cursor-not-allowed"}`}
          >
            Start Game 🎮
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";
// useGameLogic.ts
// v3: bounce animation, overshoot ends turn, spirit→spirit chain

import { useState, useCallback, useRef } from "react";
import {
  Player,
  GameState,
  GameEvent,
  HolySpiritCard,
  TokenColor,
  TOTAL_TILES,
  START_TILE,
  HOLY_SPIRIT_CARDS_PER_PLAYER,
  SIN_TILES,
  HOLY_SPIRIT_TILES,
  resolveSinChain,
  createDeck,
  shuffleDeck,
  ALL_COLORS,
  buildPath,
} from "./gameConstants";

// ─── Animation state ──────────────────────────────────────────────────────────

export interface AnimatingToken {
  playerId: string;
  /** The tile currently being "bounced" on during animation */
  visibleTile: number;
}

export interface ExtendedGameState extends GameState {
  /** While non-null a token is mid-animation; board reads visibleTile for that player */
  animatingToken: AnimatingToken | null;
}

const makeInitialState = (): ExtendedGameState => ({
  phase: "setup",
  players: [],
  currentPlayerIndex: 0,
  diceValue: null,
  isRolling: false,
  lastEvent: null,
  pendingHolySpiritChoice: false,
  animatingToken: null,
});

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useGameLogic() {
  const [state, setState] = useState<ExtendedGameState>(makeInitialState());
  const deckRef = useRef<HolySpiritCard[]>([]);
  const discardRef = useRef<HolySpiritCard[]>([]);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  };

  // ── Deal N cards (reshuffle discard if deck empty) ────────────────────────
  const dealCards = useCallback((n: number): HolySpiritCard[] => {
    const cards: HolySpiritCard[] = [];
    for (let i = 0; i < n; i++) {
      if (deckRef.current.length === 0) {
        deckRef.current = shuffleDeck(discardRef.current);
        discardRef.current = [];
      }
      if (deckRef.current.length > 0) cards.push(deckRef.current.pop()!);
    }
    return cards;
  }, []);

  // ── Animate a token bouncing tile-by-tile along a path ───────────────────
  // Calls onComplete with the final tile once animation ends.
  const animateAlongPath = useCallback(
    (
      playerId: string,
      path: number[],
      stepMs: number,
      onComplete: (finalTile: number) => void,
    ) => {
      clearTimers();

      // Show the token at each tile along the path, one at a time
      path.forEach((tile, idx) => {
        const t = setTimeout(() => {
          setState((prev) => ({
            ...prev,
            animatingToken: { playerId, visibleTile: tile },
          }));
        }, idx * stepMs);
        timersRef.current.push(t);
      });

      // After all steps, fire onComplete and clear animation
      const done = setTimeout(() => {
        setState((prev) => ({ ...prev, animatingToken: null }));
        onComplete(path[path.length - 1]);
      }, path.length * stepMs);
      timersRef.current.push(done);
    },
    [],
  );

  // ── Core landing resolver — decides what happens when a player reaches a tile
  // Returns void; mutates state via setState.
  const resolveLanding = useCallback(
    (playerId: string, tile: number) => {
      setState((prev) => {
        const player = prev.players.find((p) => p.id === playerId);
        if (!player) return prev;

        // WIN
        if (tile === TOTAL_TILES) {
          return {
            ...prev,
            players: prev.players.map((p) =>
              p.id === playerId ? { ...p, position: tile, hasWon: true } : p,
            ),
            phase: "won" as const,
            lastEvent: {
              type: "won" as const,
              playerName: player.name,
              playerColor: player.color,
              message: `🎉 ${player.name} reached the Crown and won the game!`,
            },
          };
        }

        // HOLY SPIRIT TILE — stay on this player's turn, open card picker
        if (HOLY_SPIRIT_TILES.has(tile)) {
          return {
            ...prev,
            players: prev.players.map((p) =>
              p.id === playerId ? { ...p, position: tile } : p,
            ),
            pendingHolySpiritChoice: true,
            lastEvent: {
              type: "holy_spirit_triggered" as const,
              playerName: player.name,
              playerColor: player.color,
              toTile: tile,
              message: `✨ ${player.name} landed on a Holy Spirit tile! Choose a card.`,
            },
          };
        }

        // SIN TILE
        if (SIN_TILES[tile]) {
          const sin = SIN_TILES[tile];
          const { finalTile, chain } = resolveSinChain(tile);
          const chainNames = chain.map((t) => SIN_TILES[t]?.name).join(" → ");

          // First land on sin tile, then animate backwards
          const sinPath = buildPath(tile, finalTile);

          // Schedule the sin bounce-back animation
          setTimeout(() => {
            animateAlongPath(playerId, sinPath, 180, (endTile) => {
              setState((inner) => {
                const innerPlayer = inner.players.find(
                  (p) => p.id === playerId,
                );
                if (!innerPlayer) return inner;
                return {
                  ...inner,
                  players: inner.players.map((p) =>
                    p.id === playerId ? { ...p, position: endTile } : p,
                  ),
                  currentPlayerIndex:
                    (inner.currentPlayerIndex + 1) % inner.players.length,
                  lastEvent: {
                    type: "sin_triggered" as const,
                    playerName: innerPlayer.name,
                    playerColor: innerPlayer.color,
                    fromTile: tile,
                    toTile: endTile,
                    sinName: sin.name,
                    message:
                      chain.length > 1
                        ? `💥 ${innerPlayer.name} hit ${chainNames}! Sent to tile ${endTile}.`
                        : `💥 ${innerPlayer.name} landed on ${sin.name}! Sent back to tile ${endTile}.`,
                  },
                };
              });
            });
          }, 100);

          // Immediately show player at the sin tile before animation
          return {
            ...prev,
            players: prev.players.map((p) =>
              p.id === playerId ? { ...p, position: tile } : p,
            ),
            lastEvent: {
              type: "sin_triggered" as const,
              playerName: player.name,
              playerColor: player.color,
              fromTile: player.position,
              toTile: tile,
              sinName: sin.name,
              message: `💥 ${player.name} landed on ${sin.name}...`,
            },
          };
        }

        // NORMAL TILE
        return {
          ...prev,
          players: prev.players.map((p) =>
            p.id === playerId ? { ...p, position: tile } : p,
          ),
          currentPlayerIndex:
            (prev.currentPlayerIndex + 1) % prev.players.length,
          lastEvent: {
            type: "moved" as const,
            playerName: player.name,
            playerColor: player.color,
            fromTile: player.position,
            toTile: tile,
            message: `${player.name} moved to tile ${tile}.`,
          },
        };
      });
    },
    [animateAlongPath],
  );

  // ── Add / remove players ──────────────────────────────────────────────────
  const addPlayer = useCallback((name: string, color: TokenColor) => {
    setState((prev) => {
      if (
        prev.players.length >= 4 ||
        prev.players.some((p) => p.color === color)
      )
        return prev;
      return {
        ...prev,
        players: [
          ...prev.players,
          {
            id: `player_${Date.now()}_${color}`,
            name,
            color,
            position: START_TILE,
            cards: [],
            hasWon: false,
          },
        ],
      };
    });
  }, []);

  const removePlayer = useCallback((playerId: string) => {
    setState((prev) => ({
      ...prev,
      players: prev.players.filter((p) => p.id !== playerId),
    }));
  }, []);

  // ── Start game ────────────────────────────────────────────────────────────
  const startGame = useCallback(() => {
    setState((prev) => {
      if (prev.players.length < 2) return prev;
      deckRef.current = createDeck();
      discardRef.current = [];
      return {
        ...prev,
        phase: "playing" as const,
        players: prev.players.map((p) => ({
          ...p,
          position: START_TILE,
          hasWon: false,
          cards: dealCards(HOLY_SPIRIT_CARDS_PER_PLAYER),
        })),
        currentPlayerIndex: 0,
        diceValue: null,
        lastEvent: null,
        pendingHolySpiritChoice: false,
        animatingToken: null,
      };
    });
  }, [dealCards]);

  // ── Roll dice ─────────────────────────────────────────────────────────────
  const rollDice = useCallback(() => {
    setState((prev) => {
      if (
        prev.phase !== "playing" ||
        prev.isRolling ||
        prev.pendingHolySpiritChoice ||
        prev.animatingToken
      )
        return prev;
      return { ...prev, isRolling: true };
    });

    // Dice roll delay (gives time for the visual dice spin)
    const t = setTimeout(() => {
      const rolled = Math.floor(Math.random() * 6) + 1;

      setState((prev) => {
        if (!prev.isRolling) return prev;

        const player = prev.players[prev.currentPlayerIndex];
        const newPosition = player.position + rolled;

        // OVERSHOOT — ends turn immediately, no re-roll
        if (newPosition > TOTAL_TILES) {
          return {
            ...prev,
            isRolling: false,
            diceValue: rolled,
            lastEvent: {
              type: "dice_rolled" as const,
              playerName: player.name,
              playerColor: player.color,
              message: `${player.name} rolled ${rolled} — needs exactly ${
                TOTAL_TILES - player.position
              } to reach the Crown. Turn passes to the next player.`,
            },
            currentPlayerIndex:
              (prev.currentPlayerIndex + 1) % prev.players.length,
          };
        }

        // Normal roll — start bounce animation
        const path = buildPath(player.position, newPosition);

        // Kick off animation (outside setState)
        setTimeout(() => {
          setState((inner) => {
            const innerPlayer = inner.players[inner.currentPlayerIndex];
            if (!innerPlayer || innerPlayer.id !== player.id) return inner;
            // Animate from current position
            animateAlongPath(innerPlayer.id, path, 200, (finalTile) => {
              resolveLanding(innerPlayer.id, finalTile);
            });
            return inner;
          });
        }, 0);

        return { ...prev, isRolling: false, diceValue: rolled };
      });
    }, 700);
    timersRef.current.push(t);
  }, [animateAlongPath, resolveLanding]);

  // ── Use Holy Spirit card ──────────────────────────────────────────────────
  const useCard = useCallback(
    (cardId: string) => {
      let playerId = "";
      let steps = 0;
      let currentPosition = 0;

      setState((prev) => {
        if (!prev.pendingHolySpiritChoice) return prev;

        const player = prev.players[prev.currentPlayerIndex];
        const card = player.cards.find((c) => c.id === cardId);
        if (!card) return prev;

        playerId = player.id;
        steps = card.steps;
        currentPosition = player.position;

        // Swap card: discard used, draw new
        discardRef.current.push(card);
        const [newCard] = dealCards(1);
        const newCards = player.cards
          .filter((c) => c.id !== cardId)
          .concat(newCard ? [newCard] : []);

        return {
          ...prev,
          pendingHolySpiritChoice: false,
          players: prev.players.map((p) =>
            p.id === player.id ? { ...p, cards: newCards } : p,
          ),
          lastEvent: {
            type: "card_used" as const,
            playerName: player.name,
            playerColor: player.color,
            cardAttribute: card.attribute,
            cardSteps: card.steps,
            message: `✨ ${player.name} used "${card.attribute}" (+${card.steps} steps)`,
          },
        };
      });

      // Animate after state settles
      setTimeout(() => {
        if (!playerId) return;
        const newPosition = Math.min(currentPosition + steps, TOTAL_TILES);
        const path = buildPath(currentPosition, newPosition);
        animateAlongPath(playerId, path, 200, (finalTile) => {
          resolveLanding(playerId, finalTile);
        });
      }, 50);
    },
    [dealCards, animateAlongPath, resolveLanding],
  );

  // ── Reset ─────────────────────────────────────────────────────────────────
  const resetGame = useCallback(() => {
    clearTimers();
    deckRef.current = [];
    discardRef.current = [];
    setState(makeInitialState());
  }, []);

  // ── Derived ───────────────────────────────────────────────────────────────
  const currentPlayer = state.players[state.currentPlayerIndex] ?? null;
  const availableColors = ALL_COLORS.filter(
    (c) => !state.players.some((p) => p.color === c),
  );

  // For rendering: if a token is animating, show its visibleTile instead of position
  const getDisplayPosition = useCallback(
    (player: Player): number => {
      if (state.animatingToken?.playerId === player.id) {
        return state.animatingToken.visibleTile;
      }
      return player.position;
    },
    [state.animatingToken],
  );

  return {
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
  };
}

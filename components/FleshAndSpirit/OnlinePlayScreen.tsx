"use client";

import {
  type ReactNode,
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Copy,
  DoorOpen,
  Globe2,
  Link2,
  LogOut,
  Plus,
  RefreshCw,
  Shield,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import GameBoard from "@/components/FleshAndSpirit/GameBoard";
import GameControls from "@/components/FleshAndSpirit/GameControls";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getSupabaseBrowserClient } from "@/lib/supabase-client";
import type {
  AcceptInvitationResponse,
  ApiResponse,
  AuthResponse,
  InvitationResponse,
  LeaderboardEntry,
  PublicRoomsResponse,
  RoomResponse,
  RoomSummary,
  SessionResponse,
} from "@/lib/online-play-types";
import {
  ALL_COLORS,
  Player,
  TOKEN_COLORS,
  TokenColor,
} from "@/components/FleshAndSpirit/gameConstants";

type AuthView = "signin" | "signup" | "guest";
type SocketState = "idle" | "connecting" | "connected" | "error";

interface OnlinePlayScreenProps {
  roomId?: string;
  inviteToken?: string;
  backHref?: string;
}

async function apiRequest<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const body = (await response.json()) as ApiResponse<T>;

  if (!body.ok) {
    throw new Error(body.error);
  }

  return body.data;
}

function getInviteToken(rawValue: string) {
  const value = rawValue.trim();
  if (!value) {
    return "";
  }

  if (value.startsWith("http://") || value.startsWith("https://")) {
    try {
      const url = new URL(value);
      const segments = url.pathname.split("/").filter(Boolean);
      return url.searchParams.get("invite") || segments.at(-1) || "";
    } catch {
      return value;
    }
  }

  return value;
}

function Eyelet({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-stone-50/80 px-3 py-2">
      <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">
        {icon}
        {label}
      </div>
      <div className="text-sm font-medium text-stone-800">{value}</div>
    </div>
  );
}

export default function OnlinePlayScreen({
  roomId,
  inviteToken,
  backHref = "/",
}: OnlinePlayScreenProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const activeLobbyRef = useRef<HTMLDivElement | null>(null);
  const handledInviteRef = useRef<string | null>(inviteToken ?? null);

  const [authView, setAuthView] = useState<AuthView>("guest");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [roomName, setRoomName] = useState("");
  const [roomVisibility, setRoomVisibility] = useState<"public" | "private">(
    "public",
  );
  const [inviteUsername, setInviteUsername] = useState("");
  const [inviteInput, setInviteInput] = useState("");
  const [latestInviteUrl, setLatestInviteUrl] = useState("");
  const [liveRoom, setLiveRoom] = useState<RoomSummary | null>(null);
  const [socketState, setSocketState] = useState<SocketState>("idle");
  const [roomSearch, setRoomSearch] = useState("");
  const [joiningRoomId, setJoiningRoomId] = useState<string | null>(null);
  const [activity, setActivity] = useState<string[]>([
    "Online lobby ready.",
  ]);

  const deferredRoomSearch = useDeferredValue(roomSearch);
  const currentRoomId = roomId ?? null;
  const isRoomRoute = Boolean(currentRoomId);
  const canSubmitAuth =
    authView === "guest"
      ? displayName.trim().length > 0
      : username.trim().length > 0 &&
        password.trim().length > 0 &&
        (authView === "signin" || displayName.trim().length > 0);

  const sessionQuery = useQuery({
    queryKey: ["session"],
    queryFn: () => apiRequest<SessionResponse>("/api/auth/session"),
  });

  const publicRoomsQuery = useQuery({
    queryKey: ["public-rooms"],
    queryFn: () => apiRequest<PublicRoomsResponse>("/api/rooms/public"),
    refetchOnWindowFocus: false,
  });

  const roomQuery = useQuery({
    queryKey: ["room", currentRoomId],
    queryFn: () => apiRequest<RoomResponse>(`/api/rooms/${currentRoomId}`),
    enabled: Boolean(currentRoomId),
    refetchOnWindowFocus: false,
  });

  const user = sessionQuery.data?.user ?? null;
  const canCreateRoom = Boolean(user) && roomName.trim().length >= 3;
  const activeRoom =
    roomQuery.data?.room ?? (liveRoom && liveRoom.id === currentRoomId ? liveRoom : null);

  const myStatsQuery = useQuery({
    queryKey: ["leaderboard", "me"],
    queryFn: () =>
      apiRequest<{ stats: LeaderboardEntry }>("/api/leaderboard/me"),
    enabled: Boolean(user),
  });

  const filteredRooms =
    publicRoomsQuery.data?.rooms.filter((room) => {
      const term = deferredRoomSearch.trim().toLowerCase();
      if (!term) {
        return true;
      }

      return (
        room.name.toLowerCase().includes(term) ||
        room.code.toLowerCase().includes(term)
      );
    }) ?? [];
  const joinableRooms = filteredRooms.filter((room) => room.gameStatus === "lobby");
  const spectateRooms = filteredRooms.filter((room) => room.gameStatus === "playing");

  const appendActivity = (message: string) => {
    startTransition(() => {
      setActivity((current) => [message, ...current].slice(0, 8));
    });
  };

  const reportRealtimeActivity = useEffectEvent((message: string) => {
    appendActivity(message);
  });

  const refreshRoomFromRealtime = useEffectEvent(async (roomIdToRefresh: string) => {
    try {
      const { room } = await apiRequest<RoomResponse>(
        `/api/rooms/${roomIdToRefresh}`,
      );
      startTransition(() => {
        setLiveRoom(room);
        queryClient.setQueryData<RoomResponse>(["room", room.id], { room });
      });
      void queryClient.invalidateQueries({ queryKey: ["public-rooms"] });
      reportRealtimeActivity("Room updated live.");
    } catch (error) {
      void queryClient.invalidateQueries({ queryKey: ["room", roomIdToRefresh] });
      void queryClient.invalidateQueries({ queryKey: ["public-rooms"] });
      reportRealtimeActivity(
        error instanceof Error ? error.message : "Room update will refresh shortly.",
      );
    }
  });

  const cacheRoom = (room: RoomSummary) => {
    setLiveRoom(room);
    queryClient.setQueryData<RoomResponse>(["room", room.id], { room });
  };

  const refreshSession = () => {
    void queryClient.invalidateQueries({ queryKey: ["session"] });
    void queryClient.invalidateQueries({ queryKey: ["public-rooms"] });
  };

  const focusActiveLobby = useCallback(() => {
    requestAnimationFrame(() => {
      activeLobbyRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }, []);

  const openRoom = (room: RoomSummary) => {
    cacheRoom(room);
    appendActivity(`Opened lobby "${room.name}".`);

    if (currentRoomId !== room.id) {
      router.push(`/online/rooms/${room.id}`);
    }

    focusActiveLobby();
  };

  const authMutation = useMutation({
    mutationFn: async (mode: AuthView) => {
      if (mode === "guest") {
        return await apiRequest<AuthResponse>("/api/auth/guest", {
          method: "POST",
          body: JSON.stringify({ displayName }),
        });
      }

      if (mode === "signin") {
        return await apiRequest<AuthResponse>("/api/auth/signin", {
          method: "POST",
          body: JSON.stringify({ username, password }),
        });
      }

      return await apiRequest<AuthResponse>("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({ username, password, displayName }),
      });
    },
    onSuccess: (data) => {
      refreshSession();
      setPassword("");
      if (!displayName.trim()) {
        setDisplayName(data.user.displayName);
      }
      toast.success(data.message);
      appendActivity(`${data.user.displayName} is ready for online play.`);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Authentication failed.");
    },
  });

  const signOutMutation = useMutation({
    mutationFn: async () =>
      await apiRequest<SessionResponse>("/api/auth/session", {
        method: "DELETE",
      }),
    onSuccess: () => {
      setLiveRoom(null);
      setLatestInviteUrl("");
      handledInviteRef.current = inviteToken ?? null;
      setSocketState("idle");
      refreshSession();
      if (currentRoomId || inviteToken) {
        router.replace("/online");
      }
      toast.success("Signed out.");
      appendActivity("Session closed.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to sign out.");
    },
  });

  const createRoomMutation = useMutation({
    mutationFn: async () =>
      await apiRequest<RoomResponse>("/api/rooms", {
        method: "POST",
        body: JSON.stringify({
          name: roomName,
          visibility: roomVisibility,
        }),
      }),
    onSuccess: ({ room }) => {
      setLiveRoom(room);
      setRoomName("");
      queryClient.setQueryData<RoomResponse>(["room", room.id], { room });
      refreshSession();
      router.push(`/online/rooms/${room.id}`);
      toast.success(`Created ${room.name}.`);
      appendActivity(`Room "${room.name}" opened as ${room.visibility}.`);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to create room.");
    },
  });

  const joinRoomMutation = useMutation({
    mutationFn: async (roomId: string) => {
      setJoiningRoomId(roomId);
      return await apiRequest<RoomResponse>(`/api/rooms/${roomId}/join`, {
        method: "POST",
      });
    },
    onSuccess: ({ room }) => {
      setLiveRoom(room);
      queryClient.setQueryData<RoomResponse>(["room", room.id], { room });
      refreshSession();
      router.push(`/online/rooms/${room.id}`);
      toast.success(`Joined ${room.name}.`);
      appendActivity(`Joined room "${room.name}".`);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to join room.");
    },
    onSettled: () => {
      setJoiningRoomId(null);
    },
  });

  const selectTokenMutation = useMutation({
    mutationFn: async (color: TokenColor) =>
      await apiRequest<RoomResponse>(`/api/rooms/${currentRoomId}/token`, {
        method: "POST",
        body: JSON.stringify({ color }),
      }),
    onSuccess: ({ room }) => {
      cacheRoom(room);
      toast.success("Token color selected.");
      appendActivity("Token selection updated.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to select token.");
    },
  });

  const assignUmpireMutation = useMutation({
    mutationFn: async (umpireUserId: string | null) =>
      await apiRequest<RoomResponse>(`/api/rooms/${currentRoomId}/umpire`, {
        method: "POST",
        body: JSON.stringify({ umpireUserId }),
      }),
    onSuccess: ({ room }) => {
      cacheRoom(room);
      toast.success("Umpire updated.");
      appendActivity("Room umpire updated.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to assign umpire.");
    },
  });

  const startGameMutation = useMutation({
    mutationFn: async () =>
      await apiRequest<RoomResponse>(`/api/rooms/${currentRoomId}/start`, {
        method: "POST",
      }),
    onSuccess: ({ room }) => {
      cacheRoom(room);
      toast.success("Game started.");
      appendActivity("The online game has started.");
      focusActiveLobby();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to start game.");
    },
  });

  const rollDiceMutation = useMutation({
    mutationFn: async () =>
      await apiRequest<RoomResponse>(`/api/rooms/${currentRoomId}/roll`, {
        method: "POST",
      }),
    onSuccess: ({ room }) => {
      cacheRoom(room);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to roll.");
    },
  });

  const useCardMutation = useMutation({
    mutationFn: async (cardId: string) =>
      await apiRequest<RoomResponse>(`/api/rooms/${currentRoomId}/card`, {
        method: "POST",
        body: JSON.stringify({ cardId }),
      }),
    onSuccess: ({ room }) => {
      cacheRoom(room);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to use card.");
    },
  });

  const acceptInviteMutation = useMutation({
    mutationFn: async (token: string) =>
      await apiRequest<AcceptInvitationResponse>(
        `/api/invitations/${token}/accept`,
        {
          method: "POST",
        },
      ),
    onSuccess: ({ room }) => {
      setLiveRoom(room);
      setInviteInput("");
      queryClient.setQueryData<RoomResponse>(["room", room.id], { room });
      refreshSession();
      router.replace(`/online/rooms/${room.id}`);
      toast.success(`Joined ${room.name} from invite.`);
      appendActivity(`Accepted an invite into "${room.name}".`);
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Unable to accept invite.",
      );
    },
  });

  const createInviteMutation = useMutation({
    mutationFn: async () =>
      await apiRequest<InvitationResponse>("/api/invitations", {
        method: "POST",
        body: JSON.stringify({
          roomId: currentRoomId,
          inviteeUsername: inviteUsername.trim() || undefined,
        }),
      }),
    onSuccess: ({ invitation }) => {
      setLatestInviteUrl(invitation.inviteUrl);
      setInviteUsername("");
      toast.success("Invite link created.");
      appendActivity("A fresh invite link is ready to share.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to create invite.");
    },
  });

  const leaveRoomMutation = useMutation({
    mutationFn: async () =>
      await apiRequest<RoomResponse | { room: null }>(
        `/api/rooms/${currentRoomId}/leave`,
        { method: "POST" },
      ),
    onSuccess: (data) => {
      if ("room" in data && data.room) {
        cacheRoom(data.room);
      } else {
        setLiveRoom(null);
      }
      refreshSession();
      router.replace("/online");
      toast.success("You left the room.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to leave room.");
    },
  });

  const closeRoomMutation = useMutation({
    mutationFn: async () =>
      await apiRequest<{ closed: boolean }>(`/api/rooms/${currentRoomId}/close`, {
        method: "POST",
      }),
    onSuccess: () => {
      setLiveRoom(null);
      refreshSession();
      router.replace("/online");
      toast.success("Room closed.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to close room.");
    },
  });

  useEffect(() => {
    if (!user) {
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      reportRealtimeActivity("Live updates are using refresh polling until Supabase is configured.");
      return;
    }

    const publicRoomsChannel = supabase
      .channel("fs-public-rooms")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "fs_rooms" },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["public-rooms"] });
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setSocketState("connected");
          reportRealtimeActivity("Supabase live room connection established.");
        }

        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setSocketState("error");
          reportRealtimeActivity("Supabase live connection failed. Polling will keep trying.");
        }
      });

    return () => {
      void supabase.removeChannel(publicRoomsChannel);
    };
  }, [queryClient, user]);

  useEffect(() => {
    if (!currentRoomId || socketState === "connected") {
      return;
    }

    const interval = window.setInterval(() => {
      void queryClient.invalidateQueries({ queryKey: ["room", currentRoomId] });
      void queryClient.invalidateQueries({ queryKey: ["public-rooms"] });
    }, 2500);

    return () => window.clearInterval(interval);
  }, [currentRoomId, queryClient, socketState]);

  useEffect(() => {
    if (!currentRoomId || !user) {
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return;
    }

    const roomChannel = supabase
      .channel(`fs-room-${currentRoomId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "fs_rooms",
          filter: `id=eq.${currentRoomId}`,
        },
        () => {
          void refreshRoomFromRealtime(currentRoomId);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "fs_rooms",
          filter: `id=eq.${currentRoomId}`,
        },
        () => {
          startTransition(() => {
            setLiveRoom(null);
          });
          router.replace("/online");
          void queryClient.invalidateQueries({ queryKey: ["public-rooms"] });
          reportRealtimeActivity("The active room was closed.");
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(roomChannel);
    };
  }, [currentRoomId, queryClient, router, user]);

  useEffect(() => {
    if (!user || !inviteToken || handledInviteRef.current === inviteToken) {
      return;
    }

    handledInviteRef.current = inviteToken;
    acceptInviteMutation.mutate(inviteToken);
  }, [acceptInviteMutation, inviteToken, user]);

  useEffect(() => {
    if (activeRoom && currentRoomId) {
      focusActiveLobby();
    }
  }, [activeRoom, currentRoomId, focusActiveLobby]);

  const selectedColorByUser = new Map(
    activeRoom?.tokenSelections.map((selection) => [
      selection.userId,
      selection.color,
    ]) ?? [],
  );
  const selectedUserByColor = new Map(
    activeRoom?.tokenSelections.map((selection) => [
      selection.color,
      selection.userId,
    ]) ?? [],
  );
  const currentUserSelection = user ? selectedColorByUser.get(user.id) : null;
  const activePlayers = activeRoom?.gameState?.players ?? [];
  const currentPlayer =
    activeRoom?.gameState?.players[activeRoom.gameState.currentPlayerIndex] ?? null;
  const isOwner = Boolean(user && activeRoom?.ownerId === user.id);
  const isUmpire = Boolean(user && activeRoom?.umpireId === user.id);
  const canManageActiveRoom = isOwner || isUmpire;
  const canStartActiveRoom =
    activeRoom?.gameStatus === "lobby" &&
    activeRoom.tokenSelections.length >= 2 &&
    canManageActiveRoom;
  const isCurrentOnlinePlayer = Boolean(user && currentPlayer?.id === user.id);
  const getOnlineDisplayPosition = (player: Player) => player.position;

  async function copyInviteUrl() {
    if (!latestInviteUrl) {
      return;
    }

    await navigator.clipboard.writeText(latestInviteUrl);
    toast.success("Invite link copied.");
  }

  if (isRoomRoute) {
    return (
      <div className="min-h-screen bg-amber-50 text-stone-900">
        <header className="sticky top-0 z-[100] border-b border-amber-100 bg-white/95 px-3 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  className="h-9 rounded-xl border-amber-200 bg-white px-3"
                  onClick={() => router.push("/online")}
                >
                  <DoorOpen className="size-4" />
                  Rooms
                </Button>
                <div className="min-w-0">
                  <h1 className="truncate text-base font-bold text-amber-900">
                    {activeRoom?.name ?? "Opening room..."}
                  </h1>
                  <p className="text-xs text-stone-500">
                    {activeRoom ? `${activeRoom.code} · ${activeRoom.gameStatus}` : "Loading"}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${
                  socketState === "connected"
                    ? "bg-emerald-100 text-emerald-800"
                    : socketState === "error"
                      ? "bg-red-100 text-red-700"
                      : "bg-stone-100 text-stone-600"
                }`}
              >
                {socketState === "connected" ? "Live" : "Polling"}
              </span>
              {isOwner && activeRoom && (
                <Button
                  variant="outline"
                  className="h-9 rounded-xl border-red-200 bg-white px-3 text-red-700 hover:bg-red-50"
                  onClick={() => closeRoomMutation.mutate()}
                  disabled={closeRoomMutation.isPending}
                >
                  {closeRoomMutation.isPending ? (
                    <RefreshCw className="size-4 animate-spin" />
                  ) : (
                    <DoorOpen className="size-4" />
                  )}
                  Close Room
                </Button>
              )}
              {activeRoom && (
                <Button
                  variant="outline"
                  className="h-9 rounded-xl border-stone-200 bg-white px-3"
                  onClick={() => leaveRoomMutation.mutate()}
                  disabled={leaveRoomMutation.isPending}
                >
                  {leaveRoomMutation.isPending ? (
                    <RefreshCw className="size-4 animate-spin" />
                  ) : (
                    <LogOut className="size-4" />
                  )}
                  Leave
                </Button>
              )}
            </div>
          </div>
        </header>

        {roomQuery.isLoading ? (
          <div className="flex min-h-[calc(100dvh-64px)] items-center justify-center">
            <div className="flex items-center gap-3 rounded-2xl border border-amber-100 bg-white px-4 py-3 text-sm text-stone-600">
              <RefreshCw className="size-4 animate-spin" />
              Loading room...
            </div>
          </div>
        ) : roomQuery.isError ? (
          <div className="flex min-h-[calc(100dvh-64px)] items-center justify-center p-4">
            <div className="max-w-md rounded-3xl border border-red-100 bg-white p-6 text-center shadow-sm">
              <h2 className="text-xl font-semibold text-red-700">
                Unable to open this room
              </h2>
              <p className="mt-2 text-sm text-stone-600">
                {roomQuery.error instanceof Error
                  ? roomQuery.error.message
                  : "The room may have been closed."}
              </p>
              <Button
                className="mt-4 rounded-2xl bg-stone-900 text-amber-50"
                onClick={() => router.replace("/online")}
              >
                Back to Online Rooms
              </Button>
            </div>
          </div>
        ) : activeRoom ? (
          activeRoom.gameStatus === "playing" || activeRoom.gameStatus === "won" ? (
            <main className="grid min-h-[calc(100dvh-64px)] grid-rows-[minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,1fr)_23rem] lg:grid-rows-1">
              <section className="flex min-h-[55dvh] items-start justify-center overflow-auto p-4 sm:p-5 lg:min-h-0 lg:p-6">
                <div className="w-full max-w-[min(100%,42rem)] lg:max-w-[min(100%,calc((100dvh-128px)*0.6667))]">
                  <GameBoard
                    players={activePlayers}
                    getDisplayPosition={getOnlineDisplayPosition}
                    animatingToken={null}
                    onTileClick={(tile) => {
                      toast.info(`Tile ${tile}`);
                    }}
                  />
                </div>
              </section>
              <aside className="border-t border-amber-100 bg-white p-3 lg:overflow-y-auto lg:border-l lg:border-t-0">
                <GameControls
                  players={activePlayers}
                  currentPlayer={currentPlayer}
                  diceValue={activeRoom.gameState?.diceValue ?? null}
                  isRolling={
                    activeRoom.gameState?.isRolling || rollDiceMutation.isPending
                  }
                  isAnimating={false}
                  lastEvent={activeRoom.gameState?.lastEvent ?? null}
                  pendingHolySpiritChoice={
                    activeRoom.gameState?.pendingHolySpiritChoice ?? false
                  }
                  onRoll={() => rollDiceMutation.mutate()}
                  onUseCard={(cardId) => useCardMutation.mutate(cardId)}
                  onReset={() => router.push("/online")}
                  gamePhase={activeRoom.gameState?.phase ?? "setup"}
                  canRoll={isCurrentOnlinePlayer}
                  canUseCards={isCurrentOnlinePlayer}
                />
              </aside>
            </main>
          ) : (
            <main className="mx-auto grid w-full max-w-6xl gap-5 px-4 py-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
              <section className="space-y-5">
                <div className="rounded-3xl border border-white/70 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold text-stone-950">
                        Choose Your Token
                      </h2>
                      <p className="text-sm text-stone-500">
                        The game can start when at least two players have selected colors.
                      </p>
                    </div>
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                      {activeRoom.tokenSelections.length}/4 ready
                    </span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {ALL_COLORS.map((color) => {
                      const selectedUserId = selectedUserByColor.get(color);
                      const selectedMember = activeRoom.members.find(
                        (member) => member.userId === selectedUserId,
                      );
                      const isMine = currentUserSelection === color;
                      const token = TOKEN_COLORS[color];

                      return (
                        <button
                          key={color}
                          type="button"
                          onClick={() => selectTokenMutation.mutate(color)}
                          disabled={
                            !user ||
                            selectTokenMutation.isPending ||
                            Boolean(selectedUserId && !isMine)
                          }
                          className={`flex min-h-20 items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                            isMine
                              ? "border-stone-900 bg-white shadow-sm"
                              : selectedUserId
                                ? "border-stone-200 bg-stone-100 opacity-70"
                                : "border-stone-200 bg-white hover:border-stone-400"
                          }`}
                        >
                          <span className="flex items-center gap-3">
                            <span className={`size-7 rounded-full border-2 ${token.bg} ${token.border}`} />
                            <span>
                              <span className="block text-sm font-semibold text-stone-900">
                                {token.label}
                              </span>
                              <span className="text-xs text-stone-500">
                                {selectedMember ? selectedMember.displayName : "Available"}
                              </span>
                            </span>
                          </span>
                          {isMine && (
                            <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
                              Yours
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-3xl border border-white/70 bg-white p-4 shadow-sm">
                  <h2 className="mb-3 text-lg font-semibold text-stone-950">
                    Players
                  </h2>
                  <div className="space-y-2">
                    {activeRoom.members.map((member) => {
                      const selectedColor = selectedColorByUser.get(member.userId);
                      return (
                        <div
                          key={member.userId}
                          className="flex items-center justify-between gap-3 rounded-2xl bg-stone-50 px-3 py-3"
                        >
                          <div className="min-w-0">
                            <div className="truncate font-medium text-stone-900">
                              {member.displayName}
                            </div>
                            <div className="text-xs text-stone-500">
                              @{member.username}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {selectedColor && (
                              <span className={`size-5 rounded-full border-2 ${TOKEN_COLORS[selectedColor].bg} ${TOKEN_COLORS[selectedColor].border}`} />
                            )}
                            {member.userId === activeRoom.ownerId && (
                              <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-800">
                                owner
                              </span>
                            )}
                            {member.userId === activeRoom.umpireId && (
                              <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-800">
                                umpire
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>

              <aside className="space-y-4">
                <div className="rounded-3xl border border-white/70 bg-white p-4 shadow-sm">
                  <h2 className="text-lg font-semibold text-stone-950">
                    Start Controls
                  </h2>
                  <p className="mt-1 text-sm text-stone-500">
                    Owner or assigned umpire can start when enough players are ready.
                  </p>
                  {isOwner && (
                    <select
                      value={activeRoom.umpireId ?? ""}
                      onChange={(event) =>
                        assignUmpireMutation.mutate(event.target.value || null)
                      }
                      disabled={assignUmpireMutation.isPending}
                      className="mt-4 h-11 w-full rounded-2xl border border-stone-200 bg-white px-3 text-sm text-stone-700 outline-none focus:border-stone-400"
                    >
                      <option value="">Owner starts the game</option>
                      {activeRoom.members
                        .filter((member) => member.userId !== activeRoom.ownerId)
                        .map((member) => (
                          <option key={member.userId} value={member.userId}>
                            {member.displayName} can start as umpire
                          </option>
                        ))}
                    </select>
                  )}
                  <Button
                    onClick={() => startGameMutation.mutate()}
                    disabled={!canStartActiveRoom || startGameMutation.isPending}
                    className="mt-4 h-11 w-full rounded-2xl bg-stone-900 text-amber-50 hover:bg-stone-800"
                  >
                    {startGameMutation.isPending ? (
                      <RefreshCw className="size-4 animate-spin" />
                    ) : (
                      <Sparkles className="size-4" />
                    )}
                    Start Game
                  </Button>
                </div>

                <div className="rounded-3xl border border-white/70 bg-white p-4 shadow-sm">
                  <h2 className="text-lg font-semibold text-stone-950">
                    Invite
                  </h2>
                  <div className="mt-3 space-y-3">
                    <Input
                      value={inviteUsername}
                      onChange={(event) => setInviteUsername(event.target.value)}
                      placeholder="Optional username"
                      className="h-11 rounded-2xl bg-white"
                    />
                    <Button
                      onClick={() => createInviteMutation.mutate()}
                      disabled={!currentRoomId || createInviteMutation.isPending}
                      className="h-11 w-full rounded-2xl bg-stone-900 text-amber-50 hover:bg-stone-800"
                    >
                      {createInviteMutation.isPending ? (
                        <RefreshCw className="size-4 animate-spin" />
                      ) : (
                        <Link2 className="size-4" />
                      )}
                      Create Invite
                    </Button>
                    {latestInviteUrl && (
                      <Button
                        variant="outline"
                        className="h-11 w-full rounded-2xl bg-white"
                        onClick={() => {
                          void copyInviteUrl();
                        }}
                      >
                        <Copy className="size-4" />
                        Copy Invite
                      </Button>
                    )}
                  </div>
                </div>

                {myStatsQuery.data?.stats && (
                  <div className="rounded-3xl border border-white/70 bg-white p-4 shadow-sm">
                    <h2 className="text-lg font-semibold text-stone-950">
                      Your Stats
                    </h2>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-2xl bg-stone-50 p-3">
                        <div className="text-xl font-bold">{myStatsQuery.data.stats.gamesPlayed}</div>
                        <div className="text-[10px] uppercase tracking-[0.14em] text-stone-400">Played</div>
                      </div>
                      <div className="rounded-2xl bg-emerald-50 p-3">
                        <div className="text-xl font-bold text-emerald-700">{myStatsQuery.data.stats.wins}</div>
                        <div className="text-[10px] uppercase tracking-[0.14em] text-emerald-500">Wins</div>
                      </div>
                      <div className="rounded-2xl bg-red-50 p-3">
                        <div className="text-xl font-bold text-red-700">{myStatsQuery.data.stats.losses}</div>
                        <div className="text-[10px] uppercase tracking-[0.14em] text-red-500">Losses</div>
                      </div>
                    </div>
                  </div>
                )}
              </aside>
            </main>
          )
        ) : (
          <div className="flex min-h-[calc(100dvh-64px)] items-center justify-center p-4">
            <div className="max-w-md rounded-3xl border border-amber-100 bg-white p-6 text-center shadow-sm">
              <h2 className="text-xl font-semibold text-stone-900">
                Room not available
              </h2>
              <Button
                className="mt-4 rounded-2xl bg-stone-900 text-amber-50"
                onClick={() => router.replace("/online")}
              >
                Back to Online Rooms
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8efe2_0%,#f2e5d1_40%,#efe4d5_100%)] text-stone-900">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 rounded-[2rem] border border-white/50 bg-white/70 p-5 shadow-[0_28px_90px_-38px_rgba(120,53,15,0.5)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-800">
              <Globe2 className="size-3.5" />
              Online Play
            </div>
            <h1 className="text-3xl font-semibold tracking-[-0.04em] text-stone-950">
              Rooms, guests, invites, and live joins.
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
              Persisted in Supabase and synced with Realtime so the lobby stays
              current while players come and go.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="h-10 rounded-2xl border-stone-300 bg-white/80 px-4"
              onClick={() => router.push("/online/leaderboard")}
            >
              <Trophy className="size-4" />
              Leaderboard
            </Button>
            <Button
              variant="outline"
              className="h-10 rounded-2xl border-stone-300 bg-white/80 px-4"
              onClick={() => router.push(backHref)}
            >
              <DoorOpen className="size-4" />
              {backHref === "/" ? "Back Home" : "Back"}
            </Button>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-6">
            <Card className="border-white/60 bg-white/85 shadow-[0_24px_80px_-32px_rgba(120,53,15,0.42)]">
              <CardHeader>
                <CardTitle className="text-xl text-stone-900">
                  Identity
                </CardTitle>
                <CardDescription>
                  Sign in, create an account, or keep it light with a guest name.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {user ? (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Eyelet
                        icon={<Sparkles className="size-3.5" />}
                        label="Display Name"
                        value={user.displayName}
                      />
                      <Eyelet
                        icon={<Shield className="size-3.5" />}
                        label="Session"
                        value={user.role === "guest" ? "Guest" : "Account"}
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                      <span>
                        Signed in as <strong>@{user.username}</strong>
                      </span>
                      <Button
                        variant="outline"
                        className="rounded-xl border-emerald-300 bg-white text-emerald-700"
                        onClick={() => signOutMutation.mutate()}
                        disabled={signOutMutation.isPending}
                      >
                        <LogOut className="size-4" />
                        Sign Out
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-2">
                      {(["guest", "signin", "signup"] as AuthView[]).map((view) => (
                        <button
                          key={view}
                          type="button"
                          onClick={() => setAuthView(view)}
                          className={`rounded-2xl px-3 py-2 text-sm font-medium transition ${
                            authView === view
                              ? "bg-stone-900 text-amber-50"
                              : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                          }`}
                        >
                          {view === "guest"
                            ? "Guest"
                            : view === "signin"
                              ? "Sign In"
                              : "Sign Up"}
                        </button>
                      ))}
                    </div>
                    <div className="space-y-3">
                      <Input
                        value={displayName}
                        onChange={(event) => setDisplayName(event.target.value)}
                        placeholder={
                          authView === "guest"
                            ? "Guest display name"
                            : "Display name"
                        }
                        className="h-11 rounded-2xl bg-white"
                      />
                      {authView !== "guest" && (
                        <>
                          <Input
                            value={username}
                            onChange={(event) => setUsername(event.target.value)}
                            placeholder="username"
                            className="h-11 rounded-2xl bg-white"
                          />
                          <Input
                            value={password}
                            type="password"
                            onChange={(event) => setPassword(event.target.value)}
                            placeholder="password"
                            className="h-11 rounded-2xl bg-white"
                          />
                        </>
                      )}
                    </div>
                    <Button
                      onClick={() => authMutation.mutate(authView)}
                      disabled={!canSubmitAuth || authMutation.isPending}
                      className="h-11 w-full rounded-2xl bg-stone-900 text-amber-50 hover:bg-stone-800"
                    >
                      {authMutation.isPending ? (
                        <RefreshCw className="size-4 animate-spin" />
                      ) : (
                        <Users className="size-4" />
                      )}
                      {authView === "guest"
                        ? "Continue as Guest"
                        : authView === "signin"
                          ? "Sign In"
                          : "Create Account"}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="border-white/60 bg-white/85 shadow-[0_24px_80px_-32px_rgba(120,53,15,0.42)]">
              <CardHeader>
                <CardTitle className="text-xl text-stone-900">
                  Public Rooms
                </CardTitle>
                <CardDescription>
                  Browse open rooms or filter by room name and code.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  value={roomSearch}
                  onChange={(event) => setRoomSearch(event.target.value)}
                  placeholder="Search public rooms"
                  className="h-11 rounded-2xl bg-white"
                />
                <div className="space-y-3">
                  {publicRoomsQuery.isLoading && (
                    <div className="flex items-center gap-2 rounded-2xl border border-stone-200 bg-stone-50/80 px-4 py-6 text-sm text-stone-500">
                      <RefreshCw className="size-4 animate-spin" />
                      Loading rooms...
                    </div>
                  )}
                  {publicRoomsQuery.isError && (
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-6 text-sm text-red-700">
                      {publicRoomsQuery.error instanceof Error
                        ? publicRoomsQuery.error.message
                        : "Unable to load rooms."}
                    </div>
                  )}
                  {!publicRoomsQuery.isLoading && !publicRoomsQuery.isError && joinableRooms.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50/80 px-4 py-6 text-sm text-stone-500">
                      No open lobbies match this filter yet.
                    </div>
                  )}
                  {joinableRooms.map((room) => {
                    const alreadyInside = room.members.some(
                      (member) => member.userId === user?.id,
                    );
                    const isJoiningThisRoom = joiningRoomId === room.id;

                    return (
                      <div
                        key={room.id}
                        className="rounded-3xl border border-stone-200 bg-stone-50/90 p-4"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-base font-semibold text-stone-900">
                                {room.name}
                              </h3>
                              <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-800">
                                {room.code}
                              </span>
                            </div>
                            <p className="mt-1 text-sm text-stone-500">
                              {room.memberCount} player
                              {room.memberCount === 1 ? "" : "s"} in lobby
                            </p>
                          </div>
                          <Button
                            onClick={() =>
                              alreadyInside
                                ? openRoom(room)
                                : joinRoomMutation.mutate(room.id)
                            }
                            disabled={!user || Boolean(joiningRoomId)}
                            className="h-10 rounded-2xl bg-stone-900 px-4 text-amber-50 hover:bg-stone-800"
                          >
                            {alreadyInside ? (
                              <>
                                <Globe2 className="size-4" />
                                Open Lobby
                              </>
                            ) : isJoiningThisRoom ? (
                              <>
                                <RefreshCw className="size-4 animate-spin" />
                                Joining
                              </>
                            ) : (
                              <>
                                <Plus className="size-4" />
                                Join Room
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className="border-white/60 bg-white/85 shadow-[0_24px_80px_-32px_rgba(120,53,15,0.42)]">
              <CardHeader>
                <CardTitle className="text-xl text-stone-900">
                  Spectate Ongoing Games
                </CardTitle>
                <CardDescription>
                  Watch public rooms whose games have already started.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {!publicRoomsQuery.isError && spectateRooms.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50/80 px-4 py-6 text-sm text-stone-500">
                    No ongoing public games match this filter.
                  </div>
                )}
                {spectateRooms.map((room) => (
                  <div
                    key={room.id}
                    className="rounded-3xl border border-stone-200 bg-stone-50/90 p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-semibold text-stone-900">
                            {room.name}
                          </h3>
                          <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-800">
                            playing
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-stone-500">
                          {room.memberCount} player
                          {room.memberCount === 1 ? "" : "s"} in game
                        </p>
                      </div>
                      <Button
                        onClick={() => openRoom(room)}
                        className="h-10 rounded-2xl bg-stone-900 px-4 text-amber-50 hover:bg-stone-800"
                      >
                        <Globe2 className="size-4" />
                        Spectate
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="border-white/60 bg-white/85 shadow-[0_24px_80px_-32px_rgba(120,53,15,0.42)]">
              <CardHeader>
                <CardTitle className="text-xl text-stone-900">
                  Room Actions
                </CardTitle>
                <CardDescription>
                  Create a room, then invite by username or share a link.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-6 lg:grid-cols-2">
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-500">
                    Create Room
                  </h3>
                  <Input
                    value={roomName}
                    onChange={(event) => setRoomName(event.target.value)}
                    placeholder="Room name"
                    className="h-11 rounded-2xl bg-white"
                    disabled={!user}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    {(["public", "private"] as const).map((visibility) => (
                      <button
                        key={visibility}
                        type="button"
                        onClick={() => setRoomVisibility(visibility)}
                        disabled={!user}
                        className={`rounded-2xl px-3 py-2 text-sm font-medium transition ${
                          roomVisibility === visibility
                            ? "bg-stone-900 text-amber-50"
                            : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                        }`}
                      >
                        {visibility}
                      </button>
                    ))}
                  </div>
                  <Button
                    onClick={() => createRoomMutation.mutate()}
                    disabled={!canCreateRoom || createRoomMutation.isPending}
                    className="h-11 w-full rounded-2xl bg-stone-900 text-amber-50 hover:bg-stone-800"
                  >
                    {createRoomMutation.isPending ? (
                      <RefreshCw className="size-4 animate-spin" />
                    ) : (
                      <Plus className="size-4" />
                    )}
                    Create {roomVisibility} room
                  </Button>
                </div>

                <div className="space-y-3">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-500">
                    Join by Invite
                  </h3>
                  <Input
                    value={inviteInput}
                    onChange={(event) => setInviteInput(event.target.value)}
                    placeholder="Paste an invite link or token"
                    className="h-11 rounded-2xl bg-white"
                    disabled={!user}
                  />
                  <Button
                    onClick={() =>
                      acceptInviteMutation.mutate(getInviteToken(inviteInput))
                    }
                    disabled={
                      !user ||
                      !getInviteToken(inviteInput) ||
                      acceptInviteMutation.isPending
                    }
                    className="h-11 w-full rounded-2xl bg-stone-900 text-amber-50 hover:bg-stone-800"
                  >
                    <Link2 className="size-4" />
                    Accept invite
                  </Button>
                  {inviteToken && !user && (
                    <p className="text-xs leading-5 text-amber-800">
                      An invite link is waiting. Sign in or continue as a guest
                      and it will be accepted automatically.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {currentRoomId && (
            <Card
              ref={activeLobbyRef}
              className="scroll-mt-6 border-white/60 bg-white/85 shadow-[0_24px_80px_-32px_rgba(120,53,15,0.42)]"
            >
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="text-xl text-stone-900">
                      Active Lobby
                    </CardTitle>
                    <CardDescription>
                      Live room membership comes in through Supabase Realtime.
                    </CardDescription>
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
                      socketState === "connected"
                        ? "bg-emerald-100 text-emerald-800"
                        : socketState === "connecting"
                          ? "bg-amber-100 text-amber-800"
                          : socketState === "error"
                            ? "bg-red-100 text-red-700"
                            : "bg-stone-200 text-stone-600"
                    }`}
                  >
                    {socketState}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {activeRoom ? (
                  <>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <Eyelet
                        icon={<Users className="size-3.5" />}
                        label="Room"
                        value={activeRoom.name}
                      />
                      <Eyelet
                        icon={<Shield className="size-3.5" />}
                        label="Visibility"
                        value={activeRoom.visibility}
                      />
                      <Eyelet
                        icon={<Sparkles className="size-3.5" />}
                        label="Code"
                        value={activeRoom.code}
                      />
                    </div>

                    {activeRoom.gameStatus === "lobby" ? (
                      <>
                        <div className="rounded-3xl border border-stone-200 bg-stone-50/90 p-4">
                          <div className="mb-3 flex items-center justify-between">
                            <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-500">
                              Token Colors
                            </h3>
                            <span className="text-sm text-stone-500">
                              {activeRoom.tokenSelections.length}/4 selected
                            </span>
                          </div>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {ALL_COLORS.map((color) => {
                              const selectedUserId = selectedUserByColor.get(color);
                              const selectedMember = activeRoom.members.find(
                                (member) => member.userId === selectedUserId,
                              );
                              const isMine = currentUserSelection === color;
                              const token = TOKEN_COLORS[color];

                              return (
                                <button
                                  key={color}
                                  type="button"
                                  onClick={() => selectTokenMutation.mutate(color)}
                                  disabled={
                                    !user ||
                                    selectTokenMutation.isPending ||
                                    Boolean(selectedUserId && !isMine)
                                  }
                                  className={`flex items-center justify-between rounded-2xl border px-3 py-3 text-left transition ${
                                    isMine
                                      ? "border-stone-900 bg-white shadow-sm"
                                      : selectedUserId
                                        ? "border-stone-200 bg-stone-100 opacity-70"
                                        : "border-stone-200 bg-white hover:border-stone-400"
                                  }`}
                                >
                                  <span className="flex items-center gap-3">
                                    <span
                                      className={`size-5 rounded-full border-2 ${token.bg} ${token.border}`}
                                    />
                                    <span>
                                      <span className="block text-sm font-semibold text-stone-900">
                                        {token.label}
                                      </span>
                                      <span className="text-xs text-stone-500">
                                        {selectedMember
                                          ? selectedMember.displayName
                                          : "Available"}
                                      </span>
                                    </span>
                                  </span>
                                  {isMine && (
                                    <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
                                      Yours
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="rounded-3xl border border-stone-200 bg-stone-50/90 p-4">
                          <div className="mb-3 flex items-center justify-between">
                            <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-500">
                              Players
                            </h3>
                            <span className="text-sm text-stone-500">
                              {activeRoom.memberCount} in room
                            </span>
                          </div>
                          <div className="space-y-2">
                            {activeRoom.members.map((member) => {
                              const selectedColor = selectedColorByUser.get(member.userId);

                              return (
                                <div
                                  key={member.userId}
                                  className="flex items-center justify-between gap-3 rounded-2xl bg-white px-3 py-2"
                                >
                                  <div className="min-w-0">
                                    <div className="truncate font-medium text-stone-900">
                                      {member.displayName}
                                    </div>
                                    <div className="text-xs text-stone-500">
                                      @{member.username}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {selectedColor ? (
                                      <span
                                        className={`size-4 rounded-full border-2 ${TOKEN_COLORS[selectedColor].bg} ${TOKEN_COLORS[selectedColor].border}`}
                                        title={TOKEN_COLORS[selectedColor].label}
                                      />
                                    ) : (
                                      <span className="text-xs text-stone-400">
                                        no token
                                      </span>
                                    )}
                                    {member.userId === activeRoom.ownerId && (
                                      <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-800">
                                        owner
                                      </span>
                                    )}
                                    {member.userId === activeRoom.umpireId && (
                                      <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-800">
                                        umpire
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
                          {isOwner ? (
                            <select
                              value={activeRoom.umpireId ?? ""}
                              onChange={(event) =>
                                assignUmpireMutation.mutate(event.target.value || null)
                              }
                              disabled={assignUmpireMutation.isPending}
                              className="h-11 rounded-2xl border border-stone-200 bg-white px-3 text-sm text-stone-700 outline-none focus:border-stone-400"
                            >
                              <option value="">Owner starts the game</option>
                              {activeRoom.members
                                .filter((member) => member.userId !== activeRoom.ownerId)
                                .map((member) => (
                                  <option key={member.userId} value={member.userId}>
                                    {member.displayName} can start as umpire
                                  </option>
                                ))}
                            </select>
                          ) : (
                            <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">
                              {activeRoom.umpireId
                                ? "The owner has assigned an umpire to start the game."
                                : "The owner can start once at least 2 players select tokens."}
                            </div>
                          )}
                          <Button
                            onClick={() => startGameMutation.mutate()}
                            disabled={!canStartActiveRoom || startGameMutation.isPending}
                            className="h-11 rounded-2xl bg-stone-900 px-4 text-amber-50 hover:bg-stone-800"
                          >
                            <Sparkles className="size-4" />
                            Start Game
                          </Button>
                        </div>
                      </>
                    ) : activeRoom.gameState ? (
                      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
                        <div className="rounded-3xl border border-amber-100 bg-amber-50 p-3">
                          <GameBoard
                            players={activePlayers}
                            getDisplayPosition={getOnlineDisplayPosition}
                            animatingToken={null}
                          />
                        </div>
                        <div className="rounded-3xl border border-stone-200 bg-white p-3">
                          <GameControls
                            players={activePlayers}
                            currentPlayer={currentPlayer}
                            diceValue={activeRoom.gameState.diceValue}
                            isRolling={
                              activeRoom.gameState.isRolling || rollDiceMutation.isPending
                            }
                            isAnimating={false}
                            lastEvent={activeRoom.gameState.lastEvent}
                            pendingHolySpiritChoice={
                              activeRoom.gameState.pendingHolySpiritChoice
                            }
                            onRoll={() => rollDiceMutation.mutate()}
                            onUseCard={(cardId) => useCardMutation.mutate(cardId)}
                            onReset={() => router.push("/online")}
                            gamePhase={activeRoom.gameState.phase}
                            canRoll={isCurrentOnlinePlayer}
                            canUseCards={isCurrentOnlinePlayer}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-3xl border border-dashed border-stone-300 bg-stone-50/90 px-4 py-10 text-center text-sm leading-6 text-stone-500">
                        Waiting for the game state to sync.
                      </div>
                    )}

                    <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
                      <Input
                        value={inviteUsername}
                        onChange={(event) => setInviteUsername(event.target.value)}
                        placeholder="Optional username for a direct invite"
                        className="h-11 rounded-2xl bg-white"
                      />
                      <Button
                        onClick={() => createInviteMutation.mutate()}
                        disabled={!currentRoomId || createInviteMutation.isPending}
                        className="h-11 rounded-2xl bg-stone-900 px-4 text-amber-50 hover:bg-stone-800"
                      >
                        <Link2 className="size-4" />
                        Create Invite
                      </Button>
                    </div>

                    {latestInviteUrl && (
                      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4">
                        <div className="mb-2 text-sm font-semibold text-amber-900">
                          Share this invite
                        </div>
                        <div className="flex flex-col gap-3 sm:flex-row">
                          <Input
                            value={latestInviteUrl}
                            readOnly
                            className="h-11 rounded-2xl border-amber-200 bg-white"
                          />
                          <Button
                            variant="outline"
                            className="h-11 rounded-2xl border-amber-300 bg-white text-amber-900"
                            onClick={() => {
                              void copyInviteUrl();
                            }}
                          >
                            <Copy className="size-4" />
                            Copy
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="rounded-3xl border border-dashed border-stone-300 bg-stone-50/90 px-4 py-10 text-center text-sm leading-6 text-stone-500">
                    Create a room, join a public one, or accept an invite to open
                    the live lobby here.
                  </div>
                )}
              </CardContent>
            </Card>
            )}

            <Card className="border-white/60 bg-white/85 shadow-[0_24px_80px_-32px_rgba(120,53,15,0.42)]">
              <CardHeader>
                <CardTitle className="text-xl text-stone-900">
                  Activity
                </CardTitle>
                <CardDescription>
                  Recent socket and lobby events.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {activity.map((entry, index) => (
                  <div
                    key={`${entry}-${index}`}
                    className="rounded-2xl bg-stone-50 px-3 py-2 text-sm text-stone-600"
                  >
                    {entry}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

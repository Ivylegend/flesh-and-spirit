"use client";

import {
  type ReactNode,
  startTransition,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { io, type Socket } from "socket.io-client";
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
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type {
  AcceptInvitationResponse,
  ApiResponse,
  AuthResponse,
  InvitationResponse,
  PublicRoomsResponse,
  RoomResponse,
  RoomSummary,
  SessionResponse,
} from "@/lib/online-play-types";

type AuthView = "signin" | "signup" | "guest";
type SocketState = "idle" | "connecting" | "connected" | "error";

interface OnlinePlayScreenProps {
  onBack: () => void;
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
      return (
        url.searchParams.get("invite") ||
        url.pathname.split("/").filter(Boolean).at(-2) ||
        ""
      );
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

export default function OnlinePlayScreen({ onBack }: OnlinePlayScreenProps) {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const socketRef = useRef<Socket | null>(null);
  const handledInviteRef = useRef<string | null>(null);

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
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [liveRoom, setLiveRoom] = useState<RoomSummary | null>(null);
  const [socketState, setSocketState] = useState<SocketState>("idle");
  const [roomSearch, setRoomSearch] = useState("");
  const [activity, setActivity] = useState<string[]>([
    "Online lobby ready.",
  ]);

  const deferredRoomSearch = useDeferredValue(roomSearch);
  const inviteFromUrl = searchParams.get("invite") ?? "";

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
    queryKey: ["room", activeRoomId],
    queryFn: () => apiRequest<RoomResponse>(`/api/rooms/${activeRoomId}`),
    enabled: Boolean(activeRoomId),
    refetchOnWindowFocus: false,
  });

  const user = sessionQuery.data?.user ?? null;
  const activeRoom =
    liveRoom && liveRoom.id === activeRoomId ? liveRoom : roomQuery.data?.room ?? null;

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

  const appendActivity = (message: string) => {
    startTransition(() => {
      setActivity((current) => [message, ...current].slice(0, 8));
    });
  };

  const reportSocketActivity = useEffectEvent((message: string) => {
    appendActivity(message);
  });

  const updateRoomFromSocket = useEffectEvent((room: RoomSummary) => {
    startTransition(() => {
      setLiveRoom(room);
      setActiveRoomId(room.id);
      queryClient.setQueryData<RoomResponse>(["room", room.id], { room });
    });
  });

  const updatePublicRoomsFromSocket = useEffectEvent((rooms: RoomSummary[]) => {
    queryClient.setQueryData<PublicRoomsResponse>(["public-rooms"], { rooms });
  });

  const refreshSession = () => {
    void queryClient.invalidateQueries({ queryKey: ["session"] });
    void queryClient.invalidateQueries({ queryKey: ["public-rooms"] });
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
      setActiveRoomId(null);
      setLiveRoom(null);
      setLatestInviteUrl("");
      handledInviteRef.current = null;
      setSocketState("idle");
      refreshSession();
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
      setActiveRoomId(room.id);
      setLiveRoom(room);
      setRoomName("");
      queryClient.setQueryData<RoomResponse>(["room", room.id], { room });
      refreshSession();
      toast.success(`Created ${room.name}.`);
      appendActivity(`Room "${room.name}" opened as ${room.visibility}.`);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to create room.");
    },
  });

  const joinRoomMutation = useMutation({
    mutationFn: async (roomId: string) =>
      await apiRequest<RoomResponse>(`/api/rooms/${roomId}/join`, {
        method: "POST",
      }),
    onSuccess: ({ room }) => {
      setActiveRoomId(room.id);
      setLiveRoom(room);
      queryClient.setQueryData<RoomResponse>(["room", room.id], { room });
      refreshSession();
      toast.success(`Joined ${room.name}.`);
      appendActivity(`Joined room "${room.name}".`);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to join room.");
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
      setActiveRoomId(room.id);
      setLiveRoom(room);
      setInviteInput("");
      queryClient.setQueryData<RoomResponse>(["room", room.id], { room });
      refreshSession();
      toast.success(`Joined ${room.name} from invite.`);
      appendActivity(`Accepted an invite into "${room.name}".`);
      if (typeof window !== "undefined") {
        window.history.replaceState({}, "", "/?mode=online");
      }
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
          roomId: activeRoomId,
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

  useEffect(() => {
    if (!user) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      return;
    }

    const socket = io({
      path: "/socket.io",
      withCredentials: true,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setSocketState("connected");
      reportSocketActivity("Live room connection established.");
    });

    socket.on("disconnect", () => {
      setSocketState("idle");
    });

    socket.on("connect_error", (error) => {
      setSocketState("error");
      reportSocketActivity(error.message || "Live connection failed.");
    });

    socket.on("room:snapshot", (room: RoomSummary) => {
      updateRoomFromSocket(room);
    });

    socket.on("room:updated", (room: RoomSummary) => {
      updateRoomFromSocket(room);
      reportSocketActivity(`Room "${room.name}" updated live.`);
    });

    socket.on("rooms:public", (rooms: RoomSummary[]) => {
      updatePublicRoomsFromSocket(rooms);
    });

    socket.on("invitation:created", () => {
      reportSocketActivity("A room invite was generated.");
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user]);

  useEffect(() => {
    if (!socketRef.current || !activeRoomId || socketState !== "connected") {
      return;
    }

    socketRef.current.emit("room:watch", activeRoomId, (ack?: {
      ok: boolean;
      error?: string;
    }) => {
      if (!ack?.ok && ack?.error) {
        toast.error(ack.error);
      }
    });

    return () => {
      socketRef.current?.emit("room:leave", activeRoomId);
    };
  }, [activeRoomId, socketState]);

  useEffect(() => {
    if (!user || !inviteFromUrl || handledInviteRef.current === inviteFromUrl) {
      return;
    }

    handledInviteRef.current = inviteFromUrl;
    acceptInviteMutation.mutate(inviteFromUrl);
  }, [acceptInviteMutation, inviteFromUrl, user]);

  async function copyInviteUrl() {
    if (!latestInviteUrl) {
      return;
    }

    await navigator.clipboard.writeText(latestInviteUrl);
    toast.success("Invite link copied.");
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,_#f8efe2_0%,_#f2e5d1_40%,_#efe4d5_100%)] text-stone-900">
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
              Persisted in MongoDB and synced over WebSockets so the lobby stays
              current while players come and go.
            </p>
          </div>
          <Button
            variant="outline"
            className="h-10 rounded-2xl border-stone-300 bg-white/80 px-4"
            onClick={onBack}
          >
            <DoorOpen className="size-4" />
            Back Home
          </Button>
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
                      disabled={authMutation.isPending}
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
                  {filteredRooms.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50/80 px-4 py-6 text-sm text-stone-500">
                      No public rooms match this filter yet.
                    </div>
                  )}
                  {filteredRooms.map((room) => {
                    const alreadyInside = room.members.some(
                      (member) => member.userId === user?.id,
                    );

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
                                ? setActiveRoomId(room.id)
                                : joinRoomMutation.mutate(room.id)
                            }
                            disabled={!user || joinRoomMutation.isPending}
                            className="h-10 rounded-2xl bg-stone-900 px-4 text-amber-50 hover:bg-stone-800"
                          >
                            {alreadyInside ? (
                              <>
                                <Globe2 className="size-4" />
                                Open Lobby
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
                    disabled={!user || createRoomMutation.isPending}
                    className="h-11 w-full rounded-2xl bg-stone-900 text-amber-50 hover:bg-stone-800"
                  >
                    <Plus className="size-4" />
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
                  {inviteFromUrl && !user && (
                    <p className="text-xs leading-5 text-amber-800">
                      An invite link is waiting. Sign in or continue as a guest
                      and it will be accepted automatically.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="border-white/60 bg-white/85 shadow-[0_24px_80px_-32px_rgba(120,53,15,0.42)]">
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="text-xl text-stone-900">
                      Active Lobby
                    </CardTitle>
                    <CardDescription>
                      Live room membership comes in over WebSockets.
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

                    <div className="rounded-3xl border border-stone-200 bg-stone-50/90 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-500">
                          Members
                        </h3>
                        <span className="text-sm text-stone-500">
                          {activeRoom.memberCount} connected
                        </span>
                      </div>
                      <div className="space-y-2">
                        {activeRoom.members.map((member) => (
                          <div
                            key={member.userId}
                            className="flex items-center justify-between rounded-2xl bg-white px-3 py-2"
                          >
                            <div>
                              <div className="font-medium text-stone-900">
                                {member.displayName}
                              </div>
                              <div className="text-xs text-stone-500">
                                @{member.username}
                              </div>
                            </div>
                            <span className="rounded-full bg-stone-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-600">
                              {member.role}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
                      <Input
                        value={inviteUsername}
                        onChange={(event) => setInviteUsername(event.target.value)}
                        placeholder="Optional username for a direct invite"
                        className="h-11 rounded-2xl bg-white"
                      />
                      <Button
                        onClick={() => createInviteMutation.mutate()}
                        disabled={!activeRoomId || createInviteMutation.isPending}
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

import "server-only";

import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";

import {
  InvitationSummary,
  LeaderboardEntry,
  OnlineGameState,
  RoomSummary,
  RoomVisibility,
  SessionUser,
  SessionUserRole,
} from "@/lib/online-play-types";
import {
  ALL_COLORS,
  createDeck,
  HOLY_SPIRIT_CARDS_PER_PLAYER,
  HOLY_SPIRIT_TILES,
  HolySpiritCard,
  Player,
  resolveSinChain,
  SIN_TILES,
  START_TILE,
  TOTAL_TILES,
  TokenColor,
} from "@/components/FleshAndSpirit/gameConstants";
import { getSupabaseAdmin } from "@/lib/server/supabase";

const SESSION_COOKIE = "flesh_spirit_session";

interface UserRow {
  id: string;
  username: string;
  display_name: string;
  role: SessionUserRole;
  password_hash: string | null;
  created_at: string;
}

interface SessionRow {
  id: string;
  token: string;
  user_id: string;
  created_at: string;
}

interface RoomMemberJson {
  userId: string;
  username: string;
  displayName: string;
  role: SessionUserRole;
  joinedAt: string;
}

interface RoomTokenSelectionJson {
  userId: string;
  color: TokenColor;
  selectedAt: string;
}

interface RoomRow {
  id: string;
  code: string;
  name: string;
  visibility: RoomVisibility;
  owner_id: string;
  umpire_id: string | null;
  game_status: "lobby" | "playing" | "won";
  game_state: OnlineGameState | null;
  game_deck: HolySpiritCard[];
  game_discard: HolySpiritCard[];
  winner_id: string | null;
  leaderboard_awarded: boolean;
  members: RoomMemberJson[];
  token_selections: RoomTokenSelectionJson[];
  created_at: string;
}

interface InvitationRow {
  id: string;
  token: string;
  room_id: string;
  created_by_user_id: string;
  invitee_user_id: string | null;
  created_at: string;
  accepted_at: string | null;
}

interface LeaderboardEntryRow {
  user_id: string;
  username: string;
  display_name: string;
  role: SessionUserRole;
  games_played: number;
  wins: number;
  losses: number;
  updated_at: string;
}

function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

function normalizeDisplayName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function randomToken(size = 24) {
  return randomBytes(size).toString("base64url");
}

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derivedKey}`;
}

function verifyPassword(password: string, passwordHash: string) {
  const [salt, storedHash] = passwordHash.split(":");
  if (!salt || !storedHash) {
    return false;
  }

  const derivedKey = scryptSync(password, salt, 64);
  const storedBuffer = Buffer.from(storedHash, "hex");

  return storedBuffer.length === derivedKey.length && timingSafeEqual(storedBuffer, derivedKey);
}

function ensureDisplayName(value: string, fallback: string) {
  const normalized = normalizeDisplayName(value);
  return normalized.length > 0 ? normalized : fallback;
}

function makeGuestUsername(displayName: string) {
  const safeBase = displayName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 18);

  return `guest-${safeBase || "guest"}-${randomBytes(2).toString("hex")}`;
}

function toIdentity(user: Pick<UserRow, "id" | "role" | "username" | "display_name">): SessionUser {
  return {
    id: user.id,
    role: user.role,
    username: user.username,
    displayName: user.display_name,
  };
}

function serializeDate(value: string | Date | null | undefined) {
  return value ? new Date(value).toISOString() : null;
}

function assertOk(error: unknown) {
  if (error) {
    throw new Error(error instanceof Error ? error.message : "Database request failed.");
  }
}

export function getSessionCookieName() {
  return SESSION_COOKIE;
}

export function sanitizeRoom(room: RoomRow): RoomSummary {
  const members = Array.isArray(room.members) ? room.members : [];
  const tokenSelections = Array.isArray(room.token_selections) ? room.token_selections : [];

  return {
    id: room.id,
    code: room.code,
    name: room.name,
    visibility: room.visibility,
    ownerId: room.owner_id,
    umpireId: room.umpire_id,
    gameStatus: room.game_status ?? "lobby",
    gameState: room.game_state ?? null,
    winnerId: room.winner_id ?? null,
    memberCount: members.length,
    members: members.map((member) => ({
      userId: member.userId,
      username: member.username,
      displayName: member.displayName,
      role: member.role,
      joinedAt: serializeDate(member.joinedAt) ?? new Date().toISOString(),
    })),
    tokenSelections: tokenSelections.map((selection) => ({
      userId: selection.userId,
      color: selection.color,
      selectedAt: serializeDate(selection.selectedAt) ?? new Date().toISOString(),
    })),
    createdAt: serializeDate(room.created_at) ?? new Date().toISOString(),
  };
}

function sanitizeLeaderboardEntry(entry: LeaderboardEntryRow): LeaderboardEntry {
  return {
    userId: entry.user_id,
    username: entry.username,
    displayName: entry.display_name,
    role: entry.role,
    gamesPlayed: entry.games_played,
    wins: entry.wins,
    losses: entry.losses,
    updatedAt: serializeDate(entry.updated_at) ?? new Date().toISOString(),
  };
}

export function sanitizeInvite(invite: InvitationRow): InvitationSummary {
  return {
    token: invite.token,
    roomId: invite.room_id,
    createdByUserId: invite.created_by_user_id,
    inviteeUserId: invite.invitee_user_id,
    createdAt: serializeDate(invite.created_at) ?? new Date().toISOString(),
    acceptedAt: serializeDate(invite.accepted_at),
    inviteLink: `/api/invitations/${invite.token}/accept`,
  };
}

export function sanitizeIdentity(identity: SessionUser) {
  return {
    id: identity.id,
    role: identity.role,
    username: identity.username,
    displayName: identity.displayName,
  };
}

async function makeRoomCode() {
  const supabase = getSupabaseAdmin();

  while (true) {
    const code = randomBytes(3).toString("hex").toUpperCase();
    const { data, error } = await supabase
      .from("fs_rooms")
      .select("id")
      .eq("code", code)
      .maybeSingle();
    assertOk(error);

    if (!data) {
      return code;
    }
  }
}

async function getUserRow(userId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("fs_users")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  assertOk(error);
  return data as UserRow | null;
}

async function requireRoom(roomId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("fs_rooms")
    .select("*")
    .eq("id", roomId)
    .maybeSingle();
  assertOk(error);

  if (!data) {
    throw new Error("Room not found.");
  }

  return data as RoomRow;
}

async function saveRoom(room: RoomRow) {
  const { data, error } = await getSupabaseAdmin()
    .from("fs_rooms")
    .update({
      code: room.code,
      name: room.name,
      visibility: room.visibility,
      owner_id: room.owner_id,
      umpire_id: room.umpire_id,
      game_status: room.game_status,
      game_state: room.game_state,
      game_deck: room.game_deck,
      game_discard: room.game_discard,
      winner_id: room.winner_id,
      leaderboard_awarded: room.leaderboard_awarded,
      members: room.members,
      token_selections: room.token_selections,
    })
    .eq("id", room.id)
    .select("*")
    .single();
  assertOk(error);
  return sanitizeRoom(data as RoomRow);
}

async function deleteRoom(roomId: string) {
  const { error } = await getSupabaseAdmin().from("fs_rooms").delete().eq("id", roomId);
  assertOk(error);
}

async function listRooms() {
  const { data, error } = await getSupabaseAdmin()
    .from("fs_rooms")
    .select("*")
    .order("created_at", { ascending: false });
  assertOk(error);
  return (data ?? []) as RoomRow[];
}

export async function getIdentityFromSessionId(sessionId: string | null | undefined) {
  if (!sessionId) {
    return null;
  }

  const { data: session, error: sessionError } = await getSupabaseAdmin()
    .from("fs_sessions")
    .select("*")
    .eq("token", sessionId)
    .maybeSingle();
  assertOk(sessionError);

  if (!session) {
    return null;
  }

  const user = await getUserRow((session as SessionRow).user_id);
  return user ? toIdentity(user) : null;
}

export async function createAccount(input: {
  username: string;
  password: string;
  displayName?: string;
}) {
  const username = normalizeUsername(input.username);
  const displayName = ensureDisplayName(input.displayName ?? input.username, input.username);
  const password = input.password.trim();

  if (username.length < 3) {
    throw new Error("Username must be at least 3 characters.");
  }

  if (!/^[a-z0-9_]+$/.test(username)) {
    throw new Error("Username can only contain lowercase letters, numbers, and underscores.");
  }

  if (password.length < 6) {
    throw new Error("Password must be at least 6 characters.");
  }

  const { data: existingUser, error: existingError } = await getSupabaseAdmin()
    .from("fs_users")
    .select("id")
    .eq("username", username)
    .maybeSingle();
  assertOk(existingError);

  if (existingUser) {
    throw new Error("That username is already taken.");
  }

  const { data, error } = await getSupabaseAdmin()
    .from("fs_users")
    .insert({
      id: `acct_${randomUUID()}`,
      username,
      display_name: displayName,
      role: "account",
      password_hash: hashPassword(password),
    })
    .select("*")
    .single();
  assertOk(error);

  return toIdentity(data as UserRow);
}

export async function signInAccount(input: { username: string; password: string }) {
  const username = normalizeUsername(input.username);
  const { data, error } = await getSupabaseAdmin()
    .from("fs_users")
    .select("*")
    .eq("username", username)
    .maybeSingle();
  assertOk(error);

  const account = data as UserRow | null;
  if (!account || !account.password_hash || !verifyPassword(input.password, account.password_hash)) {
    throw new Error("Invalid username or password.");
  }

  return toIdentity(account);
}

export async function createGuestIdentity(input?: { displayName?: string }) {
  const displayName = ensureDisplayName(
    input?.displayName ?? `Guest ${randomBytes(2).toString("hex").toUpperCase()}`,
    "Guest",
  );

  const { data, error } = await getSupabaseAdmin()
    .from("fs_users")
    .insert({
      id: `guest_${randomUUID()}`,
      role: "guest",
      username: makeGuestUsername(displayName),
      display_name: displayName,
    })
    .select("*")
    .single();
  assertOk(error);

  return toIdentity(data as UserRow);
}

export async function createSession(identity: SessionUser) {
  const token = `sess_${randomUUID()}`;
  const { data, error } = await getSupabaseAdmin()
    .from("fs_sessions")
    .insert({
      id: token,
      token,
      user_id: identity.id,
    })
    .select("*")
    .single();
  assertOk(error);

  return data as SessionRow;
}

export async function clearSession(sessionId: string | null | undefined) {
  if (!sessionId) {
    return;
  }

  const identity = await getIdentityFromSessionId(sessionId);
  if (!identity) {
    return;
  }

  const supabase = getSupabaseAdmin();
  const { error: sessionDeleteError } = await supabase
    .from("fs_sessions")
    .delete()
    .eq("user_id", identity.id);
  assertOk(sessionDeleteError);

  if (identity.role !== "guest") {
    return;
  }

  const affectedRooms = (await listRooms()).filter((room) =>
    room.members.some((member) => member.userId === identity.id),
  );

  await Promise.all(
    affectedRooms.map(async (room) => {
      room.members = room.members.filter((member) => member.userId !== identity.id);
      room.token_selections = room.token_selections.filter(
        (selection) => selection.userId !== identity.id,
      );

      if (room.owner_id === identity.id) {
        room.owner_id = room.members[0]?.userId ?? room.owner_id;
      }

      if (room.umpire_id === identity.id) {
        room.umpire_id = null;
      }

      if (room.members.length === 0) {
        await deleteRoom(room.id);
        return;
      }

      await saveRoom(room);
    }),
  );

  await supabase.from("fs_invitations").delete().eq("created_by_user_id", identity.id);
  await supabase.from("fs_invitations").delete().eq("invitee_user_id", identity.id);
  await supabase.from("fs_users").delete().eq("id", identity.id);
}

export async function listPublicRooms() {
  const { data, error } = await getSupabaseAdmin()
    .from("fs_rooms")
    .select("*")
    .eq("visibility", "public")
    .order("created_at", { ascending: false });
  assertOk(error);

  return ((data ?? []) as RoomRow[]).map(sanitizeRoom);
}

export async function getRoomById(roomId: string, identity?: SessionUser | null) {
  const room = await requireRoom(roomId);

  if (
    room.visibility === "private" &&
    !room.members.some((member) => member.userId === identity?.id)
  ) {
    throw new Error("This room is private.");
  }

  return sanitizeRoom(room);
}

async function ensureUserCanEnterRoom(identity: SessionUser, targetRoomId?: string) {
  const activeRooms = (await listRooms()).filter(
    (room) =>
      room.id !== targetRoomId &&
      ["lobby", "playing"].includes(room.game_status) &&
      room.members.some((member) => member.userId === identity.id),
  );

  const playingRoom = activeRooms.find((room) => room.game_status === "playing");
  if (playingRoom) {
    throw new Error("Leave your current game before joining another room.");
  }

  await Promise.all(
    activeRooms.map(async (room) => {
      room.members = room.members.filter((member) => member.userId !== identity.id);
      room.token_selections = room.token_selections.filter(
        (selection) => selection.userId !== identity.id,
      );

      if (room.owner_id === identity.id) {
        room.owner_id = room.members[0]?.userId ?? room.owner_id;
      }

      if (room.umpire_id === identity.id) {
        room.umpire_id = null;
      }

      if (room.members.length === 0) {
        await deleteRoom(room.id);
        return;
      }

      await saveRoom(room);
    }),
  );
}

export async function createRoom(input: {
  owner: SessionUser;
  name: string;
  visibility: RoomVisibility;
}) {
  const trimmedName = normalizeDisplayName(input.name);

  if (trimmedName.length < 3) {
    throw new Error("Room name must be at least 3 characters.");
  }

  await ensureUserCanEnterRoom(input.owner);

  const now = new Date().toISOString();
  const { data, error } = await getSupabaseAdmin()
    .from("fs_rooms")
    .insert({
      id: `room_${randomUUID()}`,
      code: await makeRoomCode(),
      name: trimmedName,
      visibility: input.visibility,
      owner_id: input.owner.id,
      members: [
        {
          userId: input.owner.id,
          username: input.owner.username,
          displayName: input.owner.displayName,
          role: input.owner.role,
          joinedAt: now,
        },
      ],
      token_selections: [],
      game_deck: [],
      game_discard: [],
    })
    .select("*")
    .single();
  assertOk(error);

  return sanitizeRoom(data as RoomRow);
}

export async function joinRoom(input: {
  roomId: string;
  identity: SessionUser;
  allowPrivate?: boolean;
}) {
  const room = await requireRoom(input.roomId);

  if (room.visibility === "private" && !input.allowPrivate) {
    throw new Error("This room is private. Use an invitation link.");
  }

  if (room.game_status !== "lobby") {
    throw new Error("This game has already started. You can spectate instead.");
  }

  const alreadyMember = room.members.some((member) => member.userId === input.identity.id);
  if (!alreadyMember) {
    await ensureUserCanEnterRoom(input.identity, room.id);
    room.members.push({
      userId: input.identity.id,
      username: input.identity.username,
      displayName: input.identity.displayName,
      role: input.identity.role,
      joinedAt: new Date().toISOString(),
    });
  }

  return await saveRoom(room);
}

function requireRoomMember(room: RoomRow, identity: SessionUser) {
  const member = room.members.find((roomMember) => roomMember.userId === identity.id);
  if (!member) {
    throw new Error("Join this room before opening the lobby.");
  }

  return member;
}

function canManageRoom(room: RoomRow, identity: SessionUser) {
  return room.owner_id === identity.id || room.umpire_id === identity.id;
}

function dealCardsFrom(deck: HolySpiritCard[], count: number) {
  return deck.splice(0, count);
}

async function upsertLeaderboard(member: {
  userId: string;
  username: string;
  displayName: string;
  role: SessionUser["role"];
}, increment: { gamesPlayed: number; wins?: number; losses?: number }) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("fs_leaderboard_entries")
    .select("*")
    .eq("user_id", member.userId)
    .maybeSingle();
  assertOk(error);

  const existing = data as LeaderboardEntryRow | null;
  const { error: upsertError } = await supabase
    .from("fs_leaderboard_entries")
    .upsert({
      user_id: member.userId,
      username: member.username,
      display_name: member.displayName,
      role: member.role,
      games_played: (existing?.games_played ?? 0) + increment.gamesPlayed,
      wins: (existing?.wins ?? 0) + (increment.wins ?? 0),
      losses: (existing?.losses ?? 0) + (increment.losses ?? 0),
      updated_at: new Date().toISOString(),
    });
  assertOk(upsertError);
}

async function awardLeaderboardWin(room: RoomRow, winner: Player) {
  if (room.leaderboard_awarded) {
    return;
  }

  const member = room.members.find((roomMember) => roomMember.userId === winner.id);
  if (!member) {
    return;
  }

  const losers = room.members.filter((roomMember) =>
    room.game_state?.players.some((player) => player.id === roomMember.userId && player.id !== winner.id),
  );

  await upsertLeaderboard(member, { gamesPlayed: 1, wins: 1 });
  await Promise.all(
    losers.map((loser) => upsertLeaderboard(loser, { gamesPlayed: 1, losses: 1 })),
  );

  room.leaderboard_awarded = true;
}

async function awardLeaderboardLoss(member: {
  userId: string;
  username: string;
  displayName: string;
  role: SessionUser["role"];
}) {
  await upsertLeaderboard(member, { gamesPlayed: 1, losses: 1 });
}

async function resolveOnlineLanding(
  room: RoomRow,
  state: OnlineGameState,
  playerId: string,
  tile: number,
): Promise<OnlineGameState> {
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (!player) {
    return state;
  }

  if (tile === TOTAL_TILES) {
    const nextState: OnlineGameState = {
      ...state,
      players: state.players.map((candidate) =>
        candidate.id === playerId
          ? { ...candidate, position: tile, hasWon: true }
          : candidate,
      ),
      phase: "won",
      pendingHolySpiritChoice: false,
      animatingToken: null,
      lastEvent: {
        type: "won",
        playerName: player.name,
        playerColor: player.color,
        message: `${player.name} reached the Crown and won the game!`,
      },
    };

    room.game_status = "won";
    room.winner_id = playerId;
    await awardLeaderboardWin(room, player);
    return nextState;
  }

  if (HOLY_SPIRIT_TILES.has(tile)) {
    return {
      ...state,
      players: state.players.map((candidate) =>
        candidate.id === playerId ? { ...candidate, position: tile } : candidate,
      ),
      pendingHolySpiritChoice: true,
      lastEvent: {
        type: "holy_spirit_triggered",
        playerName: player.name,
        playerColor: player.color,
        toTile: tile,
        message: `${player.name} landed on a Holy Spirit tile. Choose a card.`,
      },
    };
  }

  if (SIN_TILES[tile]) {
    const sin = SIN_TILES[tile];
    const { finalTile, chain } = resolveSinChain(tile);
    const chainNames = chain.map((chainTile) => SIN_TILES[chainTile]?.name).join(" -> ");

    return {
      ...state,
      players: state.players.map((candidate) =>
        candidate.id === playerId ? { ...candidate, position: finalTile } : candidate,
      ),
      currentPlayerIndex: (state.currentPlayerIndex + 1) % state.players.length,
      pendingHolySpiritChoice: false,
      lastEvent: {
        type: "sin_triggered",
        playerName: player.name,
        playerColor: player.color,
        fromTile: tile,
        toTile: finalTile,
        sinName: sin.name,
        message:
          chain.length > 1
            ? `${player.name} hit ${chainNames}. Sent to tile ${finalTile}.`
            : `${player.name} landed on ${sin.name}. Sent back to tile ${finalTile}.`,
      },
    };
  }

  return {
    ...state,
    players: state.players.map((candidate) =>
      candidate.id === playerId ? { ...candidate, position: tile } : candidate,
    ),
    currentPlayerIndex: (state.currentPlayerIndex + 1) % state.players.length,
    pendingHolySpiritChoice: false,
    lastEvent: {
      type: "moved",
      playerName: player.name,
      playerColor: player.color,
      fromTile: player.position,
      toTile: tile,
      message: `${player.name} moved to tile ${tile}.`,
    },
  };
}

export async function selectRoomToken(input: {
  roomId: string;
  identity: SessionUser;
  color: TokenColor;
}) {
  const room = await requireRoom(input.roomId);
  requireRoomMember(room, input.identity);

  if (room.game_status !== "lobby") {
    throw new Error("Token colors can only be changed before the game starts.");
  }

  if (!ALL_COLORS.includes(input.color)) {
    throw new Error("Choose a valid token color.");
  }

  const selectedByOtherUser = room.token_selections.some(
    (selection) => selection.color === input.color && selection.userId !== input.identity.id,
  );

  if (selectedByOtherUser) {
    throw new Error("That token color has already been selected.");
  }

  room.token_selections = room.token_selections.filter(
    (selection) => selection.userId !== input.identity.id,
  );
  room.token_selections.push({
    userId: input.identity.id,
    color: input.color,
    selectedAt: new Date().toISOString(),
  });

  return await saveRoom(room);
}

export async function assignRoomUmpire(input: {
  roomId: string;
  identity: SessionUser;
  umpireUserId: string | null;
}) {
  const room = await requireRoom(input.roomId);
  requireRoomMember(room, input.identity);

  if (room.owner_id !== input.identity.id) {
    throw new Error("Only the room owner can assign an umpire.");
  }

  if (input.umpireUserId && !room.members.some((member) => member.userId === input.umpireUserId)) {
    throw new Error("Choose a current room member as umpire.");
  }

  room.umpire_id = input.umpireUserId;
  return await saveRoom(room);
}

export async function startOnlineRoomGame(input: {
  roomId: string;
  identity: SessionUser;
}) {
  const room = await requireRoom(input.roomId);
  requireRoomMember(room, input.identity);

  if (!canManageRoom(room, input.identity)) {
    throw new Error("Only the room owner or assigned umpire can start the game.");
  }

  if (room.game_status !== "lobby") {
    throw new Error("This game has already started.");
  }

  if (room.token_selections.length < 2) {
    throw new Error("At least 2 players must choose token colors before starting.");
  }

  const deck = createDeck();
  const players = room.token_selections
    .map((selection): Player | null => {
      const member = room.members.find((candidate) => candidate.userId === selection.userId);
      if (!member) {
        return null;
      }

      return {
        id: member.userId,
        name: member.displayName,
        color: selection.color,
        position: START_TILE,
        cards: dealCardsFrom(deck, HOLY_SPIRIT_CARDS_PER_PLAYER),
        hasWon: false,
      };
    })
    .filter((player): player is Player => Boolean(player));

  if (players.length < 2) {
    throw new Error("At least 2 selected players must still be in the room.");
  }

  room.game_status = "playing";
  room.winner_id = null;
  room.leaderboard_awarded = false;
  room.game_deck = deck;
  room.game_discard = [];
  room.game_state = {
    phase: "playing",
    players,
    currentPlayerIndex: 0,
    diceValue: null,
    isRolling: false,
    lastEvent: null,
    pendingHolySpiritChoice: false,
    animatingToken: null,
  };

  return await saveRoom(room);
}

export async function rollOnlineRoomDice(input: {
  roomId: string;
  identity: SessionUser;
}) {
  const room = await requireRoom(input.roomId);
  requireRoomMember(room, input.identity);

  const state = room.game_state;
  if (!state || room.game_status !== "playing" || state.phase !== "playing") {
    throw new Error("Start the game before rolling.");
  }

  if (state.pendingHolySpiritChoice) {
    throw new Error("Choose a Holy Spirit card before rolling again.");
  }

  const player = state.players[state.currentPlayerIndex];
  if (!player || player.id !== input.identity.id) {
    throw new Error("Wait for your turn before rolling.");
  }

  const rolled = Math.floor(Math.random() * 6) + 1;
  const targetTile = player.position + rolled;

  if (targetTile > TOTAL_TILES) {
    room.game_state = {
      ...state,
      diceValue: rolled,
      currentPlayerIndex: (state.currentPlayerIndex + 1) % state.players.length,
      lastEvent: {
        type: "dice_rolled",
        playerName: player.name,
        playerColor: player.color,
        message: `${player.name} rolled ${rolled} and needs exactly ${
          TOTAL_TILES - player.position
        } to reach the Crown. Turn passes.`,
      },
    };
  } else {
    room.game_state = await resolveOnlineLanding(
      room,
      {
        ...state,
        diceValue: rolled,
        lastEvent: {
          type: "dice_rolled",
          playerName: player.name,
          playerColor: player.color,
          message: `${player.name} rolled ${rolled}.`,
        },
      },
      player.id,
      targetTile,
    );
  }

  return await saveRoom(room);
}

export async function playOnlineRoomCard(input: {
  roomId: string;
  identity: SessionUser;
  cardId: string;
}) {
  const room = await requireRoom(input.roomId);
  requireRoomMember(room, input.identity);

  const state = room.game_state;
  if (!state || room.game_status !== "playing" || state.phase !== "playing") {
    throw new Error("Start the game before using cards.");
  }

  if (!state.pendingHolySpiritChoice) {
    throw new Error("There is no Holy Spirit card choice pending.");
  }

  const player = state.players[state.currentPlayerIndex];
  if (!player || player.id !== input.identity.id) {
    throw new Error("Only the current player can choose a Holy Spirit card.");
  }

  const card = player.cards.find((candidate) => candidate.id === input.cardId);
  if (!card) {
    throw new Error("That card is not in your hand.");
  }

  room.game_discard.push(card);
  const [newCard] = dealCardsFrom(room.game_deck, 1);
  const nextCards = player.cards
    .filter((candidate) => candidate.id !== input.cardId)
    .concat(newCard ? [newCard] : []);
  const targetTile = Math.min(player.position + card.steps, TOTAL_TILES);

  room.game_state = await resolveOnlineLanding(
    room,
    {
      ...state,
      pendingHolySpiritChoice: false,
      players: state.players.map((candidate) =>
        candidate.id === player.id ? { ...candidate, cards: nextCards } : candidate,
      ),
      lastEvent: {
        type: "card_used",
        playerName: player.name,
        playerColor: player.color,
        cardAttribute: card.attribute,
        cardSteps: card.steps,
        message: `${player.name} used "${card.attribute}" (+${card.steps} steps).`,
      },
    },
    player.id,
    targetTile,
  );

  return await saveRoom(room);
}

export async function leaveRoom(input: {
  roomId: string;
  identity: SessionUser;
}) {
  const room = await requireRoom(input.roomId);
  const member = requireRoomMember(room, input.identity);
  const wasPlaying =
    room.game_status === "playing" &&
    Boolean(room.game_state?.players.some((player) => player.id === input.identity.id));

  if (wasPlaying) {
    await awardLeaderboardLoss(member);
    room.game_state = room.game_state
      ? {
          ...room.game_state,
          players: room.game_state.players.filter((player) => player.id !== input.identity.id),
          currentPlayerIndex: Math.min(
            room.game_state.currentPlayerIndex,
            Math.max(0, room.game_state.players.length - 2),
          ),
          lastEvent: {
            type: "moved",
            playerName: member.displayName,
            playerColor:
              room.game_state.players.find((player) => player.id === input.identity.id)?.color ?? "red",
            message: `${member.displayName} left the game and took a loss.`,
          },
        }
      : null;
  }

  room.members = room.members.filter((roomMember) => roomMember.userId !== input.identity.id);
  room.token_selections = room.token_selections.filter(
    (selection) => selection.userId !== input.identity.id,
  );

  if (room.owner_id === input.identity.id) {
    room.owner_id = room.members[0]?.userId ?? room.owner_id;
  }

  if (room.umpire_id === input.identity.id) {
    room.umpire_id = null;
  }

  if (room.members.length === 0) {
    await deleteRoom(room.id);
    return null;
  }

  if (room.game_status === "playing" && (room.game_state?.players.length ?? 0) < 2) {
    room.game_status = "won";
    room.game_state = room.game_state ? { ...room.game_state, phase: "won" } : null;
  }

  return await saveRoom(room);
}

export async function closeRoom(input: {
  roomId: string;
  identity: SessionUser;
}) {
  const room = await requireRoom(input.roomId);
  requireRoomMember(room, input.identity);

  if (room.owner_id !== input.identity.id) {
    throw new Error("Only the room owner can close this room.");
  }

  if (room.game_status === "playing") {
    await Promise.all(
      room.members
        .filter((member) => room.game_state?.players.some((player) => player.id === member.userId))
        .map((member) => awardLeaderboardLoss(member)),
    );
  }

  await deleteRoom(room.id);
}

export async function listLeaderboard() {
  const { data, error } = await getSupabaseAdmin()
    .from("fs_leaderboard_entries")
    .select("*")
    .order("wins", { ascending: false })
    .order("updated_at", { ascending: true })
    .limit(50);
  assertOk(error);

  return ((data ?? []) as LeaderboardEntryRow[]).map(sanitizeLeaderboardEntry);
}

export async function getUserLeaderboardStats(identity: SessionUser) {
  const { data, error } = await getSupabaseAdmin()
    .from("fs_leaderboard_entries")
    .select("*")
    .eq("user_id", identity.id)
    .maybeSingle();
  assertOk(error);

  if (!data) {
    return {
      userId: identity.id,
      username: identity.username,
      displayName: identity.displayName,
      role: identity.role,
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      updatedAt: new Date(0).toISOString(),
    } satisfies LeaderboardEntry;
  }

  return sanitizeLeaderboardEntry(data as LeaderboardEntryRow);
}

export async function createInvitation(input: {
  roomId: string;
  createdBy: SessionUser;
  inviteeUsername?: string;
}) {
  const room = await requireRoom(input.roomId);

  if (!room.members.some((member) => member.userId === input.createdBy.id)) {
    throw new Error("Only room members can create invitations.");
  }

  let inviteeUserId: string | null = null;

  if (input.inviteeUsername) {
    const { data, error } = await getSupabaseAdmin()
      .from("fs_users")
      .select("*")
      .eq("username", normalizeUsername(input.inviteeUsername))
      .maybeSingle();
    assertOk(error);

    if (!data) {
      throw new Error("The invited account does not exist.");
    }

    inviteeUserId = (data as UserRow).id;
  }

  const { data, error } = await getSupabaseAdmin()
    .from("fs_invitations")
    .insert({
      id: `invite_${randomUUID()}`,
      token: randomToken(),
      room_id: room.id,
      created_by_user_id: input.createdBy.id,
      invitee_user_id: inviteeUserId,
      accepted_at: null,
    })
    .select("*")
    .single();
  assertOk(error);

  return sanitizeInvite(data as InvitationRow);
}

export async function acceptInvitation(input: {
  token: string;
  identity: SessionUser;
}) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("fs_invitations")
    .select("*")
    .eq("token", input.token)
    .maybeSingle();
  assertOk(error);

  const invite = data as InvitationRow | null;
  if (!invite) {
    throw new Error("Invitation not found.");
  }

  if (invite.accepted_at) {
    throw new Error("Invitation has already been used.");
  }

  if (invite.invitee_user_id && invite.invitee_user_id !== input.identity.id) {
    throw new Error("This invitation is meant for a different account.");
  }

  const acceptedAt = new Date().toISOString();
  const { data: updatedInvite, error: updateError } = await supabase
    .from("fs_invitations")
    .update({ accepted_at: acceptedAt })
    .eq("id", invite.id)
    .select("*")
    .single();
  assertOk(updateError);

  const room = await joinRoom({
    roomId: invite.room_id,
    identity: input.identity,
    allowPrivate: true,
  });

  return {
    invitation: sanitizeInvite(updatedInvite as InvitationRow),
    room,
  };
}

export function createInviteAcceptanceUrl(origin: string, token: string) {
  return `${origin}/online/invitations/${token}`;
}

export async function getUserFingerprint(identity: SessionUser) {
  return `${identity.role}:${identity.id}:${identity.username}`;
}

export async function getUserById(userId: string) {
  const user = await getUserRow(userId);
  return user ? toIdentity(user) : null;
}

export async function getSessionUserByToken(sessionToken: string | null | undefined) {
  return getIdentityFromSessionId(sessionToken);
}

export async function getRoomWatcherState(roomId: string) {
  const room = await requireRoom(roomId);
  return sanitizeRoom(room);
}

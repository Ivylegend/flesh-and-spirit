import "server-only";

import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { HydratedDocument } from "mongoose";

import {
  InvitationSummary,
  LeaderboardEntry,
  OnlineGameState,
  RoomSummary,
  RoomVisibility,
  SessionUser,
} from "@/lib/online-play-types";
import {
  ALL_COLORS,
  createDeck,
  HOLY_SPIRIT_CARDS_PER_PLAYER,
  HOLY_SPIRIT_TILES,
  Player,
  resolveSinChain,
  SIN_TILES,
  START_TILE,
  TOTAL_TILES,
  TokenColor,
} from "@/components/FleshAndSpirit/gameConstants";
import { connectToDatabase } from "@/lib/server/db";
import {
  InvitationDocument,
  InvitationModel,
  LeaderboardEntryDocument,
  LeaderboardEntryModel,
  RoomDocument,
  RoomModel,
  SessionModel,
  UserDocument,
  UserModel,
} from "@/lib/server/models";
import { REALTIME_EVENTS, emitRealtimeEvent } from "@/lib/server/realtime";

const SESSION_COOKIE = "flesh_spirit_session";

function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

function normalizeDisplayName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function randomToken(size = 24) {
  return randomBytes(size).toString("base64url");
}

async function makeRoomCode() {
  await connectToDatabase();

  while (true) {
    const code = randomBytes(3).toString("hex").toUpperCase();
    const existingRoom = await RoomModel.exists({ code });
    if (!existingRoom) {
      return code;
    }
  }
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

  if (storedBuffer.length !== derivedKey.length) {
    return false;
  }

  return timingSafeEqual(storedBuffer, derivedKey);
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

  const base = safeBase || "guest";
  return `guest-${base}-${randomBytes(2).toString("hex")}`;
}

function toIdentity(user: Pick<UserDocument, "_id" | "role" | "username" | "displayName">): SessionUser {
  return {
    id: user._id,
    role: user.role,
    username: user.username,
    displayName: user.displayName,
  };
}

function serializeDate(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

export function getSessionCookieName() {
  return SESSION_COOKIE;
}

export function sanitizeRoom(
  room: Pick<
    RoomDocument,
    | "_id"
    | "code"
    | "name"
    | "visibility"
    | "ownerId"
    | "umpireId"
    | "gameStatus"
    | "gameState"
    | "winnerId"
    | "members"
    | "tokenSelections"
    | "createdAt"
  >,
): RoomSummary {
  return {
    id: room._id,
    code: room.code,
    name: room.name,
    visibility: room.visibility,
    ownerId: room.ownerId,
    umpireId: room.umpireId,
    gameStatus: room.gameStatus ?? "lobby",
    gameState: room.gameState ?? null,
    winnerId: room.winnerId ?? null,
    memberCount: room.members.length,
    members: room.members.map((member) => ({
      userId: member.userId,
      username: member.username,
      displayName: member.displayName,
      role: member.role,
      joinedAt: member.joinedAt.toISOString(),
    })),
    tokenSelections: (room.tokenSelections ?? []).map((selection) => ({
      userId: selection.userId,
      color: selection.color,
      selectedAt: selection.selectedAt.toISOString(),
    })),
    createdAt: room.createdAt.toISOString(),
  };
}

function sanitizeLeaderboardEntry(
  entry: Pick<
    LeaderboardEntryDocument,
    | "userId"
    | "username"
    | "displayName"
    | "role"
    | "gamesPlayed"
    | "wins"
    | "losses"
    | "updatedAt"
  >,
): LeaderboardEntry {
  return {
    userId: entry.userId,
    username: entry.username,
    displayName: entry.displayName,
    role: entry.role,
    gamesPlayed: entry.gamesPlayed,
    wins: entry.wins,
    losses: entry.losses,
    updatedAt: entry.updatedAt.toISOString(),
  };
}

export function sanitizeInvite(invite: Pick<InvitationDocument, "token" | "roomId" | "createdByUserId" | "inviteeUserId" | "createdAt" | "acceptedAt">): InvitationSummary {
  return {
    token: invite.token,
    roomId: invite.roomId,
    createdByUserId: invite.createdByUserId,
    inviteeUserId: invite.inviteeUserId,
    createdAt: invite.createdAt.toISOString(),
    acceptedAt: serializeDate(invite.acceptedAt),
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

async function publishRoomChange(roomId: string) {
  const room = await RoomModel.findById(roomId).lean<RoomDocument | null>();
  if (!room) {
    return;
  }

  emitRealtimeEvent(REALTIME_EVENTS.ROOM_UPDATED, {
    room: sanitizeRoom(room),
  });
}

async function publishPublicRoomsChange() {
  const rooms = await listPublicRooms();
  emitRealtimeEvent(REALTIME_EVENTS.PUBLIC_ROOMS_UPDATED, {
    rooms,
  });
}

export async function getIdentityFromSessionId(
  sessionId: string | null | undefined,
) {
  if (!sessionId) {
    return null;
  }

  await connectToDatabase();
  const session = await SessionModel.findOne({ token: sessionId }).lean();
  if (!session) {
    return null;
  }

  const user = await UserModel.findById(session.userId).lean<UserDocument | null>();
  if (!user) {
    return null;
  }

  return toIdentity(user);
}

export async function createAccount(input: {
  username: string;
  password: string;
  displayName?: string;
}) {
  await connectToDatabase();
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

  if (await UserModel.exists({ username })) {
    throw new Error("That username is already taken.");
  }

  const account = await UserModel.create({
    _id: `acct_${randomUUID()}`,
    username,
    displayName,
    role: "account",
    passwordHash: hashPassword(password),
  });

  return toIdentity(account);
}

export async function signInAccount(input: { username: string; password: string }) {
  await connectToDatabase();
  const username = normalizeUsername(input.username);
  const account = await UserModel.findOne({ username }).lean<UserDocument | null>();

  if (!account) {
    throw new Error("Invalid username or password.");
  }

  if (!account.passwordHash || !verifyPassword(input.password, account.passwordHash)) {
    throw new Error("Invalid username or password.");
  }

  return toIdentity(account);
}

export async function createGuestIdentity(input?: { displayName?: string }) {
  await connectToDatabase();
  const displayName = ensureDisplayName(
    input?.displayName ?? `Guest ${randomBytes(2).toString("hex").toUpperCase()}`,
    "Guest",
  );

  const guest = await UserModel.create({
    _id: `guest_${randomUUID()}`,
    role: "guest",
    username: makeGuestUsername(displayName),
    displayName,
  });

  return toIdentity(guest);
}

export async function createSession(identity: SessionUser) {
  await connectToDatabase();
  const token = `sess_${randomUUID()}`;

  const session = await SessionModel.create({
    _id: token,
    token,
    userId: identity.id,
  });

  return session;
}

export async function clearSession(sessionId: string | null | undefined) {
  if (!sessionId) {
    return;
  }

  await connectToDatabase();
  const session = await SessionModel.findOne({ token: sessionId }).lean();

  if (!session) {
    return;
  }

  await SessionModel.deleteMany({ userId: session.userId });
  const user = await UserModel.findById(session.userId).lean<UserDocument | null>();

  if (!user || user.role !== "guest") {
    return;
  }

  const affectedRooms = await RoomModel.find({
    "members.userId": user._id,
  });

  const roomUpdates = affectedRooms.map(async (room) => {
    room.members = room.members.filter((member) => member.userId !== user._id);

    if (room.ownerId === user._id) {
      const nextOwner = room.members[0];
      if (nextOwner) {
        room.ownerId = nextOwner.userId;
      }
    }

    if (room.members.length === 0) {
      await RoomModel.deleteOne({ _id: room._id });
      emitRealtimeEvent(REALTIME_EVENTS.ROOM_CLOSED, {
        roomId: room._id,
      });
      return;
    }

    await room.save();
    await publishRoomChange(room._id);
  });

  await Promise.all(roomUpdates);
  await InvitationModel.deleteMany({
    $or: [{ createdByUserId: user._id }, { inviteeUserId: user._id }],
  });
  await UserModel.deleteOne({ _id: user._id });
  await publishPublicRoomsChange();
}

async function requireRoom(roomId: string) {
  await connectToDatabase();
  const room = await RoomModel.findById(roomId);
  if (!room) {
    throw new Error("Room not found.");
  }
  return room;
}

export async function listPublicRooms() {
  await connectToDatabase();
  const rooms = await RoomModel.find({ visibility: "public" })
    .sort({ createdAt: -1 })
    .lean<RoomDocument[]>();

  return rooms.map(sanitizeRoom);
}

export async function getRoomById(
  roomId: string,
  identity?: SessionUser | null,
) {
  const room = await requireRoom(roomId);

  if (
    room.visibility === "private" &&
    !room.members.some((member) => member.userId === identity?.id)
  ) {
    throw new Error("This room is private.");
  }

  return sanitizeRoom(room.toObject());
}

export async function createRoom(input: {
  owner: SessionUser;
  name: string;
  visibility: RoomVisibility;
}) {
  await connectToDatabase();
  const trimmedName = normalizeDisplayName(input.name);

  if (trimmedName.length < 3) {
    throw new Error("Room name must be at least 3 characters.");
  }

  await ensureUserCanEnterRoom(input.owner);

  const room = await RoomModel.create({
    _id: `room_${randomUUID()}`,
    code: await makeRoomCode(),
    name: trimmedName,
    visibility: input.visibility,
    ownerId: input.owner.id,
    members: [
      {
        userId: input.owner.id,
        username: input.owner.username,
        displayName: input.owner.displayName,
        role: input.owner.role,
        joinedAt: new Date(),
      },
    ],
  });

  const result = sanitizeRoom(room.toObject());
  await publishRoomChange(room._id);
  await publishPublicRoomsChange();
  return result;
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

  if (room.gameStatus !== "lobby") {
    throw new Error("This game has already started. You can spectate instead.");
  }

  const alreadyMember = room.members.some((member) => member.userId === input.identity.id);
  if (!alreadyMember) {
    await ensureUserCanEnterRoom(input.identity, room._id);
    room.members.push({
      userId: input.identity.id,
      username: input.identity.username,
      displayName: input.identity.displayName,
      role: input.identity.role,
      joinedAt: new Date(),
    });
    await room.save();
  }

  const result = sanitizeRoom(room.toObject());
  await publishRoomChange(room._id);
  await publishPublicRoomsChange();
  return result;
}

async function ensureUserCanEnterRoom(identity: SessionUser, targetRoomId?: string) {
  const activeRooms = await RoomModel.find({
    _id: targetRoomId ? { $ne: targetRoomId } : { $exists: true },
    "members.userId": identity.id,
    gameStatus: { $in: ["lobby", "playing"] },
  });

  const playingRoom = activeRooms.find((room) => room.gameStatus === "playing");
  if (playingRoom) {
    throw new Error("Leave your current game before joining another room.");
  }

  await Promise.all(
    activeRooms.map(async (room) => {
      room.members = room.members.filter((member) => member.userId !== identity.id);
      room.tokenSelections = room.tokenSelections.filter(
        (selection) => selection.userId !== identity.id,
      );

      if (room.ownerId === identity.id) {
        const nextOwner = room.members[0];
        if (nextOwner) {
          room.ownerId = nextOwner.userId;
        }
      }

      if (room.umpireId === identity.id) {
        room.umpireId = null;
      }

      if (room.members.length === 0) {
        await RoomModel.deleteOne({ _id: room._id });
        emitRealtimeEvent(REALTIME_EVENTS.ROOM_CLOSED, { roomId: room._id });
        return;
      }

      await room.save();
      await publishRoomChange(room._id);
    }),
  );

  if (activeRooms.length > 0) {
    await publishPublicRoomsChange();
  }
}

function requireRoomMember(room: RoomDocument, identity: SessionUser) {
  const member = room.members.find((roomMember) => roomMember.userId === identity.id);
  if (!member) {
    throw new Error("Join this room before opening the lobby.");
  }

  return member;
}

function canManageRoom(room: RoomDocument, identity: SessionUser) {
  return room.ownerId === identity.id || room.umpireId === identity.id;
}

function dealCardsFrom(deck: RoomDocument["gameDeck"], count: number) {
  return deck.splice(0, count);
}

async function awardLeaderboardWin(room: RoomDocument, winner: Player) {
  if (room.leaderboardAwarded) {
    return;
  }

  const member = room.members.find((roomMember) => roomMember.userId === winner.id);
  if (!member) {
    return;
  }

  const losers = room.members.filter((roomMember) =>
    room.gameState?.players.some((player) => player.id === roomMember.userId && player.id !== winner.id),
  );

  await LeaderboardEntryModel.findOneAndUpdate(
    { userId: member.userId },
    {
      $set: {
        _id: `leaderboard_${member.userId}`,
        userId: member.userId,
        username: member.username,
        displayName: member.displayName,
        role: member.role,
        updatedAt: new Date(),
      },
      $inc: { gamesPlayed: 1, wins: 1 },
    },
    { new: true, upsert: true },
  );

  await Promise.all(
    losers.map((loser) =>
      LeaderboardEntryModel.findOneAndUpdate(
        { userId: loser.userId },
        {
          $set: {
            _id: `leaderboard_${loser.userId}`,
            userId: loser.userId,
            username: loser.username,
            displayName: loser.displayName,
            role: loser.role,
            updatedAt: new Date(),
          },
          $inc: { gamesPlayed: 1, losses: 1 },
        },
        { new: true, upsert: true },
      ),
    ),
  );

  room.leaderboardAwarded = true;
}

async function awardLeaderboardLoss(member: {
  userId: string;
  username: string;
  displayName: string;
  role: SessionUser["role"];
}) {
  await LeaderboardEntryModel.findOneAndUpdate(
    { userId: member.userId },
    {
      $set: {
        _id: `leaderboard_${member.userId}`,
        userId: member.userId,
        username: member.username,
        displayName: member.displayName,
        role: member.role,
        updatedAt: new Date(),
      },
      $inc: { gamesPlayed: 1, losses: 1 },
    },
    { new: true, upsert: true },
  );
}

async function resolveOnlineLanding(
  room: RoomDocument,
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

    room.gameStatus = "won";
    room.winnerId = playerId;
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

async function saveOnlineRoomChange(room: HydratedDocument<RoomDocument>) {
  await room.save();
  const result = sanitizeRoom(room.toObject());
  await publishRoomChange(room._id);
  await publishPublicRoomsChange();
  return result;
}

export async function selectRoomToken(input: {
  roomId: string;
  identity: SessionUser;
  color: TokenColor;
}) {
  const room = await requireRoom(input.roomId);
  requireRoomMember(room, input.identity);

  if (room.gameStatus !== "lobby") {
    throw new Error("Token colors can only be changed before the game starts.");
  }

  if (!ALL_COLORS.includes(input.color)) {
    throw new Error("Choose a valid token color.");
  }

  const selectedByOtherUser = room.tokenSelections.some(
    (selection) =>
      selection.color === input.color && selection.userId !== input.identity.id,
  );

  if (selectedByOtherUser) {
    throw new Error("That token color has already been selected.");
  }

  room.tokenSelections = room.tokenSelections.filter(
    (selection) => selection.userId !== input.identity.id,
  );
  room.tokenSelections.push({
    userId: input.identity.id,
    color: input.color,
    selectedAt: new Date(),
  });

  return await saveOnlineRoomChange(room);
}

export async function assignRoomUmpire(input: {
  roomId: string;
  identity: SessionUser;
  umpireUserId: string | null;
}) {
  const room = await requireRoom(input.roomId);
  requireRoomMember(room, input.identity);

  if (room.ownerId !== input.identity.id) {
    throw new Error("Only the room owner can assign an umpire.");
  }

  if (
    input.umpireUserId &&
    !room.members.some((member) => member.userId === input.umpireUserId)
  ) {
    throw new Error("Choose a current room member as umpire.");
  }

  room.umpireId = input.umpireUserId;
  return await saveOnlineRoomChange(room);
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

  if (room.gameStatus !== "lobby") {
    throw new Error("This game has already started.");
  }

  if (room.tokenSelections.length < 2) {
    throw new Error("At least 2 players must choose token colors before starting.");
  }

  const deck = createDeck();
  const players = room.tokenSelections
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

  room.gameStatus = "playing";
  room.winnerId = null;
  room.leaderboardAwarded = false;
  room.gameDeck = deck;
  room.gameDiscard = [];
  room.gameState = {
    phase: "playing",
    players,
    currentPlayerIndex: 0,
    diceValue: null,
    isRolling: false,
    lastEvent: null,
    pendingHolySpiritChoice: false,
    animatingToken: null,
  };

  return await saveOnlineRoomChange(room);
}

export async function rollOnlineRoomDice(input: {
  roomId: string;
  identity: SessionUser;
}) {
  const room = await requireRoom(input.roomId);
  requireRoomMember(room, input.identity);

  const state = room.gameState;
  if (!state || room.gameStatus !== "playing" || state.phase !== "playing") {
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
    room.gameState = {
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
    room.gameState = await resolveOnlineLanding(room, {
      ...state,
      diceValue: rolled,
      lastEvent: {
        type: "dice_rolled",
        playerName: player.name,
        playerColor: player.color,
        message: `${player.name} rolled ${rolled}.`,
      },
    }, player.id, targetTile);
  }

  return await saveOnlineRoomChange(room);
}

export async function playOnlineRoomCard(input: {
  roomId: string;
  identity: SessionUser;
  cardId: string;
}) {
  const room = await requireRoom(input.roomId);
  requireRoomMember(room, input.identity);

  const state = room.gameState;
  if (!state || room.gameStatus !== "playing" || state.phase !== "playing") {
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

  room.gameDiscard.push(card);
  const [newCard] = dealCardsFrom(room.gameDeck, 1);
  const nextCards = player.cards
    .filter((candidate) => candidate.id !== input.cardId)
    .concat(newCard ? [newCard] : []);
  const targetTile = Math.min(player.position + card.steps, TOTAL_TILES);

  room.gameState = await resolveOnlineLanding(
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

  return await saveOnlineRoomChange(room);
}

export async function leaveRoom(input: {
  roomId: string;
  identity: SessionUser;
}) {
  const room = await requireRoom(input.roomId);
  const member = requireRoomMember(room, input.identity);
  const wasPlaying =
    room.gameStatus === "playing" &&
    Boolean(room.gameState?.players.some((player) => player.id === input.identity.id));

  if (wasPlaying) {
    await awardLeaderboardLoss(member);
    room.gameState = room.gameState
      ? {
          ...room.gameState,
          players: room.gameState.players.filter(
            (player) => player.id !== input.identity.id,
          ),
          currentPlayerIndex: Math.min(
            room.gameState.currentPlayerIndex,
            Math.max(0, room.gameState.players.length - 2),
          ),
          lastEvent: {
            type: "moved",
            playerName: member.displayName,
            playerColor:
              room.gameState.players.find((player) => player.id === input.identity.id)
                ?.color ?? "red",
            message: `${member.displayName} left the game and took a loss.`,
          },
        }
      : null;
  }

  room.members = room.members.filter((roomMember) => roomMember.userId !== input.identity.id);
  room.tokenSelections = room.tokenSelections.filter(
    (selection) => selection.userId !== input.identity.id,
  );

  if (room.ownerId === input.identity.id) {
    const nextOwner = room.members[0];
    if (nextOwner) {
      room.ownerId = nextOwner.userId;
    }
  }

  if (room.umpireId === input.identity.id) {
    room.umpireId = null;
  }

  if (room.members.length === 0) {
    await RoomModel.deleteOne({ _id: room._id });
    emitRealtimeEvent(REALTIME_EVENTS.ROOM_CLOSED, { roomId: room._id });
    await publishPublicRoomsChange();
    return null;
  }

  if (
    room.gameStatus === "playing" &&
    (room.gameState?.players.length ?? 0) < 2
  ) {
    room.gameStatus = "won";
    room.gameState = room.gameState ? { ...room.gameState, phase: "won" } : null;
  }

  return await saveOnlineRoomChange(room);
}

export async function closeRoom(input: {
  roomId: string;
  identity: SessionUser;
}) {
  const room = await requireRoom(input.roomId);
  requireRoomMember(room, input.identity);

  if (room.ownerId !== input.identity.id) {
    throw new Error("Only the room owner can close this room.");
  }

  if (room.gameStatus === "playing") {
    await Promise.all(
      room.members
        .filter((member) =>
          room.gameState?.players.some((player) => player.id === member.userId),
        )
        .map((member) => awardLeaderboardLoss(member)),
    );
  }

  await RoomModel.deleteOne({ _id: room._id });
  emitRealtimeEvent(REALTIME_EVENTS.ROOM_CLOSED, { roomId: room._id });
  await publishPublicRoomsChange();
}

export async function listLeaderboard() {
  await connectToDatabase();
  const leaderboard = await LeaderboardEntryModel.find()
    .sort({ wins: -1, updatedAt: 1 })
    .limit(50)
    .lean<LeaderboardEntryDocument[]>();

  return leaderboard.map(sanitizeLeaderboardEntry);
}

export async function getUserLeaderboardStats(identity: SessionUser) {
  await connectToDatabase();
  const stats = await LeaderboardEntryModel.findOne({
    userId: identity.id,
  }).lean<LeaderboardEntryDocument | null>();

  if (!stats) {
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

  return sanitizeLeaderboardEntry(stats);
}

export async function createInvitation(input: {
  roomId: string;
  createdBy: SessionUser;
  inviteeUsername?: string;
}) {
  await connectToDatabase();
  const room = await requireRoom(input.roomId);

  if (!room.members.some((member) => member.userId === input.createdBy.id)) {
    throw new Error("Only room members can create invitations.");
  }

  let inviteeUserId: string | null = null;

  if (input.inviteeUsername) {
    const invitedUser = await UserModel.findOne({
      username: normalizeUsername(input.inviteeUsername),
    }).lean<UserDocument | null>();

    if (!invitedUser) {
      throw new Error("The invited account does not exist.");
    }

    inviteeUserId = invitedUser._id;
  }

  const invite = await InvitationModel.create({
    _id: `invite_${randomUUID()}`,
    token: randomToken(),
    roomId: room._id,
    createdByUserId: input.createdBy.id,
    inviteeUserId,
    acceptedAt: null,
  });

  const sanitizedInvite = sanitizeInvite(invite.toObject());
  emitRealtimeEvent(REALTIME_EVENTS.INVITATION_CREATED, {
    roomId: room._id,
    invitation: sanitizedInvite,
  });

  return sanitizedInvite;
}

export async function acceptInvitation(input: {
  token: string;
  identity: SessionUser;
}) {
  await connectToDatabase();
  const invite = await InvitationModel.findOne({
    token: input.token,
  });

  if (!invite) {
    throw new Error("Invitation not found.");
  }

  if (invite.acceptedAt) {
    throw new Error("Invitation has already been used.");
  }

  if (invite.inviteeUserId && invite.inviteeUserId !== input.identity.id) {
    throw new Error("This invitation is meant for a different account.");
  }

  invite.acceptedAt = new Date();
  await invite.save();

  const room = await joinRoom({
    roomId: invite.roomId,
    identity: input.identity,
    allowPrivate: true,
  });

  return {
    invitation: sanitizeInvite(invite.toObject()),
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
  await connectToDatabase();
  const user = await UserModel.findById(userId).lean<UserDocument | null>();
  return user ? toIdentity(user) : null;
}

export async function getSessionUserByToken(sessionToken: string | null | undefined) {
  return getIdentityFromSessionId(sessionToken);
}

export async function getRoomWatcherState(roomId: string) {
  const room = await requireRoom(roomId);
  return sanitizeRoom(room.toObject());
}

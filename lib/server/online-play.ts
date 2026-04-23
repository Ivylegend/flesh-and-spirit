import "server-only";

import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";

import {
  InvitationSummary,
  RoomSummary,
  RoomVisibility,
  SessionUser,
} from "@/lib/online-play-types";
import { connectToDatabase } from "@/lib/server/db";
import {
  InvitationDocument,
  InvitationModel,
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

export function sanitizeRoom(room: Pick<RoomDocument, "_id" | "code" | "name" | "visibility" | "ownerId" | "members" | "createdAt">): RoomSummary {
  return {
    id: room._id,
    code: room.code,
    name: room.name,
    visibility: room.visibility,
    ownerId: room.ownerId,
    memberCount: room.members.length,
    members: room.members.map((member) => ({
      userId: member.userId,
      username: member.username,
      displayName: member.displayName,
      role: member.role,
      joinedAt: member.joinedAt.toISOString(),
    })),
    createdAt: room.createdAt.toISOString(),
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

  const alreadyMember = room.members.some((member) => member.userId === input.identity.id);
  if (!alreadyMember) {
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

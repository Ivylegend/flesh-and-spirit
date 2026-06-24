import { Model, Schema, model, models } from "mongoose";

import {
  OnlineGameState,
  OnlineGameStatus,
  RoomVisibility,
  SessionUserRole,
} from "@/lib/online-play-types";
import { HolySpiritCard, TokenColor } from "@/components/FleshAndSpirit/gameConstants";

export interface UserDocument {
  _id: string;
  username: string;
  displayName: string;
  role: SessionUserRole;
  passwordHash?: string;
  createdAt: Date;
}

export interface SessionDocument {
  _id: string;
  token: string;
  userId: string;
  createdAt: Date;
}

export interface RoomMemberSubdocument {
  userId: string;
  username: string;
  displayName: string;
  role: SessionUserRole;
  joinedAt: Date;
}

export interface RoomTokenSelectionSubdocument {
  userId: string;
  color: TokenColor;
  selectedAt: Date;
}

export interface RoomDocument {
  _id: string;
  code: string;
  name: string;
  visibility: RoomVisibility;
  ownerId: string;
  umpireId: string | null;
  gameStatus: OnlineGameStatus;
  gameState: OnlineGameState | null;
  gameDeck: HolySpiritCard[];
  gameDiscard: HolySpiritCard[];
  winnerId: string | null;
  leaderboardAwarded: boolean;
  members: RoomMemberSubdocument[];
  tokenSelections: RoomTokenSelectionSubdocument[];
  createdAt: Date;
}

export interface LeaderboardEntryDocument {
  _id: string;
  userId: string;
  username: string;
  displayName: string;
  role: SessionUserRole;
  wins: number;
  updatedAt: Date;
}

export interface InvitationDocument {
  _id: string;
  token: string;
  roomId: string;
  createdByUserId: string;
  inviteeUserId: string | null;
  createdAt: Date;
  acceptedAt: Date | null;
}

const UserSchema = new Schema<UserDocument>(
  {
    _id: { type: String, required: true },
    username: { type: String, required: true, unique: true, index: true },
    displayName: { type: String, required: true },
    role: { type: String, required: true, enum: ["account", "guest"] },
    passwordHash: { type: String },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);

const SessionSchema = new Schema<SessionDocument>(
  {
    _id: { type: String, required: true },
    token: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);

const RoomMemberSchema = new Schema<RoomMemberSubdocument>(
  {
    userId: { type: String, required: true },
    username: { type: String, required: true },
    displayName: { type: String, required: true },
    role: { type: String, required: true, enum: ["account", "guest"] },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const RoomTokenSelectionSchema = new Schema<RoomTokenSelectionSubdocument>(
  {
    userId: { type: String, required: true },
    color: {
      type: String,
      required: true,
      enum: ["red", "blue", "green", "yellow"],
    },
    selectedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const HolySpiritCardSchema = new Schema<HolySpiritCard>(
  {
    id: { type: String, required: true },
    attribute: { type: String, required: true },
    steps: { type: Number, required: true },
  },
  { _id: false },
);

const RoomSchema = new Schema<RoomDocument>(
  {
    _id: { type: String, required: true },
    code: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    visibility: { type: String, required: true, enum: ["public", "private"] },
    ownerId: { type: String, required: true, index: true },
    umpireId: { type: String, default: null },
    gameStatus: {
      type: String,
      required: true,
      enum: ["lobby", "playing", "won"],
      default: "lobby",
    },
    gameState: { type: Schema.Types.Mixed, default: null },
    gameDeck: { type: [HolySpiritCardSchema], default: [] },
    gameDiscard: { type: [HolySpiritCardSchema], default: [] },
    winnerId: { type: String, default: null },
    leaderboardAwarded: { type: Boolean, default: false },
    members: { type: [RoomMemberSchema], default: [] },
    tokenSelections: { type: [RoomTokenSelectionSchema], default: [] },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);

const LeaderboardEntrySchema = new Schema<LeaderboardEntryDocument>(
  {
    _id: { type: String, required: true },
    userId: { type: String, required: true, unique: true, index: true },
    username: { type: String, required: true },
    displayName: { type: String, required: true },
    role: { type: String, required: true, enum: ["account", "guest"] },
    wins: { type: Number, required: true, default: 0 },
    updatedAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);

const InvitationSchema = new Schema<InvitationDocument>(
  {
    _id: { type: String, required: true },
    token: { type: String, required: true, unique: true, index: true },
    roomId: { type: String, required: true, index: true },
    createdByUserId: { type: String, required: true, index: true },
    inviteeUserId: { type: String, default: null, index: true },
    createdAt: { type: Date, default: Date.now },
    acceptedAt: { type: Date, default: null },
  },
  { versionKey: false },
);

export const UserModel =
  (models.User as Model<UserDocument> | undefined) ??
  model<UserDocument>("User", UserSchema);

export const SessionModel =
  (models.Session as Model<SessionDocument> | undefined) ??
  model<SessionDocument>("Session", SessionSchema);

export const RoomModel =
  (models.Room as Model<RoomDocument> | undefined) ??
  model<RoomDocument>("Room", RoomSchema);

export const InvitationModel =
  (models.Invitation as Model<InvitationDocument> | undefined) ??
  model<InvitationDocument>("Invitation", InvitationSchema);

export const LeaderboardEntryModel =
  (models.LeaderboardEntry as Model<LeaderboardEntryDocument> | undefined) ??
  model<LeaderboardEntryDocument>("LeaderboardEntry", LeaderboardEntrySchema);

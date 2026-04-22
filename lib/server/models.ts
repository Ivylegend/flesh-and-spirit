import { Model, Schema, model, models } from "mongoose";

import { RoomVisibility, SessionUserRole } from "@/lib/online-play-types";

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

export interface RoomDocument {
  _id: string;
  code: string;
  name: string;
  visibility: RoomVisibility;
  ownerId: string;
  members: RoomMemberSubdocument[];
  createdAt: Date;
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

const RoomSchema = new Schema<RoomDocument>(
  {
    _id: { type: String, required: true },
    code: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    visibility: { type: String, required: true, enum: ["public", "private"] },
    ownerId: { type: String, required: true, index: true },
    members: { type: [RoomMemberSchema], default: [] },
    createdAt: { type: Date, default: Date.now },
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

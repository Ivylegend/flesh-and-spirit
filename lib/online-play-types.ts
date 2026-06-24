export type SessionUserRole = "account" | "guest";
export type RoomVisibility = "public" | "private";
export type OnlineGameStatus = "lobby" | "playing" | "won";

import type { GameState, TokenColor } from "@/components/FleshAndSpirit/gameConstants";

export interface OnlineGameState extends GameState {
  animatingToken: null;
}

export interface SessionUser {
  id: string;
  role: SessionUserRole;
  username: string;
  displayName: string;
}

export interface RoomMember {
  userId: string;
  username: string;
  displayName: string;
  role: SessionUserRole;
  joinedAt: string;
}

export interface RoomTokenSelection {
  userId: string;
  color: TokenColor;
  selectedAt: string;
}

export interface RoomSummary {
  id: string;
  code: string;
  name: string;
  visibility: RoomVisibility;
  ownerId: string;
  umpireId: string | null;
  gameStatus: OnlineGameStatus;
  gameState: OnlineGameState | null;
  winnerId: string | null;
  memberCount: number;
  members: RoomMember[];
  tokenSelections: RoomTokenSelection[];
  createdAt: string;
}

export interface LeaderboardEntry {
  userId: string;
  username: string;
  displayName: string;
  role: SessionUserRole;
  gamesPlayed: number;
  wins: number;
  losses: number;
  updatedAt: string;
}

export interface InvitationSummary {
  token: string;
  roomId: string;
  createdByUserId: string;
  inviteeUserId: string | null;
  createdAt: string;
  acceptedAt: string | null;
  inviteLink: string;
}

export interface SessionResponse {
  user: SessionUser | null;
}

export interface PublicRoomsResponse {
  rooms: RoomSummary[];
}

export interface RoomResponse {
  room: RoomSummary;
}

export interface LeaderboardResponse {
  leaderboard: LeaderboardEntry[];
}

export interface AuthResponse {
  user: SessionUser;
  message: string;
}

export interface InvitationResponse {
  invitation: InvitationSummary & {
    inviteUrl: string;
  };
}

export interface AcceptInvitationResponse {
  invitation: InvitationSummary;
  room: RoomSummary;
}

export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export interface ApiFailure {
  ok: false;
  error: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

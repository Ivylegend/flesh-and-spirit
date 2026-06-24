import { NextRequest } from "next/server";

import { assignRoomUmpire } from "@/lib/server/online-play";
import {
  jsonError,
  jsonSuccess,
  parseJsonBody,
  requireSessionIdentity,
} from "@/lib/server/online-play-http";

interface RouteContext {
  params: Promise<{
    roomId: string;
  }>;
}

interface AssignUmpirePayload {
  umpireUserId: string | null;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const identity = await requireSessionIdentity(request);
    const { roomId } = await context.params;
    const body = await parseJsonBody<AssignUmpirePayload>(request);
    const room = await assignRoomUmpire({
      roomId,
      identity,
      umpireUserId: body.umpireUserId || null,
    });

    return jsonSuccess({ room });
  } catch (error) {
    return jsonError(error, 400);
  }
}

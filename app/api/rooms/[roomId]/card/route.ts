import { NextRequest } from "next/server";

import { playOnlineRoomCard } from "@/lib/server/online-play";
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

interface UseCardPayload {
  cardId: string;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const identity = await requireSessionIdentity(request);
    const { roomId } = await context.params;
    const body = await parseJsonBody<UseCardPayload>(request);
    const room = await playOnlineRoomCard({
      roomId,
      identity,
      cardId: body.cardId,
    });

    return jsonSuccess({ room });
  } catch (error) {
    return jsonError(error, 400);
  }
}

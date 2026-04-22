import { NextRequest } from "next/server";

import { joinRoom } from "@/lib/server/online-play";
import {
  jsonError,
  jsonSuccess,
  requireSessionIdentity,
} from "@/lib/server/online-play-http";

interface JoinRoomRouteContext {
  params: Promise<{
    roomId: string;
  }>;
}

export async function POST(
  request: NextRequest,
  context: JoinRoomRouteContext,
) {
  try {
    const identity = await requireSessionIdentity(request);
    const { roomId } = await context.params;
    const room = await joinRoom({
      roomId,
      identity,
    });

    return jsonSuccess({
      room,
    });
  } catch (error) {
    return jsonError(error, 400);
  }
}

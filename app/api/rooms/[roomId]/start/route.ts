import { NextRequest } from "next/server";

import { startOnlineRoomGame } from "@/lib/server/online-play";
import {
  jsonError,
  jsonSuccess,
  requireSessionIdentity,
} from "@/lib/server/online-play-http";

interface RouteContext {
  params: Promise<{
    roomId: string;
  }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const identity = await requireSessionIdentity(request);
    const { roomId } = await context.params;
    const room = await startOnlineRoomGame({ roomId, identity });

    return jsonSuccess({ room });
  } catch (error) {
    return jsonError(error, 400);
  }
}

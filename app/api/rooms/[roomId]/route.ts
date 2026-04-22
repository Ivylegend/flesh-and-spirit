import { NextRequest } from "next/server";

import { getRoomById } from "@/lib/server/online-play";
import {
  getSessionIdentity,
  jsonError,
  jsonSuccess,
} from "@/lib/server/online-play-http";

interface RoomRouteContext {
  params: Promise<{
    roomId: string;
  }>;
}

export async function GET(request: NextRequest, context: RoomRouteContext) {
  try {
    const { roomId } = await context.params;
    const identity = await getSessionIdentity(request);
    const room = await getRoomById(roomId, identity);

    return jsonSuccess({
      room,
    });
  } catch (error) {
    return jsonError(error, 400);
  }
}

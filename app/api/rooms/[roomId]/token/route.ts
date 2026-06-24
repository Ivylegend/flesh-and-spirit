import { NextRequest } from "next/server";

import { selectRoomToken } from "@/lib/server/online-play";
import {
  jsonError,
  jsonSuccess,
  parseJsonBody,
  requireSessionIdentity,
} from "@/lib/server/online-play-http";
import { TokenColor } from "@/components/FleshAndSpirit/gameConstants";

interface RouteContext {
  params: Promise<{
    roomId: string;
  }>;
}

interface SelectTokenPayload {
  color: TokenColor;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const identity = await requireSessionIdentity(request);
    const { roomId } = await context.params;
    const body = await parseJsonBody<SelectTokenPayload>(request);
    const room = await selectRoomToken({
      roomId,
      identity,
      color: body.color,
    });

    return jsonSuccess({ room });
  } catch (error) {
    return jsonError(error, 400);
  }
}

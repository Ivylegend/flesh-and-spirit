import { NextRequest } from "next/server";

import { closeRoom } from "@/lib/server/online-play";
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
    await closeRoom({ roomId, identity });

    return jsonSuccess({ closed: true });
  } catch (error) {
    return jsonError(error, 400);
  }
}

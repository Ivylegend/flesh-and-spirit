import { NextRequest } from "next/server";

import { getUserLeaderboardStats } from "@/lib/server/online-play";
import {
  jsonError,
  jsonSuccess,
  requireSessionIdentity,
} from "@/lib/server/online-play-http";

export async function GET(request: NextRequest) {
  try {
    const identity = await requireSessionIdentity(request);
    const stats = await getUserLeaderboardStats(identity);

    return jsonSuccess({ stats });
  } catch (error) {
    return jsonError(error, 401);
  }
}

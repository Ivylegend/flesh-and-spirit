import { NextRequest } from "next/server";

import { acceptInvitation } from "@/lib/server/online-play";
import {
  jsonError,
  jsonSuccess,
  requireSessionIdentity,
} from "@/lib/server/online-play-http";

interface AcceptInvitationRouteContext {
  params: Promise<{
    token: string;
  }>;
}

export async function POST(
  request: NextRequest,
  context: AcceptInvitationRouteContext,
) {
  try {
    const identity = await requireSessionIdentity(request);
    const { token } = await context.params;
    const result = await acceptInvitation({
      token,
      identity,
    });

    return jsonSuccess(result);
  } catch (error) {
    return jsonError(error, 400);
  }
}

import { NextRequest } from "next/server";

import { createGuestIdentity } from "@/lib/server/online-play";
import {
  jsonError,
  parseJsonBody,
  withSessionCookie,
} from "@/lib/server/online-play-http";

interface GuestPayload {
  displayName?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await parseJsonBody<GuestPayload>(request);
    const identity = await createGuestIdentity(body);

    return await withSessionCookie(identity, {
      message: "Guest session created.",
    }, 201);
  } catch (error) {
    return jsonError(error, 400);
  }
}

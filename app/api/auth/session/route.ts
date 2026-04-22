import { NextRequest } from "next/server";

import { sanitizeIdentity } from "@/lib/server/online-play";
import {
  clearSessionCookie,
  getSessionIdentity,
  jsonSuccess,
} from "@/lib/server/online-play-http";

export async function GET(request: NextRequest) {
  const identity = await getSessionIdentity(request);

  return jsonSuccess({
    user: identity ? sanitizeIdentity(identity) : null,
  });
}

export async function DELETE(request: NextRequest) {
  return await clearSessionCookie(request);
}

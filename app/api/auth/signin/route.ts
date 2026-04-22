import { NextRequest } from "next/server";

import { signInAccount } from "@/lib/server/online-play";
import {
  jsonError,
  parseJsonBody,
  withSessionCookie,
} from "@/lib/server/online-play-http";

interface SignInPayload {
  username: string;
  password: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await parseJsonBody<SignInPayload>(request);
    const identity = await signInAccount(body);

    return await withSessionCookie(identity, {
      message: "Signed in successfully.",
    });
  } catch (error) {
    return jsonError(error, 401);
  }
}

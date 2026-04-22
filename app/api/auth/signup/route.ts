import { NextRequest } from "next/server";

import { createAccount } from "@/lib/server/online-play";
import {
  jsonError,
  parseJsonBody,
  withSessionCookie,
} from "@/lib/server/online-play-http";

interface SignUpPayload {
  username: string;
  password: string;
  displayName?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await parseJsonBody<SignUpPayload>(request);
    const identity = await createAccount(body);

    return await withSessionCookie(identity, {
      message: "Account created successfully.",
    }, 201);
  } catch (error) {
    return jsonError(error, 400);
  }
}

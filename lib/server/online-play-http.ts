import { NextRequest, NextResponse } from "next/server";

import {
  clearSession,
  createSession,
  getIdentityFromSessionId,
  getSessionCookieName,
  sanitizeIdentity,
} from "@/lib/server/online-play";
import { SessionUser } from "@/lib/online-play-types";

const SESSION_COOKIE_NAME = getSessionCookieName();

export async function parseJsonBody<T>(request: NextRequest) {
  try {
    return (await request.json()) as T;
  } catch {
    throw new Error("Request body must be valid JSON.");
  }
}

export function jsonSuccess(data: unknown, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

export function jsonError(error: unknown, status = 400) {
  const message =
    error instanceof Error ? error.message : "Something went wrong.";
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function getSessionIdentity(request: NextRequest) {
  const sessionId = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  return await getIdentityFromSessionId(sessionId);
}

export async function requireSessionIdentity(request: NextRequest) {
  const identity = await getSessionIdentity(request);
  if (!identity) {
    throw new Error("You must be signed in or continue as a guest first.");
  }
  return identity;
}

export async function withSessionCookie(
  identity: SessionUser,
  payload: unknown,
  status = 200,
) {
  const session = await createSession(identity);
  const response = NextResponse.json(
    {
      ok: true,
      data: {
        user: sanitizeIdentity(identity),
        ...((payload as Record<string, unknown>) ?? {}),
      },
    },
    { status },
  );

  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: session.token,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });

  return response;
}

export async function clearSessionCookie(request: NextRequest) {
  const sessionId = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  await clearSession(sessionId);

  const response = NextResponse.json({
    ok: true,
    data: {
      user: null,
    },
  });

  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    expires: new Date(0),
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });

  return response;
}

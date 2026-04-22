import { NextRequest } from "next/server";

import { createRoom, listPublicRooms } from "@/lib/server/online-play";
import {
  jsonError,
  jsonSuccess,
  parseJsonBody,
  requireSessionIdentity,
} from "@/lib/server/online-play-http";

interface CreateRoomPayload {
  name: string;
  visibility: "public" | "private";
}

export async function GET() {
  const rooms = await listPublicRooms();
  return jsonSuccess({
    rooms,
  });
}

export async function POST(request: NextRequest) {
  try {
    const identity = await requireSessionIdentity(request);
    const body = await parseJsonBody<CreateRoomPayload>(request);
    const room = await createRoom({
      owner: identity,
      name: body.name,
      visibility: body.visibility,
    });

    return jsonSuccess(
      {
        room,
      },
      201,
    );
  } catch (error) {
    return jsonError(error, 400);
  }
}

import { NextRequest } from "next/server";

import {
  createInvitation,
  createInviteAcceptanceUrl,
} from "@/lib/server/online-play";
import {
  jsonError,
  jsonSuccess,
  parseJsonBody,
  requireSessionIdentity,
} from "@/lib/server/online-play-http";

interface CreateInvitationPayload {
  roomId: string;
  inviteeUsername?: string;
}

export async function POST(request: NextRequest) {
  try {
    const identity = await requireSessionIdentity(request);
    const body = await parseJsonBody<CreateInvitationPayload>(request);
    const invite = await createInvitation({
      roomId: body.roomId,
      createdBy: identity,
      inviteeUsername: body.inviteeUsername,
    });

    return jsonSuccess(
      {
        invitation: {
          ...invite,
          inviteUrl: createInviteAcceptanceUrl(
            request.nextUrl.origin,
            invite.token,
          ),
        },
      },
      201,
    );
  } catch (error) {
    return jsonError(error, 400);
  }
}

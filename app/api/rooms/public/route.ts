import { listPublicRooms } from "@/lib/server/online-play";
import { jsonSuccess } from "@/lib/server/online-play-http";

export async function GET() {
  const rooms = await listPublicRooms();
  return jsonSuccess({
    rooms,
  });
}

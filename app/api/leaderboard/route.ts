import { listLeaderboard } from "@/lib/server/online-play";
import { jsonSuccess } from "@/lib/server/online-play-http";

export async function GET() {
  const leaderboard = await listLeaderboard();
  return jsonSuccess({ leaderboard });
}

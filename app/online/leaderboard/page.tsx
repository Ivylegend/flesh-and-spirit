import Link from "next/link";
import { Trophy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { listLeaderboard } from "@/lib/server/online-play";

export default async function OnlineLeaderboardPage() {
  const leaderboard = await listLeaderboard();

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,_#f8efe2_0%,_#f2e5d1_48%,_#efe4d5_100%)] px-4 py-6 text-stone-900 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <header className="flex flex-col gap-4 rounded-[2rem] border border-white/50 bg-white/75 p-5 shadow-[0_28px_90px_-38px_rgba(120,53,15,0.5)] sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-800">
              <Trophy className="size-3.5" />
              Online Wins
            </div>
            <h1 className="text-3xl font-semibold text-stone-950">
              Leaderboard
            </h1>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              Ranked by completed online-game wins for accounts and returning
              guest sessions.
            </p>
          </div>
          <Button asChild variant="outline" className="h-10 rounded-2xl bg-white">
            <Link href="/online">Back to Online</Link>
          </Button>
        </header>

        <main className="overflow-hidden rounded-3xl border border-white/60 bg-white/85 shadow-[0_24px_80px_-32px_rgba(120,53,15,0.42)]">
          {leaderboard.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-stone-500">
              No online winners yet. Finish a match to claim the first spot.
            </div>
          ) : (
            <div className="divide-y divide-stone-100">
              {leaderboard.map((entry, index) => (
                <div
                  key={entry.userId}
                  className="grid grid-cols-[auto_1fr_auto] items-center gap-4 px-5 py-4"
                >
                  <div className="flex size-10 items-center justify-center rounded-2xl bg-amber-100 text-sm font-bold text-amber-900">
                    #{index + 1}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-stone-900">
                      {entry.displayName}
                    </div>
                    <div className="text-xs text-stone-500">
                      @{entry.username} · {entry.role}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-semibold text-stone-950">
                      {entry.wins}
                    </div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-400">
                      wins
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

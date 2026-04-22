import { Suspense } from "react";

import HomeShell from "@/components/FleshAndSpirit/HomeShell";

export default function Index() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-amber-50" />}>
      <HomeShell />
    </Suspense>
  );
}

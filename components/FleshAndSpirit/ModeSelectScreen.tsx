"use client";

import type { ReactNode } from "react";
import { Globe2, Swords, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface ModeSelectScreenProps {
  onSelectLocal: () => void;
  onSelectOnline: () => void;
}

function PlayModeCard({
  title,
  description,
  eyebrow,
  icon,
  onSelect,
}: {
  title: string;
  description: string;
  eyebrow: string;
  icon: ReactNode;
  onSelect: () => void;
}) {
  return (
    <Card className="border-white/60 bg-white/85 shadow-[0_24px_80px_-32px_rgba(120,53,15,0.45)] backdrop-blur">
      <CardHeader className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">
            {eyebrow}
          </span>
          <div className="flex size-11 items-center justify-center rounded-2xl bg-stone-900 text-amber-100 shadow-sm">
            {icon}
          </div>
        </div>
        <div className="space-y-1">
          <CardTitle className="text-2xl font-semibold text-stone-900">
            {title}
          </CardTitle>
          <CardDescription className="max-w-sm text-sm leading-6 text-stone-600">
            {description}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 text-xs text-stone-500 sm:grid-cols-2">
          <div className="rounded-2xl bg-stone-100/80 px-3 py-2">
            Shared board state
          </div>
          <div className="rounded-2xl bg-stone-100/80 px-3 py-2">
            Guided room flow
          </div>
        </div>
        <Button
          onClick={onSelect}
          className="h-11 w-full rounded-2xl bg-stone-900 text-amber-50 hover:bg-stone-800"
        >
          Choose {title}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function ModeSelectScreen({
  onSelectLocal,
  onSelectOnline,
}: ModeSelectScreenProps) {
  return (
    <div className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.34),_transparent_32%),linear-gradient(180deg,_#fff8eb_0%,_#f6ead8_52%,_#efe1ce_100%)]">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-10 max-w-3xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-300/70 bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-amber-800 shadow-sm backdrop-blur">
            <Swords className="size-3.5" />
            Flesh &amp; Spirit
          </div>
          <h1 className="max-w-4xl text-4xl font-semibold tracking-[-0.04em] text-stone-950 sm:text-5xl lg:text-6xl">
            Choose how the next match begins.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-stone-600 sm:text-base">
            Keep the quick pass-and-play board on one screen, or open the online
            lobby for accounts, guests, rooms, and live invites.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <PlayModeCard
            title="Local Play"
            eyebrow="Around One Board"
            description="Set up players on this device and jump straight into the classic turn-based board flow you already have."
            icon={<Users className="size-5" />}
            onSelect={onSelectLocal}
          />
          <PlayModeCard
            title="Online Play"
            eyebrow="Rooms & Invites"
            description="Sign in or continue as a guest, create public or private rooms, and use live updates while friends join from anywhere."
            icon={<Globe2 className="size-5" />}
            onSelect={onSelectOnline}
          />
        </div>
      </div>
    </div>
  );
}

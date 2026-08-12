# Flesh & Spirit

Flesh & Spirit is a gospel-themed multiplayer board game built with Next.js.
It now supports both:

- local play on one device
- online play with accounts or guests, public/private rooms, invite links, Supabase persistence, and live lobby updates over Supabase Realtime

## Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS
- Supabase Postgres
- Supabase Realtime
- React Query

## Environment

Create a `.env.local` file:

```sh
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

You can also copy values from [.env.example](/Users/mac/Desktop/flesh-spirit/.env.example).

## Run

```sh
pnpm install
pnpm dev
```

Run [supabase/schema.sql](/Users/mac/Desktop/flesh-spirit/supabase/schema.sql) in your Supabase SQL editor before starting online play.

## Features

- choose `Local Play` or `Online Play` from the home screen
- sign up, sign in, or continue as a guest
- create public or private rooms
- join public rooms
- invite by username or shareable link
- live lobby room updates through Supabase Realtime

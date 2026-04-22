# Flesh & Spirit

Flesh & Spirit is a gospel-themed multiplayer board game built with Next.js.
It now supports both:

- local play on one device
- online play with accounts or guests, public/private rooms, invite links, MongoDB persistence, and live lobby updates over WebSockets

## Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS
- MongoDB with Mongoose
- Socket.IO
- React Query

## Environment

Create a `.env.local` file:

```sh
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB=flesh_spirit
```

You can also copy values from [.env.example](/Users/mac/Desktop/flesh-spirit/.env.example).

## Run

```sh
pnpm install
pnpm dev
```

The app now runs through a custom Node server in [server.mjs](/Users/mac/Desktop/flesh-spirit/server.mjs) so Next.js and Socket.IO share the same process.

## Features

- choose `Local Play` or `Online Play` from the home screen
- sign up, sign in, or continue as a guest
- create public or private rooms
- join public rooms
- invite by username or shareable link
- live lobby room updates through WebSockets

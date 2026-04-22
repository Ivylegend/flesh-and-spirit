import { createServer } from "node:http";

import mongoose from "mongoose";
import next from "next";
import { Server as SocketIOServer } from "socket.io";

import { onRealtimeEvent, REALTIME_EVENTS } from "./lib/server/realtime.js";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "localhost";
const port = Number.parseInt(process.env.PORT || "3000", 10);
const mongoUri = process.env.MONGODB_URI;
const mongoDb = process.env.MONGODB_DB;
const sessionCookieName = "flesh_spirit_session";

if (!mongoUri) {
  throw new Error("MONGODB_URI is not set.");
}

let mongoPromise;

async function connectToMongo() {
  if (!mongoPromise) {
    mongoPromise = mongoose.connect(mongoUri, {
      dbName: mongoDb,
    });
  }

  return mongoPromise;
}

function parseCookies(header = "") {
  return Object.fromEntries(
    header
      .split(";")
      .map((chunk) => chunk.trim())
      .filter(Boolean)
      .map((chunk) => {
        const separatorIndex = chunk.indexOf("=");
        const key = separatorIndex >= 0 ? chunk.slice(0, separatorIndex) : chunk;
        const value = separatorIndex >= 0 ? chunk.slice(separatorIndex + 1) : "";
        return [key, decodeURIComponent(value)];
      }),
  );
}

function serializeRoom(room) {
  return {
    id: room._id,
    code: room.code,
    name: room.name,
    visibility: room.visibility,
    ownerId: room.ownerId,
    memberCount: Array.isArray(room.members) ? room.members.length : 0,
    members: (room.members || []).map((member) => ({
      userId: member.userId,
      username: member.username,
      displayName: member.displayName,
      role: member.role,
      joinedAt: new Date(member.joinedAt).toISOString(),
    })),
    createdAt: new Date(room.createdAt).toISOString(),
  };
}

const httpServer = createServer();
const app = next({
  dev,
  hostname,
  port,
  httpServer,
});
const handle = app.getRequestHandler();

await app.prepare();
await connectToMongo();

const io = new SocketIOServer(httpServer, {
  path: "/socket.io",
  cors: {
    origin: true,
    credentials: true,
  },
});

io.use(async (socket, nextMiddleware) => {
  try {
    await connectToMongo();
    const cookies = parseCookies(socket.handshake.headers.cookie);
    const sessionToken = cookies[sessionCookieName];

    if (!sessionToken) {
      return nextMiddleware(new Error("Unauthorized"));
    }

    const db = mongoose.connection.db;
    const session = await db.collection("sessions").findOne({ token: sessionToken });

    if (!session) {
      return nextMiddleware(new Error("Unauthorized"));
    }

    const user = await db.collection("users").findOne({ _id: session.userId });
    if (!user) {
      return nextMiddleware(new Error("Unauthorized"));
    }

    socket.data.identity = {
      id: user._id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
    };

    return nextMiddleware();
  } catch (error) {
    return nextMiddleware(error);
  }
});

io.on("connection", (socket) => {
  socket.emit("socket:ready", {
    user: socket.data.identity,
  });

  socket.on("room:watch", async (roomId, callback) => {
    try {
      await connectToMongo();
      const db = mongoose.connection.db;
      const room = await db.collection("rooms").findOne({ _id: roomId });

      if (!room) {
        callback?.({ ok: false, error: "Room not found." });
        return;
      }

      const isMember = (room.members || []).some(
        (member) => member.userId === socket.data.identity.id,
      );

      if (!isMember && room.visibility !== "public") {
        callback?.({ ok: false, error: "This room is private." });
        return;
      }

      socket.join(`room:${roomId}`);
      socket.emit("room:snapshot", serializeRoom(room));
      callback?.({ ok: true });
    } catch (error) {
      callback?.({
        ok: false,
        error: error instanceof Error ? error.message : "Unable to watch room.",
      });
    }
  });

  socket.on("room:leave", (roomId) => {
    socket.leave(`room:${roomId}`);
  });
});

onRealtimeEvent(REALTIME_EVENTS.ROOM_UPDATED, ({ room }) => {
  io.to(`room:${room.id}`).emit("room:updated", room);
});

onRealtimeEvent(REALTIME_EVENTS.PUBLIC_ROOMS_UPDATED, ({ rooms }) => {
  io.emit("rooms:public", rooms);
});

onRealtimeEvent(REALTIME_EVENTS.INVITATION_CREATED, ({ roomId, invitation }) => {
  io.to(`room:${roomId}`).emit("invitation:created", invitation);
});

httpServer.on("request", (req, res) => {
  handle(req, res);
});

httpServer.listen(port, hostname, () => {
  console.log(
    `> Server listening at http://${hostname}:${port} as ${
      dev ? "development" : process.env.NODE_ENV
    }`,
  );
});

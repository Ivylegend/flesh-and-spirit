import { EventEmitter } from "node:events";

const REALTIME_EVENTS = {
  PUBLIC_ROOMS_UPDATED: "public-rooms-updated",
  ROOM_UPDATED: "room-updated",
  INVITATION_CREATED: "invitation-created",
};

const globalRealtime = globalThis;

if (!globalRealtime.__fleshSpiritRealtimeEmitter) {
  globalRealtime.__fleshSpiritRealtimeEmitter = new EventEmitter();
}

const emitter = globalRealtime.__fleshSpiritRealtimeEmitter;

export { REALTIME_EVENTS };

export function emitRealtimeEvent(type, payload) {
  emitter.emit(type, payload);
}

export function onRealtimeEvent(type, handler) {
  emitter.on(type, handler);
  return () => {
    emitter.off(type, handler);
  };
}

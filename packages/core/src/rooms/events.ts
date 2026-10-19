import * as Context from "effect/Context"
import * as Layer from "effect/Layer"
import { makeChannelHub, notifyChannel } from "../notifications"

export const ROOM_EVENTS_CHANNEL = "room_events"

export const notifyRoom = (roomId: string) =>
  notifyChannel(ROOM_EVENTS_CHANNEL, roomId)

export class RoomEvents extends Context.Service<RoomEvents>()(
  "@animekaiser/core/RoomEvents",
  { make: makeChannelHub(ROOM_EVENTS_CHANNEL, "[Rooms]") }
) {
  static readonly layer = Layer.effect(RoomEvents, RoomEvents.make)
}

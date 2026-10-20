import { RoomId } from "@animekaiser/domain"
import { createFileRoute } from "@tanstack/react-router"
import * as Schema from "effect/Schema"
import { RoomPage } from "../features/rooms/room-page"

const RoomSearch = Schema.Struct({
  invite: Schema.optional(Schema.Boolean),
  ai: Schema.optional(Schema.Boolean),
})

export const Route = createFileRoute("/rooms/$roomId")({
  staticData: { title: "Room" },
  parseParams: ({ roomId }) => ({
    roomId: Schema.decodeUnknownSync(RoomId)(roomId),
  }),
  validateSearch: Schema.decodeUnknownSync(RoomSearch),
  component: RoomRoute,
})

function RoomRoute() {
  const { roomId } = Route.useParams()
  const search = Route.useSearch()
  return (
    <RoomPage
      key={roomId}
      roomId={roomId}
      openInvite={search.invite === true}
      openAi={search.ai === true}
    />
  )
}

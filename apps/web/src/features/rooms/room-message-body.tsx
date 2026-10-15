import type { RoomMessage } from "@animekaiser/domain"

export function RoomMessageBody({ message }: { message: RoomMessage }) {
  return <>{message.body}</>
}

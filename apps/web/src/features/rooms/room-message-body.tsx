import type { RoomMessage } from "@animekaiser/domain"
import { AssistantMarkdown } from "../recommendations/markdown"

export function RoomMessageBody({ message }: { message: RoomMessage }) {
  return message.kind === "ai" ? (
    <AssistantMarkdown>{message.body}</AssistantMarkdown>
  ) : (
    message.body.split(/(@[\p{L}\p{N}_]+)/gu).map((part, index) =>
      part.startsWith("@") ? (
        <span key={index} className="font-medium text-primary">
          {part}
        </span>
      ) : (
        part
      )
    )
  )
}

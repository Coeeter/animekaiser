import { Atom } from "@effect-atom/atom-react"
import { KaiserRpcClient } from "../../services/api-clients"

export const aiReactivityKeys = {
  threads: "ai-threads",
  thread: (id: string) => `ai-thread:${id}`,
  availability: "ai-availability",
  preferences: "ai-preferences",
}

export const aiThreadsAtom = KaiserRpcClient.query(
  "ListRecommendationThreads",
  void 0,
  { reactivityKeys: [aiReactivityKeys.threads] }
)

export const aiAvailabilityAtom = Atom.family((roomId: string) =>
  KaiserRpcClient.query(
    "GetAiAvailability",
    { roomId: roomId || undefined },
    { reactivityKeys: [aiReactivityKeys.availability] }
  )
)

export const aiThreadAtom = Atom.family((threadId: string) =>
  KaiserRpcClient.query(
    "GetRecommendationThread",
    { threadId },
    { reactivityKeys: [aiReactivityKeys.thread(threadId)] }
  )
)

export const aiPreferencesAtom = KaiserRpcClient.query(
  "GetAiPreferences",
  void 0,
  { reactivityKeys: [aiReactivityKeys.preferences] }
)

export const createAiThreadAtom = KaiserRpcClient.mutation(
  "CreateRecommendationThread"
)
export const sendAiMessageAtom = KaiserRpcClient.mutation(
  "SendRecommendationMessage"
)
export const stopAiAtom = KaiserRpcClient.mutation("StopRecommendation")
export const renameAiThreadAtom = KaiserRpcClient.mutation(
  "RenameRecommendationThread"
)
export const deleteAiThreadAtom = KaiserRpcClient.mutation(
  "DeleteRecommendationThread"
)
export const saveAiPreferencesAtom =
  KaiserRpcClient.mutation("SaveAiPreferences")
export const shareToRoomAtom = KaiserRpcClient.mutation(
  "ShareRecommendationToRoom"
)
export const askRoomAiAtom = KaiserRpcClient.mutation("AskRoomAi")
export const stopRoomAiAtom = KaiserRpcClient.mutation("StopRoomAi")

// The Catch me up / Ask about similar anime entry points hand their starting
// context to the assistant sheet without sending anything.
export type AssistantLaunch = {
  readonly seedMalId?: number
  readonly recapMalId?: number
  readonly recapEpisode?: number
  readonly roomId?: string
}

export const assistantLaunchAtom = Atom.make<AssistantLaunch | null>(null).pipe(
  Atom.keepAlive
)

import type {
  RoomAccess,
  RoomAdmissionStatus,
  RoomOperationError,
} from "@animekaiser/domain"
import { RoomCapacity } from "@animekaiser/domain"

export type ParticipantState =
  | "invited"
  | "admitted"
  | "left"
  | "removed"
  | "banned"
  | "expired"

export type AdmissionFacts = {
  roomOpen: boolean
  access: RoomAccess
  signedIn: boolean
  isHost: boolean
  isHostFriend: boolean
  participant: { state: ParticipantState; guest: boolean } | null
  validLink: boolean
  onlineCount: number
  alreadyOnline: boolean
}

// Friends-only always uses the host's current friendships, so membership is
// rechecked rather than trusted once admitted.
export const isStillMember = (facts: AdmissionFacts) => {
  const participant = facts.participant
  if (participant?.state !== "admitted") return false
  if (facts.isHost) return true
  if (facts.access !== "friends") return true
  return !participant.guest && facts.isHostFriend
}

export const decideAdmission = (facts: AdmissionFacts): RoomAdmissionStatus => {
  if (facts.participant?.state === "banned") return "banned"
  if (isStillMember(facts)) return "member"
  if (!facts.roomOpen) return "closed"

  const status = ((): RoomAdmissionStatus => {
    if (!facts.signedIn) {
      if (facts.access === "friends") return "sign_in_required"
      if (facts.validLink) return "joinable"
      return facts.access === "public" ? "sign_in_required" : "invite_required"
    }
    if (facts.access === "friends")
      return facts.isHostFriend ? "joinable" : "friends_only"
    if (facts.participant?.state === "invited") return "joinable"
    if (facts.participant?.state === "removed") return "invite_required"
    if (facts.access === "public" || facts.validLink) return "joinable"
    return "invite_required"
  })()

  if (
    status === "joinable" &&
    facts.onlineCount >= RoomCapacity &&
    !facts.alreadyOnline
  )
    return "full"
  return status
}

export const admissionError = (
  status: RoomAdmissionStatus
): ConstructorParameters<typeof RoomOperationError>[0] => {
  switch (status) {
    case "banned":
      return { reason: "banned", message: "You can't join this room." }
    case "closed":
      return { reason: "closed", message: "This room has closed." }
    case "full":
      return { reason: "full", message: "This room is full." }
    case "friends_only":
      return {
        reason: "friends_only",
        message: "Only the host's friends can join this room.",
      }
    case "invite_required":
      return {
        reason: "invite_required",
        message: "You need an invitation to join this room.",
      }
    case "sign_in_required":
      return {
        reason: "sign_in_required",
        message: "Sign in to join this room.",
      }
    default:
      return { reason: "unavailable", message: "This room is unavailable." }
  }
}

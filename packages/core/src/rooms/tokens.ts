import { createHash, randomBytes } from "node:crypto"

export const createOpaqueToken = () => randomBytes(24).toString("base64url")

export const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex")

export const roomGuestCookiePrefix = "kaiser_room_guest_"

export const roomGuestCookieName = (roomId: string) =>
  `${roomGuestCookiePrefix}${roomId.replaceAll("-", "")}`

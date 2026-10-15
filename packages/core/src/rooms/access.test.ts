import { describe, expect, test } from "bun:test"
import { type AdmissionFacts, decideAdmission } from "./access"

const facts = (overrides: Partial<AdmissionFacts>): AdmissionFacts => ({
  roomOpen: true,
  access: "invite",
  signedIn: true,
  isHost: false,
  isHostFriend: false,
  participant: null,
  validLink: false,
  onlineCount: 1,
  alreadyOnline: false,
  ...overrides,
})

describe("decideAdmission", () => {
  test("invite-only admits addressed invitations and link holders", () => {
    expect(decideAdmission(facts({}))).toBe("invite_required")
    expect(
      decideAdmission(
        facts({ participant: { state: "invited", guest: false } })
      )
    ).toBe("joinable")
    expect(decideAdmission(facts({ validLink: true }))).toBe("joinable")
  })

  test("friends-only ignores links and rechecks friendship for members", () => {
    const friendsRoom = facts({ access: "friends", validLink: true })
    expect(decideAdmission(friendsRoom)).toBe("friends_only")
    expect(decideAdmission({ ...friendsRoom, isHostFriend: true })).toBe(
      "joinable"
    )
    expect(
      decideAdmission({
        ...friendsRoom,
        participant: { state: "admitted", guest: false },
      })
    ).toBe("friends_only")
    expect(
      decideAdmission({
        ...friendsRoom,
        signedIn: false,
        participant: { state: "admitted", guest: true },
      })
    ).toBe("sign_in_required")
  })

  test("guests need a valid link and never join friends-only rooms", () => {
    expect(decideAdmission(facts({ signedIn: false }))).toBe("invite_required")
    expect(decideAdmission(facts({ signedIn: false, validLink: true }))).toBe(
      "joinable"
    )
    expect(decideAdmission(facts({ signedIn: false, access: "public" }))).toBe(
      "sign_in_required"
    )
  })

  test("bans, removals, closure and capacity", () => {
    expect(
      decideAdmission(
        facts({
          validLink: true,
          participant: { state: "banned", guest: false },
        })
      )
    ).toBe("banned")
    expect(
      decideAdmission(
        facts({
          access: "public",
          participant: { state: "removed", guest: false },
        })
      )
    ).toBe("invite_required")
    expect(decideAdmission(facts({ validLink: true, roomOpen: false }))).toBe(
      "closed"
    )
    expect(decideAdmission(facts({ validLink: true, onlineCount: 20 }))).toBe(
      "full"
    )
    expect(
      decideAdmission(
        facts({
          onlineCount: 20,
          participant: { state: "admitted", guest: false },
        })
      )
    ).toBe("member")
  })
})

import { describe, expect, it } from "bun:test"
import { heroSynopsis } from "./service"

describe("heroSynopsis", () => {
  it("drops trailing source and rewrite credits", () => {
    expect(heroSynopsis("A pirate sets sail.\n\n(Source: Crunchyroll)")).toBe(
      "A pirate sets sail."
    )
    expect(heroSynopsis("An elf mage travels. [Written by MAL Rewrite]")).toBe(
      "An elf mage travels."
    )
  })

  it("strips inline HTML and decodes entities", () => {
    expect(
      heroSynopsis(
        "The third season of <i>Mushoku Tensei</i>.<br><br>Rudy &amp; Eris&#039; journey."
      )
    ).toBe("The third season of Mushoku Tensei. Rudy & Eris' journey.")
  })

  it("keeps credits-like text in the middle of a synopsis", () => {
    expect(heroSynopsis("The (source) of power lies within.")).toBe(
      "The (source) of power lies within."
    )
  })

  it("returns null for missing or empty synopses", () => {
    expect(heroSynopsis(null)).toBeNull()
    expect(heroSynopsis("(Source: MAL)")).toBeNull()
  })
})

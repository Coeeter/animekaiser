import { describe, expect, test } from "bun:test"
import { Laptop, Smartphone, Tablet } from "lucide-react"
import { describeUserAgent } from "./user-agent"

describe("describeUserAgent", () => {
  test("describes common devices", () => {
    expect(describeUserAgent(null)).toEqual({
      icon: Laptop,
      label: "Unknown device",
      detail: "",
    })
    expect(
      describeUserAgent(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1"
      )
    ).toMatchObject({ icon: Smartphone, label: "Safari on iOS" })
    expect(
      describeUserAgent(
        "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1"
      )
    ).toMatchObject({ icon: Tablet, label: "Safari on iPadOS" })
    expect(
      describeUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0"
      )
    ).toMatchObject({ icon: Laptop, label: "Edge on Windows" })
  })
})

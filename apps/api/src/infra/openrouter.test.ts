import { describe, expect, test } from "bun:test"
import * as Chunk from "effect/Chunk"
import * as Effect from "effect/Effect"
import * as Stream from "effect/Stream"
import { sseData } from "./openrouter"

const parse = (text: string) =>
  Effect.runPromise(
    sseData(Stream.make(text).pipe(Stream.splitLines)).pipe(
      Stream.runCollect,
      Effect.map(Chunk.toArray)
    )
  )

describe("sseData", () => {
  test("joins multi-line data and accepts data without a space", async () => {
    expect(
      await parse('data: {"a":\ndata:1}\n\n: keep-alive\n\ndata: [DONE]\n\n')
    ).toEqual(['{"a":\n1}', "[DONE]"])
  })
  test("handles CRLF and a final event without a blank line", async () => {
    expect(await parse("event: x\r\ndata: one\r\n\r\ndata: two")).toEqual([
      "one",
      "two",
    ])
  })
})

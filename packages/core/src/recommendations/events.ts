import * as Context from "effect/Context"
import * as Layer from "effect/Layer"
import { makeChannelHub, notifyChannel } from "../notifications"

export const THREAD_EVENTS_CHANNEL = "recommendation_thread_events"

export const notifyThread = (threadId: string) =>
  notifyChannel(THREAD_EVENTS_CHANNEL, threadId)

export class ThreadEvents extends Context.Service<ThreadEvents>()(
  "@animekaiser/core/ThreadEvents",
  { make: makeChannelHub(THREAD_EVENTS_CHANNEL, "[AI]") }
) {
  static readonly layer = Layer.effect(ThreadEvents, ThreadEvents.make)
}

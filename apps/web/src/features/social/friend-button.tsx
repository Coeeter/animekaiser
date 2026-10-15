import type { FriendRelation } from "@animekaiser/domain"
import { Button } from "@animekaiser/ui/components/button"
import { Result, useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import * as Cause from "effect/Cause"
import * as Exit from "effect/Exit"
import * as Option from "effect/Option"
import { Check, Clock, UserPlus } from "lucide-react"
import { toast } from "sonner"
import {
  friendRelationAtom,
  removeFriendshipAtom,
  respondFriendRequestAtom,
  sendFriendRequestAtom,
  socialReactivityKeys,
} from "./atoms"

const failed = (exit: Exit.Exit<unknown, { readonly message: string }>) => {
  if (Exit.isSuccess(exit)) return
  const error = Cause.failureOption(exit.cause)
  toast.error(
    Option.isSome(error) ? error.value.message : "Something went wrong."
  )
}

export function useFriendActions() {
  const send = useAtomSet(sendFriendRequestAtom, { mode: "promiseExit" })
  const respond = useAtomSet(respondFriendRequestAtom, { mode: "promiseExit" })
  const remove = useAtomSet(removeFriendshipAtom, { mode: "promiseExit" })
  const options = { reactivityKeys: socialReactivityKeys }
  return {
    send: (userId: string) =>
      void send({ payload: { userId }, ...options }).then(failed),
    accept: (userId: string) =>
      void respond({ payload: { userId, accept: true }, ...options }).then(
        failed
      ),
    decline: (userId: string) =>
      void respond({ payload: { userId, accept: false }, ...options }).then(
        failed
      ),
    remove: (userId: string) =>
      void remove({ payload: { userId }, ...options }).then(failed),
  }
}

export function FriendActionButtons({
  userId,
  relation,
}: {
  userId: string
  relation: FriendRelation
}) {
  const actions = useFriendActions()
  switch (relation) {
    case "self":
      return null
    case "friends":
      return (
        <Button
          size="sm"
          variant="outline"
          onClick={() => actions.remove(userId)}
        >
          <Check data-icon="inline-start" />
          Friends · Remove
        </Button>
      )
    case "outgoing":
      return (
        <Button
          size="sm"
          variant="outline"
          onClick={() => actions.remove(userId)}
        >
          <Clock data-icon="inline-start" />
          Pending · Cancel
        </Button>
      )
    case "incoming":
      return (
        <div className="flex gap-2">
          <Button size="sm" onClick={() => actions.accept(userId)}>
            Accept
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => actions.decline(userId)}
          >
            Decline
          </Button>
        </div>
      )
    case "none":
      return (
        <Button size="sm" onClick={() => actions.send(userId)}>
          <UserPlus data-icon="inline-start" />
          Add friend
        </Button>
      )
  }
}

export function ProfileFriendButton({ username }: { username: string }) {
  const relation = useAtomValue(friendRelationAtom(username))
  return Result.builder(relation)
    .onSuccess((value) =>
      value ? (
        <FriendActionButtons userId={value.userId} relation={value.relation} />
      ) : null
    )
    .orNull()
}

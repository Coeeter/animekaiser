import * as Cause from "effect/Cause"
import * as Exit from "effect/Exit"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import { toast } from "sonner"

const ErrorMessage = Schema.Struct({ message: Schema.String })

export const errorMessage = (cause: unknown, fallback: string) =>
  Schema.decodeUnknownOption(ErrorMessage)(cause).pipe(
    Option.map(({ message }) => message),
    Option.getOrElse(() => fallback)
  )

// The message of a failed exit's typed error, or `fallback` for defects and
// interruptions. Successful exits have no message.
export const failureMessage = (
  exit: Exit.Exit<unknown, unknown>,
  fallback: string
) =>
  Exit.isSuccess(exit)
    ? null
    : Option.match(Cause.findErrorOption(exit.cause), {
        onNone: () => fallback,
        onSome: (error) => errorMessage(error, fallback),
      })

// Toasts a failed exit and narrows to success, so callers continue with the
// value only when the action worked.
export const toastFailure =
  (fallback: string) =>
  <A, E>(exit: Exit.Exit<A, E>): exit is Exit.Success<A, E> => {
    const message = failureMessage(exit, fallback)
    if (message) toast.error(message)
    return Exit.isSuccess(exit)
  }

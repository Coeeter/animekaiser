import * as Option from "effect/Option"
import * as Schema from "effect/Schema"

const ErrorMessage = Schema.Struct({ message: Schema.String })

export const errorMessage = (cause: unknown, fallback: string) =>
  Schema.decodeUnknownOption(ErrorMessage)(cause).pipe(
    Option.map(({ message }) => message),
    Option.getOrElse(() => fallback)
  )

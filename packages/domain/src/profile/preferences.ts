import * as Schema from "effect/Schema"

// `key` is KeyboardEvent.key lower-cased; `mod` is ⌘ on macOS, Ctrl elsewhere.
export const KeyBinding = Schema.Struct({
  key: Schema.String,
  mod: Schema.optionalWith(Schema.Boolean, { default: () => false }),
})
export type KeyBinding = typeof KeyBinding.Type

// Only shortcuts the user changed are stored, keyed by action id, so new
// defaults still reach everyone else.
export const ShortcutOverrides = Schema.Record({
  key: Schema.String,
  value: Schema.Array(KeyBinding),
})
export type ShortcutOverrides = typeof ShortcutOverrides.Type

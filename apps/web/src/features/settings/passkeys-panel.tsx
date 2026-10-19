import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@animekaiser/ui/components/alert-dialog"
import { Button } from "@animekaiser/ui/components/button"
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@animekaiser/ui/components/empty"
import { Field, FieldLabel } from "@animekaiser/ui/components/field"
import { Input } from "@animekaiser/ui/components/input"
import { Separator } from "@animekaiser/ui/components/separator"
import { useAtom, useAtomValue } from "@effect/atom-react"
import { useForm } from "@tanstack/react-form"
import * as Effect from "effect/Effect"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import * as Atom from "effect/reactivity/Atom"
import { Fingerprint, KeyRound, Pencil, Trash2 } from "lucide-react"
import { useId, useState } from "react"
import { toast } from "sonner"
import { IconInput } from "../../components/icon-input"
import { auth } from "../../services/auth"
import { toastFailure } from "../../utils/error"
import { SettingHeading } from "./settings-shared"

type AddPasskeyValues = { name: string }

const passkeysAtom = Atom.make(
  auth((client) => client.passkey.listUserPasskeys()).pipe(
    Effect.map((passkeys) => passkeys ?? []),
    Effect.orElseSucceed(() => [])
  )
)

const addPasskeyAtom = Atom.fn((name: string | undefined, get) =>
  auth((client) => client.passkey.addPasskey({ name })).pipe(
    Effect.tap(() => Effect.sync(() => get.refresh(passkeysAtom)))
  )
)

const renamePasskeyAtom = Atom.family((id: string) =>
  Atom.fn((name: string, get) =>
    auth((client) => client.passkey.updatePasskey({ id, name })).pipe(
      Effect.tap(() => Effect.sync(() => get.refresh(passkeysAtom)))
    )
  )
)

const deletePasskeyAtom = Atom.family((id: string) =>
  Atom.fn<void>()((_, get) =>
    auth((client) => client.passkey.deletePasskey({ id })).pipe(
      Effect.tap(() => Effect.sync(() => get.refresh(passkeysAtom)))
    )
  )
)

export function PasskeysSection() {
  const passkeys = AsyncResult.getOrElse(useAtomValue(passkeysAtom), () => [])
  const nameId = useId()
  const [addResult, addPasskey] = useAtom(addPasskeyAtom, {
    mode: "promiseExit",
  })
  const addForm = useForm({
    defaultValues: { name: "" },
    onSubmit: ({ value }) => add(value),
  })

  const add = (values: AddPasskeyValues) =>
    addPasskey(values.name.trim() || undefined).then((exit) => {
      if (!toastFailure("Unable to add passkey")(exit)) return
      addForm.reset()
      toast.success("Passkey added.")
    })

  return (
    <div className="flex flex-col gap-4">
      <SettingHeading
        title="Passkeys"
        description="Use biometrics or a device PIN to sign in without a password."
      />
      <form
        className="flex flex-col gap-4 sm:flex-row sm:items-end"
        onSubmit={(event) => {
          event.preventDefault()
          void addForm.handleSubmit()
        }}
      >
        <addForm.Field name="name">
          {(field) => (
            <Field className="flex-1">
              <FieldLabel htmlFor={nameId}>New passkey name</FieldLabel>
              <IconInput
                id={nameId}
                icon={KeyRound}
                name={field.name}
                placeholder="MacBook Touch ID"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
              />
            </Field>
          )}
        </addForm.Field>
        <Button disabled={addResult.waiting} type="submit">
          <Fingerprint data-icon="inline-start" />
          Add passkey
        </Button>
      </form>
      <Separator />
      {passkeys.length ? (
        <div className="flex flex-col gap-2">
          {passkeys.map((passkey) => (
            <PasskeyRow
              key={passkey.id}
              id={passkey.id}
              name={passkey.name ?? "Passkey"}
            />
          ))}
        </div>
      ) : (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <KeyRound />
            </EmptyMedia>
            <EmptyTitle>No passkeys registered</EmptyTitle>
          </EmptyHeader>
        </Empty>
      )}
    </div>
  )
}

function PasskeyRow({ id, name }: { id: string; name: string }) {
  const [renameResult, renamePasskey] = useAtom(renamePasskeyAtom(id), {
    mode: "promiseExit",
  })
  const [deleteResult, deletePasskey] = useAtom(deletePasskeyAtom(id), {
    mode: "promiseExit",
  })
  const pending = renameResult.waiting || deleteResult.waiting
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(name)
  const save = () =>
    renamePasskey(value.trim()).then((exit) => {
      if (toastFailure("Unable to rename passkey")(exit))
        toast.success("Passkey renamed.")
      setEditing(false)
    })
  const remove = () =>
    deletePasskey().then((exit) => {
      if (toastFailure("Unable to remove passkey")(exit))
        toast.success("Passkey removed.")
    })
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-3">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
        <KeyRound className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        {editing ? (
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void save()
            }}
          >
            <Input
              autoFocus
              required
              value={value}
              onChange={(event) => setValue(event.target.value)}
              onBlur={() => {
                setValue(name)
                setEditing(false)
              }}
            />
          </form>
        ) : (
          <p className="truncate font-medium">{name}</p>
        )}
      </div>
      <div className="flex gap-1">
        <Button
          size="icon-sm"
          variant="ghost"
          disabled={pending}
          onClick={() => setEditing(true)}
        >
          <Pencil />
          <span className="sr-only">Rename passkey</span>
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              size="icon-sm"
              variant="ghost"
              className="text-muted-foreground hover:text-destructive"
              disabled={pending}
            >
              <Trash2 />
              <span className="sr-only">Remove passkey</span>
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove this passkey?</AlertDialogTitle>
              <AlertDialogDescription>
                You will no longer be able to use it to sign in.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => void remove()}
              >
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}

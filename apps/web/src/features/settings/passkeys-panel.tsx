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
import { useForm } from "@tanstack/react-form"
import { Fingerprint, KeyRound, Pencil, Trash2 } from "lucide-react"
import { useId, useState } from "react"
import { toast } from "sonner"
import { IconInput } from "../../components/icon-input"
import { authClient } from "../../services/api-clients"
import { errorMessage } from "../../utils/error"
import { SettingHeading } from "./settings-shared"

type AddPasskeyValues = { name: string }

export function PasskeysSection() {
  const query = authClient.useListPasskeys()
  const nameId = useId()
  const [pending, setPending] = useState<string | null>(null)
  const addForm = useForm({
    defaultValues: { name: "" },
    onSubmit: ({ value }) => add(value),
  })

  const add = async (values: AddPasskeyValues) => {
    setPending("add")
    try {
      const result = await authClient.passkey.addPasskey({
        name: values.name.trim() || undefined,
      })
      if (result.error) throw result.error
      addForm.reset()
      await query.refetch()
      toast.success("Passkey added.")
    } catch (reason) {
      toast.error(errorMessage(reason, "Unable to add passkey"))
    } finally {
      setPending(null)
    }
  }
  const rename = async (id: string, name: string) => {
    setPending(id)
    try {
      const result = await authClient.passkey.updatePasskey({ id, name })
      if (result.error) throw result.error
      await query.refetch()
      toast.success("Passkey renamed.")
    } catch (reason) {
      toast.error(errorMessage(reason, "Unable to rename passkey"))
    } finally {
      setPending(null)
    }
  }
  const remove = async (id: string) => {
    setPending(id)
    try {
      const result = await authClient.passkey.deletePasskey({ id })
      if (result.error) throw result.error
      await query.refetch()
      toast.success("Passkey removed.")
    } catch (reason) {
      toast.error(errorMessage(reason, "Unable to remove passkey"))
    } finally {
      setPending(null)
    }
  }

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
        <Button disabled={pending === "add"} type="submit">
          <Fingerprint data-icon="inline-start" />
          Add passkey
        </Button>
      </form>
      <Separator />
      {query.data?.length ? (
        <div className="flex flex-col gap-2">
          {query.data.map((passkey) => (
            <PasskeyRow
              key={passkey.id}
              id={passkey.id}
              name={passkey.name ?? "Passkey"}
              pending={pending === passkey.id}
              rename={rename}
              remove={remove}
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

function PasskeyRow({
  id,
  name,
  pending,
  rename,
  remove,
}: {
  id: string
  name: string
  pending: boolean
  rename: (id: string, name: string) => Promise<void>
  remove: (id: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(name)
  const save = async () => {
    await rename(id, value.trim())
    setEditing(false)
  }
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card/40 p-3">
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
                onClick={() => void remove(id)}
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

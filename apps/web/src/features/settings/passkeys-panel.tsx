import { useForm } from "@tanstack/react-form"
import { Button } from "@workspace/ui/components/button"
import { Field, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { Fingerprint } from "lucide-react"
import { useId, useState } from "react"
import { toast } from "sonner"
import type { AppUser } from "../../lib/auth-client"
import { authClient } from "../../lib/auth-client"
import { errorMessage } from "../../lib/error"
import { AuthRequired, PanelCard } from "./settings-shared"

type AddPasskeyValues = {
  name: string
}

export function PasskeysPanel({ user }: { user: AppUser | null }) {
  const query = authClient.useListPasskeys()
  const nameId = useId()
  const [pending, setPending] = useState<string | null>(null)
  const addForm = useForm({
    defaultValues: { name: "" },
    onSubmit: ({ value }) => add(value),
  })
  if (!user) return <AuthRequired />
  const add = async (values: AddPasskeyValues) => {
    const name = values.name.trim()
    setPending("add")
    try {
      const result = await authClient.passkey.addPasskey({
        name: name || undefined,
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
    if (!window.confirm("Remove this passkey?")) return
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
      <PanelCard>
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
                <Input
                  id={nameId}
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
      </PanelCard>
      <div className="divide-y rounded-2xl border bg-background/60">
        {query.data?.length ? (
          query.data.map((passkey) => (
            <PasskeyRow
              key={passkey.id}
              id={passkey.id}
              name={passkey.name ?? "Passkey"}
              pending={pending === passkey.id}
              rename={rename}
              remove={remove}
            />
          ))
        ) : (
          <p className="p-5 text-sm text-muted-foreground">
            No passkeys registered.
          </p>
        )}
      </div>
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
  const form = useForm({
    defaultValues: { name },
    onSubmit: ({ value }) => rename(id, value.name.trim()),
  })
  const nameId = useId()

  return (
    <form
      className="flex flex-wrap items-end justify-between gap-4 p-4"
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit()
      }}
    >
      <form.Field name="name">
        {(field) => (
          <Field className="max-w-sm">
            <FieldLabel htmlFor={nameId}>Passkey name</FieldLabel>
            <Input
              id={nameId}
              name={field.name}
              required
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
            />
          </Field>
        )}
      </form.Field>
      <div className="flex gap-2">
        <Button variant="outline" disabled={pending} type="submit">
          Rename
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={pending}
          onClick={() => void remove(id)}
        >
          Remove
        </Button>
      </div>
    </form>
  )
}

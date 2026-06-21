import { Button } from "@workspace/ui/components/button"
import { Field, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { Fingerprint } from "lucide-react"
import type { FormEvent } from "react"
import { useState } from "react"
import { toast } from "sonner"
import type { AppUser } from "../../lib/auth-client"
import { authClient } from "../../lib/auth-client"
import { errorMessage } from "../../lib/error"
import { AuthRequired, PanelCard } from "./settings-shared"

export function PasskeysPanel({ user }: { user: AppUser | null }) {
  const query = authClient.useListPasskeys()
  const [pending, setPending] = useState<string | null>(null)
  if (!user) return <AuthRequired />
  const add = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const name = String(
      new FormData(event.currentTarget).get("name") ?? ""
    ).trim()
    setPending("add")
    try {
      const result = await authClient.passkey.addPasskey({
        name: name || undefined,
      })
      if (result.error) throw result.error
      event.currentTarget.reset()
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
          onSubmit={add}
        >
          <Field className="flex-1">
            <FieldLabel htmlFor="passkey-name">New passkey name</FieldLabel>
            <Input
              id="passkey-name"
              name="name"
              placeholder="MacBook Touch ID"
            />
          </Field>
          <Button disabled={pending === "add"}>
            <Fingerprint data-icon="inline-start" />
            Add passkey
          </Button>
        </form>
      </PanelCard>
      <div className="divide-y rounded-2xl border bg-background/60">
        {query.data?.length ? (
          query.data.map((passkey) => (
            <form
              className="flex flex-wrap items-end justify-between gap-4 p-4"
              key={passkey.id}
              onSubmit={(event) => {
                event.preventDefault()
                void rename(
                  passkey.id,
                  String(
                    new FormData(event.currentTarget).get("name") ?? ""
                  ).trim()
                )
              }}
            >
              <Field className="max-w-sm">
                <FieldLabel htmlFor={`passkey-${passkey.id}`}>
                  Passkey name
                </FieldLabel>
                <Input
                  id={`passkey-${passkey.id}`}
                  name="name"
                  defaultValue={passkey.name ?? "Passkey"}
                  required
                />
              </Field>
              <div className="flex gap-2">
                <Button variant="outline" disabled={pending === passkey.id}>
                  Rename
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={pending === passkey.id}
                  onClick={() => void remove(passkey.id)}
                >
                  Remove
                </Button>
              </div>
            </form>
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

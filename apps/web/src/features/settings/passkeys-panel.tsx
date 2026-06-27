import { Button } from "@workspace/ui/components/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@workspace/ui/components/form"
import { Input } from "@workspace/ui/components/input"
import { Fingerprint } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import type { AppUser } from "../../lib/auth-client"
import { authClient } from "../../lib/auth-client"
import { errorMessage } from "../../lib/error"
import { AuthRequired, PanelCard } from "./settings-shared"

type AddPasskeyValues = {
  name: string
}

type RenamePasskeyValues = {
  name: string
}

export function PasskeysPanel({ user }: { user: AppUser | null }) {
  const query = authClient.useListPasskeys()
  const [pending, setPending] = useState<string | null>(null)
  const addForm = useForm<AddPasskeyValues>({
    defaultValues: { name: "" },
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
        <Form {...addForm}>
          <form
            className="flex flex-col gap-4 sm:flex-row sm:items-end"
            onSubmit={addForm.handleSubmit(add)}
          >
            <FormField
              control={addForm.control}
              name="name"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormLabel>New passkey name</FormLabel>
                  <FormControl>
                    <Input placeholder="MacBook Touch ID" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <Button disabled={pending === "add"} type="submit">
              <Fingerprint data-icon="inline-start" />
              Add passkey
            </Button>
          </form>
        </Form>
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
  const form = useForm<RenamePasskeyValues>({
    values: { name },
  })

  return (
    <Form {...form}>
      <form
        className="flex flex-wrap items-end justify-between gap-4 p-4"
        onSubmit={form.handleSubmit((values) => rename(id, values.name.trim()))}
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem className="max-w-sm">
              <FormLabel>Passkey name</FormLabel>
              <FormControl>
                <Input required {...field} />
              </FormControl>
            </FormItem>
          )}
        />
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
    </Form>
  )
}

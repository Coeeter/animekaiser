import { Field, FieldDescription } from "@workspace/ui/components/field"
import { Switch } from "@workspace/ui/components/switch"
import { useRouter } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import type { AppUser } from "../../lib/auth-client"
import { errorMessage } from "../../lib/error"
import { loadOwnProfile, savePrivacy } from "../profile/profile-rpc"
import { AuthRequired, PanelCard } from "./settings-shared"

export function PrivacyPanel({
  open,
  user,
}: {
  open: boolean
  user: AppUser | null
}) {
  const router = useRouter()
  const [isPrivate, setPrivate] = useState(false)
  const [pending, setPending] = useState(false)
  useEffect(() => {
    if (open && user)
      void loadOwnProfile().then((value) => setPrivate(value.profile.private))
  }, [open, user])
  if (!user) return <AuthRequired />
  const update = async (checked: boolean) => {
    const previous = isPrivate
    setPrivate(checked)
    setPending(true)
    try {
      await savePrivacy(checked)
      await router.invalidate()
    } catch (reason) {
      setPrivate(previous)
      toast.error(errorMessage(reason, "Unable to update privacy"))
    } finally {
      setPending(false)
    }
  }
  return (
    <PanelCard>
      <Field orientation="horizontal">
        <div className="flex-1">
          <p className="font-semibold">Private profile</p>
          <FieldDescription>
            Hide your profile details from everyone except you.
          </FieldDescription>
        </div>
        <Switch
          aria-label="Private profile"
          checked={isPrivate}
          disabled={pending}
          onCheckedChange={(value) => void update(value)}
        />
      </Field>
    </PanelCard>
  )
}

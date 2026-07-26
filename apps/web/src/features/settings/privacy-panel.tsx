import {
  Result,
  useAtom,
  useAtomRefresh,
  useAtomValue,
} from "@effect-atom/atom-react"
import { useRouter } from "@tanstack/react-router"
import { Field, FieldDescription } from "@workspace/ui/components/field"
import { Switch } from "@workspace/ui/components/switch"
import { toast } from "sonner"
import { DataError } from "../../components/data-error"
import { errorMessage } from "../../utils/error"
import type { AppUser } from "../auth/user"
import {
  ownProfileAtom,
  profileReactivityKeys,
  updatePrivacyAtom,
} from "../profile/atoms"
import { AuthRequired, PanelCard } from "./settings-shared"

export function PrivacyPanel({ user }: { user: AppUser | null }) {
  const router = useRouter()

  const profileResult = useAtomValue(ownProfileAtom)
  const refreshProfile = useAtomRefresh(ownProfileAtom)

  const [saveResult, savePrivacy] = useAtom(updatePrivacyAtom, {
    mode: "promise",
  })

  const profile = Result.builder(profileResult)
    .onSuccess((value) => value.profile)
    .orNull()

  if (!user) return <AuthRequired />

  const profileError = Result.builder(profileResult)
    .onFailure(() => <DataError onRetry={refreshProfile} />)
    .orNull()

  if (profileError) return profileError

  const update = async (checked: boolean) => {
    try {
      await savePrivacy({
        payload: { private: checked },
        reactivityKeys: profileReactivityKeys,
      })
      await router.invalidate()
    } catch (reason) {
      toast.error(errorMessage(reason, "Unable to update privacy"))
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
          checked={profile?.private ?? false}
          disabled={saveResult.waiting}
          onCheckedChange={(value) => void update(value)}
        />
      </Field>
    </PanelCard>
  )
}

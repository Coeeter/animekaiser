import { Field, FieldDescription } from "@animekaiser/ui/components/field"
import { Switch } from "@animekaiser/ui/components/switch"
import {
  Result,
  useAtom,
  useAtomRefresh,
  useAtomValue,
} from "@effect-atom/atom-react"
import { useRouter } from "@tanstack/react-router"
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

  const isPrivate = profile?.private ?? false
  const username = user.username ?? user.name

  const update = async (patch: {
    private?: boolean
    shareStats?: boolean
    shareActivity?: boolean
    shareList?: boolean
  }) => {
    try {
      await savePrivacy({
        payload: patch,
        reactivityKeys: profileReactivityKeys,
      })
      refreshProfile()
      await router.invalidate()
    } catch (reason) {
      toast.error(errorMessage(reason, "Unable to update privacy"))
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PanelCard>
        <Field orientation="horizontal">
          <div className="flex-1">
            <p className="font-semibold">Private profile</p>
            <FieldDescription>
              Hide your profile from everyone except you. This overrides the
              sharing options below.
            </FieldDescription>
          </div>
          <Switch
            aria-label="Private profile"
            checked={isPrivate}
            disabled={saveResult.waiting}
            onCheckedChange={(value) => void update({ private: value })}
          />
        </Field>
      </PanelCard>

      <PanelCard className={isPrivate ? "opacity-60" : undefined}>
        <div className="flex flex-col gap-1">
          <h3 className="font-semibold">What visitors can see</h3>
          <p className="text-sm text-muted-foreground">
            {isPrivate
              ? "Your profile is private, so none of this is shared right now."
              : "Choose which sections appear on your public profile."}
          </p>
        </div>

        <div className="mt-4 flex flex-col gap-4">
          <Field orientation="horizontal">
            <div className="flex-1">
              <p className="font-medium">Statistics</p>
              <FieldDescription>
                Totals, score distribution, and time watched.
              </FieldDescription>
            </div>
            <Switch
              aria-label="Share statistics"
              checked={profile?.shareStats ?? true}
              disabled={saveResult.waiting || isPrivate}
              onCheckedChange={(value) => void update({ shareStats: value })}
            />
          </Field>

          <Field orientation="horizontal">
            <div className="flex-1">
              <p className="font-medium">Recent activity</p>
              <FieldDescription>
                Your watch streak and day-by-day activity.
              </FieldDescription>
            </div>
            <Switch
              aria-label="Share recent activity"
              checked={profile?.shareActivity ?? true}
              disabled={saveResult.waiting || isPrivate}
              onCheckedChange={(value) => void update({ shareActivity: value })}
            />
          </Field>

          <Field orientation="horizontal">
            <div className="flex-1">
              <p className="font-medium">Anime list</p>
              <FieldDescription>
                Let anyone open your list at /list/{username}.
              </FieldDescription>
            </div>
            <Switch
              aria-label="Share anime list"
              checked={profile?.shareList ?? true}
              disabled={saveResult.waiting || isPrivate}
              onCheckedChange={(value) => void update({ shareList: value })}
            />
          </Field>
        </div>
      </PanelCard>
    </div>
  )
}

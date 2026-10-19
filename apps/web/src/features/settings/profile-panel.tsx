import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@animekaiser/ui/components/avatar"
import { Button } from "@animekaiser/ui/components/button"
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@animekaiser/ui/components/field"
import { Switch } from "@animekaiser/ui/components/switch"
import { Textarea } from "@animekaiser/ui/components/textarea"
import {
  useAtom,
  useAtomRefresh,
  useAtomSet,
  useAtomValue,
} from "@effect/atom-react"
import { useForm } from "@tanstack/react-form"
import { useRouter } from "@tanstack/react-router"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { UserRound } from "lucide-react"
import { useEffect, useRef } from "react"
import { toast } from "sonner"
import { DataError } from "../../components/data-error"
import { IconInput } from "../../components/icon-input"
import { toastFailure } from "../../utils/error"
import { sessionAtom, updateUserAtom } from "../auth/atoms"
import type { AppUser } from "../auth/user"
import { displayUsername, userInitials } from "../auth/user"
import {
  ownProfileAtom,
  profileMutationKeys,
  profileReactivityKeys,
  removeProfileImageAtom,
  updatePrivacyAtom,
  updateProfileAtom,
  uploadProfileImageAtom,
} from "../profile/atoms"
import { AuthRequired, SettingCard, SettingHeading } from "./settings-shared"

type UsernameFormValues = {
  username: string
}

type BioFormValues = {
  description: string
}

export function ProfilePanel({ user }: { user: AppUser | null }) {
  const router = useRouter()

  const avatarInput = useRef<HTMLInputElement>(null)
  const bannerInput = useRef<HTMLInputElement>(null)

  const profileResult = useAtomValue(ownProfileAtom)
  const refreshProfile = useAtomRefresh(ownProfileAtom)
  const refreshSession = useAtomRefresh(sessionAtom)

  const profile = AsyncResult.builder(profileResult)
    .onSuccess((value) => value)
    .orNull()

  const saveProfile = useAtomSet(updateProfileAtom, { mode: "promiseExit" })
  const [privacyResult, savePrivacy] = useAtom(updatePrivacyAtom, {
    mode: "promiseExit",
  })

  const [avatarUpload, uploadAvatar] = useAtom(
    uploadProfileImageAtom("avatar"),
    { mode: "promiseExit" }
  )
  const [bannerUpload, uploadBanner] = useAtom(
    uploadProfileImageAtom("banner"),
    { mode: "promiseExit" }
  )
  const [removal, removeProfileImage] = useAtom(removeProfileImageAtom, {
    mode: "promiseExit",
  })
  const updateUser = useAtomSet(updateUserAtom, { mode: "promiseExit" })
  const pending = {
    avatar: avatarUpload.waiting || removal.waiting,
    banner: bannerUpload.waiting || removal.waiting,
  }

  const usernameForm = useForm({
    defaultValues: { username: user ? displayUsername(user) : "" },
    onSubmit: ({ value }) => updateUsername(value),
  })
  const bioForm = useForm({
    defaultValues: { description: profile?.profile.description ?? "" },
    onSubmit: ({ value }) => updateBio(value),
  })

  useEffect(() => {
    usernameForm.reset({ username: user ? displayUsername(user) : "" })
  }, [user])

  useEffect(() => {
    bioForm.reset({ description: profile?.profile.description ?? "" })
  }, [profile?.profile.description])

  if (!user) return <AuthRequired />

  const profileError = AsyncResult.builder(profileResult)
    .onFailure(() => <DataError onRetry={refreshProfile} />)
    .orNull()

  const imageLabel = (kind: "avatar" | "banner") =>
    kind === "avatar" ? "Profile picture" : "Banner"

  const afterSave = (success: string | null) => {
    refreshProfile()
    if (success) toast.success(success)
    return router.invalidate()
  }

  const upload = (kind: "avatar" | "banner", file: File) =>
    (kind === "avatar" ? uploadAvatar : uploadBanner)(file).then((exit) => {
      if (toastFailure(`Unable to update ${kind}`)(exit))
        return afterSave(`${imageLabel(kind)} updated.`)
    })

  const remove = (kind: "avatar" | "banner") =>
    removeProfileImage({
      payload: { kind },
      reactivityKeys: profileMutationKeys,
    }).then((exit) => {
      if (toastFailure(`Unable to remove ${kind}`)(exit))
        return afterSave(`${imageLabel(kind)} removed.`)
    })

  const updateUsername = (values: UsernameFormValues) => {
    const username = values.username.trim()
    return updateUser({
      username,
      displayUsername: username,
      name: username,
    }).then((exit) => {
      if (!toastFailure("Unable to update username")(exit)) return
      refreshSession()
      return afterSave("Username updated.")
    })
  }

  const updateBio = (values: BioFormValues) =>
    saveProfile({
      payload: { description: values.description.trim() || null },
      reactivityKeys: profileMutationKeys,
    }).then((exit) => {
      if (toastFailure("Unable to update bio")(exit))
        return afterSave("Bio updated.")
    })

  const updatePrivacy = (patch: {
    private?: boolean
    shareStats?: boolean
    shareActivity?: boolean
    shareList?: boolean
  }) =>
    savePrivacy({
      payload: patch,
      reactivityKeys: profileReactivityKeys,
    }).then((exit) => {
      if (toastFailure("Unable to update privacy")(exit)) return afterSave(null)
    })

  const isPrivate = profile?.profile.private ?? false
  const username = user.username ?? user.name

  return (
    <div className="flex flex-col gap-4">
      <SettingCard id="profile.banner">
        <div
          className="h-32 rounded-2xl border bg-linear-to-br from-primary/25 via-muted to-background bg-cover bg-center md:h-40"
          style={
            profile?.profile.bannerUrl
              ? { backgroundImage: `url(${profile.profile.bannerUrl})` }
              : undefined
          }
        />
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <SettingHeading
              title="Profile banner"
              description="Wide JPEG, PNG, or WebP; maximum 5 MB."
            />
          </div>
          <div className="flex gap-2">
            <input
              ref={bannerInput}
              className="hidden"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void upload("banner", file)
              }}
            />
            <Button
              type="button"
              variant="outline"
              disabled={pending.banner}
              onClick={() => bannerInput.current?.click()}
            >
              Upload
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={pending.banner || !profile?.profile.bannerUrl}
              onClick={() => void remove("banner")}
            >
              Remove
            </Button>
          </div>
        </div>
      </SettingCard>
      <SettingCard id="profile.avatar">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar className="size-20">
              <AvatarImage src={user.image ?? undefined} />
              <AvatarFallback>{userInitials(user)}</AvatarFallback>
            </Avatar>
            <div>
              <SettingHeading
                title="Profile picture"
                description="Square images work best."
              />
            </div>
          </div>
          <div className="flex gap-2">
            <input
              ref={avatarInput}
              className="hidden"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void upload("avatar", file)
              }}
            />
            <Button
              type="button"
              variant="outline"
              disabled={pending.avatar}
              onClick={() => avatarInput.current?.click()}
            >
              Upload
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={pending.avatar || !user.image}
              onClick={() => void remove("avatar")}
            >
              Remove
            </Button>
          </div>
        </div>
      </SettingCard>
      <SettingCard id="profile.username">
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            void usernameForm.handleSubmit()
          }}
        >
          <SettingHeading
            title="Username"
            description="Used across the app and in your profile URL."
          />
          <usernameForm.Field name="username">
            {(field) => (
              <Field>
                <FieldLabel htmlFor={field.name}>Username</FieldLabel>
                <IconInput
                  id={field.name}
                  icon={UserRound}
                  name={field.name}
                  className="max-w-sm"
                  minLength={3}
                  maxLength={30}
                  pattern="[A-Za-z0-9_]+"
                  required
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                />
                <FieldDescription>
                  Letters, numbers, and underscores only.
                </FieldDescription>
              </Field>
            )}
          </usernameForm.Field>
          <usernameForm.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <Button className="w-fit" disabled={isSubmitting} type="submit">
                Save username
              </Button>
            )}
          </usernameForm.Subscribe>
        </form>
      </SettingCard>
      <SettingCard id="profile.bio">
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            void bioForm.handleSubmit()
          }}
        >
          <SettingHeading
            title="Bio"
            description="A short description shown on your profile."
          />
          <bioForm.Field name="description">
            {(field) => (
              <Field>
                <FieldLabel htmlFor={field.name}>Description</FieldLabel>
                <Textarea
                  id={field.name}
                  name={field.name}
                  maxLength={300}
                  rows={5}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                />
              </Field>
            )}
          </bioForm.Field>
          <bioForm.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <Button className="w-fit" disabled={isSubmitting} type="submit">
                Save bio
              </Button>
            )}
          </bioForm.Subscribe>
        </form>
      </SettingCard>
      <SettingCard id="profile.visibility">
        {profileError ?? (
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
              disabled={privacyResult.waiting}
              onCheckedChange={(value) =>
                void updatePrivacy({ private: value })
              }
            />
          </Field>
        )}
      </SettingCard>
      <SettingCard
        id="profile.sharing"
        className={isPrivate ? "opacity-60" : undefined}
      >
        <SettingHeading
          title="What visitors can see"
          description={
            isPrivate
              ? "Your profile is private, so none of this is shared right now."
              : "Choose which sections appear on your public profile."
          }
        />
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
              checked={profile?.profile.shareStats ?? true}
              disabled={privacyResult.waiting || isPrivate}
              onCheckedChange={(value) =>
                void updatePrivacy({ shareStats: value })
              }
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
              checked={profile?.profile.shareActivity ?? true}
              disabled={privacyResult.waiting || isPrivate}
              onCheckedChange={(value) =>
                void updatePrivacy({ shareActivity: value })
              }
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
              checked={profile?.profile.shareList ?? true}
              disabled={privacyResult.waiting || isPrivate}
              onCheckedChange={(value) =>
                void updatePrivacy({ shareList: value })
              }
            />
          </Field>
        </div>
      </SettingCard>
    </div>
  )
}

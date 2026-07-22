import { useForm } from "@tanstack/react-form"
import { useRouter } from "@tanstack/react-router"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import { Button } from "@workspace/ui/components/button"
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { Textarea } from "@workspace/ui/components/textarea"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import type { AppUser } from "../../lib/auth-client"
import {
  authClient,
  displayUsername,
  userInitials,
} from "../../lib/auth-client"
import { errorMessage } from "../../lib/error"
import {
  loadOwnProfile,
  removeProfileImage,
  saveProfile,
  uploadProfileImage,
} from "../profile/profile-rpc"
import { AuthRequired, PanelCard } from "./settings-shared"

type UsernameFormValues = {
  username: string
}

type BioFormValues = {
  description: string
}

export function ProfilePanel({
  open,
  user,
}: {
  open: boolean
  user: AppUser | null
}) {
  const router = useRouter()
  const avatarInput = useRef<HTMLInputElement>(null)
  const bannerInput = useRef<HTMLInputElement>(null)
  const [profile, setProfile] = useState<Awaited<
    ReturnType<typeof loadOwnProfile>
  > | null>(null)
  const [pending, setPending] = useState<string | null>(null)
  const usernameForm = useForm({
    defaultValues: { username: user ? displayUsername(user) : "" },
    onSubmit: ({ value }) => updateUsername(value),
  })
  const bioForm = useForm({
    defaultValues: { description: profile?.profile.description ?? "" },
    onSubmit: ({ value }) => updateBio(value),
  })

  const refresh = async () => {
    const next = await loadOwnProfile()
    setProfile(next)
    return next
  }
  useEffect(() => {
    if (open && user) void refresh()
  }, [open, user])
  useEffect(() => {
    usernameForm.reset({ username: user ? displayUsername(user) : "" })
  }, [user])
  useEffect(() => {
    bioForm.reset({ description: profile?.profile.description ?? "" })
  }, [profile?.profile.description])
  if (!user) return <AuthRequired />

  const upload = async (kind: "avatar" | "banner", file: File) => {
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      toast.error("Upload a JPEG, PNG, or WebP image up to 5 MB.")
      return
    }
    setPending(kind)
    try {
      await uploadProfileImage(kind, file)
      await refresh()
      await router.invalidate()
      toast.success(
        `${kind === "avatar" ? "Profile picture" : "Banner"} updated.`
      )
    } catch (reason) {
      toast.error(errorMessage(reason, `Unable to update ${kind}`))
    } finally {
      setPending(null)
    }
  }

  const remove = async (kind: "avatar" | "banner") => {
    setPending(kind)
    try {
      await removeProfileImage(kind)
      await refresh()
      await router.invalidate()
      toast.success(
        `${kind === "avatar" ? "Profile picture" : "Banner"} removed.`
      )
    } catch (reason) {
      toast.error(errorMessage(reason, `Unable to remove ${kind}`))
    } finally {
      setPending(null)
    }
  }

  const updateUsername = async (values: UsernameFormValues) => {
    const username = values.username.trim()
    try {
      const result = await authClient.updateUser({ username, name: username })
      if (result.error) throw result.error
      await router.invalidate()
      toast.success("Username updated.")
    } catch (reason) {
      toast.error(errorMessage(reason, "Unable to update username"))
    }
  }

  const updateBio = async (values: BioFormValues) => {
    const description = values.description.trim()
    try {
      setProfile(await saveProfile(description || null))
      await router.invalidate()
      toast.success("Bio updated.")
    } catch (reason) {
      toast.error(errorMessage(reason, "Unable to update bio"))
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PanelCard>
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
            <h3 className="font-semibold">Profile banner</h3>
            <p className="text-sm text-muted-foreground">
              Wide JPEG, PNG, or WebP; maximum 5 MB.
            </p>
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
              disabled={pending === "banner"}
              onClick={() => bannerInput.current?.click()}
            >
              Upload
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={pending === "banner" || !profile?.profile.bannerUrl}
              onClick={() => void remove("banner")}
            >
              Remove
            </Button>
          </div>
        </div>
      </PanelCard>
      <PanelCard>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar className="size-20">
              <AvatarImage src={user.image ?? undefined} />
              <AvatarFallback>{userInitials(user)}</AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-semibold">Profile picture</h3>
              <p className="text-sm text-muted-foreground">
                Square images work best.
              </p>
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
              disabled={pending === "avatar"}
              onClick={() => avatarInput.current?.click()}
            >
              Upload
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={pending === "avatar" || !user.image}
              onClick={() => void remove("avatar")}
            >
              Remove
            </Button>
          </div>
        </div>
      </PanelCard>
      <PanelCard>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            void usernameForm.handleSubmit()
          }}
        >
          <div>
            <h3 className="font-semibold">Username</h3>
            <p className="text-sm text-muted-foreground">
              Used across the app and in your profile URL.
            </p>
          </div>
          <usernameForm.Field name="username">
            {(field) => (
              <Field>
                <FieldLabel htmlFor={field.name}>Username</FieldLabel>
                <Input
                  id={field.name}
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
      </PanelCard>
      <PanelCard>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            void bioForm.handleSubmit()
          }}
        >
          <div>
            <h3 className="font-semibold">Bio</h3>
            <p className="text-sm text-muted-foreground">
              A short description shown on your profile.
            </p>
          </div>
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
      </PanelCard>
    </div>
  )
}

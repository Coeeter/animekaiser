import { useNavigate, useRouter } from "@tanstack/react-router"
import { Button } from "@workspace/ui/components/button"
import { FieldGroup } from "@workspace/ui/components/field"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@workspace/ui/components/form"
import { Input } from "@workspace/ui/components/input"
import { Spinner } from "@workspace/ui/components/spinner"
import { Trash2 } from "lucide-react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import type { AppUser } from "../../lib/auth-client"
import { authClient, displayUsername } from "../../lib/auth-client"
import { errorMessage } from "../../lib/error"
import { deleteAccount as deleteKaiserAccount } from "../profile/profile-rpc"
import { AuthRequired, PanelCard } from "./settings-shared"

type ChangePasswordValues = {
  currentPassword: string
  newPassword: string
  confirmation: string
}

type DeleteAccountValues = {
  deletePassword: string
}

export function AccountPanel({
  user,
  sessionExpiresAt,
}: {
  user: AppUser | null
  sessionExpiresAt: Date | null
}) {
  const router = useRouter()
  const navigate = useNavigate()
  const passwordForm = useForm<ChangePasswordValues>({
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmation: "",
    },
  })
  const deleteForm = useForm<DeleteAccountValues>({
    defaultValues: { deletePassword: "" },
  })
  if (!user) return <AuthRequired />

  const changePassword = async (values: ChangePasswordValues) => {
    if (values.newPassword !== values.confirmation) {
      passwordForm.setError("confirmation", {
        message: "Passwords do not match.",
      })
      return
    }
    try {
      const result = await authClient.changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
        revokeOtherSessions: false,
      })
      if (result.error) throw result.error
      passwordForm.reset()
      toast.success("Password updated.")
    } catch (reason) {
      toast.error(errorMessage(reason, "Unable to change password"))
    }
  }

  const deleteAccount = async (values: DeleteAccountValues) => {
    if (
      !window.confirm(
        "Delete your AnimeKaiser account permanently? This cannot be undone."
      )
    )
      return
    try {
      await deleteKaiserAccount(values.deletePassword)
      await authClient.signOut()
      await router.invalidate()
      await navigate({ to: "/" })
    } catch (reason) {
      toast.error(errorMessage(reason, "Unable to delete account"))
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 xl:grid-cols-2">
        <PanelCard>
          <h3 className="font-semibold">Identity</h3>
          <dl className="mt-4 flex flex-col gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Username</dt>
              <dd className="mt-1 font-medium">@{displayUsername(user)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Email</dt>
              <dd className="mt-1 font-medium">{user.email}</dd>
            </div>
          </dl>
        </PanelCard>
        <PanelCard>
          <h3 className="font-semibold">Access</h3>
          <dl className="mt-4 flex flex-col gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Last login method</dt>
              <dd className="mt-1 font-medium">
                {authClient.getLastUsedLoginMethod() ?? "Unknown"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Session expires</dt>
              <dd className="mt-1 font-medium">
                {sessionExpiresAt
                  ? sessionExpiresAt.toLocaleString()
                  : "Unknown"}
              </dd>
            </div>
          </dl>
        </PanelCard>
      </div>
      <PanelCard>
        <Form {...passwordForm}>
          <form
            className="flex flex-col gap-4"
            onSubmit={passwordForm.handleSubmit(changePassword)}
          >
            <div>
              <h3 className="font-semibold">Change password</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Use at least eight characters.
              </p>
            </div>
            <FieldGroup className="grid gap-4 lg:grid-cols-3">
              <FormField
                control={passwordForm.control}
                name="currentPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="current-password"
                        required
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={passwordForm.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="new-password"
                        minLength={8}
                        required
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={passwordForm.control}
                name="confirmation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="new-password"
                        minLength={8}
                        required
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </FieldGroup>
            <Button
              className="w-fit"
              disabled={passwordForm.formState.isSubmitting}
              type="submit"
            >
              {passwordForm.formState.isSubmitting ? (
                <Spinner data-icon="inline-start" />
              ) : null}
              Update password
            </Button>
          </form>
        </Form>
      </PanelCard>
      <PanelCard className="border-destructive/30">
        <Form {...deleteForm}>
          <form
            className="flex flex-col gap-4"
            onSubmit={deleteForm.handleSubmit(deleteAccount)}
          >
            <div>
              <h3 className="font-semibold text-destructive">
                Delete account
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Permanently remove your account and profile.
              </p>
            </div>
            <FormField
              control={deleteForm.control}
              name="deletePassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm with your password</FormLabel>
                  <FormControl>
                    <Input
                      className="max-w-sm"
                      type="password"
                      autoComplete="current-password"
                      required
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              className="w-fit"
              variant="destructive"
              disabled={deleteForm.formState.isSubmitting}
              type="submit"
            >
              {deleteForm.formState.isSubmitting ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <Trash2 data-icon="inline-start" />
              )}
              Delete account
            </Button>
          </form>
        </Form>
      </PanelCard>
    </div>
  )
}

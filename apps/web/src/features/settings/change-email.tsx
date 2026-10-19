import { Button } from "@animekaiser/ui/components/button"
import { Field, FieldGroup, FieldLabel } from "@animekaiser/ui/components/field"
import { Input } from "@animekaiser/ui/components/input"
import { Spinner } from "@animekaiser/ui/components/spinner"
import { useAtom, useAtomRefresh } from "@effect/atom-react"
import { useState } from "react"
import { toast } from "sonner"
import { toastFailure } from "../../utils/error"
import {
  changeEmailAtom,
  requestEmailChangeAtom,
  sendVerificationOtpAtom,
  sessionAtom,
} from "../auth/atoms"
import { SettingCard, SettingHeading } from "./settings-shared"

type Step =
  | { kind: "idle" }
  | { kind: "current" }
  | { kind: "new"; newEmail: string }

// Both mailboxes are confirmed with a code: the current one proves it's your
// account, the new one proves you can receive mail there.
export function ChangeEmailSection({ email }: { email: string }) {
  const refreshSession = useAtomRefresh(sessionAtom)
  const [step, setStep] = useState<Step>({ kind: "idle" })
  const [sendResult, sendCode] = useAtom(sendVerificationOtpAtom, {
    mode: "promiseExit",
  })
  const [requestResult, requestChange] = useAtom(requestEmailChangeAtom, {
    mode: "promiseExit",
  })
  const [changeResult, changeEmail] = useAtom(changeEmailAtom, {
    mode: "promiseExit",
  })
  const pending =
    sendResult.waiting || requestResult.waiting || changeResult.waiting
  const [newEmail, setNewEmail] = useState("")
  const [code, setCode] = useState("")

  const start = () =>
    sendCode({ email, type: "email-verification" }).then((exit) => {
      if (!toastFailure("Unable to send a code to your email")(exit)) return
      setCode("")
      setStep({ kind: "current" })
      toast.success(`We sent a code to ${email}.`)
    })

  const confirmCurrent = () => {
    const target = newEmail.trim()
    return requestChange({ newEmail: target, otp: code }).then((exit) => {
      if (!toastFailure("Unable to start the email change")(exit)) return
      setCode("")
      setStep({ kind: "new", newEmail: target })
      toast.success(`We sent a code to ${target}.`)
    })
  }

  const confirmNew = (target: string) =>
    changeEmail({ newEmail: target, otp: code }).then((exit) => {
      if (!toastFailure("Unable to change your email")(exit)) return
      setStep({ kind: "idle" })
      setNewEmail("")
      setCode("")
      refreshSession()
      toast.success("Email updated.")
    })

  const cancel = () => {
    setStep({ kind: "idle" })
    setNewEmail("")
    setCode("")
  }

  return (
    <SettingCard id="account.email">
      <SettingHeading
        title="Email"
        description="Used to sign in with a code and to recover your account."
      />
      {step.kind === "idle" ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium">{email}</p>
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => void start()}
          >
            {pending ? <Spinner data-icon="inline-start" /> : null}
            Change email
          </Button>
        </div>
      ) : (
        <form
          className="mt-4"
          onSubmit={(event) => {
            event.preventDefault()
            if (step.kind === "current") void confirmCurrent()
            else void confirmNew(step.newEmail)
          }}
        >
          <FieldGroup>
            {step.kind === "current" ? (
              <>
                <Field>
                  <FieldLabel htmlFor="current-email-code">
                    Code sent to {email}
                  </FieldLabel>
                  <Input
                    id="current-email-code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="new-email">New email</FieldLabel>
                  <Input
                    id="new-email"
                    type="email"
                    autoComplete="email"
                    value={newEmail}
                    onChange={(event) => setNewEmail(event.target.value)}
                    required
                  />
                </Field>
              </>
            ) : (
              <Field>
                <FieldLabel htmlFor="new-email-code">
                  Code sent to {step.newEmail}
                </FieldLabel>
                <Input
                  id="new-email-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  required
                />
              </Field>
            )}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={cancel}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? <Spinner data-icon="inline-start" /> : null}
                {step.kind === "current" ? "Continue" : "Change email"}
              </Button>
            </div>
          </FieldGroup>
        </form>
      )}
    </SettingCard>
  )
}

import type { AuthMailer } from "@animekaiser/auth/server"
import { Resend } from "resend"

export const createResendAuthMailer = (config: {
  apiKey: string
  from: string
}): AuthMailer => {
  const resend = new Resend(config.apiKey)

  return {
    sendEmailOtp: ({ email, otp, type }) =>
      resend.emails
        .send({
          from: config.from,
          to: email,
          subject: "Your Kaiser verification code",
          text: `Your Kaiser ${type} code is ${otp}.`,
        })
        .then(() => undefined),
  }
}

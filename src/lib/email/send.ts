import 'server-only'
import { Resend } from 'resend'

interface SendEmailOptions {
  to: string
  subject: string
  text: string
  html?: string
}

interface SendEmailResult {
  ok: true
  id: string
}

interface SendEmailError {
  ok: false
  error: string
}

export async function sendEmail(
  opts: SendEmailOptions
): Promise<SendEmailResult | SendEmailError> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.error('[sendEmail] RESEND_API_KEY is not set')
    return { ok: false, error: 'Email service not configured' }
  }

  const from = process.env.EMAIL_FROM
  if (!from) {
    console.error('[sendEmail] EMAIL_FROM is not set')
    return { ok: false, error: 'EMAIL_FROM is not configured' }
  }

  const resend = new Resend(apiKey)

  try {
    const { data, error } = await resend.emails.send({
      from,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      ...(opts.html !== undefined && { html: opts.html }),
      ...(process.env.EMAIL_REPLY_TO && { replyTo: process.env.EMAIL_REPLY_TO }),
    })

    if (error) {
      console.error('[sendEmail] Resend error:', error)
      return { ok: false, error: error.message }
    }

    return { ok: true, id: data!.id }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[sendEmail] Unexpected error:', message)
    return { ok: false, error: message }
  }
}

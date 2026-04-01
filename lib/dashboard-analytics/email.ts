import 'server-only'

import nodemailer from 'nodemailer'

type AnalyticsEmailAttachment = {
  filename: string
  content: Buffer
  contentType: string
}

let cachedTransporter: nodemailer.Transporter | null = null

function isTruthy(value: string | undefined) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase())
}

export function hasAnalyticsEmailTransportConfig() {
  return Boolean(
    process.env.SMTP_HOST &&
    process.env.SMTP_PORT &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS &&
    process.env.EMAIL_FROM
  )
}

function getAnalyticsEmailTransporter() {
  if (cachedTransporter) {
    return cachedTransporter
  }

  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT || 0)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  if (!host || !port || !user || !pass) {
    throw new Error('Missing SMTP_HOST, SMTP_PORT, SMTP_USER or SMTP_PASS for analytics email delivery')
  }

  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure: isTruthy(process.env.SMTP_SECURE),
    auth: {
      user,
      pass,
    },
  })

  return cachedTransporter
}

export async function sendAnalyticsEmail(input: {
  to: string
  subject: string
  html: string
  text: string
  attachments?: AnalyticsEmailAttachment[]
}) {
  const from = process.env.EMAIL_FROM
  if (!from) {
    throw new Error('Missing EMAIL_FROM for analytics email delivery')
  }

  const transporter = getAnalyticsEmailTransporter()
  await transporter.sendMail({
    from,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
    attachments: (input.attachments || []).map((item) => ({
      filename: item.filename,
      content: item.content,
      contentType: item.contentType,
    })),
  })
}

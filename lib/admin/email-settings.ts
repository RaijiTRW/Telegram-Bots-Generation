import 'server-only'

import net from 'net'
import tls from 'tls'
import nodemailer from 'nodemailer'
import { createAdminClient } from '@/lib/supabase/admin'
import { decryptSecret, encryptSecret } from '@/lib/security/secret-encryption'

type EmailSettingsRow = {
  smtp_host: string | null
  smtp_port: number | null
  smtp_secure: boolean | null
  smtp_user: string | null
  smtp_from: string | null
  smtp_password_algorithm: string | null
  smtp_password_iv: string | null
  smtp_password_ciphertext: string | null
  smtp_password_auth_tag: string | null
  imap_host: string | null
  imap_port: number | null
  imap_secure: boolean | null
  imap_user: string | null
  imap_password_algorithm: string | null
  imap_password_iv: string | null
  imap_password_ciphertext: string | null
  imap_password_auth_tag: string | null
}

export type AdminEmailSettingsForm = {
  smtpHost: string
  smtpPort: number
  smtpSecure: boolean
  smtpUser: string
  smtpFrom: string
  smtpPassword?: string
  imapHost: string
  imapPort: number
  imapSecure: boolean
  imapUser: string
  imapPassword?: string
}

export type AdminEmailSettingsView = Omit<AdminEmailSettingsForm, 'smtpPassword' | 'imapPassword'> & {
  smtpPasswordConfigured: boolean
  imapPasswordConfigured: boolean
}

function normalizePort(value: unknown, fallback: number) {
  const port = Number(value)
  return Number.isFinite(port) && port > 0 ? Math.round(port) : fallback
}

function envSmtpSettings() {
  return {
    host: process.env.SMTP_HOST || '',
    port: normalizePort(process.env.SMTP_PORT, 465),
    secure: ['1', 'true', 'yes', 'on'].includes(String(process.env.SMTP_SECURE || '').toLowerCase()),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.EMAIL_FROM || process.env.SMTP_USER || '',
  }
}

function decryptSmtpPassword(row: EmailSettingsRow | null) {
  return decryptSecret(row && {
    algorithm: row.smtp_password_algorithm,
    iv: row.smtp_password_iv,
    ciphertext: row.smtp_password_ciphertext,
    auth_tag: row.smtp_password_auth_tag,
  })
}

function decryptImapPassword(row: EmailSettingsRow | null) {
  return decryptSecret(row && {
    algorithm: row.imap_password_algorithm,
    iv: row.imap_password_iv,
    ciphertext: row.imap_password_ciphertext,
    auth_tag: row.imap_password_auth_tag,
  })
}

export async function getAdminEmailSettings(): Promise<AdminEmailSettingsView> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('admin_email_settings')
    .select('*')
    .eq('id', 1)
    .maybeSingle()

  const row = (data || null) as EmailSettingsRow | null
  const env = envSmtpSettings()

  return {
    smtpHost: row?.smtp_host || env.host,
    smtpPort: row?.smtp_port || env.port,
    smtpSecure: row?.smtp_secure ?? env.secure,
    smtpUser: row?.smtp_user || env.user,
    smtpFrom: row?.smtp_from || env.from,
    smtpPasswordConfigured: Boolean(row?.smtp_password_ciphertext || env.pass),
    imapHost: row?.imap_host || '',
    imapPort: row?.imap_port || 993,
    imapSecure: row?.imap_secure ?? true,
    imapUser: row?.imap_user || '',
    imapPasswordConfigured: Boolean(row?.imap_password_ciphertext),
  }
}

export async function saveAdminEmailSettings(input: AdminEmailSettingsForm, updatedBy: string) {
  const admin = createAdminClient()
  const { data: existing } = await admin
    .from('admin_email_settings')
    .select('*')
    .eq('id', 1)
    .maybeSingle()

  const current = (existing || null) as EmailSettingsRow | null
  const smtpPassword = String(input.smtpPassword || '').trim()
  const imapPassword = String(input.imapPassword || '').trim()
  const smtpEncrypted = smtpPassword ? encryptSecret(smtpPassword) : null
  const imapEncrypted = imapPassword ? encryptSecret(imapPassword) : null

  const payload: Record<string, unknown> = {
    id: 1,
    smtp_host: input.smtpHost.trim() || null,
    smtp_port: normalizePort(input.smtpPort, 465),
    smtp_secure: Boolean(input.smtpSecure),
    smtp_user: input.smtpUser.trim() || null,
    smtp_from: input.smtpFrom.trim() || null,
    imap_host: input.imapHost.trim() || null,
    imap_port: normalizePort(input.imapPort, 993),
    imap_secure: Boolean(input.imapSecure),
    imap_user: input.imapUser.trim() || null,
    updated_by: updatedBy,
  }

  if (smtpEncrypted) {
    payload.smtp_password_algorithm = smtpEncrypted.algorithm
    payload.smtp_password_key_version = smtpEncrypted.key_version
    payload.smtp_password_iv = smtpEncrypted.iv
    payload.smtp_password_ciphertext = smtpEncrypted.ciphertext
    payload.smtp_password_auth_tag = smtpEncrypted.auth_tag
  } else if (!current?.smtp_password_ciphertext) {
    payload.smtp_password_algorithm = null
    payload.smtp_password_key_version = null
    payload.smtp_password_iv = null
    payload.smtp_password_ciphertext = null
    payload.smtp_password_auth_tag = null
  }

  if (imapEncrypted) {
    payload.imap_password_algorithm = imapEncrypted.algorithm
    payload.imap_password_key_version = imapEncrypted.key_version
    payload.imap_password_iv = imapEncrypted.iv
    payload.imap_password_ciphertext = imapEncrypted.ciphertext
    payload.imap_password_auth_tag = imapEncrypted.auth_tag
  } else if (!current?.imap_password_ciphertext) {
    payload.imap_password_algorithm = null
    payload.imap_password_key_version = null
    payload.imap_password_iv = null
    payload.imap_password_ciphertext = null
    payload.imap_password_auth_tag = null
  }

  const { error } = await admin.from('admin_email_settings').upsert(payload as never)
  if (error) {
    throw new Error(error.message)
  }
}

async function getSmtpTransportConfig() {
  const admin = createAdminClient()
  const { data } = await admin
    .from('admin_email_settings')
    .select('*')
    .eq('id', 1)
    .maybeSingle()

  const row = (data || null) as EmailSettingsRow | null
  const env = envSmtpSettings()
  const pass = decryptSmtpPassword(row) || env.pass
  const host = row?.smtp_host || env.host
  const port = row?.smtp_port || env.port
  const user = row?.smtp_user || env.user
  const from = row?.smtp_from || env.from

  if (!host || !port || !user || !pass || !from) {
    throw new Error('SMTP settings are incomplete')
  }

  return {
    host,
    port,
    secure: row?.smtp_secure ?? env.secure,
    auth: { user, pass },
    from,
  }
}

export async function sendAdminEmail(input: { to: string; subject: string; text: string; html: string }) {
  const config = await getSmtpTransportConfig()
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
  })

  await transporter.sendMail({
    from: config.from,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  })
}

export async function verifySmtpConnection() {
  const config = await getSmtpTransportConfig()
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
  })
  await transporter.verify()
}

export async function verifyImapConnection() {
  const admin = createAdminClient()
  const { data } = await admin
    .from('admin_email_settings')
    .select('*')
    .eq('id', 1)
    .maybeSingle()

  const row = (data || null) as EmailSettingsRow | null
  const host = row?.imap_host
  const port = row?.imap_port || 993
  const user = row?.imap_user
  const pass = decryptImapPassword(row)

  if (!host || !port || !user || !pass) {
    throw new Error('IMAP settings are incomplete')
  }

  await new Promise<void>((resolve, reject) => {
    const socket = row?.imap_secure
      ? tls.connect({ host, port, servername: host })
      : net.connect({ host, port })
    const timeout = windowlessTimeout(() => {
      socket.destroy()
      reject(new Error('IMAP connection timed out'))
    }, 10_000)

    socket.once('data', (chunk) => {
      const greeting = chunk.toString('utf8')
      if (!greeting.includes('OK')) {
        clearTimeout(timeout)
        socket.destroy()
        reject(new Error('IMAP server did not return OK greeting'))
        return
      }
      socket.write(`a1 LOGIN "${escapeImap(user)}" "${escapeImap(pass)}"\r\n`)
    })

    socket.on('data', (chunk) => {
      const response = chunk.toString('utf8')
      if (response.includes('a1 OK')) {
        clearTimeout(timeout)
        socket.end('a2 LOGOUT\r\n')
        resolve()
      } else if (response.includes('a1 NO') || response.includes('a1 BAD')) {
        clearTimeout(timeout)
        socket.destroy()
        reject(new Error('IMAP login failed'))
      }
    })

    socket.once('error', (error) => {
      clearTimeout(timeout)
      reject(error)
    })
  })
}

function escapeImap(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function windowlessTimeout(callback: () => void, ms: number) {
  return setTimeout(callback, ms)
}

const trim = (s: string | undefined) => (s ?? "").trim();

export const env = {
  clientSlug: trim(process.env.CLIENT_SLUG) || "farm-pizza",
  siteUrl: (trim(process.env.NEXT_PUBLIC_SITE_URL) || "http://localhost:3000").replace(/\/+$/, ""),
  stripeSecretKey: trim(process.env.STRIPE_SECRET_KEY),
  stripeWebhookSecret: trim(process.env.STRIPE_WEBHOOK_SECRET),
  stripePublishableKey: trim(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY),
  // Plain SMTP, not a vendor SDK. Every provider worth using speaks SMTP -
  // including the shop's own mailbox - so this is the setting that does not
  // have to be revisited if the mail host changes.
  smtpHost: trim(process.env.SMTP_HOST),
  smtpPort: Number(trim(process.env.SMTP_PORT)) || 587,
  smtpUser: trim(process.env.SMTP_USER),
  smtpPass: trim(process.env.SMTP_PASS),
  // Implicit TLS on 465, STARTTLS on 587/25. Overridable, but the port is right
  // often enough that making it explicit only invites getting it wrong.
  smtpSecure: trim(process.env.SMTP_SECURE)
    ? trim(process.env.SMTP_SECURE) === "true"
    : Number(trim(process.env.SMTP_PORT)) === 465,
  mailFrom: trim(process.env.MAIL_FROM),
  twilioSid: trim(process.env.TWILIO_ACCOUNT_SID),
  twilioToken: trim(process.env.TWILIO_AUTH_TOKEN),
  twilioFrom: trim(process.env.TWILIO_FROM),
  kitchenPin: trim(process.env.KITCHEN_PIN),
  adminPassword: trim(process.env.ADMIN_PASSWORD),
  launchflowKey: trim(process.env.LAUNCHFLOW_KEY),
  // Raw value. Deliberately not validated here: this module is evaluated during
  // `next build`, which runs as production without runtime secrets, so throwing
  // here would break the build rather than the deployment. lib/auth.ts checks it
  // at the moment a cookie is signed or read, which is when it actually matters.
  sessionSecret: trim(process.env.SESSION_SECRET),
  cronSecret: trim(process.env.CRON_SECRET),
  googlePlacesKey: trim(process.env.GOOGLE_PLACES_API_KEY),
  isProd: process.env.NODE_ENV === "production",
};

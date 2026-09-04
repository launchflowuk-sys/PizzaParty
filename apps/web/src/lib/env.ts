const trim = (s: string | undefined) => (s ?? "").trim();

export const env = {
  clientSlug: trim(process.env.CLIENT_SLUG) || "farm-pizza",
  siteUrl: (trim(process.env.NEXT_PUBLIC_SITE_URL) || "http://localhost:3000").replace(/\/+$/, ""),
  stripeSecretKey: trim(process.env.STRIPE_SECRET_KEY),
  stripeWebhookSecret: trim(process.env.STRIPE_WEBHOOK_SECRET),
  stripePublishableKey: trim(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY),
  resendApiKey: trim(process.env.RESEND_API_KEY),
  resendFrom: trim(process.env.RESEND_FROM),
  twilioSid: trim(process.env.TWILIO_ACCOUNT_SID),
  twilioToken: trim(process.env.TWILIO_AUTH_TOKEN),
  twilioFrom: trim(process.env.TWILIO_FROM),
  kitchenPin: trim(process.env.KITCHEN_PIN),
  adminPassword: trim(process.env.ADMIN_PASSWORD),
  launchflowKey: trim(process.env.LAUNCHFLOW_KEY),
  // Falls back to a known string for local work only. In production an unset
  // secret would let anyone forge a signed admin cookie, so it is fatal there.
  sessionSecret: trim(process.env.SESSION_SECRET)
    || (process.env.NODE_ENV === "production"
      ? (() => { throw new Error("SESSION_SECRET must be set in production"); })()
      : "dev-insecure-secret-change-me"),
  cronSecret: trim(process.env.CRON_SECRET),
  isProd: process.env.NODE_ENV === "production",
};

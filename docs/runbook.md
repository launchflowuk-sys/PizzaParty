# Farm Pizza — runbook

Everything about the live shop that is not in the code. Written 5 September 2026.

---

## Where it lives

| | |
|---|---|
| Site | https://farm-pizza.shop (and `www.`) |
| Server | Hetzner `46.225.104.128` — Ubuntu 26.04, 2 vCPU, 3.7GB, 38GB |
| Panel | Coolify 4.3.17 at http://46.225.104.128:8000 |
| Repo | `launchflowuk-sys/PizzaParty`, deploys from `main` |
| Database | Postgres 16 in Coolify, internal only, never exposed |
| SSH | `ssh -i ~/.ssh/hetzner_ed25519 root@46.225.104.128` — key only, passwords off |

Host key, verify on first connect from a new machine:
`SHA256:5CBWwIw6F5TawIuIsqltiOkNt+ezDv74jPxopkD9eec`

---

## Secrets

Production values live in **`/root/farm-pizza/prod-secrets.env`** on the server,
`chmod 600`. They were generated there and have never been on a laptop.

Coolify holds its own copy as environment variables on the application. Changing
one means changing it in **both** places, or the next redeploy puts the old value
back.

⚠️ **Not yet rotated:** the shop password and kitchen PIN were shared in a chat
transcript during setup. Rotate both before the shop trades for real.

---

## Backups

Two layers, both nightly, both on the server:

| | |
|---|---|
| `02:30` | `/usr/local/bin/farm-pizza-backup` → `/var/backups/farm-pizza/`, kept 14 days |
| `03:00` | Coolify's own scheduled backup, kept 14 |

The script refuses to keep a dump that fails a gzip test or comes out under 20KB,
because a backup nobody has read back is not a backup.

**Restore into a scratch database to check one — never straight over the live
data:**

```bash
CID=$(docker ps --filter 'name=xubvmal' --format '{{.Names}}' | head -1)
F=$(ls -t /var/backups/farm-pizza/*.sql.gz | head -1)
docker exec "$CID" psql -U farmpizza -d postgres -c 'CREATE DATABASE restore_test;'
gunzip -c "$F" | docker exec -i "$CID" psql -U farmpizza -d restore_test
# check it, then:
docker exec "$CID" psql -U farmpizza -d postgres -c 'DROP DATABASE restore_test;'
```

### ⚠️ These are not off-site yet

Both copies are on the same disk as the database. If that disk goes, they go
with it. This is the single largest remaining risk to the business, because the
menu now lives only in this database — config cannot rebuild it.

**To fix:** a Hetzner Storage Box (~€3/month) or any S3 bucket, added under
Coolify → Storages, then tick *Save to S3* on the backup. Fifteen minutes once
the credentials exist.

---

## Disk

**A full disk takes the whole site down** — Postgres cannot write its lock file,
crash-loops, and every page returns 503. This happened once, on 5 September,
after about ten deploys in a day filled 38GB with build cache.

Now capped: BuildKit at 6GB, container logs at 10MB × 3, and a weekly prune in
`/etc/cron.weekly/docker-prune`.

**If the site 503s, check the disk first:**

```bash
df -h /
docker system df
docker builder prune -af --keep-storage 6GB   # safe, only slows the next build
docker image prune -af                        # safe, keeps anything running
```

---

## Deploying

Push to `main`, then **hit Deploy in Coolify**. Roughly **10 minutes** on this
box — the Next.js compile is CPU-bound and 2 vCPU is the bottleneck. A larger
instance is the single best improvement to the working loop.

> **A push does not deploy on its own.** "Auto deploy" is switched on in
> Coolify, but this application was created from a deploy key rather than the
> GitHub App, so nothing on GitHub's side ever calls the webhook — the setting
> is on and there is nothing to trigger it. Every deploy so far has been
> started by hand. Until the webhook is wired up, code can sit on `main` for
> hours looking deployed when it is not, which is a nasty way to lose an
> afternoon. Wiring it: copy the application's webhook URL from Coolify
> (Application → Webhooks) and add it to the repo under Settings → Webhooks.

Migrations and the seed run automatically on boot. The seed **does not touch the
menu** — see `MenuMode` in `packages/db/src/seed-client.ts`. The shop owns its
menu; config only supplies the opening one.

**A half-applied migration blocks startup.** If the entrypoint loops on `P3009`,
the fix is to mark it resolved once the schema is actually correct — do not
delete migration rows blindly.

---

## Images

Product photographs are optimised on demand into AVIF and cached on a volume at
`/app/apps/web/.next/cache/images`, so the cost is paid once rather than on every
deploy. First request per size is ~550ms; cached is ~27ms.

The volume must be writable by uid 100 (`app`). The Dockerfile creates the
directory so Docker seeds the volume with the right ownership — without that it
comes up root-owned and caching silently switches itself off.

---

# What still needs you

## 1. Off-site backups — *do this first*

Cheapest insurance against the worst outcome. Needs a Storage Box or S3 bucket.

## 2. Rotate the shared secrets

Shop password and kitchen PIN were in a chat. Change both in Coolify's
environment variables **and** in `/root/farm-pizza/prod-secrets.env`.

## 3. Staff PINs

Seeded staff have no usable PIN now. Real staff need adding on **Staff → Add
somebody**, and the demo names removing. Nobody can sign in until this is done.

## 4. Stripe — blocks card payments

Three values, into Coolify → the application → Environment Variables:

- `STRIPE_SECRET_KEY` — `sk_live_…`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — `pk_live_…`
- `STRIPE_WEBHOOK_SECRET` — `whsec_…`

Then add the webhook in Stripe pointing at
`https://farm-pizza.shop/api/stripe/webhook` for `payment_intent.succeeded`,
`payment_intent.payment_failed`, `charge.refunded`.

**Paste them yourself rather than sending them.** A live secret key moves real
money and does not belong in a chat transcript.

Cash on collection and delivery already work.

## 5. Twilio and SMTP — the shop is silent without these

- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` (a UK number)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`

Email is plain SMTP through Nodemailer — the shop's own mailbox, or any host
that speaks SMTP. No sending API, no second vendor, and swapping mail hosts is
these five variables rather than a code change. Port 465 is implicit TLS, 587 is
STARTTLS; `SMTP_SECURE` follows the port unless it is set explicitly.

Whichever host it is, publish **SPF and DKIM** for the sending domain. Without
them receipts land in spam, and the shop only finds out when a customer says
they never got one.

Until these exist there are **no order confirmations, no kitchen alert, and
campaigns report as sent while delivering nothing** — which is the most
misleading failure in the system, because it looks like it worked.

A UK Twilio number needs a registered address and can take a day or two.

## 6. Deal supplements — a commercial decision

The machinery is built. Somebody has to decide what the shop actually charges
extra for inside a meal deal. Ask the owner what they do today about premium
toppings — they will already have a rule.

## 7. The photographs

All 37 are generated and wired. Worth putting to the owner that real photographs
of their own food usually outperform generated ones for a local takeaway,
because people recognise their own dinner — and that an advert has to match what
turns up.

## 8. A bigger server

2 vCPU makes every deploy a ten-minute wait. CX32 (4 vCPU / 8GB) would roughly
halve it. Resizing keeps the IP and the disk, so nothing here needs
reconfiguring.

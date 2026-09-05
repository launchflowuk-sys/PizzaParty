---
id: launchflow-panel
title: The LaunchFlow panel
summary: The agency-only health check, and why Reload config undoes changes the shop has made.
kind: guide
screens: [launchflow]
roles: []
keywords: [launchflow, agency, key, health check, reseed, reload config, re-seed, seed, config hash, stripe, webhook, twilio, resend, dry run, dry-run, test notifications, domains, clear cache, deploy]
requires: [agency]
updated: 2026-09-05
---

This screen is LaunchFlow's, not the shop's. It needs LaunchFlow's own key on top of a normal sign-in, so a manager who can open every other screen still gets turned away here with *"Agency key required."*

It has no place in a shop's day. If somebody at {shop} is reading this, the answer to whatever you are looking at is almost certainly "ring LaunchFlow".

## What this page checks

One table, read top to bottom, is the whole health check for this shop:

- **Client slug** and **Seeded** — whether the shop exists in the database at all, and the hash of the settings it was built from. *"NO — run pnpm seed"* means nothing has been loaded yet.
- **Counts** — live products, orders and customers. A products count that does not match the menu is the first sign a reload has not run.
- **Site URL** — what the software believes its own public address is. This is what signed links and webhook checks are built from, so a wrong value here breaks things a long way away.
- **Stripe** — the connected account, then *charges enabled* or **DISABLED**, and *payouts enabled* or **DISABLED**. Disabled charges means the shop cannot take card payments, whatever the storefront looks like.
- **Webhook secret** — *set*, or **MISSING**. Missing means orders are paid for and never confirmed.
- **SMS (Twilio)** and **Email (Resend)** — *configured*, or *dry-run (logs only)*. See **Dry-run mode**.
- **Kitchen notify** — which of text, email and printer the kitchen gets. For this shop it reads **none set**.
- **Review URL** — the Google link the review-request text carries. Blank switches those texts off entirely.
- **Domains** — a live check of the main domain, its www form and every legacy domain, each with the status it returned. Anything that is not a 200 or a redirect to the right place is a live problem.

Below the table are four buttons. Each one prints its raw result underneath, and that result is the only feedback you get.

## Reload config is destructive

**Reload config → DB** re-reads the shop's settings from disk and re-runs the full setup against the live database. There is no confirmation, no preview and no dry run. It takes effect the moment you press it.

It **overwrites, without warning**, everything the shop has changed in the back office that also lives in the settings file:

- prices, product names, descriptions and photos
- sold-out flags — anything the shop marked off tonight comes back on the menu
- hidden items — anything the shop took off the menu is made visible again
- opening hours, wiped and rewritten
- delivery bands, deleted and rewritten from the file, so a band added in the back office disappears
- deal prices and their featured flags
- stock on-hand and par levels, back to the numbers in the file
- driver status
- **staff roles, hours and who is on shift** — a role change a manager made on the Staff screen is silently undone
- an automation's settings, though not whether it is switched on

What it leaves alone: orders, customers, reviews once any exist, promo codes created in the back office, and staff PINs once they have been set.

Two consequences worth holding on to. **Never press this during service** — it will put sold-out items back on sale mid-Friday. And **before you press it, ask what the shop has changed since the last reload**, because whatever they say is about to be lost unless it is in the file first.

## Reload does not remove

Reload runs without the reset flag, which means it only ever adds and updates. It never deactivates.

So a product, category, deal or location deleted from the settings file **stays live on the shop's site** after a reload. The row is simply never touched again. Config-defined promo codes are also re-enabled every time, so one that was disabled in the back office comes back on.

Taking something off properly needs the seeding command run with `--reset` from the command line. If the shop has rung up saying a deleted item is still orderable, that is the reason, and this button is not the fix.

**Clear menu cache** re-reads the settings file and drops the cached menu without touching the database. That is the safe button. Use it when the file has changed and the site has not caught up.

## Test kitchen notifications

**Test kitchen notifications** tries all three kitchen channels — text, email and printer — and prints what each one did.

On this shop it returns **skipped** for all three, because the kitchen text number, the kitchen email address and the printer webhook are all empty. Skipped is not a failure; there is simply nothing configured to test.

It is worth being blunt about what that means for the shop: **nothing outside the kitchen tablet is told when an order arrives.** No text, no email, no docket. If that tab is closed or the tablet sleeps, orders pile up unseen. Filling in any one of those three is the single biggest reliability improvement available to this shop.

**Run review-request job** fires the review texts by hand for any completed order that is due one. Use it to prove the job works; the scheduler is what should be running it.

## Dry-run mode

When the **SMS (Twilio)** or **Email (Resend)** row reads *dry-run (logs only)*, messages are written to the server log and nothing leaves the building.

This screen is the only place in the entire system that says so, and only LaunchFlow can open it. Everywhere else behaves as though the message went:

- the order's history records the text as sent
- the customer is never told their order was accepted, rejected or on its way
- customer sign-in codes never arrive, so nobody can get into their account
- review requests, referral rewards and campaigns are all recorded as sent, charged at 4p each, and counted into the shop's marketing figures — so **every number on the Marketing screen from a dry-run period is fiction**

One more, and it is the one that carries legal weight: with Twilio unconfigured the inbound message webhook refuses every request outright, so **a customer texting STOP is not acted on**. Their opt-out is neither recorded nor honoured. There is no row on this page that shows whether inbound is wired up — check the number's own webhook setting directly.

If a shop reports that customers are getting no texts, this is the first row to look at, and the fix is credentials, not code.

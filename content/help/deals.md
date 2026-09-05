---
id: deals
title: Building deals, repricing them, and switching them on and off
summary: Build a meal deal from nothing, change what is in one, reprice it, and pick the days it runs.
kind: guide
screens: [deals]
roles: []
keywords: [deal, deals, meal deal, family meal, offer, bundle, deal price, put deal price up, turn off a deal, stop a deal, featured, most popular, tuesday deal, add a deal, change a deal, new deal, delete a deal, build a deal]
requires: []
updated: 2026-09-05
---

The Deals screen lists the shop's meal deals — eight of them today: Meal for 1, Meal for 2,
Family Meal 1, Family Meal 3, Mega Deal, and the three multi-pizza deals. Each row shows
what is in the deal, its price, and whether it is running, with an **Edit** button that
opens the whole thing.

**All of it is yours to change.** The price, the name, what goes in it, which sizes are
allowed, which days it runs, and building a brand new one from nothing. This used to be a
config file only LaunchFlow could touch; it is not any more, and nothing you change here is
overwritten when the site is updated.

## Building a new deal

At the bottom of the list, give it a name and a price and press **Create deal**. It is made
**switched off** on purpose — it has nothing in it yet, and a deal with nothing in it would
take the customer's money and hand them an empty basket. You are taken straight to it to say
what goes in.

## What goes in a deal

A deal is a list of **lines**. Each line is a quantity, a name the customer reads, and the
rule for what may fill it — for example `2 × Large pizza`.

For each line you set:

- **Anything from these sections.** Tick Pizzas and the line takes any pizza — including one
  you add next month. This is the usual answer.
- **Or only these exact items.** For a deal built around three specific pizzas. Be aware that
  anything you add to the menu later will *not* be in it until you come back and tick it.
- **Only these sizes.** Tick none to allow any size.
- **Charge for extra toppings on top.** On by default. Untick it and a customer can load the
  deal pizza with extras for nothing.

A line has to accept *something*. If you tick no sections and pick no items, the screen
refuses to save it and tells you so — otherwise the customer would reach an empty picker and
be unable to get past it.

**Removing the last line switches the deal off.** That is deliberate: an empty deal on sale
is a deal that charges for nothing.

## Repricing a deal

Type over the number in the **£** box and press **Save**. It is live straight away.

**Type a real number.** Anything that is not a number saves as **£0.00** rather than being
refused, and the deal goes out free. Look at the box after you save.

## Taking a deal off

Two ways, and they are not the same thing:

- **Untick Running** and Save. It disappears from the website immediately but keeps its
  price and its contents, ready for next time. This is the one you want almost always.
- **Delete** removes it for good. Orders that already used it are unaffected — they keep
  their own copy of what was sold and what it cost — but the deal itself is gone and would
  have to be rebuilt.

## Days and delivery or collection

Both are on the deal's own screen now.

- **Days it runs.** Tick the days. Tick none for every day. So a genuine Tuesday-only deal
  is a matter of ticking Tue, rather than somebody remembering to switch it on and off twice
  a week.
- **Available for.** Tick delivery, collection, or neither for both.

One thing to know about days: the day is worked out from the server's clock, not from Grays
time. For a shop trading through to two and three in the morning that matters — an order
taken at half past midnight can land on the wrong side of midnight as far as the rule is
concerned. If a late-night deal matters to you, say so and it can be looked at.

## Featured on home

The tick is labelled **Most popular**, and it is worth being straight about what it does,
because the name oversells it.

**It does not choose what is on the home page.** The home page shows the first four
*running* deals, in the order they are listed, whether they are ticked or not. The only way
to change which four appear is to untick Running on one of the earlier ones.

What the tick really changes is one small line on the website's Deals page: a ticked deal is
labelled **Most popular**, an unticked one **Every day**. That is the whole effect.

There is no limit on how many you can tick. Tick them all and every deal says "Most
popular", which tells a customer nothing. Two or three is the most that is worth having.

## What this screen still cannot do

Worth knowing before you go looking:

- **No reordering the deals.** They sit in the order they were created, and that order
  decides which four reach the home page.
- **No start or end date, no maximum number of redemptions, no minimum spend.** Deals are
  not discount codes — if you need those rules, use a code on the Promotions screen instead.
- **No "deal of the day"** beyond ticking a single day.

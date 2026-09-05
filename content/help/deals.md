---
id: deals
title: Deal prices and switching deals on and off
summary: Reprice a meal deal, take one off, and why the contents need LaunchFlow.
kind: guide
screens: [deals]
roles: []
keywords: [deal, deals, meal deal, family meal, offer, bundle, deal price, put deal price up, turn off a deal, stop a deal, featured, most popular, tuesday deal, add a deal, change a deal]
requires: []
updated: 2026-09-05
---

The Deals screen lists the shop's meal deals — eight of them today: Meal for 1, Meal for 2,
Family Meal 1, Family Meal 3, Mega Deal, and the three multi-pizza deals. Each one is a
single row, and each row has exactly three things you can change: the price, whether it is
running, and whether it is flagged as popular.

Everything else about a deal is set up by LaunchFlow.

## Repricing a deal

Each row shows the deal's name in bold, and underneath it what is in it — for example
`1 × 10" pizza + 1 × Garlic bread + 1 × Can of drink`.

To change the price, type over the number in the **£** box and press **Save** on that row.
It is live on the website straight away. Every row has its own Save, so changing three deals
means pressing Save three times.

**Type a real number.** Anything that is not a number saves as **£0.00** rather than being
refused, and the deal goes out free. Look at the box after you save.

**Taking a deal off:** untick **Active** and press Save. It disappears from the website
immediately — from the Deals page and from the home page. Tick it again to bring it back.
There is no delete, which is a good thing: a deal you switch off keeps its price and its
contents, ready for next time.

## What is in a deal

The line under the name — the slots — is a summary, not something you can edit. Neither is
anything else about how the deal is built:

- how many slots it has and what each one is called
- which products or which whole categories are allowed in each slot
- which sizes are allowed
- the description customers read

All of that lives in the shop's config file and needs LaunchFlow and a re-seed. So does
adding a brand new deal or removing one for good.

If a deal is coming out wrong — the wrong pizza sizes offered, a drink that should not be
in there — that is a slot problem, not something you can correct on this screen. Ring
LaunchFlow with the deal name and what should have been allowed.

## Featured on home

The tick is labelled **Featured on home**, and it is worth being straight about what it
actually does, because the label oversells it.

**It does not choose what is on the home page.** The home page shows the first four
*running* deals, in the order LaunchFlow set them up in, whether they are ticked or not.
The only way to change which four appear is to untick **Active** on one of the earlier
ones.

What the tick really changes is one small line on the website's Deals page. A ticked deal is
labelled **Most popular**; an unticked one is labelled **Every day**. That is the whole
effect.

There is no limit on how many you can tick. Tick them all and every deal on the page says
"Most popular", which tells a customer nothing. Two or three is the most that is worth
having.

## No day restrictions here

There is no date, no day of the week, and no delivery-or-collection setting on this form.

Underneath, the system can actually handle both — a deal can be restricted to certain days,
or made collection-only — but **only LaunchFlow can set that, in the config file.** None of
{shop}'s eight deals uses either restriction today, so every deal runs every day on both
delivery and collection.

Two things follow from that:

- A "Tuesday only" deal cannot be done from this screen. What you can do is untick **Active**
  on the other days and tick it on the day you want — which works, but somebody has to
  remember to do it, twice.
- If a day restriction is ever added for you, be aware the day is worked out from the
  server's clock, not from Grays time. For a shop trading through to two and three in the
  morning that matters: an order taken at half past midnight can land on the wrong side of
  midnight as far as the rule is concerned. Say so to LaunchFlow before they set one up.

## What this screen cannot do

Worth knowing before you go looking:

- No adding a deal and no deleting one — untick Active instead.
- No changing what is in a deal, or the allowed sizes.
- No reordering the deals.
- No start or end date, no maximum number of redemptions, no minimum spend. Deals are not
  discount codes — if you need those rules, use a code on the Promotions screen instead.
- No "deal of the day".

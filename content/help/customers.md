---
id: customers
title: Your customer list
summary: Find a customer, understand the nine groups, and see who you are allowed to text.
kind: guide
screens: [customers]
roles: []
keywords: [customer, customers, customer list, find a customer, look someone up, phone number, regulars, lapsed, gone quiet, one timers, big spenders, segment, groups, opted in, opt out, stop, unsubscribe, marketing list, block a customer, delete a customer, duplicate, wrong name]
requires: []
updated: 2026-09-05
---

Customers is the list of everyone who has actually ordered from {shop}. It is where you look somebody up, and it is where the groups come from that Campaigns and Marketing send to.

It is a list you read, not a list you edit. Nothing on this screen changes a customer's details.

## Finding a customer

Type into the box marked **Search name, phone or email** and press **Search**. It matches on any of those three.

The phone search does not tidy up formatting. It looks for the characters you typed inside the number as it was saved, so `07700 900 201` and `+447700900201` will not find each other. If a number does not come back, try it again without the spaces, and try it with `+44` instead of the leading `0`.

You can search inside a group: pick a group first, then search, and it only looks in that group.

## The segments

The row of chips across the top cuts the list nine ways. **Everyone** clears them. Each chip shows its name and a count; rest the mouse on one and the description below appears as a tooltip.

- **Everyone opted in** — the whole marketing list. Use it sparingly; it is the fastest way to get people opting out.
- **Ordered in the last 30 days** — your active customers. The best audience for a quiet night or a new item.
- **Not ordered in 60+ days** — drifting away. A code here usually pays for itself several times over.
- **Not ordered in 120+ days** — close to lost. Worth a stronger offer than you would normally give.
- **Ordered once only** — the single biggest pot of untapped money in most shops.
- **Regulars (5+ orders)** — they already like you. Tell them things first rather than discounting.
- **Big spenders (£250+ lifetime)** — worth protecting. A thank-you lands better here than an offer.
- **Grays & Little Thurrock (RM17)** — the doorstep trade, closest to the shop.
- **Chafford & West Thurrock (RM16/RM20)** — the further patch, where delivery costs more.

The two area groups go on the postcode of the customer's **last delivery**. Somebody who always collects has no delivery postcode, so they are in neither.

With a group picked you get a line underneath saying how many are in it, and a **Send this group a message** link straight through to Campaigns.

That link does **not** carry the group across. Campaigns opens on its usual starting group, *Not ordered in 60+ days*. Pick your group again on the **Send to** dropdown before you send anything.

## Two numbers that disagree

The number on each chip and the number of rows in the table below are counting different things, on purpose.

- The **chip count** is how many people in that group have opted in to marketing — that is, how many you could text.
- The **table** shows everyone in that group, opted in or not, because when you are looking somebody up you need to find them whether or not they agreed to marketing.

So "Regulars · 41" with sixty rows underneath is not a fault. Forty-one of those sixty can be contacted.

**The table stops at 200 rows.** It shows the 200 who ordered most recently, and a line underneath says *"Showing the 200 most recent of 640"* when there are more. So somebody who has not ordered for a long time may not be in the list at all even though they are in the group — search for them by name or number rather than scrolling.

Two smaller things follow from the same split. The chip count includes people who ticked the box at the checkout but never got as far as paying, so it can sit slightly above what the table can show. And the same group can read differently on the Campaigns screen, because Campaigns only counts people who also gave a mobile number.

The line in the top right — *"400 of 38 opted in to marketing"* — compares your whole opted-in list against however many customers the current filter matches. With a group or a search applied it stops making sense. Ignore it unless you are looking at the unfiltered list.

## Read only

Everything here is display. There is no way from this screen to:

- correct a misspelled name or a wrong email
- merge two records for the same person
- add a note against somebody
- block a nuisance customer from ordering again
- delete a customer

If a customer wants their details corrected or removed, it has to go to LaunchFlow — see **Who to ring**. Do not promise a same-day fix.

## Opting someone out by hand

You cannot opt anybody in or out from this screen, and there is no admin override anywhere else either. That is deliberate: consent has to be the customer's own act, and the record has to show it was.

There are exactly three ways somebody's marketing status changes, and the customer does all three:

1. **The tick box at the checkout** — *"Text me occasional deals (opt out any time)"*. Ticking it opts them in. Once opted in, leaving it unticked on a later order does **not** opt them back out.
2. **The customer texts STOP** to the shop's number. That is handled automatically, within seconds — nobody has to action it. `STOP`, `STOPALL`, `UNSUBSCRIBE`, `CANCEL`, `END`, `QUIT`, `OPTOUT`, `OPT-OUT` and `REMOVE` all count. They get a confirmation back reading *"[shop name]: you will not get any more marketing texts from us. Reply START to opt back in."*, their record flips to **No**, and the date and the fact it came by text are both kept.
3. **The customer texts START** — or `YES`, `SUBSCRIBE`, `UNSTOP` or `OPTIN` — which puts them back on the list and clears the opt-out. Somebody who changes their mind does not need you to do anything.

STOP is only read when the reply is one or two words, and only from the first word. "Stop putting olives on it" is a complaint about olives, and is stored for you to read rather than treated as an opt-out.

If a customer rings and asks to come off the list, the honest answer is to ask them to text STOP to the shop number. It is one text, it is instant, and it is the only route that leaves a record.

Every text the marketing side of the system sends carries "Reply STOP to opt out", and only people showing **Opted in** are ever contacted. Neither of those is a setting you can turn off — they are the law.

## One phone, one customer

A customer is identified by their mobile number. One number is one record, however many people use the phone.

So a household that shares a mobile shows as a single customer with everybody's orders merged into one history and one lifetime total. There is no way to split that back apart. It also means a customer who orders from a new number arrives as a brand new customer with no history — which is worth remembering before you tell somebody they have never ordered before.

---
id: notifications
title: Notifications — who gets told what
summary: Every message the shop sends, who it goes to, and why leaving email on but texts off is what keeps the bill down.
kind: guide
screens: [notifications]
roles: []
keywords: [notifications, notify, email, emails, sms, text, texts, message, messages, alerts, alert, switch off, turn off, turn on, pause, silence, credits, twilio, cost, bill, receipt, confirmation, driver, kitchen, owner, customer, popup, pop up, review request, refund email]
requires: []
updated: 2026-09-06
---

Every message this system sends is a row on this screen. Nine things that can happen to an order, four people who might care, two ways to reach them. A switch that is off sends nothing, and there is no message anywhere in the system that is not on this page.

## Email is free, texts are not

This is the whole reason the screen exists.

A text costs somewhere around **4p**. An email costs **nothing**. At two hundred orders a week, texting every status change is six or seven texts an order — around **£50 a week** to tell people things most of them would happily have read in an inbox.

So the shop starts set up like this, and it is worth leaving that way until you have a reason:

- **Email on nearly everywhere.** It costs nothing and it is the thing people can find again later.
- **Texts on for four moments only** — the order landing (the customer wants instant proof, the kitchen has to look up), the order being refused, and a delivery being handed to a driver.

The **Running cost** box at the top does the sum against your own order count. It is an estimate from what you have switched on, not a bill, but it moves the moment you tick something — so you can see what a change costs before you save it.

## Where messages go

Four boxes, and they are deliberately **not** the phone number and address on your website.

Those public ones are where customers write to you. These are where the shop shouts at you — new orders at eleven at night, refunds, refusals. Mixing them means every order lands in the inbox customers are waiting for a reply in.

**A blank box switches that route off completely**, whatever is ticked in the grid below. If the owner email is empty, the owner gets no emails, full stop. That is the quickest way to silence one person without touching anything else.

Drivers are reached on the number and email held against them in **Dispatch**, not here.

## Checking a message before it goes out

The small **↗** next to any switch opens that exact message in a new tab, rendered against your most recent real order. Not a mock-up — the same code that would send it.

Use it before you turn something on. It is also the fastest way to check a text is not about to run to two messages: the preview counts the characters and tells you.

## Pausing everything

**Pause everything** at the top stops every email and every text to everybody, including the kitchen.

It does not clear a single one of your settings. Switch it back on and you are exactly where you were. It is for a bad night, not for reconfiguring.

While it is paused, a red bar sits across the top of the screen so nobody forgets.

## The one that catches people out

If email or texts are not connected yet, a message that is switched on is **written to the order timeline and thrown away**.

The order will say `email_sent`. Nothing was sent. This is the most misleading thing the system can do, so there is a warning across the top of the screen whenever it applies — if you can see that warning, believe it over the timeline.

Getting it connected is a LaunchFlow job, not a setting on this screen.

## The kitchen popup

Separate from all of the above, and always on.

When a new order lands, the kitchen screen beeps **and** puts a large box on top of the queue with the order number on it. It stays there until somebody taps **Got it** — it does not fade away on its own, because an order that times out unnoticed is the exact thing it is there to prevent.

If the sound is switched on and the browser allows it, a desktop notification also appears when the kitchen tab is in the background.

## The receipt printer

Not on this screen on purpose.

Emails and texts go to people, who can be over-messaged and cost money to reach. The printer is a machine that either has a docket or does not. It is set up in your configuration and cannot be switched off here, so nobody can accidentally silence the one output the kitchen physically works from.

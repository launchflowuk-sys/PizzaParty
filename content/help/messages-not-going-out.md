---
id: messages-not-going-out
title: Customers say they got no text
summary: When texting is not connected the system still records every message as sent. Only LaunchFlow can see that.
kind: runbook
screens: []
roles: [manager, shift_lead, front_of_house]
keywords: [no text, no texts, no message, customer had no message, text not sent, texts not going out, sms not working, no confirmation, didnt get a text, no code arrived, review request, messages, phantom send]
requires: []
updated: 2026-09-05
---

## You will know because

A customer says they had no confirmation. Or nobody is using a code you sent out to two hundred people. Or a customer you rejected turns up at the counter an hour later, because the text telling them never landed.

## Do this now

1. **Ask one customer straight out** whether they have had anything at all from you — and work out which kind of message they mean. An order confirmation, a rejection and a marketing offer all go the same way, so if one is missing they are probably all missing.
2. **Look at Campaigns.** In the **Sent** table, the **Sent** column counts what the system believes went out, with *"N failed"* underneath when a send genuinely failed. **If it says sent and nobody received anything, that is the symptom** — the counters cannot tell the difference between a text that left and a text that was only written to a log.
3. **Ring LaunchFlow and ask them to check SMS.** On their own screen the row reads either *"SMS (Twilio): configured"* or *"dry-run (logs only)"*. That screen needs the LaunchFlow key — no manager password will open it, and there is nowhere else in the back office that tells you.
4. **Until it is fixed, ring people.** Anything that matters gets a phone call: a rejected order above all, because that is where money has moved, then anything running late.

## What the system does and does not do

When texting is not connected, the system **writes the message to the server log and records it as sent**. It counts as successful in the order's history and in your marketing figures. Nothing leaves the building.

That order history is not shown on any screen, so **your marketing figures are the only place a phantom send is visible to you at all** — and they look perfectly normal.

Everything that texts is affected at once: order confirmations and status updates, rejection messages, review requests, referral thank-you codes, abandoned-basket chasers and campaigns.

**Replies cannot come back in either.** While texting is not connected, a customer replying **STOP** is refused before it reaches us, so nobody can take themselves off the list by text.

Every campaign text, automation text, review request and referral thank-you is still costed at 4p and added to **Spent on messages** on the **Marketing** screen, whether or not it went anywhere. Order confirmations and status updates are not counted there, so the bill you can see is only part of it.

## If it is still wrong

Ring LaunchFlow with a customer's mobile number, the time of their order, and the order number. If they have already told you it is fixed and a customer still had nothing, ring back the same night — do not wait for the weekend.

## Afterwards

**Do not trust that week's marketing figures.** Spend, sends and anything measured against them are wrong for the whole period it was broken.

**Do not re-send a campaign to make up for it** until LaunchFlow has confirmed texting is live again. If it was working after all, everyone gets it twice and you pay twice.

---
id: stop-getting-texts
title: A customer wants us to stop texting them
summary: You cannot take anybody off the list from the back office. Ask them to reply STOP — that is the only switch.
kind: runbook
screens: []
roles: [manager, shift_lead, front_of_house]
keywords: [stop texting, stop texts, stop messages, unsubscribe, opt out, opt them out, remove me, take me off the list, no more texts, marketing texts, complaint about texts, spam, data protection, gdpr]
requires: [twilio]
updated: 2026-09-05
---

## You will know because

A customer rings, or replies to a message, or says at the counter that they want the texts to stop. Sometimes politely, sometimes not.

## Do this now

1. **Ask them to reply STOP to the text.** That is the whole answer, and it works instantly. **STOP**, **STOPALL**, **UNSUBSCRIBE**, **CANCEL**, **END**, **QUIT**, **REMOVE** and **OPTOUT** are all understood. They get a text straight back confirming it, and if we have their number on file they come off the marketing list at that moment.
2. **Tell them it must be one short word.** The word has to be the first word, and the whole message has to be one or two words. *"Stop putting olives on it"* is read as a complaint about olives, not as an opt-out, and nothing happens. **OPT OUT** as two words does not work either — it has to be **OPTOUT** or **OPT-OUT**, or just **STOP**. Say STOP and leave it at that.
3. **You cannot do it for them.** **Customers** is a read-only list. The **Marketing** column shows **Opted in** or **No**, and there is no button beside it — not to opt somebody out, not to correct a name, not to block a number.
4. **Check it worked.** A few minutes later, go to **Customers**, search their phone number or name, and look at the **Marketing** column. It should read **No**.
5. **If they want to come back later**, they reply **START** (**YES** and **SUBSCRIBE** work too), or tick *"Text me occasional deals (opt out any time)"* at the checkout next time they order.

## What the system does and does not do

There are only **three** ways a customer's marketing setting ever changes: the tick box at the checkout, the customer replying STOP, and the customer replying START. **None of them is a control in the back office.**

Every marketing text carries *"Reply STOP to opt out"* automatically. That is the law, not a setting, and it cannot be turned off.

Campaigns and automations only ever go to customers who have opted in and have a mobile number. The counts beside the segments on **Customers** and **Campaigns** are counts of opted-in people, which is why they are smaller than the number of rows in the table underneath.

**Order confirmations, status updates and the review-request text are service messages.** They are not marketing and STOP does not switch them off — the review request in particular goes out to everybody, opted in or not. Only LaunchFlow can turn review requests off, and only for the whole shop, not for one person. In practice the phone network may also block everything we send to a number once that number has replied STOP, so a customer who opts out may stop getting their order updates too. Worth telling them.

**Replies that are not STOP or START are stored and shown nowhere.** If a customer texts *"where is my order"* back to one of our messages, it is saved in the database and no screen in the back office displays it. Nobody sees it and nobody replies. Do not tell customers they can text you.

Marketing email carries **no unsubscribe link at all**. Until that is fixed, do not use the email channel on **Campaigns** for marketing.

## If it is still wrong

If somebody has replied STOP and is still getting marketing texts, ring LaunchFlow the same day with their number and the time they replied. That is a fault and a legal problem, not an annoyance.

## Afterwards

Check the **Marketing** column on **Customers** reads **No** for that person before you consider it done.

Never try to put someone back on the list on their say-so at the counter — you cannot from any screen, and their tick at the next checkout is the record that they agreed.

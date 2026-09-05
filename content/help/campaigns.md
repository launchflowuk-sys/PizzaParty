---
id: campaigns
title: Sending a one-off text to customers
summary: One message, one group, sent immediately — what it costs and why there is no way back.
kind: guide
screens: [campaigns]
roles: []
keywords: [campaign, campaigns, send a text, text everyone, text customers, blast, sms, message customers, offer, special offer, tell customers, quiet night, new item, send now, undo, cancel a send, cost of texts, unsubscribe, email customers, opted in, stop]
requires: []
updated: 2026-09-05
---

A campaign is one message, sent once, to a group you pick. Use it for a new item, a closure, a quiet Tuesday — anything that is news rather than a rule that should run on its own. For the rules that run on their own, see **Marketing automations**.

Two things are true of every campaign and cannot be switched off: only customers who have opted in are ever contacted, and every text ends with "Reply STOP to opt out". Both are the law, not settings. STOP is acted on automatically the moment the customer sends it.

## Sending a one-off

The form on the left, top to bottom:

- **Channel** — *SMS — £0.04 each* or *Email — free*. Read **Email has no unsubscribe** below before you pick email.
- **Send to** — one of the nine groups, with the number of people in it in brackets. That number is the people in that group who have opted in **and** have a mobile number, so it can be lower than the same group's count on the Customers screen. It starts on *Not ordered in 60+ days*, so change it unless that is genuinely who you want. On an email send the bracket still counts mobile numbers, but the message goes to the people in that group with an email address instead — a different, usually smaller, set of people.
- **Offer code** — pick one of your live promo codes, or *No code (not measurable)*.
- **Subject (email only)** — ignored on an SMS send.
- **Message** — what they get. Keep it short; see **What it costs**.

Then **Send now**.

Three fill-ins work in the message and are replaced per person:

- <code>&#123;name&#125;</code> — their first name, or "there" if you have no name for them
- <code>&#123;shop&#125;</code> — {shop}
- <code>&#123;code&#125;</code> — the offer code you picked above

**Always attach a code.** The code is how the money finds its way back. Every message is logged with the code it carried, and when that customer later places an order using it, the **whole order total** is credited to that message. That is why the **Earned** column at the bottom of this screen is a real number rather than a guess. With *No code* selected the message still goes, still costs you, and earns nothing you can ever prove.

The panel on the right, **Your list**, shows each group, what it is for, how many people are in it and what texting them would cost. The group names link through to Customers.

## There is no undo

**Send now** sends. There is no confirmation box, no preview, no test send to yourself, no scheduling for later, and no way to stop it once it has started. One click can text two thousand people — that is the hard limit on a single send, and if your group is bigger than that the rest are quietly left out, with nothing on screen to tell you.

So, before you click:

1. Read the message out loud. Check the fill-ins are spelled exactly as above, brackets and all — a typo shows up in the text as literal brackets.
2. Check the group. **Everyone opted in** is not the same as **Not ordered in 60+ days**.
3. Check the code is one you meant to give away, and that it is live on Promotions.
4. Check nothing else went out today. This screen does not know or care what anybody else has already been sent.

That last point matters. The automations on the Marketing screen refuse to contact anybody who has heard from you recently — a campaign does not. It goes to the whole group regardless. A campaign sent the morning after a win-back run will land on the same phones twice.

It works the other way too: a campaign **does** start that quiet period. Everybody you text today is off-limits to the automations for as long as their cooldown says.

## The code warning

If a box headed **Check the code** appears above the Send button, read it. It is telling you that a code in your list cannot be used by the people you are about to send to. You will see one of:

- *"…only works on a first order, so nobody on this list can use it."*
- *"…only applies to delivery orders"* (or collection).
- *"…needs a basket of at least 20.00 pounds."*

The box lists every live code with something wrong with it, not just the one you have picked, and it is always worked out as though you were texting people who have ordered before — which these groups almost entirely are. The code the form starts on is the first one with nothing wrong with it.

There is nothing else in the system that catches this. The texts send perfectly, the shop pays for every one, and every customer who tries the code is told "not valid" at the till. It costs you the money and the goodwill in one go.

Two more codes to keep out of a campaign:

- Anything beginning **THANKS-** is a personal referral reward, minted for one named customer. Nobody else can spend it, however many people you send it to.
- A code with a low **maximum uses** runs out after the first few customers and refuses everybody behind them.

## What it costs

Texts are counted at **4p each**, and that figure is fixed in the software — it is not read from your Twilio bill, so treat it as an estimate.

It is 4p per **message**, not per 160 characters. A long message is charged by the network as two or three texts but is only ever counted here as one, so a wordy campaign costs more in real money than this screen shows. Keep it short and the estimate stays honest.

Email is counted as free. The **Cost** column on the sent table and the totals on the Marketing screen both use the same 4p.

## A big send can time out

The messages go out one after another while the page is still loading. On a few hundred recipients that can take longer than the browser is willing to wait.

If the page appears to hang or errors after **Send now**, **do not press it again.** The texts are still going. Wait a minute, then reload the Campaigns screen and look at the **Sent** table. If the campaign is listed, it ran.

The **Sent** number is written down message by message as they go, so that figure is reliable. The small *"N failed"* line underneath it is not — it is written once at the very end, so a send that timed out can show nothing there even though some texts did not get through. If Sent looks lower than the group size, the difference is failures you are not being shown.

Sending it a second time genuinely does send everybody a second text.

## Email has no unsubscribe

The SMS channel carries "Reply STOP to opt out" on every message and honours it automatically.

**The email channel carries nothing.** There is no unsubscribe link and no way for a customer to take themselves off an email list. Sending marketing email without one is against UK marketing rules, and it is the shop's name on it, not LaunchFlow's.

Until that is fixed: use email for genuine service messages only, and send all marketing by SMS. If somebody has told you they want your emails to stop, there is no switch for it — the only marketing status the system holds is the one the SMS opt-in controls.

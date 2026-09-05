---
id: marketing-automations
title: Automations, and what your marketing earned
summary: Rules that text customers on their own, and how the money is credited back to the message.
kind: guide
screens: [marketing]
roles: []
keywords: [marketing, automation, automations, win back, lapsed customers, second order, quiet night, abandoned basket, abandoned checkout, birthday, send now, cooldown, do not contact, earned, roi, commission saved, just eat, referral, word of mouth, opted in, stop, cost of texts]
requires: []
updated: 2026-09-05
---

The Marketing screen is two things at once: the rules that text customers without anybody pressing anything, and the ledger showing what all of that earned. The number in the top right is how many customers you are allowed to text at all.

The whole point of the screen is at the top of it: **every message carries its own code, so when an order uses that code the money is credited back to the message that caused it.** Every figure here is counted from real orders except **Commission saved this month**, which the note underneath the tiles calls an estimate.

## What an automation is

An automation is one rule, made of six things:

- **Name** — what you will call it. Also how the system tells one rule from another, which matters; see **Editing makes a copy**.
- **When it fires** — the trigger. Six to choose from, below.
- **Days** — the number the trigger counts. For a win-back, how long somebody has to have been quiet.
- **Do not contact again within (days)** — the cooldown. See below; it is the most important field on the form.
- **Offer code** — the code every message carries. Without one the rule cannot be measured.
- **Never send more than** — the cap on a single run, so a rule set up wrongly cannot text the whole list.

Then the **Message**, and **Save automation** at the bottom. The message takes the same three fill-ins the campaign form uses: <code>&#123;name&#125;</code>, <code>&#123;shop&#125;</code> and <code>&#123;code&#125;</code>. "Reply STOP to opt out" is added to every text automatically.

The six triggers:

- **Win back a lapsed customer** — has ordered before, but not for *Days*. Usually the single biggest earner.
- **Nudge a one-time customer** — ordered exactly once, *Days* ago. Turning one order into two is where the money is.
- **Thank a new customer** — ordered for the first time *Days* ago. Cheap goodwill.
- **Birthday treat** — never fires. See below.
- **Fill a quiet night** — has ordered within *Days*. Meant to be fired by hand from its own row when the kitchen is quiet.
- **Chase an abandoned checkout** — someone who picked their food, typed in their number and then never paid. This one ignores *Days* entirely: it looks at unpaid orders between 25 minutes and 1 hour 50 minutes old, and each one is chased once and only once. The sweep that cancels unpaid orders runs at two hours, so that window is deliberate.

Automations are text only. There is no email option on this form.

**The cooldown is shared.** "Do not contact again within 30 days" does not mean thirty days since *this* rule last texted them. It means thirty days since **any** message this system has recorded against that customer — another automation, a one-off campaign, the review-request text after their last order, even the text carrying a friend's referral thank-you. That is what stops a customer getting three different messages from you in a week, and it is why the review requests appear in the money table below: they cost you and they count.

Two things sit outside it. A **campaign** does not check the cooldown before sending — it goes to the whole group — although it does start one afterwards. And **Chase an abandoned checkout** does not check it either, because somebody halfway through paying is a different situation from somebody being marketed at.

## Nothing runs unless a schedule was set up

An automation being **On** does not mean it is running.

The rules only fire when something calls the runner, and that something is a scheduler outside this software that LaunchFlow sets up once, at launch. If that was never done — or it has stopped — then nothing has ever gone out on its own, however many rules are switched on.

How to tell: look at the **Waiting** column. If a rule has been on for weeks and there are still dozens of people waiting for it, nobody is calling the runner. Ring LaunchFlow and ask them to check the automations schedule.

Until it is sorted, the rules still work — you just have to fire each one by hand from its own row.

## Firing a rule by hand

The red button at the end of each row — the one that names a number — fires that rule immediately, against whoever is waiting for it right now. There is no confirmation and no undo.

**The button tells you what it is about to do.** When people are waiting it reads *Send 250 · £10.00* — that is how many texts and roughly what they will cost. When nobody is waiting it reads **Send now** and is greyed out. A greyed-out button is the normal state for a healthy rule, not a fault.

Three things to know:

- It works on a **paused** rule. Off means "does not run on its own"; it does not mean "cannot be fired from this button".
- It still honours the cooldown and the opt-in, so it cannot reach anybody it was not going to reach anyway.
- The number and price on the button **ignore your "Never send more than" cap**. If the button says 250 and the cap is 200, only 200 go out and it costs less than the button said.

## Editing makes a copy

There is no edit button and no delete button. The form at the bottom — headed **New automation** — is both "new" and "edit", and which one it does depends entirely on the **Name**.

- Type a **name that already exists** and press **Save automation**: that rule is overwritten with what is in the form — *and it is switched off*. Every save sets a rule to paused, whether it is new or not. If you edit a live rule you must press **Turn on** afterwards, or it silently stops running.
- Type a **name that does not exist**: you get a second rule. The old one is still there, still with its old settings, still switched on if it was.

So if you meant to change the wording of "Win back after 45 days", type that name back in exactly, letter for letter. Anything else leaves you with two win-back rules both texting the same people.

To retire a rule, press **Pause**. That is as close to deleting as this screen gets, and a paused rule can still be fired from the send button beside it, so pause is not a safety catch.

## The birthday rule never fires

**Birthday treat** is in the list, it can be saved, and it will sit there on **On** for ever doing nothing.

Nowhere in the system asks a customer for their date of birth — not the checkout, not the account page, not the back office. With no birthdays there is nobody to send to, so the rule finds an audience of zero every time. Its **Waiting** count will always read 0.

Leave it alone. If you want birthday offers, that is a conversation with LaunchFlow about collecting the date first.

## Reading the money

The four tiles across the top — **Earned from marketing**, **Spent on messages**, **Net** and **Commission saved this month** — and the **Earned** column on every row all work the same way.

Every message is written down with the code it carried. When an order is later placed using that code, the system finds the most recent message carrying that code to that customer that has not already been credited, and writes the **whole order total** against it. One message, credited once, with a real order behind it.

That is worth being precise about, because it decides what the numbers mean:

- **Earned** is the **full value of the order**, not the profit on it. A £42 order credited to a win-back text shows as £42 earned. The dough, the cheese and the driver all still have to come out of that.
- **Spent** is the message cost only — 4p a text, counted per message rather than per 160 characters, so a long message costs a little more in real life than it shows here.
- **Net** is Earned minus Spent. It ignores the cost of making the food entirely. It answers "was the text worth sending", not "did we make money".
- **Orders** is how many of the messages were actually redeemed. That, against **Sent**, is the honest measure of whether a message is working.
- A rule with **no offer code** earns nothing on this screen no matter how much business it brings in. There is no code to trace, so there is nothing to credit.

Under **Word of mouth**, *Friends introduced* counts people who arrived on somebody's referral code and then actually ordered — not people who clicked a link. The referrer's thank-you is only created once that first order is paid for, so an introduction that never buys anything costs you nothing.

## Commission saved is an estimate

This is the one tile on the screen that is not measured, and it is labelled as an estimate for good reason.

It takes every order you have taken this month that was not cancelled, rejected or left unpaid, and multiplies the lot by **14%** — roughly what an aggregator would have charged on a delivery order.

That includes every order you would have had anyway: your regulars, the ones who always ring, the ones who found you on Google. It is not money the marketing made you. It is a fair answer to "what would we be handing over if we were on Just Eat instead", and nothing more.

It resets on the first of every month.

## Where the money went

That table splits your spend by what each message was **for**, not by which rule sent it. Five rows are possible: **Automations**, **Campaigns**, **Abandoned checkouts**, **Review requests** and **Referral rewards**.

Two of those will surprise you:

- **Abandoned checkouts** is its own row even though the thing sending them is one of your automations. So the **Automations** row does *not* include your abandoned-checkout rule. Add the two together if you want the total your rules have sent.
- **Review requests** and **Referral rewards** are not automations at all — they go out on their own after an order, and nothing on this screen switches them off. They are listed here because they cost you 4p a time and the shop should see its real message bill.

Campaigns are counted properly on their own row, so a one-off send never hides inside Automations.

If LaunchFlow loaded sample figures when the shop was set up, those samples are logged against the win-back rule — so they show in both the **Automations** row and that rule's own line, and your earliest numbers include trading that never happened. Ask LaunchFlow if you are not sure whether yours do.

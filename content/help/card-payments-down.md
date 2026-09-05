---
id: card-payments-down
title: The card machine is down
summary: Two different problems share that phrase. Work out which one you have, then keep taking orders.
kind: runbook
screens: []
roles: [manager, shift_lead, front_of_house]
keywords: [card machine, chip and pin, card not working, payment not working, card declined, payment failed, cannot pay, card down, taking payment, stripe, no card option]
requires: []
updated: 2026-09-05
---

Two different things share that phrase, and the fix is different for each.

*Your own card terminal on the counter* has nothing to do with this system. The website keeps taking card orders as normal. Take counter payments in cash and carry on — there is nothing to do in the back office.

*Card payment on the website is failing* — customers ring to say the payment will not go through. That is the one this page is about.

## You will know because

Customers are ringing to say their card will not go through, or that the pay step threw an error. Or nobody is ringing at all and the online orders have simply stopped coming.

## Do this now

1. **Check it yourself.** Open the storefront, put anything in a basket and go through to the step headed **04 Pay**. If the box says *"Card payments are not set up yet"* where the **Pay by card** button should be, card payment is switched off rather than broken — and that is still a job for LaunchFlow.
2. **Ring LaunchFlow.** This is not something the shop can fix from the back office. There is no payment setting on any screen you can open.
3. **Keep taking orders by phone** and put them through your own till. Do not tell customers the shop is shut — they will simply order elsewhere and not come back.
4. **If the phone cannot keep up, pause ordering — from Hours & pause, not the kitchen header.** The kitchen **Pause…** dropdown always shows customers the word *"Busy"* and gives you nowhere to type. On **Hours & pause** you pick the length, type into the **Reason (shown to customers)** box — *"Card payments are down, please ring us on {phone}"* — and press **Apply**. **Hours & pause** only opens for a manager or a shift lead. If it is not in your sidebar, either ask one of them, or pause from the kitchen header and explain it on the phone instead.

## What the system does and does not do

Card, Apple Pay and Google Pay are handled by Stripe, and card numbers never touch this website. The **Pay by card** button only appears at all when the payment keys are set on the server.

Cash is offered where the setup allows it. For this shop cash is **collection only** — the checkout button reads **Pay cash on collection**, and there is no cash-on-delivery. You cannot switch cash on delivery on yourself; it is a change LaunchFlow has to make.

The **LaunchFlow** screen has a **Stripe** row — either *not configured*, or the account with *charges* and *payouts* each marked enabled or DISABLED. That screen needs the agency key, so a manager password or a staff PIN will not open it.

## If it is still wrong

Ring LaunchFlow with the time it started and one order number that failed. Both together are worth more than a long description.

## Afterwards

**Clear the pause.** Nothing nags you about it. The only signs are the word **Paused** beside the light on the **Dashboard**, the **paused** pill on **Hours & pause**, and the status line on the kitchen header. To lift it, go to **Hours & pause**, pick **Resume** from the dropdown and press **Apply** — or press **Resume** on the kitchen header if that is where you paused from.

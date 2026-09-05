---
id: kitchen-queue
title: The kitchen screen — accepting, rejecting and the beep
summary: How the four-column board works, what the ETA promises the customer, and why nothing else tells you an order came in.
kind: guide
screens: [kitchen]
roles: []
keywords: [kitchen, tickets, board, queue, tablet, accept, accepted, reject, refuse, cancel an order, eta, how long, time, minutes, beep, sound, no sound, alarm, not beeping, pause, too busy, new order, docket, printer, missed an order]
requires: []
updated: 2026-09-05
---

The kitchen screen is the shop. Everything a ticket does — accepted, cooking, ready, out, done — happens here and nowhere else.

## The four columns

Tickets move left to right: **New → In the oven → Ready → Out for delivery**. The big accent number at the top of each column is how many are sitting in it.

Oldest ticket first, always. The minutes on each ticket count from when the order was placed, and the timer turns accent once it passes **20 minutes** — that is the screen telling you a ticket is getting old, nothing more.

The board reloads itself every five seconds, so a new order appears on its own. You never need to refresh.

On each ticket: the order number, delivery or collection, whether it is **Paid** or **Cash** with the amount to collect, a pre-order tag showing the day and the time in 24-hour — **For Fri 19:45** — the items with their sizes and extras, any note the customer typed in accent red, and the customer's name with their phone number as a tap-to-call link.

Once accepted, the buttons walk the ticket along: **Cooking**, then **Ready**, then either **Out for delivery** (delivery) or **Collected** (collection), and finally **Delivered**. A collection ticket never offers "Out for delivery" and a delivery ticket never offers "Collected".

**There is no way back.** Tap **Ready** by mistake and you cannot put it back in the oven. The ticket carries on from where you left it.

## Accepting an order

A new ticket has two controls: a **minutes** dropdown and the **Accept** button.

1. Look at the dropdown. It starts at your standard time — 15 minutes for collection, 35 for delivery.
2. If that is not honest, change it. The choices go 10, 15, 20, 25, 30, 35, 40, 45, 50, 60, 75 and 90 minutes.
3. Tap **Accept**.

**Whatever number is showing is what the customer is told.** It goes on their tracking page and in their message. It is the only lever you have over their expectations, so use it.

The screen has **no idea how busy you are**. The default is a fixed number of minutes from your settings — it does not count the tickets already on the board. The fortieth order of a Friday night is offered the same 35 minutes as the first one unless somebody changes it on the way through. On a bad night, put the minutes up before you tap Accept.

## Rejecting an order

Under Accept there is a **Reject…** dropdown with five reasons: Too busy, Item unavailable, Outside delivery area, Closing soon, Other.

Pick one and the screen asks you to confirm — *Reject #1234?* — before anything happens. That confirmation box is your only safety net.

- **If they paid by card, rejecting refunds them in full, automatically.** You do not have to do anything in Stripe. This is the only refund the back office can do by itself.
- The customer is told the order was rejected.
- **There is no undo.** A rejected order is finished. If they still want the food, they have to place it again.

Reject is only offered on a ticket in **New**. Once you accept it, the option is gone.

## The beep

The sound button lives in the header. It says **Enable sound** until you tap it, then **Sound on**.

**You have to tap it once after every page load.** Browsers will not play a sound until somebody presses something, and a reload or a tablet restart puts it back to Enable sound. First job of every shift: check the header says Sound on.

While it is on, the screen beeps once for each new ticket, and then nags every 20 seconds for as long as anything is sitting unaccepted in **New**. The nagging is the point. It stops the moment the last new ticket is accepted or rejected.

## Pausing from here

Beside each shop's name in the header is a **Pause…** dropdown: 15 min, 30 min, 1 hour, Rest of day. Choose one and new orders stop straight away. The same spot then shows a **Resume** button.

Two things to know before you use it:

- **Customers are shown the reason "Busy" and you cannot change it here.** There is nowhere on this screen to type a message. If you need customers to read something else — *"Card payments are down, please ring us on {phone}"* — pause from **Hours & pause** in the back office instead, where there is a reason box.
- **"Rest of day" is four hours, not until closing.** Pause at 5pm and it lifts itself at 9pm with nobody being told. If you are shutting for the night, change the day's hours on Hours & pause.

## Nobody is alerted but this screen

This matters more than anything else on this page.

For {shop} there is **no kitchen text, no kitchen email and no printer** connected. All three are switched off in the settings. New orders appear on this screen and **nowhere else**.

So: if this tab is closed, if the tablet has gone to sleep, or if somebody has wandered off to another website on it, **nothing tells anyone an order has arrived**. The customer is sitting there watching a tracking page that says you received it.

Keep the tablet awake, plugged in, and on this page. If you would rather have a text or an email when an order lands, ring LaunchFlow — it is a settings change, and it is worth doing before the next busy night.

## One queue for every branch

The board shows every shop's tickets together and does not filter by branch. {shop} runs one shop, Grays, so today this changes nothing at all. It is only here so nobody is surprised the day a second shop opens.

## What you cannot do here

- **No editing a ticket.** Not the items, not the address, not the total. If an order came through wrong, ring the customer and either reject it before you start cooking, or sort it out between you.
- **No cancelling.** Once you have accepted a ticket, this screen only moves it forward.
- **No re-print and no print view.** The screen is the ticket.
- **No notes.** There is nowhere to write "customer rang, rang doorbell twice". Keep your own book.
- **No history.** You cannot see who accepted a ticket or when.

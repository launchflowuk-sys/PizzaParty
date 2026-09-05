---
id: what-this-system-does-not-do
title: What this system cannot do
summary: The honest list, so you find out now instead of at eight o'clock on a Friday.
kind: reference
screens: []
roles: []
keywords: [cannot, cant, no button, missing, not possible, does not work, doesnt work, where is the, why is there no, refund, part refund, partial refund, edit an order, change an order, cancel an order, add an item, new product, add a photo, stock, stock control, tracking, track the driver, driver map, gps, bulk price change, unsubscribe, bank holiday, closed for the day, limits, not supported, undo]
requires: []
updated: 2026-09-05
---

Half the value of this page is telling you now, while nothing is going wrong. Everything below is how the software works today, not a fault waiting to be fixed this week. If you are standing in the shop and something has already gone wrong, go to the runbook for it — this page is for reading on a quiet afternoon.

## Orders cannot be changed

Once a customer has placed an order, **nothing about it can be edited**: not the items, not the size, not the address, not the note, not the total. There is no amend and no undo.

There is no order detail page in the back office at all. The order number on Orders and on the Dashboard opens the **customer's own tracking page** — the same page they got by text. It needs no login, and it shows their name, their phone number and their address. Do not forward that link to anybody.

There is no cancel button in the back office. **Reject on the kitchen board, before you accept, is the only clean exit.** After that, it is sorted out with the customer on the phone.

You also cannot add a note to an order, resend a confirmation, or send a receipt again.

## There is no history of who did what

Every status change is written down in the database, but **no screen anywhere shows it** — not the back office, not the customer's tracking page. Even if it were shown, it records only a rough "kitchen", "admin" or "system", never which member of staff pressed the button.

So there is nothing to look back on. When you need to work out what happened to an order, all you have is the status it is in now, the address that was typed, and asking the people who were on.

## Money: no refunds, no part refunds

**There is no refund button anywhere in this back office, and no partial refunds at all.**

The one refund the system does by itself: rejecting an order that has already been paid for by card refunds it in full, automatically. That is it.

- Cancelling an order does **not** refund it.
- Card money already taken has to go back through Stripe, by whoever holds the Stripe login.
- Cash goes back out of the till. Nothing to do in the system.
- There is no way to knock money off an order, or to honour a discount the system refused. That comes off in cash at the counter.
- There is no till reconciliation and no end-of-day report.

## The Dashboard is today only

Four numbers, and no more: today's takings, live in the kitchen, the average order over seven days, and how many customers have ever ordered.

There is **no date picker, no comparison with last week, no split between delivery and collection, and no best-sellers list.** For anything else, export the orders to a spreadsheet from the Orders screen — and note that the export stops at 5,000 rows and does not warn you when a wide date range has been cut short.

The order search does not tidy up phone numbers either, so a number typed with spaces and the same number typed with +44 will not find each other. Try it both ways.

## You cannot add anything to the menu

From this back office you can change a price, a name, a description, the order things appear in, and whether something is hidden or sold out. That is the whole list.

**You cannot add a product, a category, a size, an option group, an allergen or a photo.** All of those live in your shop's settings file and need LaunchFlow and a re-seed. There is no photo upload screen anywhere.

There is also no bulk change: every size has its own Save, so putting the whole menu up 5% means opening every price. And there is no way to schedule a price change for later.

## Nothing counts stock down

**Sold out is a manual switch and nothing else moves it.** Nothing comes off as food sells, and nothing clears the flag overnight — an item you marked off at nine on Friday is still off at lunchtime on Saturday until somebody switches it back on. That is the most common way a shop loses money on this system.

The Inventory screen is a shopping list, not stock control. The numbers on it only change when LaunchFlow re-seeds. **Reorder** marks the line; it does not message the supplier, and there is no button to book a delivery in afterwards, so a flagged line stays flagged. Stock lines cannot be added, renamed or removed here.

## There is no driver tracking of any kind

**No GPS. No live map. No proof of delivery, no photo, no signature.** The map on the Dispatch screen is a drawing — the pins are placed by where a driver sits in the list and mean nothing on the ground.

Assigning a driver marks them out on delivery and starts a clock. It does **not** tell the driver anything, does not move the order along, and does not produce a job sheet or a route. Somebody still has to hand over the food and mark it out for delivery on the kitchen board. A driver already on a job drops out of the **Assign driver…** dropdown until somebody presses **Set available** on their row, so one driver can only be holding one job at a time on this board.

"Back at" is always now plus thirty minutes, whatever the distance.

Drivers themselves cannot be added, renamed or removed from the back office.

## Delivery charges are by postcode only

Charge bands work on postcode districts — RM17, RM20 and so on. There is **no radius, no drive time and no drawn zone**, so a house at the far edge of a district pays exactly what a house next door to the shop pays.

Addresses are typed free-hand by the customer with no lookup, so a wrong house number goes straight through and nothing catches it.

**Remove** on a band deletes it immediately, with no confirmation and no undo.

## Opening hours are one range a day

One opening time and one closing time per day. Closing after midnight is fine. **You cannot shut between lunch and dinner** — a split day cannot be expressed here at all.

**There are no one-off closure dates.** No bank holidays, no "closed Tuesday the 24th". The only way to shut for a day is to blank that day out and put it back afterwards, and nothing reminds you to put it back.

A time that fails the format check is dropped without telling you and saves as closed, so always read the grid back after you press Save hours.

A pause stops new orders coming in. It does **not** cancel orders already in, and customers can still book a pre-order slot for later while you are paused. Nothing reminds you a pause is on except the pill on Hours &amp; pause and the kitchen header.

## New orders reach the kitchen screen and nowhere else

There is **no text to the kitchen, no email to the kitchen and no printer** — all three are empty in this shop's settings. If that tab is closed, or the tablet has gone to sleep, **nothing tells anybody an order has arrived.**

The screen is the ticket. There is no re-print, no print view, no way to edit a ticket, and no undo on Reject. Sound has to be switched on by hand with **Enable sound** after every reload.

The time you promise the customer is a fixed number of minutes from the settings — your standard collection or delivery time, and nothing else. **A far-out band's extra minutes go into the estimate the website quotes, but not into the minutes the kitchen offers on Accept**, so a long run is under-promised unless somebody puts the number up by hand. And **it has no idea how busy you are** — the fortieth order of the night is promised the same wait as the first. Nothing queues or spaces orders out.

## Customer records are read-only

You cannot correct a spelling, merge two records for the same person, add a note, or block a nuisance customer.

You cannot opt somebody out of marketing on their behalf, even if they ask you to on the phone. The only three routes are the tick box at checkout, the customer texting STOP, and the customer texting START to come back — all three are the customer's own act.

One phone number is one customer, so a household sharing a mobile becomes a single record with everybody's orders merged into it. The list shows the 200 most recent matches, with no paging.

## Marketing sends cannot be taken back

**Send now sends.** No confirmation, no preview, no test send, no schedule, no cancel. One press can text two thousand people, and there is no way to stop it once it has started.

- **Marketing email carries no unsubscribe link.** Texts carry "Reply STOP"; email carries nothing, which is a legal problem. Do not use the email channel for marketing until it has been fixed.
- Automations only run when something outside the system calls them on a schedule. If that was never set up, a rule sits there doing nothing until somebody presses **Send now**.
- Nothing can be deleted — an automation or a promo code can only be paused or disabled.
- Saving an automation under a changed name creates a second automation rather than renaming the first.
- The birthday rule can never fire, because no birthday is collected anywhere in this system.
- The money figures are rough: earned is the whole order total and not your margin, cost is counted at 4p a message rather than by length, and commission saved is a flat estimate applied to everything you took direct — including the orders you would have had anyway.

## Promo codes: the rules you cannot bend

- One code per order. Codes never stack.
- A percentage **never** comes off the delivery fee, even at 100%.
- A code has no start date — it is live the moment you save it, so it cannot be prepared in advance.
- Saving a code switches it back on, so re-saving a disabled code re-enables it. Editing is the only way to change one, and there is no delete.
- Codes are checked on the server on every order, so nothing gets past them and there is no override at the counter.

## Reviews go no further than this screen

There is **no customer review form and no import from Google**, so the list will not grow on its own.

A reply you type is stored here and nowhere else: **Google never sees it and the customer is never told.** Once saved, a reply cannot be edited. Review request texts do go out after an order, pointing at your Google listing, but whatever the customer writes there stays there.

## Staff: no starters, no leavers, no timesheet

You can change somebody's role and clock them on and off. That is all.

**You cannot add a starter or remove a leaver**, and you cannot change a PIN — staff and PINs are settings and need LaunchFlow. "Hours this week" is a fixed number that clocking on and off does not change; there are no timestamps behind it and it is not a timesheet.

Nothing stops a manager taking away their own access, and nothing records who changed a role.

## Some of what you change here can be overwritten

The site rebuilds itself from your shop's settings file every time the software is updated or restarted. Anything that also lives in that file is put back to what the file says:

**prices, product names and descriptions, sold-out and hidden flags, opening hours, delivery bands, staff roles, hours and on-shift flags, stock levels, driver status, deal prices, and the promo codes the shop was set up with.**

Orders, customers, and promo codes you created yourself are never touched.

Day-to-day trading is safe — a price you put up this evening will hold this evening. But **anything meant to be permanent has to be told to LaunchFlow**, or it will come back one day, usually the day after an update.

## And a few plain absences

- No customer-facing help or FAQ, and no translation — every screen and every text message is in English only.
- No stock, sales or accounts export beyond the orders spreadsheet.
- No way to edit these help articles from inside the app.
- Anything switched off for this shop simply is not mentioned in help at all, rather than being explained and then withheld.

## If it is not on this list

Search the help centre for what you are trying to do, in your own words. If nothing comes back, it is worth ringing before you spend twenty minutes hunting for a button that was never built — see **Who to ring**. The shop's own number is {phone}.

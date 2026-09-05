---
id: website-looks-wrong
title: The website is down or looks wrong
summary: Check what a customer actually sees, rule out the four things a shop causes itself, then ring LaunchFlow.
kind: runbook
screens: []
roles: [manager, shift_lead]
keywords: [website down, site down, website not working, site not working, cant order, customers cant order, site broken, website wrong, page not loading, shows closed, says we are closed, no menu, missing items, prices wrong on site, error, 404]
requires: []
updated: 2026-09-05
---

## You will know because

A customer rings to say the site will not let them order, or that it says you are closed when you are stood in the shop with the ovens on. Or somebody notices the menu looks wrong.

## Do this now

1. **Look at it the way a customer does.** Your own phone, on mobile data rather than the shop wifi, not signed in to the back office. A good half of "the website is down" is one person's broadband.
2. **Is it telling people you are closed?** That is the commonest cause and it is nearly always something in here:
   - The customer sees **"Ordering is paused"** with a reason at the checkout, and **Paused** with a reason on the contact page. Somebody paused it. Press **Resume** on the kitchen header, or choose **Resume** on **Hours & pause** and press **Apply**.
   - The site says **Pre-order for later** when you should be open? Go to **Hours & pause** and read today's row. **A time typed in a format the box will not accept is dropped silently and saves as blank — and blank means closed.** Retype both times and press **Save hours**, then read the grid again to check they stuck.
3. **Are items missing, or priced wrong?** Open **Menu & pricing**. The small line above the heading counts *"N sold out"* and *"N hidden"* — hidden items are gone from the website entirely and come back with **Show**; sold-out items are still on the menu with a tag. If **every** price has gone back to what it used to be, this is not a website fault: read *I changed something and it has come back*.
4. **If nothing loads at all** — on two different phones, on mobile data, from the shop's own address — that is not something the shop can fix. **Ring LaunchFlow.** While you wait, take orders on the phone on {phone} and put them through your own till. Do not tell people you are shut.
5. **Check whether it is really down.** If tickets are still appearing on the kitchen board, the site is working for somebody, and the problem is narrower than it looks.

## What the system does and does not do

**No screen in the back office tells you whether the website is up.** The one page that checks the domains needs the LaunchFlow key, so no manager password will open it.

There is **no status page and no alert**. If the site stops at eight on a Friday, nobody is told automatically — not you, not LaunchFlow. Ringing them is what starts the clock.

You cannot restart anything, clear a cache or undo an update yourself. **Clear menu cache** exists, but it lives on the LaunchFlow screen behind their key.

Not every item has a photograph. The ones without show a plain tile with the item's initials. That is normal and not a fault.

The back office and the kitchen board can be up while the customer's site is broken, and the other way round — they are the same system but staff sign in through a different door.

## If it is still wrong

Ring LaunchFlow and give them five things: what you typed to get to the site, what you saw (a photo of the screen beats a description), which phone and which network, roughly when it started, and whether orders are still landing on the kitchen board.

## Afterwards

If you paused ordering or edited the opening times while you were working it out, **put them back**. Nothing does it for you.

Then look at the site one more time as a customer and check it says **Open now**, before you go back to the pass.

---
id: delivery-zones
title: Delivery areas and charges
summary: The postcodes you deliver to, what each area pays, and what a software update wipes.
kind: guide
screens: [zones]
roles: []
keywords: [delivery area, delivery charge, delivery fee, postcode, postcodes, do we deliver there, out of area, minimum order, charge more, far away, RM17, RM20, band, bands, extra time, change the shop phone number, change the address]
requires: []
updated: 2026-09-05
---

Delivery zones does two jobs: it says **where** {shop} will deliver, and it says **what it
costs** to get there. There is one section for the shop.

The shop's address and phone number are also edited on this screen, which is not where
anyone would look for them. See the last section.

## The districts you deliver to

The box at the top, **Postcode districts we deliver to**, is the whole delivery area. Type
outward codes separated by commas — today that is `RM15, RM16, RM17, RM18, RM19, RM20`.

- The outward code is the first half of a postcode, the bit before the space. `RM20` out of
  `RM20 3AA`.
- **A letters-only entry covers the whole area.** Put `RM` in on its own and every RM
  district can order, RM1 to RM20 and beyond. That is a big net — use it deliberately.
- A postcode that matches nothing in this box cannot place a delivery order at all. They can
  still order for collection.

Underneath are the shop's standard terms, which apply anywhere no band names:

- **Standard delivery fee £** and **Minimum order £**
- **Collection time (min)** and **Delivery time (min)** — the waits quoted to customers
- **Address** and **Phone**

Press **Save shop settings** and it is live.

## Charge bands

A band is how you charge more to reach the far end of the patch. Each band is a name, a list
of districts, a fee, a minimum order, and extra minutes on the delivery time.

Today there are two:

| Band | Districts | Fee | Min order | Extra time |
| --- | --- | --- | --- | --- |
| Grays & Little Thurrock | RM17 | £1.99 | £9.99 | 0 |
| Chafford & West Thurrock | RM16, RM20 | £3.49 | £14.99 | 15 |

**To add one:** fill in the blank row at the bottom — **Area name**, **Districts** (the only
one you must fill in), **Fee £**, **Min £**, **Extra min** — and press **Add band**.

**To change one:** type over the boxes on its row and press **Save** on that row.

**Fee £ starts at 0.00 on the blank row.** Leave it there and that area gets free delivery —
a band's fee is taken exactly as typed. Type the fee before you press Add band.

Five rules worth knowing:

- **A named district always beats a whole area.** With a band on `RM` and another on `RM20`,
  an RM20 address pays the RM20 price. That is the point of banding — you list the far
  district precisely because it costs more.
- **Where two bands name the same district, the one higher up the list wins.** The list is in
  the order the bands were added, so an older band quietly beats a newer one. If a price
  looks wrong, check no band further up is also claiming that district.
- **A band's minimum left at £0.00 uses the shop's own minimum**, rather than dropping the
  minimum to nothing. That is deliberate — leave it at zero unless the area genuinely needs
  a different minimum.
- **Extra minutes are added to the wait quoted** to that area, on top of the shop's standard
  delivery time.
- **A band with no districts is not saved.** Clear the Districts box on a row, press Save, and
  nothing happens — no change, no warning. The old districts are still there when you reload.

**A band does not open up a new area.** If a district is not in the top box, an address there
is turned away before any band is looked at. To start delivering somewhere new: add the
district to the top box first, then add the band.

With no bands at all, the panel says so, and everywhere pays the shop's standard fee.

## Postcodes not distance

The whole thing works on postcode districts and nothing else. There is **no radius, no
drive-time, no mileage and no drawn map**, and there is no way to add one.

So a house at the very far edge of RM17 pays exactly the same as one across the road from
the shop, because they share a district. The only way to charge that house more is to give
its district its own band — which charges everyone else in that district more too.

Districts are also fairly big. If the split you need runs down the middle of a district, this
screen cannot express it.

## Remove has no confirmation

The **Remove** button sits on each band's row, right next to **Save**, and they are the same
size and the same colour.

**Remove deletes the band the instant you press it.** No "are you sure", no undo, and no
record of what was in it. Anywhere that band covered immediately falls back to the shop's
standard fee and minimum, which usually means you are suddenly delivering to the far
districts at the near price.

Before you press it, write the band's details down. Putting it back means typing all five
boxes again.

## Bands can be wiped by a redeploy

Bands live in the database, but **the shop's config file is what rebuilds them.** Every time
the software is updated or restarted — and every time LaunchFlow presses Reload config — the
setup wipes every band and recreates the ones written in the file.

A band you add on this screen survives day-to-day trading fine. It does **not** survive that.
Neither do the districts, fees, minimums, times, address or phone in the top box.

So: make the change here so tonight is right, then **tell LaunchFlow what you changed** so it
gets written into the config file properly. Otherwise it will quietly go back to how it was,
usually on a night nobody notices, and you will be delivering to Chafford for £1.99.

If a change has already reverted, that is what happened — make it again and ring them.

## The shop address is in this form

The **Address** and **Phone** boxes sit in the delivery box on this screen, which is an odd
place for them. They are the shop's real details and they show on the website.

Change either one, press **Save shop settings**, and it is live. As with everything else on
this screen, tell LaunchFlow so the config file matches, or the old address will come back
on the next update.

## What this screen cannot do

- No second shop. Adding a branch is a config job.
- No map, no radius, no distance-based pricing.
- No different charges by day or time.
- No "free delivery over £25" — the nearest thing is a Free delivery discount code on the
  Promotions screen, and the customer has to type it.
- No way to test a postcode from this screen. The town pages on the website have a **Check
  delivery** box, and it answers with the real band fee and minimum for that postcode — not
  the shop's headline price. Use it to check a band you have just added before the first
  customer does. It does not quote the wait, so extra minutes have to be taken on trust.

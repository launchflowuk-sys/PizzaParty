---
id: inventory
title: Inventory — a shopping list, not stock control
summary: What the counters mean, why nothing counts down as you sell, and what to do when you actually run out.
kind: guide
screens: [inventory]
roles: []
keywords: [inventory, stock, stock control, ingredients, run out, run low, out of stock, 86, no dough, no cheese, par, reorder, order more, supplier, delivery came in, level]
requires: []
updated: 2026-09-05
---

## What this screen is

**A shopping list.** That is the honest description, and reading it any other way will cost you money.

Sixteen ingredients, one to a row, under the headings **Ingredient**, **On hand** (what you have), **Par** (what a busy night needs), **Level** (a bar showing one against the other), **Supplier** and **Status**. The status reads **In stock**, **Below par** or **Out**.

Four counters run along the top: how many lines are Out of stock, how many are Below par, how many are On order, and the percentage at or above par.

**Nothing on this screen counts down as you sell food.** Sell forty margheritas and the flour figure does not move. The numbers change only when LaunchFlow updates your settings — and when they do, they go back to whatever is written in the file.

So the counters tell you what somebody last wrote down, not what is in the cupboard. Useful as a prompt before you ring the supplier. Useless as a live figure.

## Reorder does not order

The **Reorder** button on each row, and **Reorder everything below par** at the top right, do exactly one thing: they put a flag on the line. The button then reads **On order** and greys out, and the On order counter goes up by one. (The top button is greyed out when nothing is below par.)

**No message goes to the supplier.** No email, no text, no order form. Nobody outside this screen knows anything happened.

You still have to ring the supplier. The flag is a note to yourself and to the next person on shift that the ringing has been done.

## You cannot clear on order

Once a line says **On order**, there is no button to book the delivery in. Nothing says "it arrived", nothing puts the On hand figure back up.

The flag stays until LaunchFlow next updates your settings, at which point every line goes back to what is written in the file — on-hand figures, par levels and On order flags alike. Most lines come back unflagged, but any that are written as on order in the file come back flagged, whatever you did on this screen.

In practice that means the On order counter drifts upwards over a few weeks and stops meaning anything. Do not use it as a to-do list.

## Stock lines come from config

All sixteen lines — the names, the units, the on-hand figures, the par levels and the suppliers — come from your shop's settings file, which LaunchFlow holds. They are **sample data**, put there to fill the screen.

You cannot add an ingredient, rename one, change a par level, change a supplier or remove a line you do not use. All of that is a ring to LaunchFlow.

## Use sold out instead

**This screen has no effect at all on what customers can order.** Every line on it could read **Out** and the website would carry on selling pizza all night. There is nothing on this screen you can press to stop that — no switch here reaches the customer.

When you genuinely run out of something, the fix is on **Menu & pricing**:

1. Open Menu & pricing and find the item.
2. Press **Mark sold out**. It disappears from the customer's menu straight away.
3. When the delivery arrives, press **Sold out — put back on**.

For toppings and extras, scroll to **Options & toppings** at the bottom of Menu & pricing and click the pill. Green is on, red with a line through it is off.

There is no group switch — if you have no dough at all, every pizza has to be done one at a time. And **nothing clears a sold-out flag overnight.** Whatever you switch off tonight is still off tomorrow lunchtime unless somebody remembers. That is the single most common way a shop loses money on this system.

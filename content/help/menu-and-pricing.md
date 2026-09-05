---
id: menu-and-pricing
title: Changing prices and marking things sold out
summary: Put a price up, take an item off, add a new one, and reshape the whole menu.
kind: guide
screens: [menu]
roles: []
keywords: [price, prices, put prices up, price change, cheaper, dearer, sold out, out of stock, run out, ran out, 86, no dough, hide item, take it off, new product, add item, photo, topping, toppings, extra cheese, rename, search the menu, find an item, filter]
requires: []
updated: 2026-09-05
---

Menu & pricing is the screen you will use more than any other, usually in a hurry, usually
to take something off. It holds all 68 items in seven categories, with the prices, the
names, and the toppings underneath.

Everything here goes live the moment you press it — Save on a box, or a single click on a
button or a topping pill. The website changes straight away. There is no publish step, no
draft, and no Undo — to put something back you change it back.

## Finding an item

Sixty-eight items is a lot of scrolling when the phone is going. Don't scroll — use the
box at the top headed **Find an item**. It sticks to the top of the screen as you move
down the page.

- Press the **/** key anywhere on this screen and the cursor jumps into the box. You don't
  have to reach for the mouse. (It won't steal the key if you are already typing in a
  price or a name box.)
- Type a few letters. Rows disappear as you type — you don't press Enter and nothing
  reloads.
- The counter on the right of the **Find an item** bar says how many are left, like **4 of
  68**. Each category bar changes to match, like **3 of 30**.
- A category with nothing matching hides itself. A category with a match springs open even
  if it was closed, so a result is never hidden behind a shut category. (Big categories
  start closed — Pizzas has thirty items — so searching is quicker than opening them.)
- Press **Clear** (it appears next to the box once you have typed something) to bring the
  whole menu back.

**What it actually searches.** The item's name and its description, nothing else. The box
says "Type a name or a topping", and a topping will only be found if somebody wrote it into
an item's description. The **Options & toppings** panels at the bottom of the screen are
never filtered — scroll down to those.

## Reading the colours

You should be able to tell the state of the menu from across the kitchen without reading a
word.

- The small line **above** the heading is the running count: **Back office · 68 items ·
  3 sold out · 1 hidden**. Sold out is in red, hidden in amber. If both are zero, neither
  is shown.
- **A sold-out row turns pale red with a solid red bar down its left edge.** The button on
  that row goes solid red too and reads **Sold out — put back on**.
- **A hidden row fades out, gets a grey bar down its left edge, and its name is struck
  through.**
- A category bar carries a red **N sold out** tag when anything inside it is off.

## Putting a price up

Each size has its own little box with its own **Save**. Change the number, press the Save
next to it, and that is done — that size only. Doing a whole pizza in five sizes means five
saves.

Prices are in pounds and pence, so `13.64`. You can type the £ sign or leave it out.

**Type a real number.** If what you type is not a number the screen does not refuse it — it
saves the price as **£0.00** and the item goes out at nothing. Check the box shows what you
expect after you save.

There is no bulk price change and no percentage increase. A menu-wide rise means going
through the sizes one at a time.

Do not ask for it to be done "in the config" instead. The menu belongs to the shop now, and
the only way to push a config menu back over the top would throw away every other change
made since — every price, every new item, every topping.

## Sold out

Find the item, press **Mark sold out**. The row goes red and the button changes to **Sold
out — put back on**. Press it again to put it back.

On the website the item stays where it is, with a **Sold out** tag where the **Add** button
used to be. Nobody can add it to a basket, and it is dropped out of any basket that already
had it.

Three things worth knowing:

- **Nothing counts stock down.** Sold out is a switch a person presses. Selling the last
  one changes nothing on this screen.
- **Nothing clears it overnight.** An item you marked off at nine on Friday is still off on
  Saturday lunchtime. This is the single most common way a shop loses money on this system.
- **It is set for the whole menu, not per shop.** {shop} runs two shops, Grays and
  Basildon, and there is no per-shop switch on this screen. Mark something off and it is
  off at both. The same goes for prices, names and Hide — one menu, both shops. If Grays
  has run out and Basildon has not, this screen has no way to say so.

## Hiding vs sold out

Two different jobs, and people mix them up:

- **Mark sold out** — for tonight. The item stays on the menu, clearly marked, and
  customers can see you normally do it.
- **Hide** — for good, or for a long stretch. The item vanishes from the website
  completely. Press **Show** to bring it back.

Use sold out when the delivery is coming tomorrow. Use Hide when you have stopped doing it.

## Featured

The star button next to each item. Grey outline star = normal. Press it and it turns amber
and reads **★ Featured**.

Featured items are pushed to the front of the four tiles under **Tonight's menu** on the
website's home page. Only four fit, so starring twenty items does not put twenty on the
home page — it just means the four you get are picked from a bigger pile, and which four
you get is out of your hands. Star the three or four you actually want on there.

An item that is marked sold out drops out of those four and the next one moves up, so the
home page never advertises something you have not got.

## Renaming and descriptions

The name and the description sit in the same little form with one **Save**, so they go
together. Change one, press Save, both are written.

Keep the name short — it has to fit on a phone. The description is the line underneath it
on the website.

**Do not save an empty name.** The screen will let you, and the item goes out on the website
with no name.

## Reordering

The **↑** and **↓** buttons move an item up or down **inside its own section**.

To move an item into a different section, open it with **Edit** and use the Section box
there. Be aware this changes its web address, because the section is part of it — the item
is at `/menu/pizzas/margherita`, so moving it to Sides moves the link too.

To reorder the sections themselves, open **Sections** at the top of the screen and use the
arrows there. That order is the order customers see, and it decides which section they land
on first.

## Toppings and options

Right at the bottom of the screen, under **Options & toppings**. There are two groups:

- **Base** — the bar says *choose 1*. Tomato base, BBQ base, Garlic base.
- **Extra toppings** — the bar says *choose 0–8*, which is the screen's way of saying a
  customer can have none or up to eight. Sixteen toppings, each showing what it adds to
  the price.

Each option is a pill you click:

- **Green** means it is on and customers can pick it.
- **Click it and it turns red with a line through it** — off. Straight away, on every
  product that offers it, that topping goes pale and cannot be ticked. It stays listed
  on the website rather than vanishing, so the customer can see you normally do it.

While anything in a group is off, that group's header bar turns red and the right-hand side
says how many, like **· 3 off**. So you can see from the bar whether you have left something
switched off.

There is no confirmation and no undo — clicking the pill again is the undo. And as with
items, **nothing switches these back on overnight**. Run out of chicken on a Friday and
chicken is still off the pizzas on Sunday unless someone puts it back.

## Adding a new item

**+ Add an item** at the top of the screen. Give it a name, pick the section, name its first
size and price it. It is live straight away, at the bottom of its section.

It is created with **one size** on purpose — an item with no sizes has no price and cannot
be put in a basket, so it would sit on the menu refusing to be ordered. Open it with
**Edit** afterwards to add more sizes, choose which toppings it offers, and put a photo on
it.

### Sections

**Sections** at the top of the screen: rename them, reorder them, add one, delete one.

A section will not delete while it still has items in it, and it says how many. That is
deliberate — deleting Pizzas and taking thirty pizzas with it is not something anyone should
be able to do with one click at the end of a shift. Move or delete the items first.

### Deleting an item

On the item's own screen, at the bottom. **Past orders are unaffected** — every order line
keeps its own copy of the name, size and price it was sold at, so takings and order history
read exactly the same afterwards.

Delete is for something put on by mistake. For "not this season", **Hide** is the right
answer: it comes off the website and can be brought straight back.

### None of this gets overwritten

Everything you change here belongs to the shop. The menu was set up from a file once, when
the site was built, and since then the shop owns it — an update to the website will not put
last month's prices or a deleted pizza back.

## Photos

Open an item with **Edit** and there is a **Photo** box under *Photo and labels*.

There is still **no upload** anywhere in the back office. The box takes the address of a
picture that is already on the site, like `/images/products/margherita.jpg`. So new
photographs still go to LaunchFlow to be put on the server — but once they are there, which
item uses which picture is yours to set.

An item with no photo shows a plain tile with its initials on the website. That is a
deliberate fallback, not a broken image, and the item sells perfectly well without one.

The same box also carries **labels** (vegetarian, spicy) and **allergens**, typed as plain
comma-separated lists.

## Two people at once

The sold-out, hide and star buttons all read the current setting and then write the
opposite. They do not lock the row while they do it.

If two people press the same button at the same moment — you on the tablet, someone else on
the office computer — the two presses can cancel each other out and the item ends up back
where it started. It looks like nothing happened, because effectively nothing did.

**Always glance at the row after you press.** Red background and a red button means it is
genuinely off. If the row still looks normal, press it again.

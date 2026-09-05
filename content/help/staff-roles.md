---
id: staff-roles
title: Staff and what each role can open
summary: The five roles and their screens, changing somebody's role, and why PINs need replacing.
kind: guide
screens: [staff]
roles: []
keywords: [staff, team, roles, permissions, who can see what, access, change role, manager, shift lead, kitchen, driver, front of house, pin, pins, password, new starter, leaver, remove staff, add staff, clock on, clock off, hours, timesheet, rota]
requires: []
updated: 2026-09-05
---

Staff lists everybody on the books, what role they hold, and whether they are on shift tonight. Beside it, under the heading **Role permissions**, is the matrix — the actual, enforced answer to "what can she see?".

## The five roles

The matrix on the right is not a diagram of how it ought to work. It is the same table the software reads. A square that is empty means that role cannot open the screen, cannot see it in the sidebar, and is sent somewhere else if they type the address in by hand.

Every role can open **Help**, so that row is filled all the way across. The rest:

- **Manager** — everything. Every square is filled.
- **Shift lead** — Dashboard, Kitchen queue, Orders, Dispatch, Inventory, Reviews, Hours & pause. Enough to run a service. Not prices, not promo codes, not customers, not staff.
- **Kitchen** — the Kitchen queue, and nothing else but Help.
- **Driver** — the Kitchen queue and Dispatch.
- **Front of house** — Dashboard, Kitchen queue and Orders. Enough to answer the phone with.

One row does not behave like the rest. **LaunchFlow** shows as filled for Manager, but that screen also needs LaunchFlow's own key on top of the sign-in. A manager who opens it without the key is turned away. Nobody at the shop is expected to get in there.

Note what nobody except a manager can reach: **Menu & pricing, Deals, Promotions, Customers, Campaigns, Marketing, Staff and Delivery zones**. If you want a shift lead to be able to put an item sold out during service, they cannot — that is a manager's screen. Plan around it rather than handing your own PIN out.

## Changing someone's role

In their row, pick the new role from the dropdown and press **Save** next to it.

**It does not take effect until they sign in again.** Their role is fixed at the moment they key their PIN in, and it stays that way for as long as that sign-in lasts — up to twelve hours. Nothing signs them out and nothing warns them.

So if you have just taken access away from somebody who is still standing at the tablet, taking access away is not enough on its own: make them sign out and back in, or take the tablet.

Two warnings. **A role change is undone by a re-seed** — if LaunchFlow reloads the shop's settings, every role goes back to what is written in the shop's setup file, silently. If a role change is meant to be permanent, tell LaunchFlow so they write it down. And see **Do not demote yourself** below.

## Adding a starter or removing a leaver

You cannot do either from this screen. There is no **Add**, and there is no **Remove**.

Staff, their phone numbers and their PINs all live in the shop's setup file. Adding a starter or taking a leaver off means ringing LaunchFlow — see **Who to ring** — and it is not instant.

**That matters on the day somebody leaves.** Their PIN keeps working until LaunchFlow removes them, and a sign-in already issued lasts twelve hours regardless. If a leaver goes badly, ring LaunchFlow the same day and say it is urgent.

## PINs

Each person signs in with their own 4 to 8 digit PIN at the back-office sign-in box, which is how the roles above get enforced at all. The PIN itself is never stored in a readable form.

**The PINs this shop was set up with are 1111, 2222, 3333 and so on, and they are written down in the shop's setup file, which is not private.** They are placeholders from the build. They must be replaced with real ones before the shop goes live, and there is no screen anywhere that changes a PIN — it is a job for LaunchFlow.

There is one thing to understand about how they are replaced: a person's PIN is only ever written when that person is first created. Reloading the shop's settings afterwards does **not** put the old PIN back. So once LaunchFlow has set a real PIN for somebody it stays set — but until then, anyone who has seen the setup file can sign in as the manager.

Treat that as the single job to chase before launch.

## Hours this week is decorative

The **Hours this week** column is a fixed number that was typed into the shop's setup file. It is there so the screen has something in it.

**Clock on** and **Clock off** flip the **Tonight** tag between *On shift* and *Off*, and that is all they do. No time is recorded, nothing is added up, and the hours number does not move — not by a minute, however long somebody is clocked on.

This is not a timesheet and cannot be used as one. Reloading the shop's settings resets both the hours and who is on shift back to the numbers in the file. Keep paying your staff from whatever you use now.

## Do not demote yourself

Nothing stops a manager changing their own role. Set yourself to Kitchen and press **Save**, and nothing appears to happen — you carry on as a manager for the rest of the shift. The next time you sign in with your PIN you get the kitchen queue, the sidebar down to two items, and no Staff screen. You cannot put it back, because putting it back is a manager's screen.

That delay is the nasty part: the mistake is made today and lands tomorrow, by which time nobody remembers doing it.

If it happens, the way back in is the shop's own password rather than your personal PIN — that signs you in as a manager regardless of what the staff list says, and you can set your role back from there. If you do not have the shop password to hand, ring LaunchFlow.

Easiest of all: change your own role only when somebody else in the shop is a manager too.

---
id: signing-in
title: Signing in and signing out
summary: One box, three ways in, and how long the system keeps you signed in.
kind: guide
screens: []
roles: []
keywords: [login, log in, sign in, signing in, password, pin, forgot my pin, forgot password, cannot get in, locked out, wrong password, wrong pin, sign out, log out, kitchen pin, tablet, shared tablet, no access, denied, someone else logged in]
requires: []
updated: 2026-09-05
---

## One box, three ways in

The back office signs in at `/admin/login`. There is one field, labelled **Password or staff PIN**, and a **Log in** button. What you type decides which way in you are using.

- **4 to 8 digits** is tried as a personal staff PIN.
- **Anything else** is tried as the shop's own password, which gives full manager access.
- **The agency key** is only asked for when you arrive at the LaunchFlow screen. The field then says **Agency key** instead.

A wrong PIN and a PIN that belongs to nobody look exactly the same, and every attempt takes the same moment to come back. That is deliberate — it stops somebody at the counter guessing their way in.

## Signing in with your own PIN

Use your own PIN wherever you can. It is the only way the system knows who you are, and it is what decides which screens you get. The sidebar, the page you land on and every Save button all read the same list.

Type your PIN, press **Log in**, and you land on the first screen your role can open. Your name and your role are printed at the bottom of the sidebar, under the menu. **If it says somebody else's name, the last person did not sign out** — press Sign out and start again, or everything you do this evening is recorded against them.

You cannot change your own PIN, and there is no "forgot my PIN" link. PINs are set up by LaunchFlow.

## The shop password

The shop password is the owner's own way in. It signs you in as **Owner**, with the manager role, which means everything: prices, promotions, campaigns, staff, delivery charges.

It is not a personal login. Nothing anywhere records which person used it, so if four people know it, four people are all "Owner". Use it for the owner and for setting the shop up. Everybody else should use their own PIN.

## The agency key

The LaunchFlow screen at `/admin/launchflow` needs a separate agency key, on top of being signed in. A manager who can open every other screen in the building will still be told **Agency key required** there. That is normal, not a fault — it is the screen that can wipe your settings, so it is kept behind LaunchFlow's own key.

## The kitchen tablet

The kitchen board at `/kitchen` has its own sign-in at `/kitchen/login`, which asks for one shared kitchen PIN. That is for the tablet on the wall: sign it in once and leave it.

If you sign in at `/admin/login` with your own personal PIN instead, you get the kitchen board as well without a second sign-in. Every role in this shop is allowed to open the kitchen board, so any staff PIN unlocks it.

The difference matters. A tablet signed in with the shared kitchen PIN has no person and no role behind it — it can show the ticket board and nothing else. **There is no back office and no help centre on it at all**: tap through to any `/admin` address and it asks for a password or a PIN. If somebody on the tablet needs to look something up in help, they sign in with their own PIN on the back-office sign-in page, on that tablet or another device.

## Signing out

- **In the back office:** the **Sign out** button at the bottom of the sidebar, under your name.
- **On the kitchen board:** the **Sign out** button along the top, past Enable sound.

Either button signs you out of everything, **including the kitchen board**. If you press Sign out on the wall tablet mid-service, somebody has to key the kitchen PIN back in before tickets appear again. On a shared tablet that is almost never what you want — leave the tablet alone and sign out on the office computer instead.

## How long you stay signed in

| Where | How long |
| --- | --- |
| The back office | 12 hours |
| The kitchen tablet | 30 days |
| The LaunchFlow screen | 4 hours |

When the time runs out you are simply sent back to the sign-in page the next time you press something. Nothing warns you first, and nothing is lost — you were not part-way through anything the system was holding.

## When somebody leaves

Ring LaunchFlow and have them made inactive. Two things to know before you rely on it:

- It stops them signing in **again**. It does not end a sign-in they already have. If they signed in at the start of the shift, that sign-in keeps working until it runs out, up to 12 hours.
- If it is urgent, the shop password and the kitchen PIN want changing too, because those are the credentials most likely to have been passed around. Both are settings on the server, so LaunchFlow has to change them.

## If a screen will not open

**Nothing tells you.** Type in the address of a screen your role cannot open — or follow a link to one — and you are simply put on the first screen you *can* open, with no message, no warning and nothing in red. The only clue is the address bar, which carries `?denied=menu` (or whichever screen it was) after the redirect.

So if a link keeps dumping you back on the Dashboard or the kitchen queue, that is what has happened: your role does not include that screen. Nothing is broken and nothing you did caused it. A manager can change a role on the Staff screen; read **Staff and roles** for what each role can reach.

## What signing in cannot do

- There is no self-service password or PIN change, and no reset link. Every change goes through LaunchFlow.
- There is no record of who signed in, when, or from which device.
- Nothing tells you the shop password has been shared around.
- Marking somebody inactive does not throw them out of a session they already have.

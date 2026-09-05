---
id: driver-off-radar
title: A driver has gone off-radar
summary: There is no tracking of any kind. Work out what left the shop, then free the driver up.
kind: runbook
screens: []
roles: [manager, shift_lead, driver, front_of_house]
keywords: [driver gone, where is my driver, driver not back, driver missing, driver not answering, lost driver, track driver, gps, live tracking, late delivery, reassign driver]
requires: []
updated: 2026-09-05
---

## You will know because

A driver left twenty minutes ago and nobody has heard from them, or a customer rings asking where their food is and you cannot say.

## Do this now

1. **Ring the driver from your own phone.** Their number is **not** on the Dispatch screen — the driver table shows name, vehicle, status, order number and a "Back at" time, and nothing else. Keep the drivers' numbers in your own phone or on the wall.
2. **Check the kitchen board.** Is that ticket still sitting in **Ready**, or has it moved to **Out for delivery**? That tells you whether the food actually left the shop.
3. **Ring the customer** and tell them where you are up to, before they ring you.
4. **To send someone else out:** on **Dispatch**, find the missing driver's row and press **Set available** — that clears the order off them and wipes their "Back at" time. Then in the **Ready to go** panel on the right, pick the free driver from the **Assign driver…** dropdown and press **Go**. Only drivers showing **Available** appear in that dropdown. **Dispatch** opens for a manager, a shift lead or a driver; front of house does not get it, so ask one of them.
5. **When the food is finally delivered**, press **Delivered** on that ticket on the kitchen screen — a collection ticket says **Collected** instead — so the customer's tracking page stops saying it is on its way.

## What the system does and does not do

There is **no GPS and no live tracking of any kind**. The map on Dispatch is a drawing: the shop is a square in the middle and the pins are placed by position in the list. They mean nothing at all.

**"Back at" is always half an hour from the moment you assigned the job**, whatever the distance.

Assigning a driver does not tell the driver anything, does not print anything and does not move the order along — someone still has to hand over the food and press **Out for delivery** on the kitchen screen.

A driver can only hold one job at a time. Pressing **Go** marks them **On delivery**, which takes them straight out of the **Assign driver…** dropdown until somebody presses **Set available** on their row.

The **Ready to go** panel lists delivery orders only, and only ones somebody has pressed **Cooking** on, or that are **Ready**. A ticket that has been accepted and not started yet is not on it, even though it is sitting in the **In the oven** column. A collection order never appears there at all.

Drivers themselves come from your shop's setup file. They cannot be added, renamed or removed on this screen, and the ones in there today are sample entries with made-up phone numbers.

## If it is still wrong

This is usually a people problem, not a software one — follow your own procedure first. Ring LaunchFlow only if a driver's row will not change status at all.

## Afterwards

**Set the driver's status correctly on Dispatch.** The button on each row only ever offers one of two things: **Set available** for a driver who is off shift or out on a job, and **Set off shift** for one who is showing available. So a driver coming back for the night takes two presses — **Set available** first, then **Set off shift**.

If you leave a driver marked **On delivery**, they will not appear in the **Assign driver…** dropdown and the count at the top of the screen will read short.

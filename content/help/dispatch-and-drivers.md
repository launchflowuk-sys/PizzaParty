---
id: dispatch-and-drivers
title: Dispatch — sending a driver out
summary: What assigning a driver actually does, why the map is only a drawing, and where the drivers come from.
kind: guide
screens: [dispatch]
roles: []
keywords: [dispatch, driver, drivers, assign, send out, delivery, map, tracking, where is my driver, driver not back, gps, back at, ready to go, off shift, available, rider]
requires: []
updated: 2026-09-05
---

Dispatch is a whiteboard for who is out and what is waiting. It keeps a record. It does not talk to anybody.

The line at the top right says how many drivers are free — *2 of 4 drivers free*.

## Assigning a driver

The **Ready to go** panel on the right lists delivery orders waiting, oldest first, with the order number, the customer, what is in it, the total and how long it has been waiting.

1. Find the order.
2. Open the **Assign driver…** dropdown beside it. Only drivers currently marked **Available** appear in that list.
3. Press **Go**.

That does three things and no more:

- marks the driver **On delivery**;
- puts the order number in their row;
- sets a **Back at** time.

The driver's row in the table underneath shows all three. When they get back, press **Set available** on their row — that clears the order and the Back at time and puts them back in the dropdown.

There is one button on each row and it changes with the driver's status. A driver who is Available shows **Set off shift**; a driver who is On delivery or Off shift shows **Set available**. Setting someone off shift does not remove their row — they stay in the table marked **Off shift**, and drop out of the dropdown and out of the "drivers free" count.

**Go** is greyed out whenever no driver is marked Available. If it will not press, that is why.

## What assigning does not do

This is the part that catches people out. Pressing Go:

- **does not touch the order.** The ticket does not move. Somebody still has to press **Out for delivery** on the kitchen screen, or the customer's tracking page will sit on "Ready" while the food is in a car.
- **does not tell the driver anything.** No text, no app, no notification. You still have to hand them the food and say where it is going.
- **produces no job sheet.** There is nothing to print. The address is on the kitchen ticket.
- **does not show you their phone number.** There is no phone column on this screen. Driver numbers are not in the back office at all — keep them in your phone.

Think of it as writing on a whiteboard, not sending a job.

## The map is not a map

The grey grid at the top left is a **drawing**. It is a placeholder, and the small print in its corner says so.

The black square is the shop. Each pulsing accent square is a driver marked On delivery — but the pins are placed by their **position in the list**, not by where anybody is. Move a driver up the list and their pin moves across the screen.

**There is no GPS anywhere in this system.** Nothing tracks a car, nothing knows a distance, and nothing knows when a driver got somewhere. If you need to know where a driver is, ring them.

## Back at 30 minutes

The **Back at** column is always the time you pressed Go plus **30 minutes**. Every time, for every order, whatever the distance.

A drop in Grays and a drop in Aveley get the same 30 minutes. It is a rough note to yourself, not a prediction. Do not chase a driver because their Back at time has passed, and do not assume they are fine because it has not.

## Ready to go includes unfinished food

The Ready to go panel lists delivery orders that are **Ready** *and* ones still **Being prepared**. That is deliberate — it lets you line a driver up while the last pizza is in the oven.

It also means **an order on this list is not necessarily bagged and waiting**. Check the kitchen board before you send someone to the pass for it.

Collection orders never appear here.

## Drivers come from config

The four drivers on this screen come from your shop's settings file, which LaunchFlow holds. From this screen you can only change a driver's **status** and who is on which order.

You **cannot** add a new driver, change a name, change a vehicle or remove somebody who has left. That is a ring to LaunchFlow.

Today's four — Marek, Aisha, Danny and Kasia — are **sample entries with made-up phone numbers** put in to fill the screen. Before you run real deliveries through this, give LaunchFlow your actual drivers.

One more thing: driver statuses are rebuilt from that same settings file whenever the software is updated. Everyone goes back to the status written in the file, so somebody you had marked off shift can come back as available. If the board suddenly looks wrong after an update, that is why — just set them right again.

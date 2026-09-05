---
id: reviews
title: Reviews and replies
summary: Where the reviews come from, why a reply never reaches Google, what Hide and Pin change, and when the review text goes out.
kind: guide
screens: [reviews]
roles: []
keywords: [review, reviews, rating, ratings, stars, google review, reply to a review, bad review, complaint, feedback, average rating, review request, ask for a review, google, reputation, hide a review, pin a review, featured review]
requires: []
updated: 2026-09-05
---

The Reviews screen shows a rating summary on the left and the latest reviews on the right. The line in the top right counts how many are still waiting on a reply, and each review has a **Hide** and a **Pin** button underneath it.

Before you use it for anything that matters, read the first three sections. Some of this list is connected to Google and some of it is not, and the difference decides what a reply does.

## Where these come from

Two places, and the tag beside the date tells you which.

**Direct** reviews were put in the database when the shop was set up. There is no review form on the website for a customer to fill in, so nothing adds to them on its own. If they look the same in six months, that is not a fault.

**Google** reviews are pulled from your Google listing, once a day, if the connection has been set up. The panel at the top of the screen tells you whether it is on, and there is a **Pull from Google** button beside the heading for when you do not want to wait for the overnight run.

Two things about the Google side are worth being blunt about:

- **Google gives back five.** Not the most recent five that you can page through — five in total, chosen by Google. There is no paid tier of the API that returns more. This is a rolling window of what Google is showing today, not an archive of everything anybody has ever written.
- **A review that drops out of Google's five stays here.** It was real when it arrived and you may have dealt with it, so it is kept rather than deleted. That is why this list can hold more than five Google reviews.

If the panel says **not connected**, everything tagged Google in the list is sample data from the setup, and none of it came from your listing.

## A reply goes nowhere

On a **Direct** review you can type a reply and press **Reply**. It is saved, it appears under the review with **Your reply** above it, and on the website it appears under that review too. **The customer is never told.** No email, no text.

On a **Google** review there is no reply box. There cannot be: Google's API can read reviews but not answer them, so anything typed here would go nowhere. Instead each one carries a **Reply on Google** link straight to that review, which is where replying actually works, signed in as the business.

If somebody has left you a bad review on Google, that link is the only thing on this screen that will change anything.

## Awaiting a reply never reaches zero

The **N awaiting a reply** line counts every review with no reply saved on this screen.

A Google review can never have one, because there is no box to type it in. So Google reviews sit in that count for ever, whether or not you have answered them properly on Google. Answer them on Google and ignore the number.

## You cannot edit a reply

The reply box only appears while a direct review has no reply on it. The moment you save one, the box is gone and the reply is fixed.

There is no edit and no delete. Read it back before you press **Reply**, particularly if it is a reply written in temper on a Friday night.

## Hide and pin change the website

Both buttons change the storefront. Neither changes this page, and neither touches Google.

**Hide from the website** takes the review off the home page and out of the score shown there. It is not a delete: the review stays in the list below with a **Hidden** tag on it, and the button turns into **Hidden — show it again**. Google is unaffected either way; a review you hide here is still on your listing for anyone to read.

**Pin to the top** moves a review to the front of that same strip on the home page. The strip only ever shows reviews that are **4 stars or more and have some text written in them**, so pinning a 2-star review, or one with a rating and no words, changes nothing anybody can see.

A daily pull from Google leaves both settings alone. Hiding and pinning are your decisions and a sync will not undo them.

## The big number is not your Google rating

The number on the left, the "from N reviews" underneath it and the five bars breaking it down by star are worked out from **the reviews shown on this page** — the fifty most recent, Google ones and direct ones together — and nothing else. It counts reviews you have hidden from the website, because they are still on this page.

Your Google listing keeps its own score, worked out from every review Google holds rather than the five it hands back. The two will not match. Do not quote this one to anybody, and do not put it on a poster.

The figure on the home page is a third number again: the average across every review here that is **not hidden**.

## Review request texts do go out

This is the part that reaches real customers, so it is worth knowing exactly.

Forty-five minutes after an order is marked completed, the customer gets one text: *"hope you enjoyed your order! A quick Google review helps us loads"* followed by the link to the {shop} Google listing. Each order triggers it once, and only once.

Some detail worth knowing, because it costs you money:

- It goes out **whether or not the customer opted in to marketing**. It is a service message about an order they placed, not marketing, and it is treated as such.
- It costs the same 4p as any other text, and it is counted on the Marketing screen under **Review requests** so your message bill is honest.
- It counts towards the shared quiet period. A customer who has just had a review request will not be picked up by a win-back or a quiet-night rule until their cooldown has passed — which is the point, so you do not text somebody twice in an afternoon.
- It only runs if two things are in place: the Google review link on the shop's setup, and the schedule LaunchFlow points at the system every few minutes. Take either away and not one request goes out — silently, with nothing on any screen to say so. If nobody is getting review requests, those are the two things to ask about.

**A review written on Google does not appear here the moment it is written.** It arrives on the next daily pull, and only if it is one of the five Google chooses to hand back. Check Google itself to see whether the requests are working.

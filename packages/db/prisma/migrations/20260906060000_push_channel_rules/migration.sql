-- Push rules for shops that already exist.
--
-- The seeder only writes notification rules into an empty table - deliberately,
-- so a redeploy cannot switch SMS back on for a shop that turned it off. That
-- protection means a new *channel* never reaches an existing shop either, and
-- push would have been a switch that was never drawn and never fired.
--
-- Only the customer row: they are the only audience with an app.
--
-- ON CONFLICT covers the case where a shop was seeded after the code shipped
-- and already has these.
INSERT INTO "NotificationRule" ("id", "clientId", "event", "audience", "channel", "enabled", "delayMinutes")
SELECT
  gen_random_uuid()::text,
  c."id",
  v."event",
  'customer',
  'push',
  v."enabled",
  v."delayMinutes"
FROM "Client" c
CROSS JOIN (VALUES
  ('order_placed',            true,  0),
  ('order_accepted',          true,  0),
  ('order_preparing',         true,  0),
  ('order_ready',             true,  0),
  ('order_out_for_delivery',  true,  0),
  -- Off: the receipt is an email, and a push saying "enjoy your food" as they
  -- open the box is noise.
  ('order_completed',         false, 0),
  ('order_rejected',          true,  0),
  ('order_refunded',          true,  0),
  ('review_request',          true,  45)
) AS v("event", "enabled", "delayMinutes")
ON CONFLICT ("clientId", "event", "audience", "channel") DO NOTHING;

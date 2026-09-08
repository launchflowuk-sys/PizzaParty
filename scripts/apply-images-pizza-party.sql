-- Pizza Party: the 18 product photographs and 3 category headers delivered 2026-09-08.
--
-- The shop owns its menu after the first seed, so a deploy ships the image files but
-- leaves these rows still pointing at nothing. This fills the blanks and only the
-- blanks: every statement is guarded on image='', so it cannot overwrite a photograph
-- the owner has since set from the back office, and it is safe to run twice.
--
-- Run against the pizza-party database only:
--   psql "$DATABASE_URL" -f scripts/apply-images-pizza-party.sql

update "Category" set image='categories/wraps.jpg' where slug='wraps' and image='';
update "Category" set image='categories/burgers.jpg' where slug='burgers' and image='';
update "Category" set image='categories/kids-meals.jpg' where slug='kids-meals' and image='';

update "Product"  set image='products/chicken-strips-wrap.jpg' where slug='chicken-strips-wrap' and image='';
update "Product"  set image='products/chicken-and-crispy-bacon-wrap.jpg' where slug='chicken-and-crispy-bacon-wrap' and image='';
update "Product"  set image='products/hotdog-and-chips-wrap.jpg' where slug='hotdog-and-chips-wrap' and image='';
update "Product"  set image='products/quarter-pounder.jpg' where slug='quarter-pounder' and image='';
update "Product"  set image='products/half-pounder.jpg' where slug='half-pounder' and image='';
update "Product"  set image='products/chicken-burger.jpg' where slug='chicken-burger' and image='';
update "Product"  set image='products/grilled-chicken-leg-1.jpg' where slug='grilled-chicken-leg-1' and image='';
update "Product"  set image='products/grilled-chicken-leg-2.jpg' where slug='grilled-chicken-leg-2' and image='';
update "Product"  set image='products/grilled-chicken-leg-4.jpg' where slug='grilled-chicken-leg-4' and image='';
update "Product"  set image='products/chips-large.jpg' where slug='chips-large' and image='';
update "Product"  set image='products/cheesy-chips.jpg' where slug='cheesy-chips' and image='';
update "Product"  set image='products/salad-box.jpg' where slug='salad-box' and image='';
update "Product"  set image='products/grilled-chicken-leg-side.jpg' where slug='grilled-chicken-leg-side' and image='';
update "Product"  set image='products/pepsi-can.jpg' where slug='pepsi-can' and image='';
update "Product"  set image='products/pepsi-max-can.jpg' where slug='pepsi-max-can' and image='';
update "Product"  set image='products/pepsi-max-cherry-can.jpg' where slug='pepsi-max-cherry-can' and image='';
update "Product"  set image='products/tango-orange-can.jpg' where slug='tango-orange-can' and image='';
update "Product"  set image='products/capri-sun.jpg' where slug='capri-sun' and image='';

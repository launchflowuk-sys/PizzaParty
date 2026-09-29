import { test } from "node:test";
import assert from "node:assert/strict";
import { optimisedImageUrl } from "../../apps/web/src/lib/image-url";

const SITE = "https://pizzaparty.live";

test("brand photographs go through the optimiser at the asked width", () => {
  assert.equal(
    optimisedImageUrl(SITE, "/brand/products/margherita.jpg", 256),
    "https://pizzaparty.live/_next/image?url=%2Fbrand%2Fproducts%2Fmargherita.jpg&w=256&q=75",
  );
  // An absolute URL on this site is treated as local.
  assert.equal(
    optimisedImageUrl(SITE, `${SITE}/brand/hero-home.webp`, 1200),
    "https://pizzaparty.live/_next/image?url=%2Fbrand%2Fhero-home.webp&w=1200&q=75",
  );
});

test("svgs, other origins and empty paths are left alone", () => {
  assert.equal(optimisedImageUrl(SITE, "/brand/logo.svg", 414), `${SITE}/brand/logo.svg`);
  assert.equal(optimisedImageUrl(SITE, "https://cdn.example.com/a.jpg", 414), "https://cdn.example.com/a.jpg");
  assert.equal(optimisedImageUrl(SITE, "", 414), "");
});

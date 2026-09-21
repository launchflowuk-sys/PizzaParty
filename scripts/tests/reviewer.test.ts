/**
 * The app-review sign-in, which has already cost one App Store rejection.
 *
 * Apple hands the reviewer a number typed as `07902810090` and a "password".
 * If normalisation misses any of the forms it can arrive in, the reviewer gets
 * a random code sent to a phone they do not have, and the submission is
 * rejected on Guideline 2.1 with nothing in the logs to explain it.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { REVIEWER_CODE, REVIEWER_PHONE, isReviewerPhone } from "../../apps/web/src/lib/reviewer";

test("every way the reviewer's number can be typed reaches the reviewer path", () => {
  for (const form of [
    "07902810090", // exactly what Apple shows the reviewer
    "+447902810090",
    "447902810090",
    "00447902810090",
    "07902 810090",
    " 07902-810-090 ",
    "7902810090",
  ]) {
    assert.ok(isReviewerPhone(form), `should match: ${form}`);
  }
});

test("nobody else is let in", () => {
  for (const other of ["07902810091", "07902810", "", "not a phone", "shujaat@nexusedu.co.uk"]) {
    assert.equal(isReviewerPhone(other), false, `should not match: ${other}`);
  }
});

test("the credentials are the ones in the App Store Connect review notes", () => {
  // Changing either of these without updating ASC re-breaks the submission.
  assert.equal(REVIEWER_PHONE, "+447902810090");
  assert.equal(REVIEWER_CODE, "483920");
  assert.match(REVIEWER_CODE, /^\d{6}$/, "verify rejects anything that is not six digits");
});

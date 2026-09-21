import { toE164 } from "./phone";

/**
 * The one account App Store and Play review can sign in with.
 *
 * Both reviewers hold these credentials and neither can receive a UK text, so
 * this number is handed a fixed code instead of a random one and never has an
 * SMS sent to it.
 *
 * Apple presents it to the reviewer as a **username and password pair**, and a
 * reviewer who types both and submits has not necessarily asked for a code
 * first. So the code is accepted on its own, without a stored one to match -
 * otherwise the sign-in fails every time no matter how often they retry, which
 * is what got the app rejected on Guideline 2.1.
 *
 * ponytail: a fixed credential on one phone number, deliberately. Rotate or
 * delete this file's constants once both apps are approved and out of review.
 */
export const REVIEWER_PHONE = "+447902810090";
export const REVIEWER_CODE = "483920";

/** Is this the reviewer's number, however they happened to type it? */
export function isReviewerPhone(raw: string): boolean {
  return toE164(raw) === REVIEWER_PHONE;
}

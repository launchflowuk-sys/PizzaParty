import Image from "next/image";

/**
 * Which cards the shop takes.
 *
 * These are real brand marks or nothing. A hand-drawn approximation of the Visa
 * wordmark is worse than no badge at all: it is instantly recognisable as fake,
 * which undermines the exact thing the badge exists to establish, and the card
 * schemes are strict about their marks being reproduced accurately.
 *
 * So each one is an SVG file the shop drops into assets/payments/, downloaded
 * from the scheme's own brand centre. Anything missing simply is not shown, and
 * if none are present this renders a plain line of text instead - honest, and
 * still reassuring.
 *
 * Where to get them, all free and official:
 *   Visa        https://usa.visa.com/run-your-business/small-business-tools/payment-technology/visa-brand-assets.html
 *   Mastercard  https://brand.mastercard.com/brandcenter/mastercard-brand-mark.html
 *   Amex        https://www.americanexpress.com/us/merchant/logo-and-signage.html
 *   Apple Pay   https://developer.apple.com/apple-pay/marketing/
 *   Google Pay  https://developers.google.com/pay/api/web/guides/brand-guidelines
 */
const MARKS = [
  { file: "visa.svg", label: "Visa" },
  { file: "mastercard.svg", label: "Mastercard" },
  { file: "amex.svg", label: "American Express" },
  { file: "apple-pay.svg", label: "Apple Pay" },
  { file: "google-pay.svg", label: "Google Pay" },
] as const;

export function PaymentBadges({ available }: { available: string[] }) {
  const shown = MARKS.filter((m) => available.includes(m.file));

  if (shown.length === 0) {
    return (
      <p className="fp-pay-fallback">
        Card payments taken securely online. Cash accepted at the door and at the counter.
      </p>
    );
  }

  return (
    <div className="fp-pay">
      <span className="fp-pay-l">We accept</span>
      <ul className="fp-pay-list">
        {shown.map((m) => (
          <li key={m.file}>
            <Image
              src={`/brand/payments/${m.file}`}
              alt={m.label}
              width={44}
              height={28}
              unoptimized
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

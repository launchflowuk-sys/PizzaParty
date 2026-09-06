/**
 * The kitchen screen owns the whole window.
 *
 * This used to be `fixed inset-0 z-50` — not for layout, but to cover up the
 * storefront header, footer and basket bar that the root layout was drawing
 * underneath it. The root layout no longer renders any of that on ops screens,
 * so the cover-up can go: a fixed full-viewport box on a phone fights the
 * browser's own address bar and makes the page scroll inside itself.
 */
export default function KitchenLayout({ children }: { children: React.ReactNode }) {
  return <div style={{ minHeight: "100dvh", background: "var(--color-surface-2, var(--color-bg))" }}>{children}</div>;
}

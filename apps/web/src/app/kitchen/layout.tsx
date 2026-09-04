export default function KitchenLayout({ children }: { children: React.ReactNode }) {
  // Full-bleed for tablets; hides the storefront chrome visually via CSS on the parent.
  return <div className="fixed inset-0 z-50 bg-surface-2 overflow-y-auto">{children}</div>;
}

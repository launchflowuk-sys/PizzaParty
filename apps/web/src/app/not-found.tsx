import Link from "next/link";

export default function NotFound() {
  return (
    <div className="lf-container py-20 text-center">
      <h1 className="lf-h1">Page not found</h1>
      <p className="text-muted mt-3">That page isn&apos;t on the menu.</p>
      <Link href="/menu" className="lf-btn lf-btn-primary mt-6">See the menu</Link>
    </div>
  );
}

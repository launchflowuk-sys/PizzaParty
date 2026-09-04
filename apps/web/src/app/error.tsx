"use client";
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="lf-container py-20 text-center">
      <h1 className="lf-h1">Something went wrong</h1>
      <p className="text-muted mt-3">{error.message}</p>
      <button className="lf-btn lf-btn-primary mt-6" onClick={reset}>Try again</button>
    </div>
  );
}

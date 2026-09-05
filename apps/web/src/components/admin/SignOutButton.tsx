"use client";

/**
 * Sign out of the back office.
 *
 * Needed for more than tidiness: the shop password, five staff PINs and the
 * agency key all land on the same screens, and without this the only way to
 * see the back office as somebody else was to clear cookies by hand. A shared
 * tablet behind the counter has the same problem at the end of a shift.
 *
 * Sends to the login page rather than refreshing, so the next person starts
 * where they need to be.
 */
export function SignOutButton({ label = "Sign out" }: { label?: string }) {
  async function signOut() {
    try {
      await fetch("/api/admin/logout", { method: "POST" });
    } finally {
      // Hard navigation on purpose: the client router caches rendered screens,
      // and a soft push would show the last person's dashboard until it
      // revalidated.
      window.location.href = "/admin/login";
    }
  }

  return (
    <button type="button" className="btn btn-secondary" style={{ width: "100%", marginTop: 12 }} onClick={signOut}>
      {label}
    </button>
  );
}

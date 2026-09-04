"use client";
import { useRouter } from "next/navigation";
export function LogoutButton() {
  const router = useRouter();
  return <button className="btn btn-ghost" onClick={async () => { await fetch("/api/account/logout", { method: "POST" }); router.refresh(); }}>Log out</button>;
}

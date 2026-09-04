import type { Metadata } from "next";
import { AdminLoginForm } from "@/components/admin/AdminLoginForm";
export const metadata: Metadata = { title: "Admin login", robots: { index: false } };
export default async function AdminLogin({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <div className="lf-container max-w-sm">
      <h1 className="lf-h1 pt-10">Admin</h1>
      <AdminLoginForm next={next ?? "/admin"} />
    </div>
  );
}

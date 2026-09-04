import { prisma } from "@launchflow/db";
import { getClientRow } from "@/lib/menu";
import { gbp } from "@/lib/money";
import { togglePromo, upsertPromo } from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminPromos() {
  const client = await getClientRow();
  const promos = await prisma.promo.findMany({ where: { clientId: client.id }, orderBy: { code: "asc" } });
  return (
    <div>
      <header className="fp-adminhead">
        <div>
          <span className="fp-kicker" style={{ marginBottom: 6 }}>Back office</span>
          <h1>Promotions</h1>
        </div>
      </header>
      <form action={upsertPromo} className="lf-card p-4 mt-4 grid gap-2 sm:grid-cols-3">
        <input name="code" placeholder="CODE" className="lf-input uppercase" required />
        <select name="type" className="lf-input"><option value="percent">% off</option><option value="fixed">£ off</option><option value="free_delivery">Free delivery</option></select>
        <input name="value" placeholder="Value (10 = 10% or £10)" className="lf-input" inputMode="decimal" />
        <input name="minOrder" placeholder="Min order £" className="lf-input" inputMode="decimal" />
        <input name="maxUses" placeholder="Max uses (blank = unlimited)" className="lf-input" inputMode="numeric" />
        <input name="endsAt" type="date" className="lf-input" />
        <select name="fulfilment" className="lf-input"><option value="">Delivery & collection</option><option value="delivery">Delivery only</option><option value="collection">Collection only</option></select>
        <label className="text-sm flex items-center gap-2"><input type="checkbox" name="firstOrderOnly" /> First order only</label>
        <button className="lf-btn lf-btn-primary">Create / update</button>
      </form>
      <table className="w-full text-sm mt-6 lf-card">
        <thead><tr className="text-left border-b border-line"><th className="p-2">Code</th><th className="p-2">Type</th><th className="p-2">Rules</th><th className="p-2">Uses</th><th className="p-2"></th></tr></thead>
        <tbody>{promos.map((p) => (
          <tr key={p.id} className={`border-b border-line ${p.active ? "" : "opacity-50"}`}>
            <td className="p-2 font-bold">{p.code}</td>
            <td className="p-2">{p.type === "percent" ? `${p.value}% off` : p.type === "fixed" ? `${gbp(p.value)} off` : "Free delivery"}</td>
            <td className="p-2 text-muted">{p.minOrder ? `min ${gbp(p.minOrder)}` : ""} {p.firstOrderOnly ? "· first order" : ""} {p.fulfilment.length ? `· ${p.fulfilment.join("/")}` : ""} {p.endsAt ? `· until ${p.endsAt.toLocaleDateString("en-GB")}` : ""}</td>
            <td className="p-2">{p.uses}{p.maxUses ? `/${p.maxUses}` : ""}</td>
            <td className="p-2"><form action={togglePromo}><input type="hidden" name="id" value={p.id} /><button className="lf-btn lf-btn-ghost">{p.active ? "Disable" : "Enable"}</button></form></td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

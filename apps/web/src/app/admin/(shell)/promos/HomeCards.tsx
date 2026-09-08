import { allSlots, slotState, PROMO_IMAGE } from "@/lib/promo-slots";
import { gbp } from "@/lib/money";
import { createPromoSlot, updatePromoSlot, togglePromoSlot, deletePromoSlot } from "../promo-slot-actions";

/**
 * Home-screen cards, managed by the shop.
 *
 * The point of this screen is that nobody has to ring us to change what the app
 * opens on. So it states the image size in plain words rather than assuming the
 * owner knows, and it says in English whether each card is on screen right now -
 * "live", "scheduled", "finished" - because a pair of dates and a checkbox does
 * not answer that question at a glance.
 */

const STATE_STYLE: Record<string, string> = {
  live: "var(--color-ok)",
  paused: "var(--color-warn)",
  scheduled: "var(--color-neutral-700)",
  finished: "var(--color-neutral-600)",
  "no image": "var(--color-danger)",
};

/** `datetime-local` wants `YYYY-MM-DDTHH:mm` and nothing else. */
function forInput(d: Date | null): string {
  if (!d) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export async function HomeCards() {
  const slots = await allSlots();

  return (
    <section style={{ marginTop: 32 }}>
      <h2 style={{ margin: "0 0 4px" }}>Home screen cards</h2>
      <p style={{ margin: "0 0 16px", color: "var(--color-neutral-700)", maxWidth: "62ch" }}>
        What customers see at the top of the app and the website. Upload a graphic at{" "}
        <strong>{PROMO_IMAGE.width} × {PROMO_IMAGE.height}</strong> ({PROMO_IMAGE.ratio}), JPEG, PNG or WebP,
        under 2MB. Leave the dates empty to run it until you stop it. Pausing keeps the dates.
      </p>

      {slots.length === 0 ? (
        <p style={{ color: "var(--color-neutral-700)" }}>No cards yet. The first one you add replaces the fixed image.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px", display: "grid", gap: 12 }}>
          {slots.map((s) => {
            const state = slotState(s);
            return (
              <li key={s.id} style={{ border: "1px solid var(--color-line)", borderRadius: 12, padding: 16, background: "var(--color-surface)" }}>
                <form action={updatePromoSlot} encType="multipart/form-data" style={{ display: "grid", gap: 10 }}>
                  <input type="hidden" name="id" value={s.id} />

                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    {s.imageMime ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`/promo/${s.id}.jpg`} alt="" width={120} height={80}
                           style={{ objectFit: "cover", borderRadius: 8, border: "1px solid var(--color-line)" }} />
                    ) : null}
                    <strong style={{ color: STATE_STYLE[state] ?? "inherit", textTransform: "uppercase", fontSize: 12, letterSpacing: ".08em" }}>
                      {state}
                    </strong>
                    {s.price != null ? <span>{gbp(s.price)}</span> : null}
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <input name="title" defaultValue={s.title} placeholder="Title" required style={{ flex: "1 1 200px" }} />
                    <input name="subtitle" defaultValue={s.subtitle} placeholder="Subtitle (optional)" style={{ flex: "1 1 200px" }} />
                    <input name="price" defaultValue={s.price != null ? (s.price / 100).toFixed(2) : ""} placeholder="Price £" style={{ width: 110 }} />
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <input name="target" defaultValue={s.target} placeholder="Opens: deal or category slug" style={{ flex: "1 1 200px" }} />
                    <select name="placement" defaultValue={s.placement}>
                      <option value="hero">Top of the screen</option>
                      <option value="featured">In the deals row</option>
                    </select>
                    <input name="sortOrder" type="number" defaultValue={s.sortOrder} style={{ width: 80 }} aria-label="Order" />
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <label style={{ fontSize: 13 }}>From <input type="datetime-local" name="startsAt" defaultValue={forInput(s.startsAt)} /></label>
                    <label style={{ fontSize: 13 }}>Until <input type="datetime-local" name="endsAt" defaultValue={forInput(s.endsAt)} /></label>
                    <label style={{ fontSize: 13 }}>Replace image <input type="file" name="image" accept="image/jpeg,image/png,image/webp" /></label>
                  </div>

                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="submit" className="btn btn-primary">Save</button>
                    <button type="submit" formAction={togglePromoSlot} className="btn">{s.active ? "Pause" : "Resume"}</button>
                    <button type="submit" formAction={deletePromoSlot} className="btn btn-danger">Delete</button>
                  </div>
                </form>
              </li>
            );
          })}
        </ul>
      )}

      <form action={createPromoSlot} encType="multipart/form-data"
            style={{ display: "grid", gap: 10, border: "1px dashed var(--color-line)", borderRadius: 12, padding: 16 }}>
        <strong>Add a card</strong>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input name="title" placeholder="Title" required style={{ flex: "1 1 200px" }} />
          <input name="subtitle" placeholder="Subtitle (optional)" style={{ flex: "1 1 200px" }} />
          <input name="price" placeholder="Price £" style={{ width: 110 }} />
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input name="target" placeholder="Opens: deal or category slug" style={{ flex: "1 1 200px" }} />
          <select name="placement" defaultValue="hero">
            <option value="hero">Top of the screen</option>
            <option value="featured">In the deals row</option>
          </select>
          <input name="sortOrder" type="number" defaultValue={0} style={{ width: 80 }} aria-label="Order" />
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <label style={{ fontSize: 13 }}>From <input type="datetime-local" name="startsAt" /></label>
          <label style={{ fontSize: 13 }}>Until <input type="datetime-local" name="endsAt" /></label>
          <label style={{ fontSize: 13 }}>Image <input type="file" name="image" accept="image/jpeg,image/png,image/webp" required /></label>
        </div>
        <div><button type="submit" className="btn btn-primary">Add card</button></div>
      </form>
    </section>
  );
}

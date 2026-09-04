"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useBasket } from "@/components/basket/store";

/** "Apply to basket" on the deals screen. Writes the code into the basket store;
 *  the server still validates it when the basket is repriced, so this only saves
 *  the customer typing it. */
export function ApplyCode({ code }: { code: string }) {
  const setPromo = useBasket((s) => s.setPromo);
  const lines = useBasket((s) => s.lines);
  const router = useRouter();
  const [done, setDone] = useState(false);

  return (
    <button
      className="btn btn-secondary"
      onClick={() => {
        setPromo(code);
        setDone(true);
        if (lines.length) router.push("/basket");
        else window.setTimeout(() => setDone(false), 2400);
      }}
    >
      {done && !lines.length ? "Saved for your basket" : "Apply to basket"}
    </button>
  );
}

"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { currentCustomer } from "@/lib/session";
import { redeemReward } from "@/lib/loyalty";

/**
 * Claiming a reward.
 *
 * The customer, not the shop, so it authenticates on the signed-in customer
 * rather than staff. The reward id is checked against the shop's own list inside
 * `redeemReward`, so a made-up id cannot mint anything.
 */
export async function claimReward(fd: FormData) {
  const customer = await currentCustomer();
  if (!customer) redirect("/account?next=/rewards");

  const result = await redeemReward(customer.id, String(fd.get("rewardId") ?? ""));
  revalidatePath("/rewards");

  if (!result.ok) redirect(`/rewards?e=${encodeURIComponent(result.error)}`);
  redirect(`/rewards?code=${encodeURIComponent(result.code)}`);
}

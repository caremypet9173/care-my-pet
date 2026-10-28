"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

export async function switchActiveHousehold(householdId: string) {
  try {
    const cookieStore = await cookies();
    cookieStore.set("care_active_household_id", householdId, {
      path: "/",
      maxAge: 31536000,
      sameSite: "lax",
    });
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (error) {
    console.error("[switchActiveHousehold error]", error);
    return { ok: false };
  }
}

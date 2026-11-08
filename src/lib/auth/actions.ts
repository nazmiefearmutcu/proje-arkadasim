"use server";

import { redirect } from "next/navigation";
import { destroySession } from "./session";

/** Oturumu kapatır ve ana sayfaya döner. */
export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/");
}

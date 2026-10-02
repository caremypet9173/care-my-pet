"use client";
import { usePathname } from "@/i18n/navigation";
import { ProfileHeader } from "./profile-header";
import type { PetProfile } from "../types";
export function ProfileFrame({ pet }: { pet: PetProfile }) {
  return <ProfileHeader pet={pet} compact={usePathname() !== "/demo/luna"} />;
}

"use client";
import { useState } from "react";
import { IconCat, IconDog } from "@tabler/icons-react";
export function PetIcon({ species, src, name }: { species: "cat" | "dog"; src?: string | null; name?: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  const Icon = species === "cat" ? IconCat : IconDog;
  if (src && src !== failed) return <div className="household-pet-avatar household-pet-avatar--photo">
    {/* Signed private image: never cache it through the public optimizer. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={src} alt={name ?? ""} onError={() => setFailed(src)} />
  </div>;
  return <div className="household-pet-avatar" aria-hidden="true"><Icon size={56} stroke={1.3} /></div>;
}

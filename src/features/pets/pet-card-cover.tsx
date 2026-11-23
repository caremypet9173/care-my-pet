"use client";

import { useState } from "react";

export function PetCardCover({ src }: { src?: string | null }) {
  const [failed, setFailed] = useState<string | null>(null);
  const showPhoto = Boolean(src && src !== failed);

  return (
    <div
      className={`household-card-cover${showPhoto ? " has-photo" : ""}`}
      aria-hidden="true"
    >
      {showPhoto ? (
        <>
          {/* Signed private image: never cache it through the public optimizer. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src!}
            alt=""
            className="household-card-cover-image"
            loading="lazy"
            decoding="async"
            onError={() => setFailed(src!)}
          />
          <div className="household-card-cover-scrim" />
        </>
      ) : null}
    </div>
  );
}

import { useTranslations } from "next-intl";
import Image from "next/image";
import { IconCheck, IconHeart } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { assets } from "@/lib/assets";
import { useFormatters } from "@/lib/formatters";
import type { PetProfile } from "../types";

export function ProfileHeader({
  pet,
  compact = false,
}: {
  pet: PetProfile;
  compact?: boolean;
}) {
  const t = useTranslations("copy");
  const { formatNumber } = useFormatters();
  return (
    <section
      className={`profile-cover ${compact ? "profile-cover--compact" : ""}`}
      aria-label={`Profil: ${pet.name}`}
    >
      <Image
        src={assets.lunaCover}
        alt=""
        fill
        sizes="(min-width: 1280px) 1184px, 100vw"
        className="profile-cover-image"
        preload={!compact}
      />
      <div className="profile-cover-status">
        <Badge tone="success" dot>
          {t("activeProfileRegularCare")}
        </Badge>
      </div>
      <div className="profile-glass">
        <Image
          className="profile-portrait"
          src={pet.image}
          width={208}
          height={256}
          alt={`Portret kotki ${pet.name}`}
          sizes={compact ? "80px" : "(max-width: 639px) 120px, 208px"}
          preload
        />
        <div className="profile-details">
          <div className="profile-name">
            <h1>{pet.name}</h1>
            <Badge>{t("domesticCat")}</Badge>
          </div>
          <p>
            {t("europeanShorthair4Years")} {formatNumber(pet.weightKg)} kg
          </p>
          <div className="profile-tags">
            <Badge tone="success">
              <IconCheck size={14} aria-hidden="true" />
              {t("spayed")}
            </Badge>
            <Badge>{t("microchipXxxExample")}</Badge>
            <Badge tone="accent">{t("allergiesNoneKnown")}</Badge>
          </div>
          <blockquote className="guardian-note">
            <IconHeart size={20} aria-hidden="true" />
            <div>
              <strong>{t("ownersNote")}</strong>
              <p>{t("aCalmHomebodyLovesAWarmBlanket")}</p>
            </div>
          </blockquote>
        </div>
      </div>
    </section>
  );
}

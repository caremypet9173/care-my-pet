import { useTranslations } from "next-intl";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { assets } from "@/lib/assets";

export function BrandLogo() {
  const t = useTranslations("copy");
  return (
    <Link href="/" className="brand" aria-label={t("careMyPetHome")}>
      <Image src={assets.brand} width={36} height={36} alt="" />
      <span>
        Care My <span className="brand-accent">Pet</span>
      </span>
    </Link>
  );
}

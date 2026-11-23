import { getLocale } from "next-intl/server";
import Image from "next/image";
import { IconCheck, IconArrowRight, IconHeart } from "@tabler/icons-react";
import { Link } from "@/i18n/navigation";
import { assets } from "@/lib/assets";
import { authDesignMessages } from "./design-messages";

export async function AuthShell({ children }: { children: React.ReactNode }) {
  const t = authDesignMessages[await getLocale()];
  return (
    <div className="auth-shell">
      <section className="auth-form-panel">{children}</section>
      <section className="auth-story" aria-labelledby="auth-story-title">
        <div>
          <div className="auth-story-brand">
            <span>
              <Image src={assets.brand} width={32} height={32} alt="" />
            </span>
            <div>
              <strong>Care My Pet</strong>
              <small>{t.tagline}</small>
            </div>
          </div>
          <span className="auth-story-badge">{t.badge}</span>
          <h2 id="auth-story-title">{t.headline}</h2>
          <p>{t.description}</p>
          <ul>
            {t.features.map((item) => (
              <li key={item}>
                <IconCheck size={20} aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <aside className="auth-story-preview">
          <IconHeart size={22} aria-hidden="true" />
          <h3>{t.preview}</h3>
          <p>{t.previewText}</p>
          <Link href="/demo/luna">
            {t.demo}
            <IconArrowRight size={16} aria-hidden="true" />
          </Link>
        </aside>
      </section>
    </div>
  );
}

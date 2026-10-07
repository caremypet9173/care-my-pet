import { readFile } from "node:fs/promises";
import path from "node:path";
import { getLocale, getTranslations } from "next-intl/server";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import "@/styles/legal.css";

const documents = {
  privacy: { pl: "privacy.pl.md", en: "privacy.en.md" },
  terms: { pl: "terms.pl.md", en: "terms.en.md" },
} as const;

export async function LegalDocument({ document }: { document: keyof typeof documents }) {
  const locale = await getLocale();
  const [markdown, t] = await Promise.all([
    readFile(path.join(process.cwd(), "src/content/legal", documents[document][locale]), "utf8"),
    getTranslations("copy"),
  ]);
  return (
    <Section>
      <Container width="prose">
        <div className="page-heading">
          <h1>{t(document === "privacy" ? "yourDataPrivacy" : "termsOfUse")}</h1>
        </div>
        <article className="legal-content" lang={locale}>
          <Markdown
            remarkPlugins={[remarkGfm]}
            skipHtml
            components={{
              h1: ({ children }) => <h2>{children}</h2>,
              h2: ({ children }) => <h3>{children}</h3>,
              h3: ({ children }) => <h3>{children}</h3>,
              table: ({ children }) => (
                <div className="legal-table-scroll" role="region"
                  aria-label={t("legalProcessingTableLabel")} tabIndex={0}>
                  <table>{children}</table>
                </div>
              ),
            }}
          >
            {markdown}
          </Markdown>
        </article>
      </Container>
    </Section>
  );
}

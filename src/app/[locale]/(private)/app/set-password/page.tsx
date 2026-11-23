import { getLocale } from "next-intl/server";
import { SetPasswordForm } from "@/features/auth/set-password-form";
import { authMessages } from "@/features/auth/messages";
import { Container } from "@/components/layout/container";

export async function generateMetadata() {
  const locale = await getLocale();
  return {
    title: authMessages[locale].setPassword,
    robots: { index: false, follow: false },
  };
}

export default function SetPasswordPage() {
  return (
    <Container className="pets-page" style={{ maxWidth: "28rem", margin: "3rem auto" }}>
      <SetPasswordForm />
    </Container>
  );
}

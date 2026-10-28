"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import {
  IconAlertCircle,
  IconCheck,
  IconHome,
  IconShieldCheck,
  IconUsers,
} from "@tabler/icons-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import type { InvitationDetailsResponse } from "./types";

export function AcceptInvitation({
  token,
  initialUserEmail,
}: {
  token: string;
  initialUserEmail?: string | null;
}) {
  const locale = useLocale();
  const pl = locale === "pl";
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState<InvitationDetailsResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [isAccepting, setIsAccepting] = useState(false);
  const [acceptedSuccess, setAcceptedSuccess] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function fetchDetails() {
      setLoading(true);
      setErrorMsg(null);
      try {
        const client = createClient();
        const { data, error } = await client.functions.invoke("household", {
          body: { action: "get_invite_details", token },
        });

        if (cancelled) return;
        if (error || !data?.invitation) {
          setErrorMsg(
            pl
              ? "Nie udało się odnaleźć tego zaproszenia. Link mógł wygasnąć lub zostać usunięty."
              : "Could not find this invitation. The link may have expired or been removed.",
          );
        } else {
          setDetails(data as InvitationDetailsResponse);
        }
      } catch {
        if (!cancelled) {
          setErrorMsg(
            pl
              ? "Wystąpił błąd podczas sprawdzania zaproszenia."
              : "An error occurred while checking the invitation.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchDetails();
    return () => {
      cancelled = true;
    };
  }, [token, pl]);

  async function handleAccept() {
    if (isAccepting || !details) return;
    setIsAccepting(true);
    setErrorMsg(null);
    try {
      const client = createClient();
      const { data, error } = await client.functions.invoke("household", {
        body: { action: "accept_invite", token },
      });

      if (error || !data?.success) {
        const errKey = data?.error || error?.message || "error";
        let msg = pl
          ? "Nie udało się zaakceptować zaproszenia."
          : "Could not accept the invitation.";
        if (errKey === "already_owner") {
          msg = pl
            ? "Jesteś już właścicielem tego gospodarstwa."
            : "You are already the owner of this household.";
        } else if (errKey === "invite_expired") {
          msg = pl
            ? "To zaproszenie wygasło."
            : "This invitation has expired.";
        } else if (errKey === "invite_accepted") {
          msg = pl
            ? "To zaproszenie zostało już wcześniej zaakceptowane."
            : "This invitation has already been accepted.";
        } else if (errKey === "invite_cancelled") {
          msg = pl
            ? "To zaproszenie zostało anulowane przez właściciela."
            : "This invitation was cancelled by the owner.";
        }
        setErrorMsg(msg);
        return;
      }

      setAcceptedSuccess(true);
      window.setTimeout(() => {
        router.push("/app");
      }, 1500);
    } catch {
      setErrorMsg(
        pl
          ? "Wystąpił nieoczekiwany błąd podczas dołączania."
          : "An unexpected error occurred while joining.",
      );
    } finally {
      setIsAccepting(false);
    }
  }

  if (loading) {
    return (
      <div className="household-invite-card">
        <div className="household-invite-icon is-loading">
          <IconHome size={32} />
        </div>
        <h2>{pl ? "Sprawdzanie zaproszenia…" : "Checking invitation…"}</h2>
        <p>{pl ? "Proszę czekać chwilę." : "Please wait a moment."}</p>
      </div>
    );
  }

  if (errorMsg || !details) {
    return (
      <div className="household-invite-card">
        <div className="household-invite-icon is-error">
          <IconAlertCircle size={32} />
        </div>
        <h2>{pl ? "Problem z zaproszeniem" : "Invitation error"}</h2>
        <p>{errorMsg || (pl ? "Nieprawidłowy link zaproszenia." : "Invalid invitation link.")}</p>
        <Link href="/app" className="history-action-btn is-primary">
          <span>{pl ? "Przejdź do aplikacji" : "Go to app"}</span>
        </Link>
      </div>
    );
  }

  if (acceptedSuccess) {
    return (
      <div className="household-invite-card is-success">
        <div className="household-invite-icon is-success">
          <IconCheck size={36} />
        </div>
        <h2>{pl ? "Witaj w gospodarstwie!" : "Welcome to the household!"}</h2>
        <p>
          {pl
            ? `Pomyślnie dołączono do ${details.household?.nazwa || "gospodarstwa"}. Przenosimy do pulpitu…`
            : `Successfully joined ${details.household?.nazwa || "household"}. Redirecting…`}
        </p>
      </div>
    );
  }

  const isPending = details.invitation.status === "pending";

  if (!isPending) {
    const statusNote =
      details.invitation.status === "accepted"
        ? pl
          ? "To zaproszenie zostało już zaakceptowane."
          : "This invitation has already been accepted."
        : details.invitation.status === "expired"
          ? pl
            ? "To zaproszenie wygasło."
            : "This invitation has expired."
          : pl
            ? "To zaproszenie zostało anulowane."
            : "This invitation has been cancelled.";

    return (
      <div className="household-invite-card">
        <div className="household-invite-icon">
          <IconAlertCircle size={32} />
        </div>
        <h2>{pl ? "Status zaproszenia" : "Invitation status"}</h2>
        <p>{statusNote}</p>
        <Link href="/app" className="history-action-btn is-primary">
          <span>{pl ? "Przejdź do aplikacji" : "Go to app"}</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="household-invite-card">
      <div className="household-invite-icon is-primary">
        <IconUsers size={36} />
      </div>

      <h2>
        {pl
          ? "Zaproszenie do wspólnej opieki"
          : "Co-care invitation"}
      </h2>

      <p className="household-invite-subtitle">
        <strong>{details.inviter.email}</strong>{" "}
        {pl
          ? "zaprasza Cię do gospodarstwa:"
          : "invites you to household:"}
      </p>

      <div className="household-invite-box">
        <div className="household-invite-box-header">
          <IconHome size={22} aria-hidden="true" />
          <strong>{details.household?.nazwa || (pl ? "Mój dom" : "My Home")}</strong>
        </div>

        {details.pets.length > 0 && (
          <div className="household-invite-pets-list">
            <span className="household-invite-pets-label">
              {pl ? "Pupile w tym domu:" : "Pets in this home:"}
            </span>
            <div className="household-invite-pets-chips">
              {details.pets.map((p) => (
                <span key={p.id} className="household-invite-pet-chip">
                  <span>{p.gatunek === "cat" ? "🐱" : "🐶"}</span>
                  <strong>{p.imie}</strong>
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="household-invite-benefits">
          <div className="household-invite-benefit-row">
            <IconShieldCheck size={16} aria-hidden="true" />
            <span>
              {pl
                ? "Dostęp do kart zdrowia, badań krwi i dokumentacji medycznej"
                : "Access to health records, blood tests, and medical records"}
            </span>
          </div>
          <div className="household-invite-benefit-row">
            <IconShieldCheck size={16} aria-hidden="true" />
            <span>
              {pl
                ? "Wspólny terminarz wizyt, szczepień i przypomnień o lekach"
                : "Shared schedule for visits, vaccinations, and medication reminders"}
            </span>
          </div>
        </div>
      </div>

      {initialUserEmail ? (
        <div className="household-invite-actions">
          <p className="household-invite-user-note">
            {pl ? "Zalogowano jako:" : "Logged in as:"}{" "}
            <strong>{initialUserEmail}</strong>
          </p>
          <Button
            type="button"
            variant="primary"
            size="md"
            disabled={isAccepting}
            onClick={() => void handleAccept()}
          >
            {isAccepting
              ? pl
                ? "Dołączanie…"
                : "Joining…"
              : pl
                ? "Dołącz do gospodarstwa"
                : "Join household"}
          </Button>
        </div>
      ) : (
        <div className="household-invite-actions">
          <p className="household-invite-user-note">
            {pl
              ? "Aby dołączyć do gospodarstwa, zaloguj się lub załóż darmowe konto."
              : "To join this household, log in or create a free account."}
          </p>
          <div className="household-invite-auth-buttons">
            <Link
              href={`/login?returnTo=/zaproszenie/${token}`}
              className="history-action-btn is-primary"
            >
              <span>{pl ? "Zaloguj się" : "Log in"}</span>
            </Link>
            <Link
              href={`/register?returnTo=/zaproszenie/${token}`}
              className="history-action-btn"
            >
              <span>{pl ? "Zarejestruj się" : "Sign up"}</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

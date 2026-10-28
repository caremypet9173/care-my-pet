"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import {
  IconAlertCircle,
  IconCheck,
  IconClock,
  IconCopy,
  IconHome,
  IconMail,
  IconPencil,
  IconShieldCheck,
  IconTrash,
  IconUser,
  IconUserCheck,
  IconUserPlus,
  IconUsers,
  IconUserX,
} from "@tabler/icons-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import type {
  HouseholdDetailsResponse,
  HouseholdInvitation,
  HouseholdMember,
} from "./types";

export function HouseholdManager({
  initialData,
}: {
  initialData: HouseholdDetailsResponse;
}) {
  const locale = useLocale();
  const pl = locale === "pl";
  const router = useRouter();

  const [household, setHousehold] = useState(initialData.household);
  const [members, setMembers] = useState<HouseholdMember[]>(
    initialData.members,
  );
  const [invitations, setInvitations] = useState<HouseholdInvitation[]>(
    initialData.invitations,
  );
  const isOwner = household.is_owner;

  // Edycja nazwy
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(household.nazwa);
  const [isSavingName, setIsSavingName] = useState(false);

  // Formularz zaproszenia
  const [inviteEmail, setInviteEmail] = useState("");
  const [isInviting, setIsInviting] = useState(false);
  const [inviteFeedback, setInviteFeedback] = useState<{
    type: "ok" | "error";
    text: string;
    inviteUrl?: string;
  } | null>(null);

  // Stany akcji
  const [busyActionKey, setBusyActionKey] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeZone: "UTC",
    }).format(new Date(iso));

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = nameValue.trim();
    if (!trimmed || trimmed === household.nazwa || isSavingName) {
      setIsEditingName(false);
      return;
    }
    setIsSavingName(true);
    try {
      const client = createClient();
      const { data, error } = await client.functions.invoke("household", {
        body: {
          action: "rename",
          household_id: household.id,
          name: trimmed,
        },
      });
      if (!error && data?.household) {
        setHousehold((prev) => ({ ...prev, nazwa: data.household.nazwa }));
        setIsEditingName(false);
        router.refresh();
      }
    } finally {
      setIsSavingName(false);
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = inviteEmail.trim().toLowerCase();
    if (!trimmed || isInviting) return;

    setIsInviting(true);
    setInviteFeedback(null);
    try {
      const client = createClient();
      const { data, error } = await client.functions.invoke("household", {
        body: {
          action: "invite",
          household_id: household.id,
          email: trimmed,
        },
      });

      if (error || !data?.invitation) {
        const errKey = data?.error || error?.message || "error";
        let msg = pl
          ? "Nie udało się utworzyć zaproszenia. Spróbuj ponownie."
          : "Could not create invitation. Please try again.";
        if (errKey === "cannot_invite_self") {
          msg = pl
            ? "Nie możesz zaprosić własnego adresu e-mail."
            : "You cannot invite your own email address.";
        } else if (errKey === "already_member") {
          msg = pl
            ? "Użytkownik o tym adresie jest już członkiem tego gospodarstwa."
            : "User with this email is already a member of this household.";
        } else if (errKey === "invalid_email") {
          msg = pl
            ? "Wpisz poprawny adres e-mail."
            : "Please enter a valid email address.";
        }
        setInviteFeedback({ type: "error", text: msg });
        return;
      }

      const invite = data.invitation as HouseholdInvitation;
      const inviteUrl =
        data.invite_url ||
        `${window.location.origin}/pl/zaproszenie/${invite.token}`;

      setInvitations((prev) => [
        invite,
        ...prev.filter((i) => i.email !== invite.email),
      ]);
      setInviteEmail("");
      setInviteFeedback({
        type: "ok",
        text: data.email_sent
          ? pl
            ? `Wysłano zaproszenie na adres ${invite.email}!`
            : `Invitation sent to ${invite.email}!`
          : pl
            ? `Utworzono zaproszenie dla ${invite.email}. Skopiuj link poniżej i przekaż go współopiekunowi.`
            : `Created invitation for ${invite.email}. Copy the link below and share it with your co-guardian.`,
        inviteUrl,
      });
      router.refresh();
    } catch {
      setInviteFeedback({
        type: "error",
        text: pl
          ? "Wystąpił nieoczekiwany błąd podczas wysyłania zaproszenia."
          : "An unexpected error occurred while sending the invitation.",
      });
    } finally {
      setIsInviting(false);
    }
  }

  async function handleCopy(url: string, token: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedToken(token);
      window.setTimeout(() => setCopiedToken(null), 2500);
    } catch {
      // Fallback
      prompt(pl ? "Skopiuj poniższy link:" : "Copy the link below:", url);
    }
  }

  async function handleCancelInvite(inviteId: string) {
    if (
      !confirm(
        pl
          ? "Czy na pewno chcesz anulować to zaproszenie?"
          : "Are you sure you want to cancel this invitation?",
      )
    ) {
      return;
    }
    setBusyActionKey(`cancel-${inviteId}`);
    try {
      const client = createClient();
      const { error } = await client.functions.invoke("household", {
        body: {
          action: "cancel_invite",
          household_id: household.id,
          invite_id: inviteId,
        },
      });
      if (!error) {
        setInvitations((prev) => prev.filter((i) => i.id !== inviteId));
        router.refresh();
      }
    } finally {
      setBusyActionKey(null);
    }
  }

  async function handleRemoveMember(member: HouseholdMember) {
    const isSelf = member.is_self;
    const confirmMsg = isSelf
      ? pl
        ? "Czy na pewno chcesz opuścić to gospodarstwo? Utracisz dostęp do kart tych zwierząt."
        : "Are you sure you want to leave this household? You will lose access to these pets."
      : pl
        ? `Czy na pewno chcesz usunąć dostęp dla użytkownika ${member.email || "współopiekun"}?`
        : `Are you sure you want to remove access for ${member.email || "co-guardian"}?`;

    if (!confirm(confirmMsg)) return;

    setBusyActionKey(`remove-${member.user_id}`);
    try {
      const client = createClient();
      const { error } = await client.functions.invoke("household", {
        body: {
          action: "remove_member",
          household_id: household.id,
          user_id: member.user_id,
        },
      });
      if (!error) {
        if (isSelf) {
          router.push("/app");
        } else {
          setMembers((prev) =>
            prev.filter((m) => m.user_id !== member.user_id),
          );
          router.refresh();
        }
      }
    } finally {
      setBusyActionKey(null);
    }
  }

  return (
    <div className="household-manager-layout">
      {/* Przełącznik wielu gospodarstw (jeśli użytkownik ma własne i jest też zaproszony do innego) */}
      {initialData.availableHouseholds && initialData.availableHouseholds.length > 1 && (
        <section className="household-switcher-box">
          <span className="household-switcher-label">
            {pl ? "Twoje gospodarstwa domowe:" : "Your households:"}
          </span>
          <div className="household-switcher-pills">
            {initialData.availableHouseholds.map((h) => (
              <Link
                key={h.id}
                href={`/app/gospodarstwo?id=${h.id}`}
                className={`household-switcher-pill ${h.is_active ? "is-active" : ""}`}
              >
                <IconHome size={16} aria-hidden="true" />
                <strong>{h.nazwa}</strong>
                <span className={`household-role-tag ${h.rola === "owner" ? "is-owner" : ""}`}>
                  {h.rola === "owner"
                    ? pl
                      ? "Właściciel"
                      : "Owner"
                    : pl
                      ? "Współopiekun"
                      : "Member"}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Karta główna gospodarstwa */}
      <section className="household-manager-card">
        <div className="household-manager-card-top">
          <div className="household-manager-title-row">
            <span className="household-manager-home-icon" aria-hidden="true">
              <IconHome size={24} />
            </span>
            <div>
              {isEditingName ? (
                <form
                  onSubmit={handleSaveName}
                  className="household-name-form"
                >
                  <input
                    type="text"
                    value={nameValue}
                    onChange={(e) => setNameValue(e.target.value)}
                    maxLength={100}
                    autoFocus
                    className="household-name-input"
                  />
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={isSavingName}
                  >
                    {isSavingName ? (pl ? "Zapis…" : "Saving…") : pl ? "Zapisz" : "Save"}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setNameValue(household.nazwa);
                      setIsEditingName(false);
                    }}
                  >
                    {pl ? "Anuluj" : "Cancel"}
                  </Button>
                </form>
              ) : (
                <div className="household-name-display">
                  <h2>{household.nazwa}</h2>
                  {isOwner && (
                    <button
                      type="button"
                      className="household-edit-name-btn"
                      onClick={() => setIsEditingName(true)}
                      title={pl ? "Zmień nazwę gospodarstwa" : "Rename household"}
                      aria-label={pl ? "Zmień nazwę gospodarstwa" : "Rename household"}
                    >
                      <IconPencil size={16} aria-hidden="true" />
                    </button>
                  )}
                </div>
              )}
              <p className="household-manager-meta">
                {pl
                  ? `Założone: ${formatDate(household.created_at)}`
                  : `Created: ${formatDate(household.created_at)}`}
              </p>
            </div>
          </div>

          <div className="household-manager-badge-col">
            <span
              className={`household-role-badge ${isOwner ? "is-owner" : "is-member"}`}
            >
              <IconShieldCheck size={14} aria-hidden="true" />
              {isOwner
                ? pl
                  ? "Właściciel gospodarstwa"
                  : "Household owner"
                : pl
                  ? "Współopiekun (Członek)"
                  : "Co-guardian (Member)"}
            </span>
          </div>
        </div>
      </section>

      {/* Sekcja: Członkowie gospodarstwa */}
      <section className="household-manager-card">
        <div className="household-manager-section-header">
          <div>
            <h3>
              {pl ? "Członkowie gospodarstwa" : "Household members"} (
              {members.length + 1})
            </h3>
            <p>
              {pl
                ? "Wszystkie osoby na tej liście mają dostęp do historii zdrowia, badań, szczepień i terminarza wszystkich zwierząt w tym domu."
                : "All members on this list have access to health history, tests, vaccinations, and calendar for all pets in this home."}
            </p>
          </div>
        </div>

        <ul className="household-members-list">
          {/* Właściciel */}
          <li className="household-member-item is-owner-item">
            <div className="household-member-avatar">
              <IconUserCheck size={20} aria-hidden="true" />
            </div>
            <div className="household-member-info">
              <div className="household-member-title-line">
                <strong>
                  {initialData.owner.email || (pl ? "Właściciel konta" : "Account owner")}
                </strong>
                {initialData.owner.is_self && (
                  <span className="household-tag">{pl ? "Ty" : "You"}</span>
                )}
                <span className="household-role-tag is-owner">
                  {pl ? "Właściciel" : "Owner"}
                </span>
              </div>
              <small>
                {pl
                  ? `Właściciel od ${formatDate(initialData.owner.created_at)}`
                  : `Owner since ${formatDate(initialData.owner.created_at)}`}
              </small>
            </div>
          </li>

          {/* Członkowie */}
          {members.map((member) => (
            <li key={member.user_id} className="household-member-item">
              <div className="household-member-avatar">
                <IconUser size={20} aria-hidden="true" />
              </div>
              <div className="household-member-info">
                <div className="household-member-title-line">
                  <strong>
                    {member.email || (pl ? "Współopiekun" : "Co-guardian")}
                  </strong>
                  {member.is_self && (
                    <span className="household-tag">{pl ? "Ty" : "You"}</span>
                  )}
                  <span className="household-role-tag">
                    {pl ? "Współopiekun" : "Co-guardian"}
                  </span>
                </div>
                <small>
                  {pl
                    ? `Dołączył(a): ${formatDate(member.created_at)}`
                    : `Joined: ${formatDate(member.created_at)}`}
                </small>
              </div>

              {(isOwner || member.is_self) && (
                <div className="household-member-actions">
                  <button
                    type="button"
                    className="history-action-btn is-danger"
                    disabled={busyActionKey === `remove-${member.user_id}`}
                    onClick={() => void handleRemoveMember(member)}
                  >
                    <IconUserX size={15} aria-hidden="true" />
                    <span>
                      {member.is_self
                        ? pl
                          ? "Opuść gospodarstwo"
                          : "Leave household"
                        : pl
                          ? "Usuń dostęp"
                          : "Remove access"}
                    </span>
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>

        {members.length === 0 && (
          <div className="household-members-empty">
            <IconUsers size={24} aria-hidden="true" />
            <p>
              {pl
                ? "W tym gospodarstwie jesteś jedynym opiekunem. Zaproś partnera lub członka rodziny poniżej, aby wspólnie dbać o zwierzaki."
                : "You are currently the only caregiver in this household. Invite your partner or family member below to share care."}
            </p>
          </div>
        )}
      </section>

      {/* Sekcja: Zaproś współopiekuna (dla właściciela) */}
      {isOwner && (
        <section className="household-manager-card">
          <div className="household-manager-section-header">
            <div>
              <h3>{pl ? "Zaproś współopiekuna" : "Invite a co-guardian"}</h3>
              <p>
                {pl
                  ? "Wpisz adres e-mail partnera lub członka rodziny. Wyślemy wiadomość z bezpiecznym linkiem do dołączenia do gospodarstwa."
                  : "Enter the email of your partner or family member. We'll send an invitation with a secure link to join."}
              </p>
            </div>
          </div>

          <form onSubmit={handleInvite} className="household-invite-form">
            <div className="household-invite-input-row">
              <div className="household-invite-field">
                <IconMail size={18} aria-hidden="true" />
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder={
                    pl ? "np. anna.kowalska@example.com" : "e.g. anna@example.com"
                  }
                  aria-label={
                    pl
                      ? "Adres e-mail współopiekuna"
                      : "Co-guardian email address"
                  }
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={isInviting || !inviteEmail.trim()}
              >
                <IconUserPlus size={16} aria-hidden="true" />
                {isInviting
                  ? pl
                    ? "Wysyłanie…"
                    : "Sending…"
                  : pl
                    ? "Wyślij zaproszenie"
                    : "Send invitation"}
              </Button>
            </div>

            {inviteFeedback && (
              <div
                className={`household-invite-feedback is-${inviteFeedback.type}`}
                role="status"
              >
                <div className="household-feedback-header">
                  {inviteFeedback.type === "ok" ? (
                    <IconCheck size={16} aria-hidden="true" />
                  ) : (
                    <IconAlertCircle size={16} aria-hidden="true" />
                  )}
                  <span>{inviteFeedback.text}</span>
                </div>

                {inviteFeedback.inviteUrl && (
                  <div className="household-invite-url-box">
                    <input
                      type="text"
                      readOnly
                      value={inviteFeedback.inviteUrl}
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                    />
                    <button
                      type="button"
                      className="history-action-btn is-primary"
                      onClick={() =>
                        void handleCopy(
                          inviteFeedback.inviteUrl!,
                          "feedback-link",
                        )
                      }
                    >
                      {copiedToken === "feedback-link" ? (
                        <>
                          <IconCheck size={14} aria-hidden="true" />
                          <span>{pl ? "Skopiowano! ✓" : "Copied! ✓"}</span>
                        </>
                      ) : (
                        <>
                          <IconCopy size={14} aria-hidden="true" />
                          <span>{pl ? "Kopiuj link" : "Copy link"}</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </form>
        </section>
      )}

      {/* Sekcja: Oczekujące zaproszenia */}
      {isOwner && invitations.length > 0 && (
        <section className="household-manager-card">
          <div className="household-manager-section-header">
            <div>
              <h3>
                {pl ? "Oczekujące zaproszenia" : "Pending invitations"} (
                {invitations.length})
              </h3>
              <p>
                {pl
                  ? "Zaproszenia oczekujące na akceptację przez zaproszoną osobę. Zaproszenie wygasa automatycznie po 7 dniach."
                  : "Invitations awaiting acceptance. An invitation expires automatically after 7 days."}
              </p>
            </div>
          </div>

          <ul className="household-invitations-list">
            {invitations.map((invite) => {
              const origin =
                typeof window !== "undefined"
                  ? window.location.origin
                  : "https://caremypet.app";
              const inviteUrl = `${origin}/pl/zaproszenie/${invite.token}`;
              const isCopied = copiedToken === invite.token;

              return (
                <li key={invite.id} className="household-invitation-item">
                  <div className="household-invitation-main">
                    <div className="household-invitation-title">
                      <IconMail size={16} aria-hidden="true" />
                      <strong>{invite.email}</strong>
                      <span className="household-tag">
                        {pl ? "Oczekuje" : "Pending"}
                      </span>
                    </div>
                    <div className="household-invitation-meta">
                      <span>
                        <IconClock size={13} aria-hidden="true" />
                        {pl
                          ? `Wysłano: ${formatDate(invite.invited_at)}`
                          : `Sent: ${formatDate(invite.invited_at)}`}
                      </span>
                      <span>·</span>
                      <span>
                        {pl
                          ? `Ważne do: ${formatDate(invite.expires_at)}`
                          : `Expires: ${formatDate(invite.expires_at)}`}
                      </span>
                    </div>
                  </div>

                  <div className="household-invitation-actions">
                    <button
                      type="button"
                      className="history-action-btn"
                      onClick={() => void handleCopy(inviteUrl, invite.token)}
                      title={pl ? "Kopiuj link do zaproszenia" : "Copy invitation link"}
                    >
                      {isCopied ? (
                        <>
                          <IconCheck size={14} aria-hidden="true" />
                          <span>{pl ? "Skopiowano!" : "Copied!"}</span>
                        </>
                      ) : (
                        <>
                          <IconCopy size={14} aria-hidden="true" />
                          <span>{pl ? "Kopiuj link" : "Copy link"}</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      className="history-action-btn is-danger"
                      disabled={busyActionKey === `cancel-${invite.id}`}
                      onClick={() => void handleCancelInvite(invite.id)}
                      title={pl ? "Anuluj zaproszenie" : "Cancel invitation"}
                    >
                      <IconTrash size={14} aria-hidden="true" />
                      <span>{pl ? "Anuluj" : "Cancel"}</span>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Sekcja: Zwierzęta w tym gospodarstwie */}
      <section className="household-manager-card">
        <div className="household-manager-section-header">
          <div>
            <h3>
              {pl ? "Zwierzęta w tym gospodarstwie" : "Pets in this household"}{" "}
              ({initialData.pets.length})
            </h3>
            <p>
              {pl
                ? "Pupile, do których opiekunowie w tym gospodarstwie mają wspólny dostęp."
                : "Pets accessible to all caregivers in this household."}
            </p>
          </div>
          <Link href="/app" className="history-action-link">
            <span>{pl ? "Przejdź do pulpitu pupili →" : "Go to pets dashboard →"}</span>
          </Link>
        </div>

        <div className="household-pets-mini-grid">
          {initialData.pets.map((pet) => (
            <Link
              key={pet.id}
              href={`/app/zwierzeta/${pet.id}`}
              className="household-pet-mini-card"
            >
              <div className="household-pet-mini-avatar">
                {pet.gatunek === "cat" ? "🐱" : "🐶"}
              </div>
              <div className="household-pet-mini-info">
                <strong>{pet.imie}</strong>
                <small>
                  {pet.gatunek === "cat"
                    ? pl
                      ? "Kot"
                      : "Cat"
                    : pl
                      ? "Pies"
                      : "Dog"}
                  {pet.rasa ? ` · ${pet.rasa}` : ""}
                </small>
              </div>
            </Link>
          ))}
          {initialData.pets.length === 0 && (
            <p className="household-pets-mini-empty">
              {pl
                ? "Brak dodanych zwierząt w tym gospodarstwie."
                : "No pets in this household yet."}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

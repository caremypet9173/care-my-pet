"use client";

import "@/styles/household-manager.css";
import "@/styles/household-invite.css";
import "@/styles/recovery.css";
import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import {
  IconAlertCircle,
  IconCheck,
  IconClock,
  IconCopy,
  IconHome,
  IconKey,
  IconLock,
  IconMail,
  IconMailForward,
  IconPencil,
  IconPlus,
  IconShieldCheck,
  IconShieldLock,
  IconTrash,
  IconUser,
  IconUserCheck,
  IconUserPlus,
  IconUsers,
  IconUserX,
} from "@tabler/icons-react";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import type {
  HouseholdAdminRequest,
  HouseholdDetailsResponse,
  HouseholdInvitation,
  HouseholdMember,
} from "./types";
import { switchActiveHousehold } from "./actions";
import { notifyHouseholdChange } from "./active-household-events";
import {
  HouseholdRecoveryBanner,
  RecoveryKeyDialog,
} from "./recovery-key-controls";

function getRoleTagLabel(rola: string, pl: boolean): string {
  if (rola === "owner") return pl ? "Właściciel" : "Owner";
  if (rola === "admin") return pl ? "Współadministrator" : "Co-admin";
  return pl ? "Współopiekun" : "Member";
}

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
  const canManage = household.can_manage;

  // Edycja nazwy
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(household.nazwa);
  const [isSavingName, setIsSavingName] = useState(false);

  // Formularz zaproszenia
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"member" | "admin">("member");
  const [isInviting, setIsInviting] = useState(false);
  const [inviteFeedback, setInviteFeedback] = useState<{
    type: "ok" | "error";
    text: string;
    inviteUrl?: string;
  } | null>(null);

  // Bezpieczeństwo: klucz odzyskania, e-mail pomocniczy, wnioski o współadministrację
  const [recoveryKeyDialogOpen, setRecoveryKeyDialogOpen] = useState(false);
  const [backupEmailInput, setBackupEmailInput] = useState(
    household.recovery_email ?? "",
  );
  const [isSavingBackupEmail, setIsSavingBackupEmail] = useState(false);
  const [backupEmailMsg, setBackupEmailMsg] = useState<{
    type: "ok" | "error";
    text: string;
  } | null>(null);
  const [adminRequest, setAdminRequest] =
    useState<HouseholdAdminRequest | null>(initialData.admin_request ?? null);
  const [takeoverMsg, setTakeoverMsg] = useState<{
    type: "ok" | "error";
    text: string;
  } | null>(null);

  // Stany akcji
  const [busyActionKey, setBusyActionKey] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Synchronizacja aktywnego gospodarstwa po stronie klienta (np. przy wejściu przez link ?id=...)
  useEffect(() => {
    if (household?.id) {
      notifyHouseholdChange(household.id);
    }
  }, [household?.id]);

  // Automatyczna synchronizacja po stronie serwera, jeśli upłynął 14-dniowy termin wniosku o współadministrację
  const pendingReqResolvesAt =
    adminRequest?.status === "pending" ? adminRequest.resolves_at : null;
  useEffect(() => {
    if (!pendingReqResolvesAt) return;
    if (new Date(pendingReqResolvesAt).getTime() > Date.now()) return;

    let cancelled = false;
    async function syncExpiredRequest() {
      const client = createClient();
      const { data } = await client.functions.invoke("household", {
        body: { action: "get", household_id: household.id },
      });
      if (!cancelled && data?.household) {
        setHousehold(data.household);
        setMembers(data.members ?? []);
        setInvitations(data.invitations ?? []);
        setAdminRequest(data.admin_request ?? null);
        router.refresh();
      }
    }
    void syncExpiredRequest();
    return () => {
      cancelled = true;
    };
  }, [pendingReqResolvesAt, household.id, router]);

  // Założenie własnego gospodarstwa (dla osób będących tylko współopiekunem)
  const hasOwnedHousehold =
    initialData.availableHouseholds?.some((h) => h.rola === "owner") ??
    household.is_owner;
  const [newHomeName, setNewHomeName] = useState("");
  const [isCreatingHome, setIsCreatingHome] = useState(false);
  const [createHomeError, setCreateHomeError] = useState<string | null>(null);

  async function handleSwitchHousehold(targetId: string) {
    if (targetId === household.id) return;
    notifyHouseholdChange(targetId);
    await switchActiveHousehold(targetId);
    router.push(`/app/household?id=${targetId}`);
    router.refresh();
  }

  async function handleCreateOwnHousehold(e: React.FormEvent) {
    e.preventDefault();
    if (isCreatingHome) return;
    setIsCreatingHome(true);
    setCreateHomeError(null);
    try {
      const client = createClient();
      const { data, error } = await client.functions.invoke("household", {
        body: {
          action: "create_household",
          nazwa: newHomeName.trim(),
        },
      });

      if (error || !data?.household) {
        setCreateHomeError(
          pl
            ? "Nie udało się utworzyć gospodarstwa. Spróbuj ponownie."
            : "Could not create household. Please try again.",
        );
        return;
      }

      const newId = data.household.id;
      notifyHouseholdChange(newId);
      await switchActiveHousehold(newId);
      router.push(`/app/household?id=${newId}`);
      router.refresh();
    } catch {
      setCreateHomeError(
        pl
          ? "Wystąpił błąd podczas tworzenia gospodarstwa."
          : "An error occurred while creating household.",
      );
    } finally {
      setIsCreatingHome(false);
    }
  }

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
          rola: isOwner ? inviteRole : "member",
          locale,
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
        `${window.location.origin}/pl/invite/${invite.token}`;

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

  async function handleSaveBackupEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!isOwner || isSavingBackupEmail) return;
    setIsSavingBackupEmail(true);
    setBackupEmailMsg(null);
    try {
      const client = createClient();
      const trimmed = backupEmailInput.trim();
      const { data, error } = await client.functions.invoke("household", {
        body: {
          action: "update_recovery_email",
          household_id: household.id,
          recovery_email: trimmed,
          locale,
        },
      });

      if (error || !data?.success) {
        setBackupEmailMsg({
          type: "error",
          text:
            data?.error === "invalid_email"
              ? pl
                ? "Podaj poprawny adres e-mail."
                : "Enter a valid email address."
              : pl
                ? "Nie udało się zapisać pomocniczego adresu e-mail."
                : "Failed to save backup email.",
        });
        return;
      }

      const nextEmail = (data.recovery_email as string | null) ?? null;
      setHousehold((prev) => ({ ...prev, recovery_email: nextEmail }));
      setBackupEmailInput(nextEmail ?? "");
      setBackupEmailMsg({
        type: "ok",
        text: nextEmail
          ? pl
            ? `Zapisano adres pomocniczy: ${nextEmail}`
            : `Backup email saved: ${nextEmail}`
          : pl
            ? "Usunięto pomocniczy adres e-mail."
            : "Backup email cleared.",
      });
      router.refresh();
    } finally {
      setIsSavingBackupEmail(false);
    }
  }

  async function handleSetMemberRole(
    member: HouseholdMember,
    nextRole: "admin" | "member",
  ) {
    if (!isOwner) return;
    const key = `role-${member.user_id}`;
    setBusyActionKey(key);
    try {
      const client = createClient();
      const { data, error } = await client.functions.invoke("household", {
        body: {
          action: "set_member_role",
          household_id: household.id,
          user_id: member.user_id,
          rola: nextRole,
          locale,
        },
      });
      if (!error && data?.success) {
        setMembers((prev) =>
          prev.map((m) =>
            m.user_id === member.user_id ? { ...m, rola: nextRole } : m,
          ),
        );
        router.refresh();
      }
    } finally {
      setBusyActionKey(null);
    }
  }

  async function handleRequestAdminTakeover() {
    if (isOwner || household.my_role !== "member") return;
    const confirmed = confirm(
      pl
        ? "Złożyć wniosek o rolę współadministratora? Właściciel otrzyma wiadomość e-mail i ma 14 dni na zatwierdzenie lub sprzeciw. Po tym czasie uprawnienia zostaną nadane automatycznie."
        : "Request co-admin rights? The owner will receive an email alert and has 14 days to veto before automatic activation.",
    );
    if (!confirmed) return;

    setBusyActionKey("takeover-request");
    setTakeoverMsg(null);
    try {
      const client = createClient();
      const { data, error } = await client.functions.invoke("household", {
        body: {
          action: "request_admin_takeover",
          household_id: household.id,
          locale,
        },
      });
      if (error || !data?.admin_request) {
        setTakeoverMsg({
          type: "error",
          text:
            data?.error === "request_already_pending"
              ? pl
                ? "Wniosek o współadministrację już oczekuje na rozpatrzenie."
                : "A co-admin request is already pending."
              : pl
                ? "Nie udało się złożyć wniosku."
                : "Failed to submit co-admin request.",
        });
        return;
      }
      setAdminRequest(data.admin_request as HouseholdAdminRequest);
      setTakeoverMsg({
        type: "ok",
        text: pl
          ? "Wysłano wniosek o współadministrację. Powiadomienie trafiło do właściciela."
          : "Co-admin request submitted. Owner has been notified.",
      });
      router.refresh();
    } finally {
      setBusyActionKey(null);
    }
  }

  async function handleRespondAdminRequest(
    decision: "approve" | "reject" | "cancel",
  ) {
    if (!adminRequest) return;
    setBusyActionKey(`req-${decision}`);
    setTakeoverMsg(null);
    try {
      const client = createClient();
      const { data, error } = await client.functions.invoke("household", {
        body: {
          action: "respond_admin_request",
          household_id: household.id,
          request_id: adminRequest.id,
          decision,
          locale,
        },
      });
      if (!error && data?.admin_request) {
        const updatedReq = data.admin_request as HouseholdAdminRequest;
        setAdminRequest(updatedReq);
        if (decision === "approve") {
          setMembers((prev) =>
            prev.map((m) =>
              m.user_id === adminRequest.requester_user_id
                ? { ...m, rola: "admin" }
                : m,
            ),
          );
        }
        router.refresh();
      }
    } finally {
      setBusyActionKey(null);
    }
  }

  const selfMember = members.find((m) => m.is_self) ?? null;
  const isRequesterSelf = Boolean(
    adminRequest && selfMember && adminRequest.requester_user_id === selfMember.user_id,
  );
  const canRotateOrSetKey = isOwner;

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
              <button
                key={h.id}
                type="button"
                onClick={() => handleSwitchHousehold(h.id)}
                className={`household-switcher-pill ${h.id === household.id ? "is-active" : ""}`}
              >
                <IconHome size={16} aria-hidden="true" />
                <strong>{h.nazwa}</strong>
                <span className={`household-role-tag ${h.rola === "owner" ? "is-owner" : h.rola === "admin" ? "is-admin" : ""}`}>
                  {getRoleTagLabel(h.rola, pl)}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      <HouseholdRecoveryBanner
        householdId={household.id}
        householdName={household.nazwa}
        ownerEmail={initialData.owner?.email ?? ""}
        recoveryEmail={household.recovery_email}
        canManage={isOwner}
        hasRecoveryKey={household.has_recovery_key}
      />

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
                  {canManage && (
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
              className={`household-role-badge ${
                isOwner ? "is-owner" : household.my_role === "admin" ? "is-admin" : "is-member"
              }`}
            >
              <IconShieldCheck size={14} aria-hidden="true" />
              {isOwner
                ? pl
                  ? "Właściciel gospodarstwa"
                  : "Household owner"
                : household.my_role === "admin"
                  ? pl
                    ? "Współadministrator"
                    : "Co-admin"
                  : pl
                    ? "Współopiekun (Członek)"
                    : "Co-guardian (Member)"}
            </span>
          </div>
        </div>
      </section>

      {/* Opcja dla współopiekuna: Założenie własnego gospodarstwa */}
      {!hasOwnedHousehold && (
        <section className="household-manager-card household-create-own-card">
          <div className="household-create-own-header">
            <span className="household-create-own-icon" aria-hidden="true">
              <IconHome size={24} />
            </span>
            <div>
              <h3>
                {pl
                  ? "Chcesz założyć własne gospodarstwo domowe?"
                  : "Want to create your own household?"}
              </h3>
              <p>
                {pl
                  ? `Obecnie jesteś współopiekunem w gospodarstwie „${household.nazwa}”. Masz dostęp do kartotek, badań i leków wspólnych pupili. Jeśli chcesz dodać własnego nowego zwierzaka lub zaprosić innych domowników, możesz w każdej chwili założyć własne gospodarstwo (będziesz jego właścicielem).`
                  : `You are currently a co-guardian in "${household.nazwa}". If you want to add your own new pets and invite caregivers, you can create your own household.`}
              </p>
            </div>
          </div>

          <form
            onSubmit={handleCreateOwnHousehold}
            className="household-create-own-form"
          >
            <input
              type="text"
              value={newHomeName}
              onChange={(e) => setNewHomeName(e.target.value)}
              placeholder={pl ? "np. Mój dom lub Dom Rodzinny" : "e.g. My Home"}
              maxLength={100}
              disabled={isCreatingHome}
              aria-label={pl ? "Nazwa nowego gospodarstwa" : "New household name"}
            />
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isCreatingHome}
            >
              <IconPlus size={16} aria-hidden="true" />
              {isCreatingHome
                ? pl
                  ? "Tworzenie…"
                  : "Creating…"
                : pl
                  ? "Załóż własne gospodarstwo"
                  : "Create my household"}
            </Button>
          </form>

          {createHomeError && (
            <p className="household-create-own-error" role="alert">
              <IconAlertCircle size={15} aria-hidden="true" />
              <span>{createHomeError}</span>
            </p>
          )}
        </section>
      )}

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
          {members.map((member) => {
            const isAdminMember = member.rola === "admin";
            const canRemoveMember =
              member.is_self || isOwner || (canManage && !isAdminMember);
            return (
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
                    <span
                      className={`household-role-tag ${
                        isAdminMember ? "is-admin" : ""
                      }`}
                    >
                      {getRoleTagLabel(member.rola, pl)}
                    </span>
                  </div>
                  <small>
                    {pl
                      ? `Dołączył(a): ${formatDate(member.created_at)}`
                      : `Joined: ${formatDate(member.created_at)}`}
                  </small>
                </div>

                {(isOwner || canRemoveMember) && (
                  <div className="household-member-actions">
                    {isOwner && (
                      <button
                        type="button"
                        className="history-action-btn"
                        disabled={busyActionKey === `role-${member.user_id}`}
                        onClick={() =>
                          void handleSetMemberRole(
                            member,
                            isAdminMember ? "member" : "admin",
                          )
                        }
                      >
                        <IconShieldCheck size={15} aria-hidden="true" />
                        <span>
                          {isAdminMember
                            ? pl
                              ? "Cofnij współadministratora"
                              : "Demote to member"
                            : pl
                              ? "Nadaj współadministratora"
                              : "Promote to co-admin"}
                        </span>
                      </button>
                    )}
                    {canRemoveMember && (
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
                    )}
                  </div>
                )}
              </li>
            );
          })}
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

      {/* Sekcja: Zaproś współopiekuna (dla właściciela i współadministratora) */}
      {canManage && (
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

              {isOwner && (
                <select
                  value={inviteRole}
                  onChange={(e) =>
                    setInviteRole(e.target.value === "admin" ? "admin" : "member")
                  }
                  aria-label={pl ? "Rola zapraszanej osoby" : "Invitee role"}
                  className="household-invite-role-select"
                >
                  <option value="member">
                    {pl ? "Współopiekun" : "Member"}
                  </option>
                  <option value="admin">
                    {pl ? "Współadministrator" : "Co-admin"}
                  </option>
                </select>
              )}

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

      {/* Sekcja: Bezpieczeństwo i klucz odzyskania dostępu */}
      <section className="household-manager-card recovery-settings-card">
        <div className="household-manager-section-header">
          <div>
            <h3>
              <IconShieldLock size={18} aria-hidden="true" />{" "}
              {pl
                ? "Bezpieczeństwo i klucz odzyskania dostępu"
                : "Security & emergency recovery key"}
            </h3>
            <p>
              {pl
                ? "Jednorazowy klucz odzyskania zabezpiecza kartoteki na wypadek utraty dostępu do konta lub skrzynki właściciela. Domostwo bez aktywnego klucza działa wyłącznie w trybie odczytu."
                : "A one-time recovery key protects this household if the owner loses account or email access. Without an active key, records are strictly read-only."}
            </p>
          </div>
          <span
            className={`recovery-status-badge ${
              household.has_recovery_key ? "is-active" : "is-missing"
            }`}
          >
            {household.has_recovery_key ? (
              <>
                <IconCheck size={14} aria-hidden="true" />
                {pl ? "Aktywny klucz" : "Key active"}
                {household.recovery_key_hint ? ` (${household.recovery_key_hint})` : ""}
              </>
            ) : (
              <>
                <IconLock size={14} aria-hidden="true" />
                {pl ? "Brak klucza (tylko odczyt)" : "No key (read-only)"}
              </>
            )}
          </span>
        </div>

        <div className="recovery-settings-grid">
          <div className="recovery-setting-box">
            <div className="recovery-setting-meta">
              <strong>
                {pl ? "Jednorazowy klucz odzyskania (Legacy)" : "One-time recovery key"}
              </strong>
              <span>
                {household.recovery_key_set_at
                  ? pl
                    ? `Ustawiony: ${formatDate(household.recovery_key_set_at)} · Końcówka: ${household.recovery_key_hint ?? "—"}`
                    : `Set on: ${formatDate(household.recovery_key_set_at)} · Hint: ${household.recovery_key_hint ?? "—"}`
                  : pl
                    ? "Nie wygenerowano jeszcze klucza. Zapis nowych danych i edycja są zablokowane."
                    : "Not generated yet. Creating or editing records is currently blocked."}
              </span>
            </div>
            <div className="recovery-setting-actions">
              {canRotateOrSetKey ? (
                <Button
                  type="button"
                  size="sm"
                  variant={household.has_recovery_key ? "secondary" : "primary"}
                  onClick={() => setRecoveryKeyDialogOpen(true)}
                >
                  <IconKey size={15} aria-hidden="true" />
                  {household.has_recovery_key
                    ? pl
                      ? "Rotuj / wygeneruj nowy klucz"
                      : "Rotate / generate new key"
                    : pl
                      ? "Wygeneruj klucz odzyskania"
                      : "Generate recovery key"}
                </Button>
              ) : (
                <small className="recovery-owner-only-note">
                  {pl
                    ? "Rotację istniejącego klucza może wykonać tylko właściciel domostwa."
                    : "Only the household owner can rotate an active recovery key."}
                </small>
              )}
              <Link href="/recover" className="history-action-link">
                {pl ? "Publiczny formularz odzyskania →" : "Public recovery portal →"}
              </Link>
            </div>
          </div>

          {isOwner && (
            <form onSubmit={handleSaveBackupEmail} className="recovery-setting-box">
              <div className="recovery-setting-meta">
                <label htmlFor="household-backup-email">
                  <strong>
                    {pl ? "Pomocniczy e-mail odzyskania (opcjonalnie)" : "Backup recovery email (optional)"}
                  </strong>
                </label>
                <span>
                  {pl
                    ? "Możesz wysłać na ten adres kopię klucza odzyskania oraz otrzymywać alerty bezpieczeństwa."
                    : "Receive a copy of new recovery keys and urgent security alerts here."}
                </span>
              </div>
              <div className="recovery-backup-email-row">
                <input
                  id="household-backup-email"
                  type="email"
                  placeholder={pl ? "np. zaufana.osoba@domena.pl" : "backup@example.com"}
                  value={backupEmailInput}
                  onChange={(e) => setBackupEmailInput(e.target.value)}
                />
                <Button
                  type="submit"
                  size="sm"
                  variant="secondary"
                  disabled={isSavingBackupEmail}
                >
                  <IconMailForward size={15} aria-hidden="true" />
                  {isSavingBackupEmail
                    ? pl
                      ? "Zapisywanie..."
                      : "Saving..."
                    : pl
                      ? "Zapisz adres"
                      : "Save email"}
                </Button>
              </div>
              {backupEmailMsg && (
                <p
                  className={`household-invite-feedback is-${backupEmailMsg.type}`}
                  role="status"
                >
                  {backupEmailMsg.text}
                </p>
              )}
            </form>
          )}
        </div>
      </section>

      {/* Sekcja: Ciągłość administracji (14-dniowy wniosek o współadministratora) */}
      {(adminRequest || (!isOwner && household.my_role === "member")) && (
        <section
          className={`household-manager-card recovery-takeover-card ${
            adminRequest?.status === "pending" ? "is-pending" : ""
          }`}
        >
          <div className="household-manager-section-header">
            <div>
              <h3>
                <IconClock size={18} aria-hidden="true" />{" "}
                {pl
                  ? "Przekazanie / ciągłość administracji domostwem"
                  : "Household continuity & co-admin request"}
              </h3>
              {adminRequest?.status === "pending" ? (
                <p>
                  {isOwner
                    ? pl
                      ? `Opiekun ${adminRequest.requester_email} złożył wniosek o rolę współadministratora. Jeśli nie odrzucisz go do ${formatDate(adminRequest.resolves_at)}, uprawnienia zostaną nadane automatycznie.`
                      : `Member ${adminRequest.requester_email} requested co-admin access. Unless rejected by ${formatDate(adminRequest.resolves_at)}, access is granted automatically.`
                    : pl
                      ? `Oczekuje wniosek opiekuna ${adminRequest.requester_email} o nadanie roli współadministratora. Automatyczna aktywacja bez sprzeciwu właściciela nastąpi: ${formatDate(adminRequest.resolves_at)}.`
                      : `Co-admin request by ${adminRequest.requester_email} is pending until ${formatDate(adminRequest.resolves_at)}.`}
                </p>
              ) : adminRequest ? (
                <p>
                  {adminRequest.status === "approved"
                    ? pl
                      ? `Ostatni wniosek (${adminRequest.requester_email}) został zatwierdzony.`
                      : `Latest request (${adminRequest.requester_email}) was approved.`
                    : adminRequest.status === "rejected"
                      ? pl
                        ? `Ostatni wniosek (${adminRequest.requester_email}) został odrzucony przez właściciela.`
                        : `Latest request (${adminRequest.requester_email}) was rejected by the owner.`
                      : pl
                        ? `Ostatni wniosek (${adminRequest.requester_email}) został wycofany.`
                        : `Latest request (${adminRequest.requester_email}) was cancelled.`}
                </p>
              ) : (
                <p>
                  {pl
                    ? "Jeśli obecny właściciel nie odpowiada, jako opiekun możesz wnioskować o rolę współadministratora. Właściciel otrzyma alert i ma 14 dni na zgłoszenie weta."
                    : "If the owner is unresponsive, you may request co-admin permissions. The owner is alerted and has 14 days to veto."}
                </p>
              )}
            </div>
          </div>

          <div className="recovery-takeover-actions">
            {adminRequest?.status === "pending" && isOwner && (
              <>
                <Button
                  type="button"
                  size="sm"
                  disabled={busyActionKey !== null}
                  onClick={() => void handleRespondAdminRequest("approve")}
                >
                  <IconCheck size={15} aria-hidden="true" />
                  {pl ? "Zatwierdź teraz" : "Approve now"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={busyActionKey !== null}
                  onClick={() => void handleRespondAdminRequest("reject")}
                >
                  <IconUserX size={15} aria-hidden="true" />
                  {pl ? "Odrzuć wniosek (weto)" : "Reject request (veto)"}
                </Button>
              </>
            )}

            {adminRequest?.status === "pending" && isRequesterSelf && (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={busyActionKey !== null}
                onClick={() => void handleRespondAdminRequest("cancel")}
              >
                {pl ? "Wycofaj swój wniosek" : "Cancel request"}
              </Button>
            )}

            {(!adminRequest || adminRequest.status !== "pending") &&
              !isOwner &&
              household.my_role === "member" && (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={busyActionKey === "takeover-request"}
                  onClick={() => void handleRequestAdminTakeover()}
                >
                  <IconShieldCheck size={15} aria-hidden="true" />
                  {pl
                    ? "Wnioskuj o współadministrację (14 dni)"
                    : "Request co-admin rights (14 days)"}
                </Button>
              )}
          </div>

          {takeoverMsg && (
            <p className={`household-invite-feedback is-${takeoverMsg.type}`} role="status">
              {takeoverMsg.text}
            </p>
          )}
        </section>
      )}

      {/* Sekcja: Oczekujące zaproszenia */}
      {canManage && invitations.length > 0 && (
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
                  : "https://caremypet.pl";
              const inviteUrl = `${origin}/pl/invite/${invite.token}`;
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
              href={`/app/pets/${pet.id}`}
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

      <RecoveryKeyDialog
        open={recoveryKeyDialogOpen}
        onClose={() => setRecoveryKeyDialogOpen(false)}
        householdId={household.id}
        householdName={household.nazwa}
        ownerEmail={initialData.owner?.email ?? ""}
        recoveryEmail={household.recovery_email}
        hasExistingKey={household.has_recovery_key}
        onGenerated={(payload) => {
          setHousehold((prev) => ({
            ...prev,
            has_recovery_key: true,
            recovery_key_hint: payload.recovery_key_hint,
            recovery_key_set_at: payload.recovery_key_set_at,
          }));
        }}
      />
    </div>
  );
}

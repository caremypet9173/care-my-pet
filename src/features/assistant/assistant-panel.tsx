"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "next-intl";
import {
  IconAlertCircle,
  IconFlask,
  IconHistory,
  IconInfoCircle,
  IconMessageCircle,
  IconPlus,
  IconSend,
  IconSparkles,
  IconUser,
} from "@tabler/icons-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { FormattedMedicalText } from "@/features/medical/formatted-text";
import type {
  AssistantMessage,
  AssistantSource,
  AssistantThread,
} from "./types";

const MAX_MESSAGE_CHARS = 800;
const DAILY_MESSAGE_LIMIT = 20;

export function AssistantPanel({
  petId,
  petName,
  initialThreads,
  initialMessages,
  initialQuotaUsed,
}: {
  petId: string;
  petName: string;
  initialThreads?: AssistantThread[];
  initialMessages?: AssistantMessage[];
  initialQuotaUsed?: number;
}) {
  const locale = useLocale();
  const pl = locale === "pl";

  const [threads, setThreads] = useState<AssistantThread[]>(initialThreads ?? []);
  const [messages, setMessages] = useState<AssistantMessage[]>(initialMessages ?? []);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(
    initialThreads?.[0]?.id ?? null,
  );
  const [quotaUsed, setQuotaUsed] = useState(initialQuotaUsed ?? 0);
  const [loadingInitial, setLoadingInitial] = useState(initialThreads === undefined);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const threadEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (initialThreads !== undefined) return;
    let active = true;

    async function loadLazyAssistantData() {
      setLoadingInitial(true);
      try {
        const client = createClient();
        const [threadsRes, msgsRes, quotaRes] = await Promise.all([
          client
            .from("pet_assistant_thread")
            .select("*")
            .eq("pet_id", petId)
            .order("updated_at", { ascending: false })
            .limit(50),
          client
            .from("pet_assistant_message")
            .select("*")
            .eq("pet_id", petId)
            .order("created_at", { ascending: true })
            .limit(300),
          client.rpc("get_ai_assistant_quota_used"),
        ]);

        if (!active) return;

        if (threadsRes.data) {
          const loadedThreads = threadsRes.data as AssistantThread[];
          setThreads(loadedThreads);
          setSelectedThreadId(loadedThreads[0]?.id ?? null);
        }
        if (msgsRes.data) {
          setMessages(
            (msgsRes.data as Array<Record<string, unknown>>).map((row) => ({
              ...row,
              sources: Array.isArray(row.sources) ? row.sources : [],
              follow_ups: Array.isArray(row.follow_ups) ? row.follow_ups : [],
            })) as AssistantMessage[],
          );
        }
        if (typeof quotaRes.data === "number") {
          setQuotaUsed(quotaRes.data);
        }
      } catch (err) {
        console.error("Failed to load assistant data", err);
      } finally {
        if (active) setLoadingInitial(false);
      }
    }

    void loadLazyAssistantData();
    return () => {
      active = false;
    };
  }, [petId, initialThreads]);

  const activeMessages = useMemo(
    () =>
      selectedThreadId
        ? messages.filter((m) => m.thread_id === selectedThreadId)
        : [],
    [messages, selectedThreadId],
  );

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [activeMessages.length, sending, selectedThreadId]);

  const trimmed = input.trim();
  const charsLeft = MAX_MESSAGE_CHARS - input.length;
  const overCharLimit = input.length > MAX_MESSAGE_CHARS;
  const quotaReached = quotaUsed >= DAILY_MESSAGE_LIMIT;

  const suggestedPrompts = pl
    ? [
        `Podsumuj ostatnie badania i wizyty ${petName}`,
        `Kiedy wypada kolejny termin szczepienia lub profilaktyki?`,
        `Jak zmieniała się waga ${petName} w ostatnim czasie?`,
        `O co warto zapytać lekarza na najbliższej wizycie kontrolnej?`,
      ]
    : [
        `Summarize ${petName}'s latest lab results and visits`,
        `When is the next vaccination or preventive care due?`,
        `How has ${petName}'s weight changed recently?`,
        `What should I ask the vet at the next check-up?`,
      ];

  const formatTime = (iso: string) =>
    new Intl.DateTimeFormat(locale, {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(iso));

  const formatThreadDate = (iso: string) =>
    new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
    }).format(new Date(iso));

  const lastAssistantMessage = useMemo(() => {
    for (let i = activeMessages.length - 1; i >= 0; i--) {
      if (activeMessages[i].role === "assistant") {
        return activeMessages[i];
      }
    }
    return null;
  }, [activeMessages]);

  function startNewChat() {
    if (sending) return;
    setSelectedThreadId(null);
    setError("");
    textareaRef.current?.focus();
  }

  async function sendQuestion(questionText?: string) {
    const textToSend = (questionText ?? input).trim();
    if (!textToSend || sending || quotaReached) return;
    if (textToSend.length > MAX_MESSAGE_CHARS) {
      setError(
        pl
          ? `Wiadomość jest za długa (maksymalnie ${MAX_MESSAGE_CHARS} znaków).`
          : `Message is too long (maximum ${MAX_MESSAGE_CHARS} characters).`,
      );
      return;
    }

    setError("");
    setSending(true);

    const tempThreadId = selectedThreadId ?? `temp-thread-${Date.now()}`;
    const optimisticId = `temp-${Date.now()}`;
    const optimisticUserMsg: AssistantMessage = {
      id: optimisticId,
      thread_id: tempThreadId,
      pet_id: petId,
      household_id: "",
      role: "user",
      content: textToSend,
      sources: [],
      follow_ups: [],
      created_by: "",
      created_at: new Date().toISOString(),
    };

    const previousSelectedThreadId = selectedThreadId;
    if (!selectedThreadId) {
      setSelectedThreadId(tempThreadId);
    }
    if (!questionText) setInput("");
    setMessages((prev) => [...prev, optimisticUserMsg]);

    try {
      const client = createClient();
      const { data, error: fnError } = await client.functions.invoke(
        "pet-assistant",
        {
          body: {
            action: "ask",
            pet_id: petId,
            thread_id: previousSelectedThreadId,
            message: textToSend,
            locale,
          },
        },
      );

      if (fnError || !data?.assistant_message || !data?.thread) {
        const status = fnError?.context?.status;
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
        setSelectedThreadId(previousSelectedThreadId);
        if (!questionText) setInput(textToSend);

        if (status === 429) {
          setQuotaUsed(DAILY_MESSAGE_LIMIT);
          setError(
            pl
              ? `Wykorzystano dzienny limit ${DAILY_MESSAGE_LIMIT} wiadomości do Asystenta AI.`
              : `Daily limit of ${DAILY_MESSAGE_LIMIT} AI Assistant messages reached.`,
          );
        } else if (status === 400) {
          setError(
            pl
              ? `Pytanie przekracza dopuszczalną długość (${MAX_MESSAGE_CHARS} znaków).`
              : `Question exceeds maximum length (${MAX_MESSAGE_CHARS} characters).`,
          );
        } else {
          setError(
            pl
              ? "Asystent AI jest chwilowo niedostępny. Spróbuj ponownie za chwilę."
              : "AI Assistant is temporarily unavailable. Please try again shortly.",
          );
        }
        return;
      }

      const returnedThread = data.thread as AssistantThread;
      const savedUser = {
        ...(data.user_message as AssistantMessage),
        sources: [],
        follow_ups: [],
      };
      const savedAssistant: AssistantMessage = {
        ...(data.assistant_message as AssistantMessage),
        sources: Array.isArray(data.assistant_message.sources)
          ? (data.assistant_message.sources as AssistantSource[])
          : [],
        follow_ups: Array.isArray(data.assistant_message.follow_ups)
          ? (data.assistant_message.follow_ups as string[])
          : [],
      };

      setThreads((prev) => {
        const rest = prev.filter((t) => t.id !== returnedThread.id);
        return [returnedThread, ...rest];
      });
      setSelectedThreadId(returnedThread.id);
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== optimisticId),
        savedUser,
        savedAssistant,
      ]);

      if (typeof data.used === "number") {
        setQuotaUsed(data.used);
      } else {
        setQuotaUsed((u) => Math.min(DAILY_MESSAGE_LIMIT, u + 1));
      }
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      setSelectedThreadId(previousSelectedThreadId);
      if (!questionText) setInput(textToSend);
      setError(
        pl
          ? "Nie udało się połączyć z Asystentem AI. Sprawdź połączenie i spróbuj ponownie."
          : "Could not connect to AI Assistant. Check your connection and retry.",
      );
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  }

  return (
    <div className="assistant-panel">
      <section className="pet-panel assistant-header-card">
        <div className="assistant-header-top">
          <div className="assistant-header-title">
            <span className="assistant-badge-icon" aria-hidden="true">
              <IconSparkles size={20} />
            </span>
            <div>
              <h2>
                {pl
                  ? `Asystent AI kartoteki — ${petName}`
                  : `Record AI Assistant — ${petName}`}
              </h2>
              <p>
                {pl
                  ? "Zadawaj pytania o wyniki badań, wizyty, wagę i nadchodzące terminy profilaktyki na podstawie zatwierdzonej dokumentacji."
                  : "Ask questions about lab results, visits, weight, and upcoming preventive care based on confirmed records."}
              </p>
            </div>
          </div>

          <div className="assistant-header-actions">
            <span
              className={`assistant-quota-pill${quotaReached ? " is-limit" : ""}`}
              title={
                pl
                  ? "Dzienny limit zapytań do Asystenta AI (odnawia się o północy UTC)"
                  : "Daily AI Assistant query quota (resets at midnight UTC)"
              }
            >
              {pl
                ? `Dzisiaj: ${quotaUsed} / ${DAILY_MESSAGE_LIMIT} zapytań`
                : `Today: ${quotaUsed} / ${DAILY_MESSAGE_LIMIT} queries`}
            </span>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={sending || selectedThreadId === null}
              onClick={startNewChat}
            >
              <IconPlus size={16} aria-hidden="true" />
              {pl ? "Nowa rozmowa" : "New chat"}
            </Button>
          </div>
        </div>

        <div className="assistant-disclaimer">
          <IconInfoCircle size={17} aria-hidden="true" />
          <span>
            {pl
              ? "Asystent odpowiada wyłącznie na podstawie zapisanych danych w kartotece i nie zastępuje konsultacji ani diagnozy lekarza weterynarii."
              : "The assistant answers strictly based on saved record entries and does not replace veterinary consultation or diagnosis."}
          </span>
        </div>
      </section>

      {loadingInitial ? (
        <section className="pet-panel p-12 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
          <IconSparkles size={32} className="animate-pulse text-teal-600" />
          <p className="text-sm font-medium">
            {pl
              ? "Wczytywanie historii rozmów z Asystentem AI…"
              : "Loading AI Assistant conversations…"}
          </p>
        </section>
      ) : (
        <div className="assistant-workspace">
        <aside
          className="pet-panel assistant-sidebar"
          aria-label={pl ? "Historia rozmów" : "Conversation history"}
        >
          <div className="assistant-sidebar-header">
            <h3>{pl ? "Historia rozmów" : "Chat history"}</h3>
            <span>{threads.length}</span>
          </div>

          <button
            type="button"
            className={`assistant-new-thread-btn${selectedThreadId === null ? " is-active" : ""}`}
            disabled={sending}
            onClick={startNewChat}
          >
            <IconPlus size={16} aria-hidden="true" />
            <span>{pl ? "Nowa rozmowa (czysty kontekst)" : "New chat (fresh context)"}</span>
          </button>

          {threads.length === 0 ? (
            <p className="assistant-sidebar-empty">
              {pl
                ? "Brak wcześniejszych rozmów. Zadaj pierwsze pytanie, aby rozpocząć wątek."
                : "No previous chats yet. Ask your first question to start a thread."}
            </p>
          ) : (
            <ul className="assistant-thread-list">
              {threads.map((thread) => {
                const isSelected = thread.id === selectedThreadId;
                const count = messages.filter(
                  (m) => m.thread_id === thread.id,
                ).length;
                return (
                  <li key={thread.id}>
                    <button
                      type="button"
                      className={`assistant-thread-item${isSelected ? " is-active" : ""}`}
                      disabled={sending}
                      onClick={() => {
                        setSelectedThreadId(thread.id);
                        setError("");
                      }}
                    >
                      <IconMessageCircle size={17} aria-hidden="true" />
                      <div className="assistant-thread-item-text">
                        <strong>{thread.title}</strong>
                        <small>
                          {formatThreadDate(thread.updated_at)}
                          {count > 0
                            ? pl
                              ? ` · ${count} wiad.`
                              : ` · ${count} msgs`
                            : ""}
                        </small>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        <section className="pet-panel assistant-chat-card" aria-live="polite">
          {activeMessages.length === 0 ? (
            <div className="assistant-empty-state">
              <div className="assistant-empty-icon" aria-hidden="true">
                <IconSparkles size={28} />
              </div>
              <h3>
                {pl
                  ? `Nowa rozmowa o zdrowiu ${petName}`
                  : `New conversation about ${petName}'s health`}
              </h3>
              <p>
                {pl
                  ? "Okno kontekstowe jest czyste — wybierz jedno z pytań startowych poniżej, wpisz własne pytanie lub wróć do wcześniejszej rozmowy z listy po lewej stronie."
                  : "Context window is fresh — pick a starter question below, type your own question, or select a previous conversation on the left."}
              </p>
              <div className="assistant-suggestions">
                {suggestedPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    className="assistant-suggestion-chip"
                    disabled={sending || quotaReached}
                    onClick={() => void sendQuestion(prompt)}
                  >
                    <IconSparkles size={15} aria-hidden="true" />
                    <span>{prompt}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="assistant-thread">
              {activeMessages.map((msg) => {
                const isUser = msg.role === "user";
                return (
                  <article
                    key={msg.id}
                    className={`assistant-message ${isUser ? "is-user" : "is-assistant"}`}
                  >
                    <div className="assistant-message-avatar" aria-hidden="true">
                      {isUser ? (
                        <IconUser size={18} />
                      ) : (
                        <IconSparkles size={18} />
                      )}
                    </div>
                    <div className="assistant-message-body">
                      <header className="assistant-message-meta">
                        <strong>
                          {isUser
                            ? pl
                              ? "Ty"
                              : "You"
                            : pl
                              ? "Asystent Care My Pet"
                              : "Care My Pet Assistant"}
                        </strong>
                        <time dateTime={msg.created_at}>
                          {formatTime(msg.created_at)}
                        </time>
                      </header>

                      <div className="assistant-message-content">
                        {isUser ? (
                          <p>{msg.content}</p>
                        ) : (
                          <FormattedMedicalText text={msg.content} />
                        )}
                      </div>

                      {!isUser && msg.sources && msg.sources.length > 0 && (
                        <footer className="assistant-message-sources">
                          <span className="assistant-sources-label">
                            {pl
                              ? "Powiązane wpisy z kartoteki:"
                              : "Related record entries:"}
                          </span>
                          <div className="assistant-sources-list">
                            {msg.sources.map((src) => {
                              const href =
                                src.source_type === "medical_report"
                                  ? `/app/zwierzeta/${petId}?tab=results&report=${src.source_id}`
                                  : `/app/zwierzeta/${petId}?tab=history`;
                              return (
                                <Link
                                  key={`${src.source_type}-${src.source_id}`}
                                  href={href}
                                  className="assistant-source-chip"
                                >
                                  {src.source_type === "medical_report" ? (
                                    <IconFlask size={14} aria-hidden="true" />
                                  ) : (
                                    <IconHistory size={14} aria-hidden="true" />
                                  )}
                                  <span>{src.title}</span>
                                  <small>({src.event_date})</small>
                                </Link>
                              );
                            })}
                          </div>
                        </footer>
                      )}
                    </div>
                  </article>
                );
              })}

              {!sending &&
                lastAssistantMessage &&
                lastAssistantMessage.follow_ups &&
                lastAssistantMessage.follow_ups.length > 0 && (
                  <div className="assistant-followups">
                    <span className="assistant-followups-label">
                      <IconSparkles size={14} aria-hidden="true" />
                      {pl
                        ? "Podpowiedzi kolejnych pytań w tym wątku:"
                        : "Suggested follow-up questions:"}
                    </span>
                    <div className="assistant-followups-list">
                      {lastAssistantMessage.follow_ups.map((followUp) => (
                        <button
                          key={followUp}
                          type="button"
                          className="assistant-followup-chip"
                          disabled={sending || quotaReached}
                          onClick={() => void sendQuestion(followUp)}
                        >
                          <span>{followUp}</span>
                          <span aria-hidden="true">→</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

              {sending && (
                <div
                  className="assistant-message is-assistant is-thinking"
                  role="status"
                >
                  <div className="assistant-message-avatar" aria-hidden="true">
                    <IconSparkles size={18} />
                  </div>
                  <div className="assistant-message-body">
                    <header className="assistant-message-meta">
                      <strong>
                        {pl ? "Asystent Care My Pet" : "Care My Pet Assistant"}
                      </strong>
                    </header>
                    <p className="assistant-thinking-text">
                      {pl
                        ? `Przeszukuję kartotekę ${petName} i przygotowuję odpowiedź…`
                        : `Searching ${petName}'s record and preparing an answer…`}
                    </p>
                  </div>
                </div>
              )}

              <div ref={threadEndRef} />
            </div>
          )}

          {error && (
            <div className="assistant-error" role="alert">
              <IconAlertCircle size={18} aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <form
            className="assistant-composer"
            onSubmit={(e) => {
              e.preventDefault();
              void sendQuestion();
            }}
          >
            <label htmlFor={`assistant-input-${petId}`} className="sr-only">
              {pl
                ? `Zadaj pytanie o zdrowie ${petName}`
                : `Ask a question about ${petName}'s health`}
            </label>
            <textarea
              id={`assistant-input-${petId}`}
              ref={textareaRef}
              rows={2}
              value={input}
              disabled={sending || quotaReached}
              maxLength={MAX_MESSAGE_CHARS}
              onChange={(e) => {
                setInput(e.target.value);
                if (error) setError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void sendQuestion();
                }
              }}
              placeholder={
                quotaReached
                  ? pl
                    ? "Wykorzystano dzienny limit 20 wiadomości."
                    : "Daily limit of 20 messages reached."
                  : pl
                    ? `Zadaj pytanie o historię zdrowia, wyniki badań lub terminy ${petName}… (Enter wysyła, Shift+Enter nowa linia)`
                    : `Ask about ${petName}'s health history, lab results, or due dates… (Enter to send, Shift+Enter for new line)`
              }
            />
            <div className="assistant-composer-footer">
              <small
                className={`assistant-char-counter${charsLeft < 80 ? " is-near" : ""}${overCharLimit ? " is-over" : ""}`}
              >
                {input.length} / {MAX_MESSAGE_CHARS}{" "}
                {pl ? "znaków (twardy limit wejścia)" : "chars (input cap)"}
              </small>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={!trimmed || overCharLimit || sending || quotaReached}
              >
                <IconSend size={16} aria-hidden="true" />
                {sending
                  ? pl
                    ? "Wysyłanie…"
                    : "Sending…"
                  : pl
                    ? "Wyślij pytanie"
                    : "Send question"}
              </Button>
            </div>
          </form>
        </section>
      </div>
      )}
    </div>
  );
}

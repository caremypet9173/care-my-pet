"use client";
import "@/styles/medical-review.css";
import { measurementValueType, validMeasurementValue } from "../../../supabase/functions/medical-reports/value-type.mjs";
import { useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import { useLocale } from "next-intl";
import {
  IconFileText,
  IconPlus,
  IconArrowLeft,
  IconSparkles,
  IconAlertTriangle,
  IconClipboardText,
  IconBold,
  IconList,
  IconHeading,
  IconEye,
  IconRestore,
  IconSwitchHorizontal,
  IconBan,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Link, useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { trackAction } from "@/lib/telemetry";
import type { Pet } from "@/features/pets/types";
import { medicalMessages } from "./messages";
import type {
  AiQuotaStatus,
  HouseholdHashMatch,
  Measurement,
  RejectedDocumentInfo,
  ReportDraft,
  TrashedSamePetMatch,
} from "./types";
import { PdfPreview } from "./pdf-preview";
import { ReviewParameter } from "./review-parameter";
import { rangeStatus } from "./comparison";
import { FormattedMedicalText } from "./formatted-text";
import {
  findMatchingOtherPet,
  isPatientNameMismatch,
} from "./patient-name-match";

const blank = (): ReportDraft => ({
  title: "",
  test_date: "",
  laboratory: "",
  doctor: "",
  notes: "",
  ai_interpretation: "",
  rows: [],
});
const maxFile = 12 * 1024 * 1024;
const extensions: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
};

export function ReviewForm({
  pet,
  otherPets = [],
}: {
  pet: Pet;
  otherPets?: Array<{ id: string; imie: string }>;
}) {
  const locale = useLocale();
  const pl = locale === "pl";
  const t = medicalMessages[locale as "pl" | "en"] ?? medicalMessages.pl;
  const router = useRouter();

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [draft, setDraft] = useState<ReportDraft>(blank);
  const [reviewing, setReviewing] = useState(false);
  const [patient, setPatient] = useState("");
  const [busy, setBusy] = useState<"read" | "save" | "check" | "reuse" | null>(null);
  const [readAutomatically, setReadAutomatically] = useState(false);
  const [reusedFromCache, setReusedFromCache] = useState(false);
  const [humanLabWarning, setHumanLabWarning] = useState(false);
  const [quota, setQuota] = useState<AiQuotaStatus | null>(null);

  const [duplicate, setDuplicate] = useState<{
    id: string;
    title: string;
    test_date: string;
  } | null>(null);
  const [trashedMatch, setTrashedMatch] = useState<TrashedSamePetMatch | null>(null);
  const [householdMatch, setHouseholdMatch] = useState<HouseholdHashMatch | null>(null);
  const [rejectedDoc, setRejectedDoc] = useState<RejectedDocumentInfo | null>(null);
  const [pendingMatchedFile, setPendingMatchedFile] = useState<File | null>(null);

  const [submitted, setSubmitted] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const titleInvalid = !draft.title.trim();
  const dateInvalid =
    !/^\d{4}-\d{2}-\d{2}$/.test(draft.test_date) ||
    draft.test_date < "1900-01-01" ||
    draft.test_date > today ||
    Number.isNaN(Date.parse(draft.test_date)) ||
    new Date(draft.test_date).toISOString().slice(0, 10) !== draft.test_date;

  const [error, setError] = useState("");
  const [ai, setAi] = useState<boolean | null>(null);
  const [zoom, setZoom] = useState(100);
  const upload = useRef<{ id: string; path: string; uploaded: boolean } | null>(null);
  const saved = useRef(false);
  const validationSummary = useRef<HTMLDivElement>(null);
  const feedback = useRef<HTMLDivElement>(null);
  const duplicateNotice = useRef<HTMLElement>(null);
  const checkingNotice = useRef<HTMLParagraphElement>(null);
  const [candidate, setCandidate] = useState<File | null>(null);
  const [notesPreview, setNotesPreview] = useState(false);
  const [aiPreview, setAiPreview] = useState(true);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const choosing = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const notesInput = useRef<HTMLTextAreaElement>(null);

  function handleDragEnter(event: DragEvent<HTMLElement>) {
    if (busy || !event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    event.stopPropagation();
    dragDepth.current += 1;
    setDragging(true);
  }
  function handleDragOver(event: DragEvent<HTMLElement>) {
    if (busy || !event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";
  }
  function handleDragLeave(event: DragEvent<HTMLElement>) {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    event.stopPropagation();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  }
  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    dragDepth.current = 0;
    setDragging(false);
    if (busy) return;
    const dropped = event.dataTransfer.files?.[0];
    if (dropped) void choose(dropped);
  }

  function insertMarkdown(kind: "bold" | "heading" | "list") {
    const el = notesInput.current;
    if (!el) return;
    const start = el.selectionStart ?? draft.notes.length;
    const end = el.selectionEnd ?? draft.notes.length;
    const selected = draft.notes.slice(start, end);
    let replacement = "";
    let cursorOffset = 0;
    if (kind === "bold") {
      replacement = `**${selected || (pl ? "pogrubiony tekst" : "bold text")}**`;
      cursorOffset = selected ? replacement.length : 2;
    } else if (kind === "heading") {
      const prefix = start > 0 && draft.notes[start - 1] !== "\n" ? "\n### " : "### ";
      replacement = `${prefix}${selected || (pl ? "Nagłówek sekcji:" : "Section heading:")}`;
      cursorOffset = replacement.length;
    } else {
      const prefix = start > 0 && draft.notes[start - 1] !== "\n" ? "\n- " : "- ";
      replacement = `${prefix}${selected || (pl ? "punkt opisu" : "bullet item")}`;
      cursorOffset = replacement.length;
    }
    const nextValue = draft.notes.slice(0, start) + replacement + draft.notes.slice(end);
    update("notes", nextValue.slice(0, 12000));
    requestAnimationFrame(() => {
      el.focus();
      const pos = Math.min(start + cursorOffset, 12000);
      el.setSelectionRange(pos, pos);
    });
  }

  const back = `/app/pets/${pet.id}?tab=results`;

  useEffect(() => {
    const notice =
      duplicate || trashedMatch || householdMatch || rejectedDoc
        ? duplicateNotice.current
        : error && error !== t.validation
          ? feedback.current
          : busy === "check"
            ? checkingNotice.current
            : null;
    notice?.focus({ preventScroll: true });
    notice?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [duplicate, trashedMatch, householdMatch, rejectedDoc, error, busy, t.validation]);

  useEffect(() => {
    let active = true;
    createClient()
      .functions.invoke("medical-reports", {
        body: { action: "capabilities", pet_id: pet.id },
      })
      .then(({ data, error }) => {
        if (!active) return;
        setAi(!error && data?.extraction === true);
        if (!error && data?.quota && typeof data.quota.remaining === "number") {
          setQuota(data.quota as AiQuotaStatus);
        }
      });
    return () => {
      active = false;
    };
  }, [pet.id]);

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  useEffect(
    () => () => {
      if (!saved.current && upload.current?.uploaded) {
        void createClient()
          .storage.from("medical-documents")
          .remove([upload.current.path]);
      }
    },
    [],
  );
  useEffect(() => {
    if (!file) return;
    const guard = (event: BeforeUnloadEvent) => {
      if (!saved.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [file]);

  async function mountFreshFile(next: File) {
    if (upload.current?.uploaded) {
      await createClient().storage.from("medical-documents").remove([upload.current.path]);
    }
    upload.current = null;
    setFile(next);
    setPreview(URL.createObjectURL(next));
    setDraft(blank());
    setSubmitted(false);
    setPatient("");
    setReadAutomatically(false);
    setReusedFromCache(false);
    setHumanLabWarning(false);
    setReviewing(false);
    setNotesPreview(false);
    setAiPreview(true);
    setError("");
    setZoom(100);
    setCandidate(null);
    setPendingMatchedFile(null);
  }

  async function choose(next?: File) {
    if (!next || busy || choosing.current) return;
    if (file && !window.confirm(t.resetWarning)) return;
    choosing.current = true;
    setCandidate(next);
    setBusy("check");
    setDuplicate(null);
    setTrashedMatch(null);
    setHouseholdMatch(null);
    setRejectedDoc(null);
    setPendingMatchedFile(null);
    setError("");
    try {
      const bytes = new Uint8Array(await next.slice(0, 8).arrayBuffer());
      const valid =
        next.type === "application/pdf"
          ? new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-"
          : next.type === "image/jpeg"
            ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
            : next.type === "image/png" &&
              [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v);
      if (!extensions[next.type] || !next.size || next.size > maxFile || !valid) {
        setError(t.fileError);
        return;
      }
      const digest = await crypto.subtle.digest("SHA-256", await next.arrayBuffer());
      const sha256 = Array.from(new Uint8Array(digest), (b) =>
        b.toString(16).padStart(2, "0"),
      ).join("");
      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      const { data, error } = await Promise.race([
        createClient().functions.invoke("medical-reports", {
          body: { action: "check_duplicate", pet_id: pet.id, sha256 },
          signal: controller.signal,
        }),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(new Error("check_timeout"));
          }, 30000);
        }),
      ]).finally(() => clearTimeout(timer));
      if (error) throw error;
      if (data?.rejected) {
        setRejectedDoc(data.rejected as RejectedDocumentInfo);
        setCandidate(null);
        return;
      }
      if (data?.duplicate) {
        setDuplicate(data.duplicate);
        setCandidate(null);
        return;
      }
      if (data?.trashed_same_pet) {
        setTrashedMatch(data.trashed_same_pet as TrashedSamePetMatch);
        setPendingMatchedFile(next);
        setCandidate(null);
        return;
      }
      if (data?.household_match) {
        setHouseholdMatch(data.household_match as HouseholdHashMatch);
        setPendingMatchedFile(next);
        setCandidate(null);
        return;
      }
      await mountFreshFile(next);
    } catch {
      setError(
        pl
          ? "Nie udało się sprawdzić pliku. Nie został dodany. Spróbuj ponownie. To nie oznacza, że dokument jest duplikatem."
          : "Could not check the file. It has not been added. Please retry. This does not mean it is a duplicate.",
      );
    } finally {
      choosing.current = false;
      setBusy(null);
    }
  }

  async function restoreTrashedAndOpen(reportId: string) {
    if (busy) return;
    setBusy("reuse");
    setError("");
    try {
      const { error: fnErr } = await createClient().functions.invoke("medical-reports", {
        body: { action: "restore", pet_id: pet.id, report_id: reportId },
      });
      if (fnErr) throw fnErr;
      saved.current = true;
      trackAction("medical_report_restored", { source: "upload_dedup" });
      router.push(`${back}&report=${encodeURIComponent(reportId)}`);
      router.refresh();
    } catch {
      setError(
        pl
          ? "Nie udało się przywrócić badania z kosza. Spróbuj ponownie."
          : "Could not restore the report from trash. Please try again.",
      );
      setBusy(null);
    }
  }

  async function moveFromOtherPetAndOpen(match: HouseholdHashMatch) {
    if (busy) return;
    setBusy("reuse");
    setError("");
    try {
      const { error: fnErr } = await createClient().functions.invoke("medical-reports", {
        body: {
          action: "move",
          pet_id: match.pet_id,
          report_id: match.id,
          target_pet_id: pet.id,
        },
      });
      if (fnErr) throw fnErr;
      saved.current = true;
      trackAction("medical_report_moved", {
        source: "upload_dedup",
        from_trash: match.status === "trashed",
      });
      router.push(`${back}&report=${encodeURIComponent(match.id)}`);
      router.refresh();
    } catch {
      setError(
        pl
          ? "Nie udało się przenieść badania do tego pupila. Spróbuj ponownie."
          : "Could not move the report to this pet. Please try again.",
      );
      setBusy(null);
    }
  }

  async function loadReusableDraft(sourceReportId: string) {
    if (busy || !pendingMatchedFile) return;
    const matchedFile = pendingMatchedFile;
    setBusy("reuse");
    setError("");
    try {
      const { data, error: fnErr } = await createClient().functions.invoke(
        "medical-reports",
        {
          body: {
            action: "reuse_extracted",
            pet_id: pet.id,
            source_report_id: sourceReportId,
          },
        },
      );
      if (fnErr || !data?.report) throw fnErr ?? new Error("reuse_failed");
      await mountFreshFile(matchedFile);
      setTrashedMatch(null);
      setHouseholdMatch(null);
      setDraft({
        ...data.report,
        ai_interpretation: data.report.ai_interpretation ?? "",
        rows: (data.report.rows ?? []).map((row: Measurement) => ({
          ...row,
          value_type: measurementValueType(row),
        })),
      });
      setReadAutomatically(true);
      setReusedFromCache(true);
      setHumanLabWarning(false);
      setNotesPreview(Boolean(data.report.notes?.trim()));
      setAiPreview(true);
      setReviewing(true);
      if (data.quota && typeof data.quota.remaining === "number") {
        setQuota(data.quota as AiQuotaStatus);
      }
      trackAction("medical_report_ai_reused", { source: "upload_banner" });
    } catch {
      setError(
        pl
          ? "Nie udało się wczytać zapisanego odczytu. Możesz wybrać plik ponownie."
          : "Could not load the previously extracted data. Please retry.",
      );
    } finally {
      setBusy(null);
    }
  }

  function update(field: keyof Omit<ReportDraft, "rows">, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }
  function updateRow(index: number, field: keyof Measurement, value: string) {
    setDraft((current) => ({
      ...current,
      rows: current.rows.map((row, i) =>
        i === index ? { ...row, [field]: value } : row,
      ),
    }));
  }

  async function extract() {
    if (!file || busy || duplicate) return;
    if (reviewing && !window.confirm(t.resetWarning)) return;
    setBusy("read");
    setError("");
    setRejectedDoc(null);
    setSubmitted(false);
    try {
      const client = createClient();
      const {
        data: { user },
      } = await client.auth.getUser();
      if (!user) throw new Error("unauthorized");
      if (!upload.current) {
        const id = crypto.randomUUID();
        upload.current = {
          id,
          path: `${pet.gospodarstwo_id}/${user.id}/${id}.${extensions[file.type]}`,
          uploaded: false,
        };
      }
      if (!upload.current.uploaded) {
        const { error: upErr } = await client.storage
          .from("medical-documents")
          .upload(upload.current.path, file, {
            contentType: file.type,
            upsert: false,
            cacheControl: "0",
          });
        if (upErr && String((upErr as { statusCode?: string }).statusCode) !== "409")
          throw upErr;
        upload.current.uploaded = true;
      }
      const { data, error } = await client.functions.invoke("medical-reports", {
        body: {
          action: "extract",
          pet_id: pet.id,
          mime: file.type,
          storage_path: upload.current.path,
        },
      });
      if (error) {
        const details = await error.context?.json?.().catch(() => null);
        if (details?.quota && typeof details.quota.remaining === "number") {
          setQuota(details.quota as AiQuotaStatus);
        }
        if (details?.duplicate) {
          setDuplicate(details.duplicate);
          return;
        }
        if (details?.error === "invalid_document_type") {
          // Backend already deleted temporary file from Storage.
          upload.current = null;
          setFile(null);
          setPreview("");
          setReviewing(false);
          const docType =
            details.document_type === "unreadable" ? "unreadable" : "non_medical";
          setRejectedDoc({
            document_type: docType,
            reason: typeof details.reason === "string" ? details.reason : "",
          });
          trackAction("medical_report_ai_rejected", {
            document_type: docType,
            cached: Boolean(details.cached),
          });
          return;
        }
        throw new Error(details?.error ?? "extraction_failed");
      }
      if (data?.quota && typeof data.quota.remaining === "number") {
        setQuota(data.quota as AiQuotaStatus);
      }
      setDraft({
        ...data.report,
        ai_interpretation: data.report.ai_interpretation ?? "",
        rows: data.report.rows.map((row: Measurement) => ({
          ...row,
          value_type: measurementValueType(row),
        })),
      });
      setPatient(data.patient_name ?? "");
      setReadAutomatically(true);
      setReusedFromCache(Boolean(data.reused_from_cache));
      setHumanLabWarning(data.document_type === "human_lab_report");
      setNotesPreview(Boolean(data.report.notes?.trim()));
      setAiPreview(true);
      setReviewing(true);
      if (data.reused_from_cache) {
        trackAction("medical_report_ai_reused", { source: "extract_auto" });
      }
    } catch (error) {
      setError(
        error instanceof Error && error.message === "daily_limit"
          ? t.limit
          : error instanceof Error && error.message === "ai_billing"
            ? t.aiBilling
            : error instanceof Error && error.message === "page_limit_exceeded"
              ? t.pageLimit
              : t.aiError,
      );
    } finally {
      setBusy(null);
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!file || busy || duplicate) return;
    setSubmitted(true);
    if (issues.length) {
      setError(t.validation);
      requestAnimationFrame(() => {
        validationSummary.current?.focus({ preventScroll: true });
        validationSummary.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      });
      return;
    }
    setBusy("save");
    setError("");
    try {
      const client = createClient();
      const {
        data: { user },
      } = await client.auth.getUser();
      if (!user) throw new Error();
      if (!upload.current) {
        const id = crypto.randomUUID();
        upload.current = {
          id,
          path: `${pet.gospodarstwo_id}/${user.id}/${id}.${extensions[file.type]}`,
          uploaded: false,
        };
      }
      if (!upload.current.uploaded) {
        const { error } = await client.storage
          .from("medical-documents")
          .upload(upload.current.path, file, {
            contentType: file.type,
            upsert: false,
            cacheControl: "0",
          });
        if (error && String((error as { statusCode?: string }).statusCode) !== "409")
          throw error;
        upload.current.uploaded = true;
      }
      const { data, error } = await client.functions.invoke("medical-reports", {
        body: {
          action: "confirm",
          id: upload.current.id,
          pet_id: pet.id,
          source_name: file.name.slice(0, 180),
          source_mime: file.type,
          report: draft,
          confirmed: true,
        },
      });
      if (error || !data?.id) {
        const details = await error?.context?.json?.().catch(() => null);
        if (details?.duplicate) {
          setDuplicate(details.duplicate);
          setBusy(null);
          return;
        }
        throw new Error(details?.error ?? "save_failed");
      }
      saved.current = true;
      router.push(`${back}&report=${encodeURIComponent(data.id)}`);
      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error && error.message === "already_confirmed"
          ? t.alreadyConfirmed
          : t.saveError,
      );
      setBusy(null);
    }
  }

  const outside = draft.rows.filter((row) =>
    ["above", "below"].includes(rangeStatus(row)),
  );
  const nameMismatch = patient ? isPatientNameMismatch(patient, pet.imie) : false;
  const matchedOtherPet = nameMismatch
    ? findMatchingOtherPet(patient, otherPets)
    : null;

  const issues: { target: string; text: string }[] = [];
  if (dateInvalid)
    issues.push({
      target: "review-test_date",
      text: pl
        ? "Podaj datę badania (nie późniejszą niż dzisiaj)."
        : "Enter the test date (no later than today).",
    });
  if (titleInvalid)
    issues.push({
      target: "review-title",
      text: pl ? "Uzupełnij nazwę badania." : "Enter the report title.",
    });
  draft.rows.forEach((row, index) => {
    const label = `${index + 1}. ${row.name.trim() || (pl ? "Parametr bez nazwy" : "Unnamed parameter")}`;
    if (!row.name.trim())
      issues.push({
        target: `review-row-${index}-name`,
        text: pl ? `${label}: wpisz nazwę parametru.` : `${label}: enter the parameter name.`,
      });
    if (!validMeasurementValue(row.value, measurementValueType(row)))
      issues.push({
        target: `review-row-${index}-value`,
        text: pl ? `${label}: uzupełnij poprawny wynik.` : `${label}: enter a valid result.`,
      });
  });

  function goToIssue(id: string) {
    const control = document.getElementById(id);
    control?.focus({ preventScroll: true });
    control?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <div className="medical-review">
      <header className="medical-process-header">
        <Link
          href={back}
          onClick={(event) => {
            if (busy || (file && !window.confirm(t.cancelWarning)))
              event.preventDefault();
          }}
        >
          <IconArrowLeft size={18} />
          {t.back}
        </Link>
        <div>
          <strong>{pet.imie}</strong>
          <span>{t.review}</span>
        </div>
        <span className="household-tag">{t.step}</span>
      </header>
      <h1 className="sr-only">{t.review}</h1>
      <input
        ref={fileInput}
        className="sr-only"
        tabIndex={-1}
        type="file"
        accept="application/pdf,image/jpeg,image/png"
        aria-label={t.choose}
        disabled={!!busy}
        onChange={(event) => {
          void choose(event.target.files?.[0]);
          event.target.value = "";
        }}
      />

      {error && error !== t.validation && (
        <div ref={feedback} tabIndex={-1} role="alert" className="medical-error">
          <p>{error}</p>
          {candidate && (
            <Button
              variant="secondary"
              disabled={!!busy}
              onClick={() => void choose(candidate ?? undefined)}
            >
              {pl ? "Spróbuj ponownie" : "Try again"}
            </Button>
          )}
        </div>
      )}

      {busy === "check" && (
        <p ref={checkingNotice} tabIndex={-1} className="review-save-note" role="status">
          {pl
            ? "Sprawdzanie, czy dokument jest już w kartotece…"
            : "Checking for an existing document…"}
        </p>
      )}

      {rejectedDoc && (
        <section
          ref={duplicateNotice}
          tabIndex={-1}
          className="review-rejected"
          role="alert"
        >
          <IconBan size={24} aria-hidden="true" />
          <div>
            <h2>
              {rejectedDoc.document_type === "unreadable"
                ? pl
                  ? "Dokument jest nieczytelny"
                  : "Document is unreadable"
                : pl
                  ? "Ten plik nie wygląda na dokument medyczny"
                  : "This file does not appear to be a medical report"}
            </h2>
            <p>
              {rejectedDoc.reason ||
                (pl
                  ? "Przesyłaj wyłącznie wyniki badań laboratoryjnych, badania obrazowe (USG, RTG, TK, ECHO) lub wypisy weterynaryjne."
                  : "Please upload only laboratory results, imaging studies, or veterinary clinic records.")}
            </p>
            <div className="review-duplicate-actions">
              <Button
                size="sm"
                variant="secondary"
                disabled={!!busy}
                onClick={() => fileInput.current?.click()}
              >
                {pl ? "Wybierz właściwy dokument" : "Choose a valid document"}
              </Button>
            </div>
          </div>
        </section>
      )}

      {duplicate && (
        <section
          ref={duplicateNotice}
          tabIndex={-1}
          className="review-duplicate"
          role="alert"
        >
          <IconFileText size={24} aria-hidden="true" />
          <div>
            <h2>
              {pl
                ? "Ten dokument jest już w kartotece"
                : "This document is already in the record"}
            </h2>
            <p>
              {duplicate.title} · {duplicate.test_date}
            </p>
            <p>
              {pl
                ? "Nie ma potrzeby ponownego odczytu ani dodawania tego samego pliku."
                : "There is no need to read or add the same file again."}
            </p>
            <div className="review-duplicate-actions">
              <Link
                href={`${back}&report=${duplicate.id}`}
                onClick={() => {
                  saved.current = true;
                }}
              >
                {pl ? "Otwórz istniejące badanie" : "Open existing report"}
              </Link>
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                disabled={!!busy}
              >
                {t.changeFile}
              </button>
            </div>
          </div>
        </section>
      )}

      {trashedMatch && (
        <section
          ref={duplicateNotice}
          tabIndex={-1}
          className="review-duplicate"
          role="alert"
        >
          <IconRestore size={24} aria-hidden="true" />
          <div>
            <h2>
              {pl
                ? "To badanie znajduje się w koszu tego pupila"
                : "This report is in this pet's trash"}
            </h2>
            <p>
              {trashedMatch.title} · {trashedMatch.test_date}
            </p>
            <p>
              {pl
                ? "Możesz je przywrócić jednym kliknięciem — bez ponownego zużycia odczytu AI."
                : "You can restore it in one click without using AI quota again."}
            </p>
            <div className="review-duplicate-actions">
              <Button
                size="sm"
                loading={busy === "reuse"}
                disabled={!!busy}
                onClick={() => void restoreTrashedAndOpen(trashedMatch.id)}
              >
                <IconRestore size={15} aria-hidden="true" />
                {pl ? "Przywróć z kosza (0 tokenów AI)" : "Restore from trash (0 AI tokens)"}
              </Button>
              {pendingMatchedFile && (
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => void loadReusableDraft(trashedMatch.id)}
                >
                  {pl
                    ? "Wczytaj dane do edycji (bez AI)"
                    : "Load extracted data for editing (no AI)"}
                </button>
              )}
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                disabled={!!busy}
              >
                {t.changeFile}
              </button>
            </div>
          </div>
        </section>
      )}

      {householdMatch && (
        <section
          ref={duplicateNotice}
          tabIndex={-1}
          className="review-duplicate"
          role="alert"
        >
          <IconSwitchHorizontal size={24} aria-hidden="true" />
          <div>
            <h2>
              {householdMatch.status === "trashed"
                ? pl
                  ? `Ten plik był niedawno w koszu pupila ${householdMatch.pet_name}`
                  : `This file was recently trashed under ${householdMatch.pet_name}`
                : pl
                  ? `Ten dokument jest już zapisany u pupila ${householdMatch.pet_name}`
                  : `This document is already saved under ${householdMatch.pet_name}`}
            </h2>
            <p>
              {householdMatch.title} · {householdMatch.test_date}
            </p>
            <p>
              {pl
                ? "Mamy już gotowy odczyt tego pliku w Twoim gospodarstwie — możesz przenieść badanie tutaj albo wczytać gotowe dane bez zużywania limitu AI."
                : "We already have the extracted data in your household — move the report here or reuse the extracted fields without using AI quota."}
            </p>
            <div className="review-duplicate-actions">
              {!householdMatch.pet_archived && (
                <Button
                  size="sm"
                  loading={busy === "reuse"}
                  disabled={!!busy}
                  onClick={() => void moveFromOtherPetAndOpen(householdMatch)}
                >
                  <IconSwitchHorizontal size={15} aria-hidden="true" />
                  {pl
                    ? `Przenieś do ${pet.imie} (0 tokenów AI)`
                    : `Move to ${pet.imie} (0 AI tokens)`}
                </Button>
              )}
              {pendingMatchedFile && (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!!busy}
                  onClick={() => void loadReusableDraft(householdMatch.id)}
                >
                  {pl
                    ? "Wczytaj gotowy odczyt (bez AI)"
                    : "Reuse extracted data (no AI)"}
                </Button>
              )}
              {householdMatch.status === "active" && (
                <Link
                  href={`/app/pets/${householdMatch.pet_id}?tab=results&report=${householdMatch.id}`}
                  onClick={() => {
                    saved.current = true;
                  }}
                >
                  {pl
                    ? `Otwórz u ${householdMatch.pet_name}`
                    : `Open under ${householdMatch.pet_name}`}
                </Link>
              )}
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                disabled={!!busy}
              >
                {t.changeFile}
              </button>
            </div>
          </div>
        </section>
      )}

      {!file ? (
        <section
          className={`medical-upload${dragging ? " is-dragging" : ""}`}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <IconFileText size={40} aria-hidden="true" />
          <h2>{t.add}</h2>
          <p>{t.fileHint}</p>
          <p className="medical-drop-hint">
            {pl
              ? "Przeciągnij i upuść plik PDF, JPG lub PNG tutaj albo wybierz go z dysku."
              : "Drag and drop a PDF, JPG or PNG file here or choose it from your device."}
          </p>
          {quota && (
            <p className="review-quota-pill">
              <IconSparkles size={14} aria-hidden="true" />
              <span>
                {pl
                  ? `Pozostało ${quota.remaining} z ${quota.limit} odczytów AI dzisiaj · Przesyłaj wyłącznie dokumenty weterynaryjne`
                  : `${quota.remaining} of ${quota.limit} AI readings remaining today · Upload veterinary medical records only`}
              </span>
            </p>
          )}
          <Button
            onClick={() => fileInput.current?.click()}
            disabled={!!busy}
            loading={busy === "check"}
          >
            {busy === "check"
              ? pl
                ? "Sprawdzanie pliku…"
                : "Checking file…"
              : t.choose}
          </Button>
        </section>
      ) : (
        <div className="medical-split">
          <section
            className={`medical-original${dragging ? " is-dragging" : ""}`}
            aria-label={t.original}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <header>
              <strong>{file.name}</strong>
              <a href={preview || undefined} target="_blank" rel="noopener noreferrer">
                {t.open}
              </a>
            </header>
            {file.type === "application/pdf" ? (
              preview && <PdfPreview key={preview} url={preview} />
            ) : (
              <>
                <label className="medical-zoom">
                  {t.zoom}
                  <input
                    type="range"
                    min={50}
                    max={200}
                    value={zoom}
                    onChange={(event) => setZoom(Number(event.target.value))}
                  />
                </label>
                <div
                  className="medical-image-scroll"
                  tabIndex={0}
                  role="region"
                  aria-label={t.zoom}
                >
                  {/* Private local blob, never passed to an image optimization service. */}
                  {preview && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={preview}
                      alt={t.original}
                      style={{ width: `${zoom}%`, maxWidth: "none" }}
                    />
                  )}
                </div>
              </>
            )}
            <Button
              variant="ghost"
              onClick={() => fileInput.current?.click()}
              disabled={!!busy}
            >
              {t.changeFile}
            </Button>
          </section>
          <div className="medical-edit">
            {!reviewing ? (
              <section className="medical-reading">
                <p>{t.aiHint}</p>
                {quota && (
                  <p className="review-quota-pill">
                    <IconSparkles size={14} aria-hidden="true" />
                    <span>
                      {pl
                        ? `Pozostało ${quota.remaining} z ${quota.limit} odczytów AI dzisiaj`
                        : `${quota.remaining} of ${quota.limit} AI readings remaining today`}
                    </span>
                  </p>
                )}
                <div>
                  <Button
                    onClick={extract}
                    disabled={
                      ai !== true ||
                      !!busy ||
                      !!duplicate ||
                      (quota !== null && quota.remaining <= 0)
                    }
                    loading={busy === "read"}
                  >
                    <IconSparkles size={18} />
                    {busy === "read" ? t.reading : t.extract}
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={!!busy || !!duplicate}
                    onClick={() => setReviewing(true)}
                  >
                    {t.manual}
                  </Button>
                </div>
                {ai === false && <p>{t.aiMissing}</p>}
                {quota !== null && quota.remaining <= 0 && <p>{t.limit}</p>}
                {busy === "read" && <p role="status">{t.reading}</p>}
              </section>
            ) : null}
            {reviewing && (
              <form
                ref={form}
                noValidate
                onSubmit={save}
                className="medical-review-form"
              >
                <fieldset disabled={!!busy || !!duplicate}>
                  {humanLabWarning && (
                    <aside className="review-attention" role="status">
                      <IconAlertTriangle size={22} aria-hidden="true" />
                      <div>
                        <strong>
                          {pl
                            ? "Dokument wygląda na wynik z laboratorium ludzkiego lub bez oznaczeń weterynaryjnych."
                            : "This document looks like a human lab report or lacks veterinary markers."}
                        </strong>
                        <p>
                          {pl
                            ? `Upewnij się przed zapisaniem, że to faktycznie badanie pupila ${pet.imie} (np. zlecone w zewnętrznym laboratorium).`
                            : `Please confirm before saving that this report truly belongs to ${pet.imie}.`}
                        </p>
                      </div>
                    </aside>
                  )}

                  {nameMismatch && (
                    <aside className="review-attention" role="alert">
                      <IconAlertTriangle size={22} aria-hidden="true" />
                      <div>
                        <strong>
                          {pl
                            ? `Uwaga: imię z dokumentu („${patient}”) różni się od wybranego pupila („${pet.imie}”).`
                            : `Notice: patient name on document ("${patient}") differs from selected pet ("${pet.imie}").`}
                        </strong>
                        <p>
                          {matchedOtherPet
                            ? pl
                              ? `To imię pasuje do innego pupila w Twoim gospodarstwie: ${matchedOtherPet.imie}. Sprawdź, czy na pewno zapisujesz wynik do właściwej kartoteki.`
                              : `This matches another pet in your household: ${matchedOtherPet.imie}. Make sure you are saving to the right pet.`
                            : pl
                              ? "Sprawdź przed zapisaniem, czy dodałeś dokument do właściwego pupila. W razie pomyłki możesz też przenieść badanie po zapisaniu."
                              : "Double-check that you selected the right pet before saving. You can also move the report afterward."}
                        </p>
                      </div>
                    </aside>
                  )}

                  {outside.length > 0 && (
                    <aside className="review-attention">
                      <IconAlertTriangle size={23} aria-hidden="true" />
                      <div>
                        <strong>
                          {pl
                            ? `Wskaźniki poza zakresem z dokumentu: ${outside.length}.`
                            : `${outside.length} parameters outside the document range.`}
                        </strong>
                        <p>
                          {pl
                            ? "Możesz przejrzeć i skorygować dowolne pole lub zapisać badanie w obecnej postaci."
                            : "You can review and correct any field or save the report as is."}
                        </p>
                      </div>
                      <span>{pl ? "Wymaga uwagi" : "Needs review"}</span>
                    </aside>
                  )}

                  <section className="medical-metadata">
                    <header className="review-section-heading">
                      <h2>
                        <IconClipboardText size={17} />
                        {t.metadata}
                      </h2>
                      <span className="review-source-badge">
                        {reusedFromCache
                          ? pl
                            ? "Wczytane z wcześniejszego odczytu (0 tokenów AI)"
                            : "Reused from previous reading (0 AI tokens)"
                          : readAutomatically
                            ? pl
                              ? "Odczytane automatycznie"
                              : "Automatically extracted"
                            : pl
                              ? "Wpisywane ręcznie"
                              : "Manual entry"}
                      </span>
                    </header>
                    <div className="medical-fields">
                      {(
                        [
                          ["test_date", t.date, 10],
                          ["laboratory", t.lab, 160],
                          ["doctor", t.doctor, 160],
                          ["title", t.title, 160],
                        ] as const
                      ).map(([key, label, max]) => (
                        <label key={key}>
                          {label}
                          {(key === "title" || key === "test_date") && " *"}
                          <input
                            id={`review-${key}`}
                            type={key === "test_date" ? "date" : "text"}
                            value={draft[key]}
                            aria-invalid={
                              submitted &&
                              (key === "title"
                                ? titleInvalid
                                : key === "test_date"
                                  ? dateInvalid
                                  : false)
                            }
                            aria-describedby={
                              submitted &&
                              (key === "title"
                                ? titleInvalid
                                : key === "test_date"
                                  ? dateInvalid
                                  : false)
                                ? `review-error-${key}`
                                : undefined
                            }
                            required={key === "title" || key === "test_date"}
                            maxLength={max}
                            min={key === "test_date" ? "1900-01-01" : undefined}
                            max={
                              key === "test_date"
                                ? new Date().toISOString().slice(0, 10)
                                : undefined
                            }
                            onChange={(event) => update(key, event.target.value)}
                          />
                          {submitted &&
                            ((key === "title" && titleInvalid) ||
                              (key === "test_date" && dateInvalid)) && (
                              <span
                                className="review-field-error"
                                id={`review-error-${key}`}
                              >
                                {key === "title"
                                  ? pl
                                    ? "Uzupełnij nazwę badania."
                                    : "Enter the report title."
                                  : pl
                                    ? "Podaj poprawną datę, nie późniejszą niż dzisiaj."
                                    : "Enter a valid date, no later than today."}
                              </span>
                            )}
                        </label>
                      ))}
                    </div>
                    <p className="review-patient-line">
                      {t.patientHint} <strong>{pet.imie}</strong>
                      {patient && (
                        <>
                          {" "}
                          · {t.patient}: <strong>{patient}</strong>
                        </>
                      )}
                    </p>
                  </section>

                  {Boolean(draft.ai_interpretation?.trim()) && (
                    <section
                      className="review-ai-section"
                      aria-label={pl ? "Wstępna analiza AI" : "Preliminary AI analysis"}
                    >
                      <header className="review-ai-header">
                        <div className="review-ai-title">
                          <IconSparkles
                            size={18}
                            className="medical-ai-sparkle-icon"
                            aria-hidden="true"
                          />
                          <div>
                            <h3>
                              {pl
                                ? "Wstępna analiza AI badania"
                                : "Preliminary AI report analysis"}
                            </h3>
                            <p>
                              {pl
                                ? "Wygenerowana automatycznie podczas odczytu badania"
                                : "Generated automatically during document extraction"}
                            </p>
                          </div>
                        </div>
                        <div className="review-ai-actions">
                          <button
                            type="button"
                            className={`review-md-btn is-preview${aiPreview ? " is-active" : ""}`}
                            aria-pressed={aiPreview}
                            onClick={() => setAiPreview((v) => !v)}
                          >
                            <IconEye size={15} aria-hidden="true" />
                            {aiPreview
                              ? pl
                                ? "Edytuj tekst"
                                : "Edit text"
                              : pl
                                ? "Podgląd formatowania"
                                : "Preview formatting"}
                          </button>
                        </div>
                      </header>
                      {aiPreview ? (
                        <div className="review-ai-preview-box">
                          <FormattedMedicalText text={draft.ai_interpretation || ""} />
                        </div>
                      ) : (
                        <label>
                          <span className="sr-only">
                            {pl ? "Treść analizy AI" : "AI analysis content"}
                          </span>
                          <textarea
                            maxLength={12000}
                            rows={7}
                            value={draft.ai_interpretation || ""}
                            onChange={(event) =>
                              update("ai_interpretation", event.target.value)
                            }
                          />
                        </label>
                      )}
                      <small className="review-md-hint">
                        {pl
                          ? "Wstępna analiza AI ma charakter pomocniczy i zostanie trwale zapisana wraz z badaniem."
                          : "Preliminary AI analysis is advisory and will be permanently saved with the report."}
                      </small>
                    </section>
                  )}

                  <section className="medical-parameters">
                    <header className="review-section-heading">
                      <div>
                        <h2>
                          {pl ? "Wyodrębnione parametry laboratoryjne" : t.parameters}{" "}
                          <small>({draft.rows.length})</small>
                        </h2>
                        <span className="review-species">
                          {pet.gatunek === "cat" ? "Felis catus" : "Canis familiaris"}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        disabled={draft.rows.length >= 100}
                        onClick={() => {
                          setDraft((current) => ({
                            ...current,
                            rows: [
                              ...current.rows,
                              {
                                name: "",
                                value: "",
                                unit: "",
                                reference: "",
                                category: "other",
                              },
                            ],
                          }));
                        }}
                      >
                        <IconPlus size={16} />
                        {t.addRow}
                      </Button>
                    </header>
                    {draft.rows.length === 0 && (
                      <p className="review-descriptive-empty">
                        {pl
                          ? "Badanie opisowe / obrazowe (np. USG, TK, RTG, ECHO) — brak parametrów tabelarycznych. Sprawdź i edytuj treść opisu poniżej lub dodaj parametr ręcznie."
                          : "Descriptive / imaging report (e.g. ultrasound, CT, X-ray) — no tabular parameters. Review the description below or add a parameter manually."}
                      </p>
                    )}
                    {draft.rows.map((row, index) => (
                      <ReviewParameter
                        key={index}
                        row={row}
                        index={index}
                        submitted={submitted}
                        onChange={(field, value) => updateRow(index, field, value)}
                        onRemove={() => {
                          setDraft((current) => ({
                            ...current,
                            rows: current.rows.filter((_, i) => i !== index),
                          }));
                        }}
                      />
                    ))}
                  </section>

                  <details
                    className={`review-source-notes${draft.rows.length === 0 ? " is-descriptive" : ""}`}
                    open={draft.notes || draft.rows.length === 0 ? true : undefined}
                  >
                    <summary>
                      <IconClipboardText size={18} />
                      {draft.rows.length === 0
                        ? pl
                          ? "Opis badania obrazowego / wnioski z dokumentu"
                          : "Imaging / descriptive findings and conclusions"
                        : t.notes}
                    </summary>
                    <div
                      className="review-notes-toolbar"
                      role="toolbar"
                      aria-label={pl ? "Formatowanie opisu" : "Description formatting"}
                    >
                      <button
                        type="button"
                        className="review-md-btn"
                        onClick={() => insertMarkdown("heading")}
                        disabled={notesPreview}
                        title={pl ? "Nagłówek sekcji (###)" : "Section heading (###)"}
                      >
                        <IconHeading size={15} aria-hidden="true" />
                        {pl ? "Nagłówek" : "Heading"}
                      </button>
                      <button
                        type="button"
                        className="review-md-btn"
                        onClick={() => insertMarkdown("bold")}
                        disabled={notesPreview}
                        title={pl ? "Pogrubienie (**tekst**)" : "Bold (**text**)"}
                      >
                        <IconBold size={15} aria-hidden="true" />
                        {pl ? "Pogrubienie" : "Bold"}
                      </button>
                      <button
                        type="button"
                        className="review-md-btn"
                        onClick={() => insertMarkdown("list")}
                        disabled={notesPreview}
                        title={pl ? "Lista punktowana (- )" : "Bullet list (- )"}
                      >
                        <IconList size={15} aria-hidden="true" />
                        {pl ? "Lista" : "List"}
                      </button>
                      <button
                        type="button"
                        className={`review-md-btn is-preview${notesPreview ? " is-active" : ""}`}
                        aria-pressed={notesPreview}
                        onClick={() => setNotesPreview((v) => !v)}
                      >
                        <IconEye size={15} aria-hidden="true" />
                        {notesPreview
                          ? pl
                            ? "Edytuj tekst"
                            : "Edit text"
                          : pl
                            ? "Podgląd formatowania"
                            : "Preview formatting"}
                      </button>
                    </div>
                    {notesPreview ? (
                      <div className="review-notes-preview-box">
                        {draft.notes.trim() ? (
                          <FormattedMedicalText text={draft.notes} />
                        ) : (
                          <p>
                            {pl
                              ? "Brak wpisanego opisu badania."
                              : "No description entered."}
                          </p>
                        )}
                      </div>
                    ) : (
                      <label>
                        <span className="sr-only">{t.notes}</span>
                        <textarea
                          ref={notesInput}
                          maxLength={12000}
                          rows={draft.rows.length === 0 ? 14 : 4}
                          value={draft.notes}
                          onChange={(event) => update("notes", event.target.value)}
                        />
                      </label>
                    )}
                    <small className="review-md-hint">
                      {pl
                        ? "Obsługiwane formatowanie: ### Nagłówek sekcji, **pogrubienie**, *kursywa* oraz listy punktowane (- lub •)."
                        : "Supported formatting: ### Section heading, **bold**, *italic*, and bullet lists (- or •)."}
                    </small>
                  </details>

                  <p className="review-save-note">
                    <IconFileText size={18} />
                    {t.notSaved}
                  </p>

                  {submitted && issues.length > 0 && (
                    <div
                      ref={validationSummary}
                      className="review-validation-summary"
                      role="alert"
                      tabIndex={-1}
                      aria-labelledby="review-validation-title"
                    >
                      <h2 id="review-validation-title">
                        {pl
                          ? "Badanie nie zostało zapisane. Uzupełnij wymagane pola:"
                          : "The report has not been saved. Complete the required fields:"}
                      </h2>
                      <p>
                        {pl
                          ? "Kliknij pozycję, aby przejść do miejsca wymagającego uwagi. Lista skraca się po poprawieniu danych."
                          : "Select an item to go to it. Resolved items disappear from this list."}
                      </p>
                      <ul>
                        {issues.map((issue) => (
                          <li key={issue.target}>
                            <button
                              type="button"
                              onClick={() => goToIssue(issue.target)}
                            >
                              {issue.text}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <footer className="medical-confirm-bar">
                    <Button
                      variant="ghost"
                      onClick={extract}
                      disabled={
                        ai !== true ||
                        !!busy ||
                        !!duplicate ||
                        (quota !== null && quota.remaining <= 0)
                      }
                      loading={busy === "read"}
                    >
                      <IconSparkles size={16} />
                      {t.extract}
                    </Button>
                    <Button type="submit" loading={busy === "save"}>
                      {t.save} →
                    </Button>
                  </footer>
                </fieldset>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

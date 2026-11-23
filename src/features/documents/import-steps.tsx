import { useTranslations } from "next-intl";
import {
  IconCheck,
  IconChecks,
  IconDeviceMobile,
  IconFileUpload,
  IconFolderHeart,
  IconAdjustments,
} from "@tabler/icons-react";
import { Card } from "@/components/ui/card";

export function ImportSteps() {
  const t = useTranslations("copy");
  return (
    <ol className="steps-grid">
      <li>
        <Card className="step-card">
          <div className="step-top">
            <span className="step-number">1</span>
            <span className="eyebrow">{t("step1")}</span>
          </div>
          <h3>{t("addADocument")}</h3>
          <p>{t("uploadAPdfFromTheClinicOr")}</p>
          <div className="step-illustration upload-illustration">
            <span className="icon-tile">
              <IconFileUpload size={28} aria-hidden="true" />
            </span>
            <strong>{t("visitNotes09Pdf")}</strong>
            <span className="caption">{t("sampleDocumentToAdd")}</span>
          </div>
          <p className="step-hint">
            <IconCheck size={17} aria-hidden="true" />
            {t("supportsPhotosAndPdfFiles")}
          </p>
        </Card>
      </li>
      <li>
        <Card className="step-card">
          <div className="step-top">
            <span className="step-number">2</span>
            <span className="eyebrow">{t("step2")}</span>
          </div>
          <h3>{t("checkTheExtractedData")}</h3>
          <p>{t("compareTheExtractedParametersDirectlyWithThe")}</p>
          <div className="step-illustration">
            <div className="readout-grid">
              <div>
                <span>{t("original")}</span>
                <strong>{t("glucose98MgDl")}</strong>
              </div>
              <div className="readout-proposal">
                <span>{t("aiExtraction")}</span>
                <strong>98 mg/dl</strong>
              </div>
            </div>
            <div className="illustrated-button">
              <IconChecks size={16} aria-hidden="true" />
              {t("approveAndSave")}
            </div>
          </div>
          <p className="step-hint">
            <IconAdjustments size={17} aria-hidden="true" />
            {t("fullControlOverEveryEntry")}
          </p>
        </Card>
      </li>
      <li>
        <Card className="step-card">
          <div className="step-top">
            <span className="step-number">3</span>
            <span className="eyebrow">{t("step3")}</span>
          </div>
          <h3>{t("readyInYourPetsRecord")}</h3>
          <p>{t("theDataBecomesPartOfYourPets")}</p>
          <div className="step-illustration saved-illustration">
            <span className="icon-tile">
              <IconFolderHeart size={24} aria-hidden="true" />
            </span>
            <div>
              <strong>{t("savedAfterApproval")}</strong>
              <span className="caption">{t("addedToLunasProfile")}</span>
            </div>
          </div>
          <p className="step-hint">
            <IconDeviceMobile size={17} aria-hidden="true" />
            {t("quickAccessAtTheClinic")}
          </p>
        </Card>
      </li>
    </ol>
  );
}

import { Fragment, type ReactNode } from "react";

function renderInlineMarkdown(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const pattern = /\*\*([^*]+)\*\*|\*([^*\n]+)\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[1] !== undefined) {
      parts.push(<strong key={`b-${key++}`}>{match[1]}</strong>);
    } else if (match[2] !== undefined) {
      parts.push(<em key={`i-${key++}`}>{match[2]}</em>);
    }
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

export function FormattedMedicalText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let listItems: string[] = [];
  let paragraphLines: string[] = [];
  let blockKey = 0;

  const flushList = () => {
    if (listItems.length === 0) return;
    const items = listItems;
    listItems = [];
    blocks.push(
      <ul key={`ul-${blockKey++}`} className="formatted-medical-list">
        {items.map((item, idx) => (
          <li key={idx}>{renderInlineMarkdown(item)}</li>
        ))}
      </ul>,
    );
  };

  const flushParagraph = () => {
    if (paragraphLines.length === 0) return;
    const para = paragraphLines;
    paragraphLines = [];
    blocks.push(
      <p key={`p-${blockKey++}`} className="formatted-medical-paragraph">
        {para.map((line, idx) => (
          <Fragment key={idx}>
            {idx > 0 && <br />}
            {renderInlineMarkdown(line)}
          </Fragment>
        ))}
      </p>,
    );
  };

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();

    if (!trimmed) {
      flushList();
      flushParagraph();
      continue;
    }

    const headingMatch = trimmed.match(/^#{1,3}\s+(.+)$/);
    if (headingMatch) {
      flushList();
      flushParagraph();
      const headingText = headingMatch[1].replace(/^\*\*(.+)\*\*$/, "$1");
      blocks.push(
        <h4 key={`h-${blockKey++}`} className="formatted-medical-heading">
          {renderInlineMarkdown(headingText)}
        </h4>,
      );
      continue;
    }

    const listMatch = trimmed.match(/^(?:[-*•]|\d+\.)\s+(.+)$/);
    if (listMatch) {
      flushParagraph();
      listItems.push(listMatch[1]);
      continue;
    }

    // Standalone bold section label ending with colon, e.g. "**Wnioski:**" or "Wnioski:"
    const sectionLabelMatch =
      trimmed.match(/^\*\*([^*]{2,80}:)\*\*$/) ??
      (trimmed.length <= 65 && /^[A-ZĄĆĘŁŃÓŚŹŻ][^\n.!?]{1,60}:$/.test(trimmed)
        ? [trimmed, trimmed]
        : null);

    if (sectionLabelMatch) {
      flushList();
      flushParagraph();
      blocks.push(
        <h4 key={`h-${blockKey++}`} className="formatted-medical-heading">
          {sectionLabelMatch[1]}
        </h4>,
      );
      continue;
    }

    flushList();
    paragraphLines.push(trimmed);
  }

  flushList();
  flushParagraph();

  return (
    <div className={`formatted-medical-text${className ? ` ${className}` : ""}`}>
      {blocks}
    </div>
  );
}

import type { CSSProperties } from "react";

const URL_OR_EMAIL_RE = /(https?:\/\/[^\s<>()"']+|www\.[^\s<>()"']+|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi;
const TRAILING_PUNCTUATION_RE = /[.,;:!?)]*$/;

function splitTrailingPunctuation(value: string) {
  const match = value.match(TRAILING_PUNCTUATION_RE);
  const trailing = match?.[0] ?? "";
  if (!trailing) return { core: value, trailing: "" };
  return { core: value.slice(0, -trailing.length), trailing };
}

function hrefFor(value: string) {
  if (/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(value)) return `mailto:${value}`;
  if (value.startsWith("www.")) return `https://${value}`;
  return value;
}

export default function MessageBody({ text, fallback, style }: { text: string | null | undefined; fallback?: string | null; style?: CSSProperties }) {
  const source = text || fallback || "Kein Textinhalt erkannt.";
  const parts: Array<string | { text: string; href: string }> = [];
  let lastIndex = 0;

  source.replace(URL_OR_EMAIL_RE, (match, _unused, offset: number) => {
    if (offset > lastIndex) parts.push(source.slice(lastIndex, offset));
    const { core, trailing } = splitTrailingPunctuation(match);
    if (core) parts.push({ text: core, href: hrefFor(core) });
    if (trailing) parts.push(trailing);
    lastIndex = offset + match.length;
    return match;
  });
  if (lastIndex < source.length) parts.push(source.slice(lastIndex));

  return (
    <div style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", ...style }}>
      {parts.map((part, index) => typeof part === "string" ? part : (
        <a
          key={`${part.href}-${index}`}
          href={part.href}
          target={part.href.startsWith("mailto:") ? undefined : "_blank"}
          rel={part.href.startsWith("mailto:") ? undefined : "noopener noreferrer"}
          style={{ color: "#2563EB", textDecoration: "underline", textUnderlineOffset: "2px" }}
        >
          {part.text}
        </a>
      ))}
    </div>
  );
}

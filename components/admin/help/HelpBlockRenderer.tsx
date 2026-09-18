import { HelpBlock } from "@/lib/help/types";
import Link from "next/link";

interface HelpCalloutProps {
  title?: string;
  text: string;
}

export function HelpCallout({ title, text }: HelpCalloutProps) {
  return (
    <aside className="rounded-lg border border-[#31CDFF]/35 bg-[#31CDFF]/08 px-4 py-3 text-sm text-[#272055]">
      {title ? <p className="mb-1 font-semibold">{title}</p> : null}
      <p className="leading-relaxed text-[#272055]/90">{text}</p>
    </aside>
  );
}

interface HelpBlockRendererProps {
  blocks: HelpBlock[];
}

export function HelpBlockRenderer({ blocks }: HelpBlockRendererProps) {
  return (
    <div className="space-y-6">
      {blocks.map((block, index) => {
        switch (block.type) {
          case "paragraph":
            return (
              <p
                key={`p-${index}`}
                className="text-[15px] leading-7 text-[#272055]/90"
              >
                {block.text}
              </p>
            );
          case "heading":
            return (
              <h2
                key={block.id}
                id={block.id}
                className="scroll-mt-28 text-xl font-semibold text-[#272055]"
              >
                {block.text}
              </h2>
            );
          case "steps":
            return (
              <ol
                key={`steps-${index}`}
                className="list-decimal space-y-2 pl-5 text-[15px] leading-7 text-[#272055]/90"
              >
                {block.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            );
          case "list":
            return (
              <ul
                key={`list-${index}`}
                className="list-disc space-y-2 pl-5 text-[15px] leading-7 text-[#272055]/90"
              >
                {block.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            );
          case "callout":
            return (
              <HelpCallout
                key={`callout-${index}`}
                title={block.title}
                text={block.text}
              />
            );
          case "rich":
            return (
              <p
                key={`rich-${index}`}
                className="text-[15px] leading-7 text-[#272055]/90"
              >
                {block.parts.map((part, partIndex) => {
                  if (part.kind === "text") {
                    return <span key={partIndex}>{part.text}</span>;
                  }
                  if (part.kind === "code") {
                    return (
                      <code
                        key={partIndex}
                        className="rounded bg-[#272055]/06 px-1.5 py-0.5 font-mono text-[13px] text-[#272055]"
                      >
                        {part.text}
                      </code>
                    );
                  }
                  return (
                    <Link
                      key={partIndex}
                      href={part.href}
                      className="font-medium text-[#2563eb] hover:underline"
                    >
                      {part.label}
                    </Link>
                  );
                })}
              </p>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}

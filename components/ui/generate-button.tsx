"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";

/** BQI sky cyan (~#31CDFF) — highlight / glow hue */
const BQI_CYAN_HUE = 195;

export interface GenerateButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * The hue value (0-360) for the button's highlight color.
   * Default is 195 (BQI cyan #31CDFF). Pass 275 for brand violet glow.
   */
  hue?: number;
  /**
   * If true, forces the button into its "Generating" state.
   * By default, the button also enters this state when focused or clicked.
   */
  isGenerating?: boolean;
  /** Idle label shown letter-by-letter. Default: "Generate" */
  label?: string;
  /** Generating-state label. Default: "Generating" */
  generatingLabel?: string;
}

function splitLabel(text: string) {
  return text.split("").map((ch) => (ch === " " ? "\u00A0" : ch));
}

function letterDelay(index: number): string {
  return `${(index * 0.08).toFixed(2)}s`;
}

export function GenerateButton({
  hue = BQI_CYAN_HUE,
  isGenerating: controlledIsGenerating,
  label = "Generate",
  generatingLabel = "Generating",
  className,
  onClick,
  style,
  ...props
}: GenerateButtonProps) {
  const [isFocused, setIsFocused] = useState(false);

  const isGenerating =
    controlledIsGenerating !== undefined
      ? controlledIsGenerating
      : isFocused;

  const idleLetters = splitLabel(label);
  const generatingLetters = splitLabel(generatingLabel);
  const minCh = Math.max(label.length, generatingLabel.length, 8);

  return (
    <div className="relative inline-block group">
      <style>{`
        .gen-btn {
          --border-radius: 24px;
          --padding: 4px;
          --transition: 0.4s;
          /* BQI sky cyan — matches Add Candidates CTA */
          --button-color: #31CDFF;
          --button-color-deep: #272055;
          --highlight-color-hue: ${hue}deg;

          position: relative;
          user-select: none;
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 0.5em 0.5em 0.5em 1.1em;
          font-family: "Poppins", "Inter", "Segoe UI", sans-serif;
          font-size: 1em;
          font-weight: 400;
          color: #fff;

          /* Cyan → deep purple so AI CTAs read branded on the light toolbar */
          background-color: var(--button-color);
          background-image: linear-gradient(
            135deg,
            #31CDFF 0%,
            #31CDFF 55%,
            #272055 160%
          );

          box-shadow:
            inset 0px 1px 1px rgba(255, 255, 255, 0.45),
            inset 0px 2px 2px rgba(255, 255, 255, 0.2),
            inset 0px 4px 4px rgba(255, 255, 255, 0.1),
            0 1px 2px rgba(39, 32, 85, 0.12),
            0 4px 12px rgba(49, 205, 255, 0.35);

          border: solid 1px rgba(255, 255, 255, 0.45);
          border-radius: var(--border-radius);
          cursor: pointer;

          transition: box-shadow var(--transition), border var(--transition), background-color var(--transition), background-image var(--transition), filter var(--transition);
        }

        .gen-btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .gen-btn::before {
          content: "";
          position: absolute;
          top: calc(0px - var(--padding));
          left: calc(0px - var(--padding));
          width: calc(100% + var(--padding) * 2);
          height: calc(100% + var(--padding) * 2);
          border-radius: calc(var(--border-radius) + var(--padding));
          pointer-events: none;
          background-image: linear-gradient(
            180deg,
            rgba(49, 205, 255, 0.22),
            rgba(39, 32, 85, 0.28)
          );

          z-index: -1;
          transition: box-shadow var(--transition), filter var(--transition);
          box-shadow: 0 -8px 8px -6px rgba(255,255,255,0) inset,
            0 -16px 16px -8px rgba(255,255,255,0) inset,
            1px 1px 1px rgba(255,255,255,0.35),
            2px 2px 2px rgba(49,205,255,0.15),
            -1px -1px 1px rgba(39,32,85,0.12),
            -2px -2px 2px rgba(39,32,85,0.08);
        }

        .gen-btn::after {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          border-radius: inherit;
          pointer-events: none;
          background-image: linear-gradient(
            0deg,
            #fff,
            hsl(var(--highlight-color-hue), 100%, 70%),
            hsla(var(--highlight-color-hue), 100%, 70%, 50%),
            8%,
            transparent
          );
          background-position: 0 0;
          opacity: 0;
          transition: opacity var(--transition), filter var(--transition);
        }

        .gen-btn-letter {
          position: relative;
          display: inline-block;
          color: rgba(255, 255, 255, 0.78);
          animation: gen-letter-anim 2s ease-in-out infinite;
          transition: color var(--transition), text-shadow var(--transition), opacity var(--transition);
        }

        @keyframes gen-letter-anim {
          50% {
            text-shadow: 0 0 4px rgba(255, 255, 255, 0.7);
            color: #fff;
          }
        }

        .gen-btn-svg {
          flex-shrink: 0;
          height: 1.25em;
          width: 1.25em;
          margin-right: 0.5rem;
          fill: #ffffff;
          animation: gen-flicker 2s linear infinite;
          animation-delay: 0.5s;
          filter: drop-shadow(0 0 2px rgba(255, 255, 255, 0.55));
          transition: fill var(--transition), filter var(--transition), opacity var(--transition);
        }

        @keyframes gen-flicker {
          50% { opacity: 0.3; }
        }

        .gen-txt-wrapper {
          position: relative;
          display: flex;
          align-items: center;
          min-width: calc(var(--gen-min-ch, 8) * 0.62em);
          height: 1.25em;
        }

        .gen-txt-1,
        .gen-txt-2 {
          position: absolute;
          left: 0;
          top: 50%;
          transform: translateY(-50%);
          white-space: nowrap;
          word-spacing: -0.05em;
        }

        .gen-txt-1 {
          animation: gen-appear-anim 1s ease-in-out forwards;
        }

        .gen-txt-2 {
          opacity: 0;
        }

        @keyframes gen-appear-anim {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }

        /* Generating (Focus/Active) state */
        .gen-btn[data-generating="true"] .gen-txt-1 {
          animation: gen-opacity-anim 0.3s ease-in-out forwards;
          animation-delay: 1s;
        }
        .gen-btn[data-generating="true"] .gen-txt-2 {
          animation: gen-opacity-anim 0.3s ease-in-out reverse forwards;
          animation-delay: 1s;
        }

        @keyframes gen-opacity-anim {
          0% { opacity: 1; }
          100% { opacity: 0; }
        }

        .gen-btn[data-generating="true"] .gen-btn-letter {
          animation: gen-focused-letter-anim 1s ease-in-out forwards, gen-letter-anim 1.2s ease-in-out infinite;
          animation-delay: 0s, 1s;
        }

        @keyframes gen-focused-letter-anim {
          0%, 100% { filter: blur(0px); }
          50% {
            transform: scale(2);
            filter: blur(10px) brightness(150%) drop-shadow(-36px 12px 12px hsl(var(--highlight-color-hue), 100%, 70%));
          }
        }

        .gen-btn[data-generating="true"] .gen-btn-svg {
          animation-duration: 1.2s;
          animation-delay: 0.2s;
        }

        .gen-btn[data-generating="true"]::before {
          box-shadow: 0 -8px 12px -6px rgba(255,255,255,0.2) inset,
            0 -16px 16px -8px hsla(var(--highlight-color-hue), 100%, 70%, 20%) inset,
            1px 1px 1px rgba(255,255,255,0.2),
            2px 2px 2px rgba(255,255,255,0.067),
            -1px -1px 1px rgba(0,0,0,0.133),
            -2px -2px 2px rgba(0,0,0,0.067);
        }

        .gen-btn[data-generating="true"]::after {
          opacity: 0.6;
          mask-image: linear-gradient(0deg, #fff, transparent);
          filter: brightness(100%);
        }

        /* Animation delays for letters (registry set to 13; inline style covers longer labels) */
        .gen-btn-letter:nth-child(1), .gen-btn[data-generating="true"] .gen-btn-letter:nth-child(1) { animation-delay: 0s; }
        .gen-btn-letter:nth-child(2), .gen-btn[data-generating="true"] .gen-btn-letter:nth-child(2) { animation-delay: 0.08s; }
        .gen-btn-letter:nth-child(3), .gen-btn[data-generating="true"] .gen-btn-letter:nth-child(3) { animation-delay: 0.16s; }
        .gen-btn-letter:nth-child(4), .gen-btn[data-generating="true"] .gen-btn-letter:nth-child(4) { animation-delay: 0.24s; }
        .gen-btn-letter:nth-child(5), .gen-btn[data-generating="true"] .gen-btn-letter:nth-child(5) { animation-delay: 0.32s; }
        .gen-btn-letter:nth-child(6), .gen-btn[data-generating="true"] .gen-btn-letter:nth-child(6) { animation-delay: 0.4s; }
        .gen-btn-letter:nth-child(7), .gen-btn[data-generating="true"] .gen-btn-letter:nth-child(7) { animation-delay: 0.48s; }
        .gen-btn-letter:nth-child(8), .gen-btn[data-generating="true"] .gen-btn-letter:nth-child(8) { animation-delay: 0.56s; }
        .gen-btn-letter:nth-child(9), .gen-btn[data-generating="true"] .gen-btn-letter:nth-child(9) { animation-delay: 0.64s; }
        .gen-btn-letter:nth-child(10), .gen-btn[data-generating="true"] .gen-btn-letter:nth-child(10) { animation-delay: 0.72s; }
        .gen-btn-letter:nth-child(11), .gen-btn[data-generating="true"] .gen-btn-letter:nth-child(11) { animation-delay: 0.8s; }
        .gen-btn-letter:nth-child(12), .gen-btn[data-generating="true"] .gen-btn-letter:nth-child(12) { animation-delay: 0.88s; }
        .gen-btn-letter:nth-child(13), .gen-btn[data-generating="true"] .gen-btn-letter:nth-child(13) { animation-delay: 0.96s; }

        /* Hover & Active states */
        .gen-btn:active:not(:disabled) {
          border: solid 1px hsla(var(--highlight-color-hue), 100%, 80%, 70%);
          background-color: var(--button-color-deep);
          background-image: linear-gradient(
            135deg,
            #1eb8e8 0%,
            #272055 70%
          );
          filter: brightness(0.97);
        }
        .gen-btn:active:not(:disabled)::before {
          box-shadow: 0 -8px 12px -6px rgba(255,255,255,0.5) inset,
            0 -16px 16px -8px hsla(var(--highlight-color-hue), 100%, 70%, 55%) inset,
            1px 1px 1px rgba(255,255,255,0.35),
            2px 2px 2px rgba(49,205,255,0.2),
            -1px -1px 1px rgba(39,32,85,0.2),
            -2px -2px 2px rgba(39,32,85,0.12);
        }
        .gen-btn:active:not(:disabled)::after {
          opacity: 1;
          mask-image: linear-gradient(0deg, #fff, transparent);
          filter: brightness(200%);
        }
        .gen-btn:active:not(:disabled) .gen-btn-letter {
          text-shadow: 0 0 1px hsla(var(--highlight-color-hue), 100%, 90%, 90%);
          animation: none;
          color: #fff;
        }

        @media (hover: hover) and (pointer: fine) {
          .gen-btn:hover:not(:disabled) {
            border: solid 1px hsla(var(--highlight-color-hue), 100%, 85%, 55%);
            filter: brightness(1.04);
            box-shadow:
              inset 0px 1px 1px rgba(255, 255, 255, 0.5),
              inset 0px 2px 2px rgba(255, 255, 255, 0.22),
              0 2px 4px rgba(39, 32, 85, 0.14),
              0 6px 16px rgba(49, 205, 255, 0.45);
          }
          .gen-btn:hover:not(:disabled)::before {
            box-shadow: 0 -8px 8px -6px rgba(255,255,255,0.55) inset,
              0 -16px 16px -8px hsla(var(--highlight-color-hue), 100%, 70%, 35%) inset,
              1px 1px 1px rgba(255,255,255,0.35),
              2px 2px 2px rgba(49,205,255,0.18),
              -1px -1px 1px rgba(39,32,85,0.12),
              -2px -2px 2px rgba(39,32,85,0.08);
          }
          .gen-btn:hover:not(:disabled)::after {
            opacity: 1;
            mask-image: linear-gradient(0deg, #fff, transparent);
          }
          .gen-btn:hover:not(:disabled) .gen-btn-svg {
            fill: #fff;
            filter: drop-shadow(0 0 3px hsl(var(--highlight-color-hue), 100%, 70%)) drop-shadow(0 -2px 4px rgba(39,32,85,0.35));
            animation: none;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .gen-btn-letter,
          .gen-btn-svg,
          .gen-txt-1,
          .gen-btn[data-generating="true"] .gen-btn-letter,
          .gen-btn[data-generating="true"] .gen-txt-1,
          .gen-btn[data-generating="true"] .gen-txt-2 {
            animation: none !important;
          }
          .gen-btn-letter {
            color: rgba(255, 255, 255, 0.95);
          }
          .gen-btn[data-generating="true"] .gen-txt-1 {
            opacity: 0;
          }
          .gen-btn[data-generating="true"] .gen-txt-2 {
            opacity: 1;
          }
          .gen-btn-svg {
            opacity: 1;
            filter: none;
          }
        }
      `}</style>

      <button
        type="button"
        className={cn("gen-btn", className)}
        data-generating={isGenerating}
        style={
          {
            ...style,
            ["--gen-min-ch" as string]: minCh,
          } as React.CSSProperties
        }
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onClick={(e) => {
          setIsFocused(true);
          onClick?.(e);
        }}
        {...props}
      >
        <svg
          className="gen-btn-svg"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z"
          />
        </svg>

        <div className="gen-txt-wrapper">
          <div className="gen-txt-1">
            {idleLetters.map((letter, i) => (
              <span
                key={`t1-${i}`}
                className="gen-btn-letter"
                style={i >= 13 ? { animationDelay: letterDelay(i) } : undefined}
              >
                {letter}
              </span>
            ))}
          </div>
          <div className="gen-txt-2">
            {generatingLetters.map((letter, i) => (
              <span
                key={`t2-${i}`}
                className="gen-btn-letter"
                style={i >= 13 ? { animationDelay: letterDelay(i) } : undefined}
              >
                {letter}
              </span>
            ))}
          </div>
        </div>
      </button>
    </div>
  );
}

export default GenerateButton;

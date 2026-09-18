'use client';

import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Props for the GlowBorderCard component
 */
export interface GlowBorderCardProps extends React.HTMLAttributes<HTMLDivElement> {
    /**
     * Content to display inside the card
     */
    children?: React.ReactNode;

    /**
     * Width of the card (CSS value)
     * @default "320px"
     */
    width?: string;

    /**
     * Height of the card (CSS value). If not provided, uses aspect-ratio.
     */
    height?: string;

    /**
     * Aspect ratio of the card (e.g., "1", "16/9", "4/3")
     * @default "1"
     */
    aspectRatio?: string;

    /**
     * Corner radius of the card
     * @default "0.75rem"
     */
    borderRadius?: string;

    /**
     * Animation duration in seconds
     * @default 4
     */
    animationDuration?: number;

    /**
     * Gradient colors array (up to 10 colors)
     */
    gradientColors?: string[];

    /**
     * Border width for the glow effect
     * @default "1.25em"
     */
    borderWidth?: string;

    /**
     * Blur amount for the glow effect
     * @default "0.75em"
     */
    blurAmount?: string;

    /**
     * Inset distance (negative values push the border outside).
     * Prefer ≥ 0 when ancestors use overflow:hidden — outer glow gets clipped.
     * @default "0"
     */
    inset?: string;

    /**
     * Preset color themes
     */
    colorPreset?: 'nature' | 'ocean' | 'sunset' | 'aurora' | 'custom';

    /**
     * Whether animation is paused
     * @default false
     */
    paused?: boolean;

    /**
     * Fill available space (no square aspect-ratio, stretch content).
     * Use for full-bleed workspace wrappers.
     */
    fill?: boolean;

    /**
     * Extra classes for the inner content wrapper
     */
    contentClassName?: string;
}

// Preset gradient colors (10 colors each for smooth transitions)
const colorPresets: Record<string, string[]> = {
    nature: ['#669900', '#88bb22', '#99cc33', '#aaddaa', '#ccee66', '#006699', '#228888', '#3399cc', '#55aacc', '#669900'],
    ocean: ['#006699', '#1177aa', '#2288bb', '#3399cc', '#44aadd', '#55bbee', '#66ccff', '#44bbee', '#2299cc', '#006699'],
    sunset: ['#ff6600', '#ff7711', '#ff8822', '#ff9900', '#ffaa22', '#ffbb44', '#ffcc00', '#ff9933', '#ff7722', '#ff6600'],
    aurora: ['#00ff87', '#22ffaa', '#44ffcc', '#60efff', '#88ddff', '#bb99ff', '#dd77ee', '#ff68f0', '#ff55cc', '#00ff87'],
    custom: ['#669900', '#99cc33', '#ccee66', '#006699', '#3399cc', '#990066', '#cc3399', '#ff6600', '#ff9900', '#ffcc00'],
};

/**
 * GlowBorderCard - A CSS-only animated glowing border card component
 *
 * Features a rotating conic gradient that creates a beautiful
 * aurora-like glow effect around the card edges.
 * Uses @property for smooth angle animation.
 *
 * The glow paints above content (pointer-events-none, z-30) as a border ring so
 * opaque children cannot wash it out. Prefer inset ≥ 0 when ancestors clip.
 */
export const GlowBorderCard = React.forwardRef<HTMLDivElement, GlowBorderCardProps>(
    (
        {
            children,
            className,
            width = '320px',
            height,
            aspectRatio = '1',
            borderRadius = '0.75rem',
            animationDuration = 4,
            gradientColors,
            borderWidth = '1.25em',
            blurAmount = '0.75em',
            inset = '0',
            colorPreset = 'custom',
            paused = false,
            fill = false,
            contentClassName,
            style,
            ...props
        },
        ref
    ) => {
        // Determine the gradient colors to use (up to 10)
        const colors = gradientColors || colorPresets[colorPreset] || colorPresets.custom;

        // Build color CSS variables (--glow-color-1 through --glow-color-10)
        const colorVars: Record<string, string> = {};
        for (let i = 0; i < 10; i++) {
            colorVars[`--glow-color-${i + 1}`] = colors[i % colors.length];
        }

        const resolvedHeight = fill ? height || '100%' : height;
        const resolvedWidth = fill ? width || '100%' : width;

        return (
            <div
                ref={ref}
                className={cn(
                    'relative isolate',
                    fill
                        ? 'flex min-h-0 min-w-0 flex-1 flex-col bg-transparent'
                        : 'grid place-content-center bg-zinc-50/50 backdrop-blur-md dark:bg-neutral-900/60',
                    className
                )}
                style={{
                    width: resolvedWidth,
                    height: resolvedHeight || 'auto',
                    aspectRatio: fill || resolvedHeight ? 'unset' : aspectRatio,
                    borderRadius: borderRadius,
                    '--glow-animation-duration': `${animationDuration}s`,
                    ...colorVars,
                    ...style,
                } as React.CSSProperties}
                {...props}
            >
                <div
                    className={cn(
                        'relative z-0 h-full w-full bg-transparent',
                        fill
                            ? 'flex min-h-0 flex-1 flex-col items-stretch justify-stretch p-0'
                            : 'flex items-center justify-center p-4',
                        contentClassName
                    )}
                >
                    {children}
                </div>

                {/*
                  Glow ring paints after content and above it (pointer-events-none)
                  so opaque column chrome cannot wash out the border.
                */}
                <div
                    aria-hidden
                    className={cn(
                        'pointer-events-none absolute z-[30] rounded-[inherit] border-solid glow-conic',
                        paused && '[animation-play-state:paused]'
                    )}
                    style={{
                        inset: inset,
                        borderWidth: borderWidth,
                        filter: `blur(${blurAmount})`,
                    }}
                />
            </div>
        );
    }
);

GlowBorderCard.displayName = 'GlowBorderCard';

export default GlowBorderCard;

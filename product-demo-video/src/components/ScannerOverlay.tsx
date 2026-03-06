import React, { useMemo } from "react";
import {
    interpolate,
    spring,
    useCurrentFrame,
    useVideoConfig,
    Easing,
} from "remotion";
import {
    ScanBarcode,
    X,
} from "lucide-react";

// CORE APP FONTS & STYLES
const APP_FONT_STACK = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

const WordBlur: React.FC<{
    text: string;
    delay: number;
    active: boolean;
    fontSize?: number;
}> = ({ text, delay, active, fontSize = 54 }) => {
    const frame = useCurrentFrame();
    const words = text.split(" ");

    return (
        <div style={{
            display: "flex",
            gap: "16px",
            flexWrap: "nowrap",
            justifyContent: 'center',
            alignItems: 'center'
        }}>
            {words.map((word, i) => {
                const wordDelay = delay + i * 4;
                const progress = interpolate(frame, [wordDelay, wordDelay + 20], [0, 1], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                    easing: Easing.out(Easing.quad),
                });

                const opacity = progress;
                const blur = interpolate(progress, [0, 1], [15, 0]);
                const translateY = interpolate(progress, [0, 1], [-25, 0]);

                return (
                    <span
                        key={i}
                        style={{
                            display: "inline-block",
                            opacity: active ? opacity : 0,
                            filter: `blur(${blur}px)`,
                            transform: `translateY(${translateY}px)`,
                            fontSize: fontSize,
                            fontWeight: 800,
                            color: "#111",
                            fontFamily: APP_FONT_STACK,
                            whiteSpace: "nowrap",
                            letterSpacing: '-0.04em',
                        }}
                    >
                        {word}
                    </span>
                );
            })}
        </div>
    );
};

export const ScannerOverlay: React.FC<{
    startFrame: number;
    brandName?: string;
    brandColor?: string;
}> = ({
    startFrame,
    brandName = "Swftly",
    brandColor = "#2c19fc"
}) => {
        const hexToRgb = (hex: string) => {
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            return `${r},${g},${b}`;
        };
        const rgb = hexToRgb(brandColor);

        const frame = useCurrentFrame();
        const { fps, width, height } = useVideoConfig();

        const p4TextStart = startFrame;

        // Animation for the button to follow the text blur style
        const btnBlurDelay = p4TextStart + 35;
        const btnProgress = interpolate(frame, [btnBlurDelay, btnBlurDelay + 20], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.out(Easing.quad),
        });

        const btnOpacity = btnProgress;
        const btnBlur = interpolate(btnProgress, [0, 1], [15, 0]);
        const btnTranslateY = interpolate(btnProgress, [0, 1], [-25, 0]);

        // Cursor interaction - Centered button
        const scanBtnWidth = 90;
        const scanBtnHeight = 90;
        const scanBtnX = 1580; // Adjusted slightly left as requested
        const scanBtnY = 225; // Corrected for new paddingTop (180 + button half-height)
        const c1Start = btnBlurDelay + 20;
        const c1MoveX = interpolate(frame, [c1Start, c1Start + 22], [width / 2 + 300, scanBtnX], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        const c1MoveY = interpolate(frame, [c1Start, c1Start + 22], [height + 100, scanBtnY], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        const c1Visible = interpolate(frame, [c1Start, c1Start + 5], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        const clickFrame1 = c1Start + 24;
        const clickFlash1 = spring({ frame: frame - clickFrame1, fps, config: { damping: 14, stiffness: 500 } });
        const c1FadeOut = interpolate(frame, [clickFrame1 + 2, clickFrame1 + 8], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

        // Scanner Modal logic - SNAPIER FAST SCAN
        const p4ScannerStart = clickFrame1 + 3;
        const scannerModalProg = spring({
            frame: frame - p4ScannerStart,
            fps,
            config: { damping: 14, stiffness: 350 }
        });

        const phase5Start = p4ScannerStart + 80; // Shorter hold (was 150)
        const modalBottom = 160;
        const modalPadding = 20;
        const modalWidth = 580;
        const viewportHeight = 400;
        const modalHeight = viewportHeight + (modalPadding * 2);
        const xBtnX = (width - modalWidth) / 2 + modalWidth + 24 - 32; // Adjusted for 64px button (radius 32)
        const xBtnY = height - modalBottom - modalHeight - 24 + 32;
        const cursorMoveX = interpolate(frame, [phase5Start, phase5Start + 22], [width * 0.5, xBtnX], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        const cursorMoveY = interpolate(frame, [phase5Start, phase5Start + 22], [height * 0.6, xBtnY], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        const cursorVisible = interpolate(frame, [phase5Start, phase5Start + 4], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        const clickFlash = spring({ frame: frame - (phase5Start + 24), fps, config: { damping: 14, stiffness: 500 } });
        const scannerExit = spring({ frame: frame - (phase5Start + 26), fps, config: { damping: 18, stiffness: 180 } });
        const p4Exit = spring({ frame: frame - (phase5Start + 30), fps, config: { damping: 18, stiffness: 160 } });

        if (frame < p4TextStart) return null;

        // Ensure Swftly has only capital S
        const formattedBrand = brandName.charAt(0).toUpperCase() + brandName.slice(1).toLowerCase();

        const headlineLines = [
            "Just",
            "check",
            "in",
            "the",
            "items,",
            formattedBrand,
            "will",
            "handle",
            "the",
            "rest"
        ];

        return (
            <div style={{ position: 'absolute', inset: 0, zIndex: 9999 }}>
                {(frame >= p4TextStart) && (
                    <div style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'flex-start',
                        paddingTop: 180, // Moved down as requested
                        opacity: 1 - p4Exit,
                        transform: `scale(${interpolate(p4Exit, [0, 0.15, 1], [1, 1.04, 0])})`,
                        transformOrigin: 'center center',
                    }}>
                        <div style={{
                            display: 'flex',
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '100%',
                        }}>
                            <WordBlur
                                text={`Just check in the items, ${formattedBrand} will handle the rest`}
                                delay={p4TextStart}
                                active={true}
                                fontSize={54}
                            />

                            {/* Button with smooth width expansion to prevent jumping */}
                            <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: interpolate(btnProgress, [0, 1], [0, scanBtnWidth]), // Smoothly expand width
                                height: scanBtnHeight,
                                background: `linear-gradient(rgba(255,255,255,0.07) 80%, rgba(255,255,255,0.15)), ${brandColor}`,
                                color: 'white',
                                borderRadius: 24,
                                border: 'none',
                                boxShadow: `0 3px 1px -1px rgba(26,26,26,0.07), inset 0 3px 0 0 rgba(255,255,255,0.22), inset 3px 0 0 0 rgba(255,255,255,0.22), inset -3px 0 0 0 rgba(255,255,255,0.22), inset 0 -2px 0 2px rgba(0,0,60,0.35), inset 0 2px 0 0 rgba(0,0,60,0.35)`,
                                flexShrink: 0,
                                opacity: btnOpacity,
                                marginLeft: interpolate(btnProgress, [0, 1], [0, 40]), // Smoothly expand gap
                                filter: `blur(${btnBlur}px)`,
                                transform: `translateY(${btnTranslateY}px) scale(${interpolate(clickFlash1, [0, 0.5, 1], [1, 0.82, 1])})`,
                                overflow: 'hidden' // Hide icon while width is small
                            }}>
                                <ScanBarcode size={44} strokeWidth={2.2} color="white" />
                            </div>
                        </div>
                    </div>
                )}

                {scannerModalProg > 0.01 && (
                    <div style={{
                        position: 'absolute',
                        left: '50%',
                        bottom: modalBottom,
                        width: modalWidth,
                        backgroundColor: '#fff',
                        borderRadius: 20,
                        padding: modalPadding,
                        border: `1.5px solid rgba(${rgb},0.20)`,
                        boxShadow: '0 15px 50px rgba(0,0,0,0.4)',
                        zIndex: 980,
                        opacity: scannerModalProg * (1 - scannerExit),
                        transform: `translateX(-50%) scale(${interpolate(scannerModalProg, [0, 1], [0.2, 1]) * interpolate(scannerExit, [0, 0.15, 1], [1, 1.08, 0])})`,
                        transformOrigin: 'center center',
                        fontFamily: APP_FONT_STACK,
                    }}>
                        <div style={{
                            position: 'absolute', top: -24, right: -24,
                            width: 64, height: 64,
                            backgroundColor: '#fff',
                            border: '1px solid rgba(0,0,0,0.10)',
                            borderRadius: '50%',
                            boxShadow: `0 3px 12px rgba(0,0,0,0.25), 0 0 0 ${interpolate(clickFlash, [0, 0.5, 1], [0, 10, 0])}px rgba(${rgb},0.4)`,
                            transform: `scale(${1 - interpolate(clickFlash, [0, 0.5, 1], [0, 0.35, 0])})`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            zIndex: 9999,
                        }}>
                            <X size={34} strokeWidth={2.5} color={brandColor} />
                        </div>
                        <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden' }}>
                            <div style={{
                                position: 'relative',
                                width: '100%',
                                height: viewportHeight,
                                overflow: 'hidden',
                                backgroundColor: '#000',
                                borderRadius: 12,
                            }}>
                                <div style={{
                                    position: 'absolute',
                                    left: '50%', top: '50%',
                                    transform: 'translate(-50%, -50%)',
                                    width: '88%', height: '42%',
                                    zIndex: 1,
                                    boxShadow: '0 0 0 9999px rgba(255,255,255,0.4)',
                                }}>
                                    {[
                                        { top: 0, left: 0, borderTop: '6px solid rgba(255,255,255,0.9)', borderLeft: '6px solid rgba(255,255,255,0.9)' },
                                        { top: 0, right: 0, borderTop: '6px solid rgba(255,255,255,0.9)', borderRight: '6px solid rgba(255,255,255,0.9)' },
                                        { bottom: 0, left: 0, borderBottom: '6px solid rgba(255,255,255,0.9)', borderLeft: '6px solid rgba(255,255,255,0.9)' },
                                        { bottom: 0, right: 0, borderBottom: '6px solid rgba(255,255,255,0.9)', borderRight: '6px solid rgba(255,255,255,0.9)' },
                                    ].map((s, i) => (
                                        <div key={i} style={{ position: 'absolute', width: 40, height: 40, ...s }} />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {c1Visible > 0.01 && c1FadeOut > 0.01 && (
                    <div style={{
                        position: 'absolute',
                        left: c1MoveX,
                        top: c1MoveY,
                        width: 48, height: 48,
                        opacity: c1Visible * c1FadeOut,
                        zIndex: 9999,
                        transform: `scale(${1 - interpolate(clickFlash1, [0, 0.5, 1], [0, 0.3, 0])})`,
                    }}>
                        <svg width="48" height="60" viewBox="0 0 28 36" fill="none">
                            <path d="M2 2L2 28L8.5 21.5L12.5 31L16 29.5L12 20L20.5 20L2 2Z" fill="white" stroke="#111" strokeWidth="1.8" strokeLinejoin="round" />
                        </svg>
                    </div>
                )}

                {cursorVisible > 0.01 && (
                    <div style={{
                        position: 'absolute',
                        left: cursorMoveX,
                        top: cursorMoveY,
                        width: 48,
                        height: 48,
                        opacity: cursorVisible * (1 - scannerExit),
                        zIndex: 9999,
                        transform: `scale(${1 - interpolate(clickFlash, [0, 0.5, 1], [0, 0.35, 0])})`,
                    }}>
                        <svg width="48" height="60" viewBox="0 0 28 36" fill="none">
                            <path d="M2 2L2 28L8.5 21.5L12.5 31L16 29.5L12 20L20.5 20L2 2Z" fill="white" stroke="#111" strokeWidth="1.8" strokeLinejoin="round" />
                        </svg>
                    </div>
                )}
            </div>
        );
    };

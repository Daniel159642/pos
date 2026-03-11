import React from "react";
import { AbsoluteFill, Series, useCurrentFrame, useVideoConfig, interpolate, spring, Easing, Img, staticFile, interpolateColors } from "remotion";
import {
    FileSpreadsheet,
    FileText,
    FileImage,
    MousePointer2,
    AlertTriangle,
    Mail,
    Shirt,
    Watch,
    ShoppingBag,
    Package,
    Send,
    CheckCircle2,
    Plus,
    ExternalLink,
    LayoutDashboard,
    FolderOpen,
    BookOpen,
    ArrowLeftRight,
    Library,
    FileBarChart,
    Truck,
    Settings,
    ChevronDown,
    Search,
    Bell,
    MessageSquare,
    Coffee,
    Star
} from "lucide-react";
import { loadFont } from "@remotion/google-fonts/EBGaramond";
import { ThreeLogoRemotion } from "./ThreeLogoRemotion";

const { fontFamily } = loadFont();

// --- CONSTANTS ---
const BLUE = "#2c19fc";
const SCENE_DURATION = 180; // Extended to 6 seconds for transitions
const TRANSITION_DURATION = 20;

// --- STYLED COMPONENTS ---
const MockupContainer: React.FC<{ children: React.ReactNode, isError?: boolean, errorProgress?: number, overflowVisible?: boolean }> = ({ children, isError, errorProgress = 0, overflowVisible }) => {
    const finalProgress = isError ? 1 : errorProgress;

    const gradColor1 = interpolateColors(finalProgress, [0, 1], ["rgba(255, 255, 255, 0.45)", "rgba(255, 255, 255, 0.4)"]);
    const gradColor2 = interpolateColors(finalProgress, [0, 1], ["rgba(44, 25, 252, 0.1)", "rgba(255, 255, 255, 0.4)"]);
    const borderColor = interpolateColors(finalProgress, [0, 1], ["rgba(255, 255, 255, 0.45)", "rgba(239, 68, 68, 0.4)"]);

    return (
        <div style={{
            width: 208,
            height: 176,
            background: `linear-gradient(135deg, ${gradColor1} 0%, ${gradColor2} 100%)`,
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            borderRadius: 12,
            border: `1px solid ${borderColor}`,
            boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.18)",
            position: "relative",
            overflow: overflowVisible ? "visible" : "hidden",
            display: "flex",
            flexDirection: "column",
            padding: 12
        }}>
            {children}
        </div>
    );
};

const InnerBorderEffect: React.FC = () => (
    <div style={{
        position: "absolute",
        inset: 0,
        borderRadius: 10,
        border: "1px solid rgba(255, 255, 255, 0.5)",
        margin: "2.5px",
        pointerEvents: "none",
        zIndex: 5
    }}>
        <div style={{
            width: "100%",
            height: "100%",
            borderRadius: 8,
            border: "1px solid rgba(255, 255, 255, 0.2)"
        }} />
    </div>
);

const AmbientGlow: React.FC<{ color: string, delay: number, x: string, theme?: "dark" | "light" }> = ({ color, delay, x, theme = "dark" }) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    const progress = theme === "light" ? 1 : spring({
        frame: frame - delay,
        fps,
        config: { damping: 25, stiffness: 150 }
    });

    const scale = interpolate(progress, [0, 1], [0, 1.5]);
    const opacity = interpolate(progress, [0, 1], [0, 0.6]);
    const translateY = interpolate(progress, [0, 1], [400, 0]);

    return (
        <div style={{
            position: "absolute",
            bottom: "-20%",
            left: x,
            width: "60%",
            height: "60%",
            background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
            borderRadius: "50%",
            filter: "blur(100px)",
            transform: `translate(-50%, ${translateY}px) scale(${scale})`,
            opacity,
            pointerEvents: "none",
            zIndex: 1
        }} />
    );
};

const CinematicTitle: React.FC<{
    text: string;
    delay?: number;
    textColor?: string;
    suffixIcon?: React.ReactNode;
    suffixIconDelay?: number;
    wordStagger?: number;
}> = ({ text, delay = 0, textColor = "#fff", suffixIcon, suffixIconDelay, wordStagger = 5 }) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    // Split by words, but ensure a trailing period becomes its own token for staggering
    const tokens = text.split(" ").flatMap(t => {
        if (t.endsWith(".") && t.length > 1) return [t.slice(0, -1), "."];
        return t;
    });

    return (
        <div style={{
            display: "flex",
            gap: "18px",
            flexWrap: "nowrap",
            justifyContent: "center",
            alignItems: "baseline"
        }}>
            {tokens.map((token, i) => {
                const isPeriod = token === ".";
                const isTargetWord = token.toLowerCase() === "any";
                const tokenDelay = delay + i * wordStagger;

                // We want the underline to start exactly when the period starts (the last token)
                const periodIndex = tokens.length - 1;
                const periodDelay = delay + periodIndex * wordStagger;
                const underlineSpr = spring({
                    frame: frame - periodDelay,
                    fps,
                    config: { stiffness: 200, damping: 15 }
                });
                const underlineWidth = interpolate(underlineSpr, [0, 1], [0, 1]);

                if (isPeriod) {
                    const spr = spring({
                        frame: frame - tokenDelay,
                        fps,
                        config: { stiffness: 400, damping: 12, mass: 0.8 }
                    });
                    const scale = interpolate(spr, [0, 1], [6, 1]);
                    const opacity = interpolate(spr, [0, 0.15], [0, 1]);

                    return (
                        <span
                            key={i}
                            style={{
                                display: "inline-block",
                                opacity,
                                transform: `scale(${scale})`,
                                fontSize: 72,
                                fontWeight: 400,
                                color: textColor,
                                fontFamily,
                                whiteSpace: "pre",
                                letterSpacing: "-0.01em",
                                marginLeft: -8 // Pull period closer to previous word
                            }}
                        >
                            {token}
                        </span>
                    );
                } else {
                    const progress = interpolate(frame, [tokenDelay, tokenDelay + 20], [0, 1], {
                        extrapolateLeft: "clamp",
                        extrapolateRight: "clamp",
                        easing: Easing.out(Easing.quad),
                    });
                    const opacity = progress;
                    const blur = interpolate(progress, [0, 1], [20, 0]);
                    const translateY = interpolate(progress, [0, 1], [-30, 0]);

                    return (
                        <span
                            key={i}
                            style={{
                                display: "inline-block",
                                opacity,
                                filter: `blur(${blur}px)`,
                                transform: `translateY(${translateY}px)`,
                                fontSize: 72,
                                fontWeight: 400,
                                color: textColor,
                                fontFamily,
                                whiteSpace: "nowrap",
                                letterSpacing: "-0.01em",
                                position: "relative"
                            }}
                        >
                            {token}
                            {isTargetWord && (
                                <div style={{
                                    position: "absolute",
                                    bottom: 12,
                                    left: 0,
                                    height: 4,
                                    background: textColor,
                                    borderRadius: 4,
                                    width: "100%",
                                    transform: `scaleX(${underlineWidth})`,
                                    transformOrigin: "left",
                                    opacity: underlineWidth
                                }} />
                            )}
                        </span>
                    );
                }
            })}

            {suffixIcon && (() => {
                const iconDelay = suffixIconDelay !== undefined ? suffixIconDelay : delay + tokens.length * 5;
                const iconSpr = spring({
                    frame: frame - iconDelay,
                    fps,
                    config: { stiffness: 400, damping: 12, mass: 0.8 }
                });
                const iconScale = interpolate(iconSpr, [0, 1], [6, 1]);
                const iconOpacity = interpolate(iconSpr, [0, 0.15], [0, 1]);

                return (
                    <div style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        opacity: iconOpacity,
                        transform: `scale(${iconScale})`,
                        marginLeft: 4,
                        alignSelf: "center",
                        height: 72 // Matching the approx line height of the text
                    }}>
                        {suffixIcon}
                    </div>
                );
            })()}
        </div>
    );
};

const SceneWrapper: React.FC<{ children: React.ReactNode, title: string | React.ReactNode, subtitle?: string, theme?: "dark" | "light", titleDelay?: number, errorGlowFrame?: number, errorRecoverFrame?: number, successGlowFrame?: number, successRecoverFrame?: number, exitFrame?: number, glowSet?: "default" | "royal", blurAmount?: number, overlay?: React.ReactNode, zoomAmount?: number, cameraX?: number, cameraY?: number, cameraRotate?: number }> = ({ children, title, subtitle, theme = "dark", titleDelay = 0, errorGlowFrame, errorRecoverFrame, successGlowFrame, successRecoverFrame, exitFrame, glowSet = "default", blurAmount = 0, overlay, zoomAmount = 1, cameraX = 0, cameraY = 0, cameraRotate = 0 }) => {
    const frame = useCurrentFrame();

    // Base cinematic camera zoom-in
    const baseScale = interpolate(frame, [0, 20], [1, 1.30], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.out(Easing.exp)
    });

    const cameraScale = baseScale * zoomAmount;

    // Transition to white and blue/purple theme starting soon after animations finish
    const transitionStart = 50;
    const transitionEnd = 65; // Quicker, punchier transition over 15 frames

    // Determine theme progression (0 = dark, 1 = light)
    const rawThemeProgress = interpolate(frame, [transitionStart, transitionEnd], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
    });
    let themeFactor = theme === "light" ? 1 : rawThemeProgress;

    // Fade out text instead of changing color, only if theme is dark
    let textOpacity = theme === "light" ? 1 : interpolate(frame, [transitionStart, transitionEnd], [1, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
    });

    if (exitFrame) {
        textOpacity = interpolate(frame, [exitFrame, exitFrame + 8], [textOpacity, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.out(Easing.ease)
        });
    }

    const bg1 = interpolateColors(themeFactor, [0, 1], ["#0a0a1a", "#ffffff"]);
    const bg2 = interpolateColors(themeFactor, [0, 1], ["#170ba3", "#f8fafc"]);

    const baseGlow1 = interpolateColors(themeFactor, [0, 1], ["#ffffff", "#2c19fc"]); // White to Blue
    const baseGlow2 = interpolateColors(themeFactor, [0, 1], ["#3b82f6", "#a855f7"]); // Blue-Purple to Purple
    const baseGlow3 = interpolateColors(themeFactor, [0, 1], ["#6366f1", "#8b5cf6"]); // Indigo to Deep Purple
    const baseGlow4 = interpolateColors(themeFactor, [0, 1], ["#8b5cf6", "#4338ca"]); // Violet to Indigo

    // Exit Glow (Royal Blue, White, Black)
    const exitGlowProgress = exitFrame ? interpolate(frame, [exitFrame, exitFrame + 10], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.out(Easing.ease)
    }) : 0;

    const finalGlow1 = glowSet === "royal" ? "#2c19fc" : interpolateColors(exitGlowProgress, [0, 1], [baseGlow1, "#2c19fc"]); // Royal Blue
    const finalGlow2 = glowSet === "royal" ? "#ffffff" : interpolateColors(exitGlowProgress, [0, 1], [baseGlow2, "#ffffff"]); // White
    const finalGlow3 = glowSet === "royal" ? "#000000" : interpolateColors(exitGlowProgress, [0, 1], [baseGlow3, "#000000"]); // Black
    const finalGlow4 = glowSet === "royal" ? "#1a0fb3" : interpolateColors(exitGlowProgress, [0, 1], [baseGlow4, "#1a0fb3"]); // Deeper Blue

    const errorProgressRise = errorGlowFrame ? interpolate(frame, [errorGlowFrame, errorGlowFrame + 8], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.inOut(Easing.ease)
    }) : 0;

    const errorProgressFall = errorRecoverFrame ? interpolate(frame, [errorRecoverFrame, errorRecoverFrame + 8], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.inOut(Easing.ease)
    }) : 0;

    const errorProgress = errorProgressRise - errorProgressFall;

    const glow1Error = interpolateColors(errorProgress, [0, 1], [finalGlow1, "#ef4444"]); // Red
    const glow2Error = interpolateColors(errorProgress, [0, 1], [finalGlow2, "#ffffff"]); // White
    const glow3Error = interpolateColors(errorProgress, [0, 1], [finalGlow3, "#fca5a5"]); // Light Red
    const glow4Error = interpolateColors(errorProgress, [0, 1], [finalGlow4, "#dc2626"]); // Dark Red

    const successProgressRise = successGlowFrame ? interpolate(frame, [successGlowFrame, successGlowFrame + 8], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.inOut(Easing.ease)
    }) : 0;

    const successProgressFall = successRecoverFrame ? interpolate(frame, [successRecoverFrame, successRecoverFrame + 8], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.inOut(Easing.ease)
    }) : 0;

    const successProgress = successProgressRise - successProgressFall;

    const glow1 = interpolateColors(successProgress, [0, 1], [glow1Error, "#22c55e"]); // Green
    const glow2 = interpolateColors(successProgress, [0, 1], [glow2Error, "#ffffff"]); // White
    const glow3 = interpolateColors(successProgress, [0, 1], [glow3Error, "#86efac"]); // Light Green
    const glow4 = interpolateColors(successProgress, [0, 1], [glow4Error, "#16a34a"]); // Dark Green

    const titleColor = theme === "light" ? "#0f172a" : "#fff";
    const subColor = theme === "light" ? "rgba(15,23,42,0.65)" : "rgba(255,255,255,0.75)";

    return (
        <AbsoluteFill style={{
            backgroundColor: bg1,
            background: `linear-gradient(135deg, ${bg1} 0%, ${bg2} 100%)`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "Inter, system-ui, sans-serif"
        }}>
            <AbsoluteFill style={{
                transform: `scale(${cameraScale}) translate(${cameraX}px, ${cameraY}px) rotate(${cameraRotate}deg)`,
                transformOrigin: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center"
            }}>
                <AmbientGlow color={glow1} delay={0} x="50%" theme={theme} />
                <AmbientGlow color={glow2} delay={4} x="40%" theme={theme} />
                <AmbientGlow color={glow3} delay={8} x="60%" theme={theme} />
                <AmbientGlow color={glow4} delay={12} x="50%" theme={theme} />

                <div style={{
                    marginBottom: 80,
                    textAlign: "center",
                    zIndex: 20,
                    opacity: textOpacity
                }}>
                    {typeof title === "string" ? <CinematicTitle text={title} textColor={titleColor} delay={titleDelay} /> : title}
                    {subtitle && (
                        <p style={{ fontSize: 24, color: subColor, marginTop: 12, fontWeight: 500 }}>{subtitle}</p>
                    )}
                </div>
                <div style={{
                    position: "relative",
                    transform: "scale(1.5)",
                    zIndex: 10
                }}>
                    {children}
                </div>
                {overlay}
            </AbsoluteFill>
        </AbsoluteFill>
    );
};

const SwipeTransition: React.FC<{ from: React.ReactNode, to: React.ReactNode }> = ({ from, to }) => {
    const frame = useCurrentFrame();
    const { durationInFrames } = useVideoConfig();
    const progress = interpolate(frame, [0, durationInFrames], [0, 1], { easing: Easing.bezier(0.42, 0, 0.58, 1) });

    return (
        <AbsoluteFill>
            <div style={{ transform: `translateX(${-progress * 100}%)`, width: "100%", height: "100%", position: "absolute" }}>
                {from}
            </div>
            <div style={{ transform: `translateX(${(1 - progress) * 100}%)`, width: "100%", height: "100%", position: "absolute" }}>
                {to}
            </div>
        </AbsoluteFill>
    );
};

// --- SCENES ---

const UploadScene = () => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    const entryDelay = 10;
    const hoverStart = 25; // Adjusted to start after 10f delay + arrival duration
    const isHovered = frame > hoverStart;

    const entrySpring = spring({
        frame: frame - entryDelay,
        fps,
        config: { damping: 15, stiffness: 100 }
    });

    const baseTranslateY = interpolate(entrySpring, [0, 1], [300, 0]);
    const baseRotate = interpolate(entrySpring, [0, 1], [-15, 0]);
    const scale = interpolate(entrySpring, [0, 1], [0.8, 1]);
    const containerOpacity = interpolate(entrySpring, [0, 1], [0, 1]);

    const exitTranslateY = interpolate(frame, [50, 65], [0, 1000], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.in(Easing.cubic)
    });
    const exitRotate = interpolate(frame, [50, 65], [0, 25], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.in(Easing.cubic)
    });

    const translateY = baseTranslateY + exitTranslateY;
    const rotate = baseRotate + exitRotate;

    // Transition timing: 0.8s = 24 frames
    const dragProgress = interpolate(frame, [hoverStart, hoverStart + 24], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.bezier(0.23, 1, 0.32, 1)
    });

    const cursorX = interpolate(dragProgress, [0, 1], [200, 150]);
    const cursorY = interpolate(dragProgress, [0, 1], [200, 135]);
    const cursorOpacity = interpolate(dragProgress, [0, 0.1], [0, 1]);

    // Stacked files offsets
    // del: 0.2s = 6 frames, 0.3s = 9 f, 0.4s = 12 f
    const file1Enter = spring({ frame: frame - hoverStart - 6, fps, config: { damping: 20, stiffness: 200 } });
    const file2Enter = spring({ frame: frame - hoverStart - 9, fps, config: { damping: 20, stiffness: 200 } });
    const file3Enter = spring({ frame: frame - hoverStart - 12, fps, config: { damping: 20, stiffness: 200 } });

    return (
        <SceneWrapper title="Upload any shipment file.">
            <div style={{
                transform: `translateY(${translateY}px) rotate(${rotate}deg) scale(${scale})`,
                opacity: containerOpacity,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative"
            }}>
                <MockupContainer>
                    <InnerBorderEffect />
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", zIndex: 10 }}>
                        <Img src={staticFile("upload-icon.svg")} style={{ width: 48, height: 48, marginBottom: 6, opacity: 0.6, filter: "invert(100%)" }} />
                        <span style={{ color: "rgba(255,255,255,0.8)", fontWeight: 900, fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase" }}>Drop files</span>

                        <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
                            <div style={{ padding: "4px 8px", borderRadius: 4, backgroundColor: "rgba(255, 255, 255, 0.1)", border: "1px solid rgba(255, 255, 255, 0.2)", display: "flex", alignItems: "center", gap: 4 }}>
                                <FileSpreadsheet size={10} color="#4ade80" />
                                <span style={{ fontSize: 9, fontWeight: 900, color: "rgba(255,255,255,0.9)" }}>XLS</span>
                            </div>
                            <div style={{ padding: "4px 8px", borderRadius: 4, backgroundColor: "rgba(255, 255, 255, 0.1)", border: "1px solid rgba(255, 255, 255, 0.2)", display: "flex", alignItems: "center", gap: 4 }}>
                                <FileText size={10} color="#f87171" />
                                <span style={{ fontSize: 9, fontWeight: 900, color: "rgba(255,255,255,0.9)" }}>PDF</span>
                            </div>
                            <div style={{ padding: "4px 8px", borderRadius: 4, backgroundColor: "rgba(255, 255, 255, 0.1)", border: "1px solid rgba(255, 255, 255, 0.2)", display: "flex", alignItems: "center", gap: 4 }}>
                                <FileImage size={10} color="#60a5fa" />
                                <span style={{ fontSize: 9, fontWeight: 900, color: "rgba(255,255,255,0.9)" }}>IMG</span>
                            </div>
                        </div>
                    </div>
                </MockupContainer>

                {isHovered && (
                    <div style={{
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        transform: `translate(${cursorX - 104}px, ${cursorY - 88}px)`,
                        opacity: cursorOpacity,
                        zIndex: 100
                    }}>
                        <div style={{ position: "relative" }}>
                            <div style={{ position: "absolute", top: -45, left: -115, display: "flex", flexDirection: "column", gap: 0, scale: "1.15" }}>
                                {file1Enter > 0 && (
                                    <div style={{ transform: `translateX(${(1 - file1Enter) * 10}px)`, opacity: file1Enter, backgroundColor: "#fff", padding: "4px 12px", borderRadius: 6, boxShadow: "0 10px 30px rgba(0,0,0,0.1)", border: "1px solid #eee", display: "flex", alignItems: "center", gap: 10, rotate: "-2deg", zIndex: 10 }}>
                                        <FileSpreadsheet size={18} color="#16a34a" />
                                        <span style={{ fontWeight: 800, fontSize: 12, color: "#111" }}>inventory.xls</span>
                                    </div>
                                )}
                                {file2Enter > 0 && (
                                    <div style={{ transform: `translate(${(1 - file2Enter) * 10 + 5}px, -12px)`, opacity: file2Enter, backgroundColor: "#fff", padding: "4px 12px", borderRadius: 6, boxShadow: "0 10px 30px rgba(0,0,0,0.1)", border: "1px solid #eee", display: "flex", alignItems: "center", gap: 10, rotate: "1deg", zIndex: 20 }}>
                                        <FileText size={18} color="#dc2626" />
                                        <span style={{ fontWeight: 800, fontSize: 12, color: "#111" }}>invoice.pdf</span>
                                    </div>
                                )}
                                {file3Enter > 0 && (
                                    <div style={{ transform: `translate(${(1 - file3Enter) * 10 + 10}px, -24px)`, opacity: file3Enter, backgroundColor: "#fff", padding: "4px 12px", borderRadius: 6, boxShadow: "0 10px 30px rgba(0,0,0,0.1)", border: "1px solid #eee", display: "flex", alignItems: "center", gap: 10, rotate: "-1deg", zIndex: 30 }}>
                                        <FileImage size={18} color="#2563eb" />
                                        <span style={{ fontWeight: 800, fontSize: 12, color: "#111" }}>photo.jpg</span>
                                    </div>
                                )}
                            </div>
                            <MousePointer2 size={36} fill="black" stroke="white" strokeWidth={2} style={{ filter: "drop-shadow(0 5px 15px rgba(0,0,0,0.3))" }} />
                        </div>
                    </div>
                )}
            </div>
        </SceneWrapper>
    );
};

const ExtractionScene = () => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    const hoverStart = 5;
    // Scan timing: 1.2s = 36 frames
    const isScanning = frame > hoverStart && frame < hoverStart + 36;
    const isExtracted = frame >= hoverStart + 36;
    const scanProgress = interpolate(frame, [hoverStart, hoverStart + 36], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });

    const popIn = spring({
        frame,
        fps,
        config: { damping: 14, stiffness: 200 }
    });
    const scale = interpolate(popIn, [0, 1], [0.3, 1]);

    // Dramatic hover & zoom during scanning phase
    const scanZoomInSpr = spring({
        frame: frame - hoverStart,
        fps,
        config: { damping: 14, stiffness: 220 }
    });
    const scanZoomOutSpr = spring({
        frame: frame - (hoverStart + 36),
        fps,
        config: { damping: 14, stiffness: 220 }
    });

    const scanZoomBonus = interpolate(scanZoomInSpr, [0, 1], [0, 0.45]) - interpolate(scanZoomOutSpr, [0, 1], [0, 0.45]);
    const hoverAmplitude = interpolate(scanZoomInSpr, [0, 1], [0, 25]) * (1 - interpolate(scanZoomOutSpr, [0, 1], [0, 1]));

    // Slower, graceful pan over the document
    const scanHoverY = Math.sin((frame - hoverStart) / 12) * hoverAmplitude * 1.5;
    const scanHoverRotate = Math.sin((frame - hoverStart) / 18) * (hoverAmplitude / 30);

    // Quick zoom in when the main title writes itself out (frame 50)
    const zoomIn = interpolate(frame, [50, 65], [1, 1.15], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.out(Easing.cubic)
    });

    const recoverFrame = 179;
    const sceneExitProgress = interpolate(frame, [recoverFrame, recoverFrame + 10], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.in(Easing.cubic)
    });
    const sceneExitScale = 1 - (sceneExitProgress * 0.5);
    const sceneExitOpacity = 1 - sceneExitProgress;

    const finalScale = scale * zoomIn * sceneExitScale;
    const opacity = interpolate(popIn, [0, 0.5], [0, 1], { extrapolateRight: "clamp" }) * sceneExitOpacity;

    const titleExitFrame = 45;
    const title1ExitProgress = interpolate(frame, [titleExitFrame, titleExitFrame + 8], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.in(Easing.cubic)
    });
    const title1Scale = 1 - (title1ExitProgress * 0.5); // scale down to 0.5
    const title1Opacity = 1 - title1ExitProgress;

    const errorFrame = 84;
    const titleFlipProgress = interpolate(frame, [errorFrame, errorFrame + 8], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.inOut(Easing.ease)
    });
    const title2RotateX = interpolate(titleFlipProgress, [0, 1], [0, -90]);
    const title3RotateX = interpolate(titleFlipProgress, [0, 1], [90, 0]);
    const title2Opacity = interpolate(titleFlipProgress, [0, 0.5], [1, 0], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
    const title3Opacity = interpolate(titleFlipProgress, [0.5, 1], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });

    const emailFrame = 146;
    const title4FlipProgress = interpolate(frame, [emailFrame, emailFrame + 8], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.inOut(Easing.ease)
    });
    const title3WordRotateX = interpolate(title4FlipProgress, [0, 1], [0, -90]);
    const title4WordRotateX = interpolate(title4FlipProgress, [0, 1], [90, 0]);
    const title3WordOpacity = interpolate(title4FlipProgress, [0, 0.5], [1, 0], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
    const title4WordOpacity = interpolate(title4FlipProgress, [0.5, 1], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });

    const alertSwapFrame = 159;
    const alertExitProgress = interpolate(frame, [alertSwapFrame, alertSwapFrame + 6], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.in(Easing.cubic)
    });
    const alertScale = 1 - alertExitProgress;
    const sentSpring = spring({
        frame: frame - (alertSwapFrame + 2),
        fps,
        config: { stiffness: 260, damping: 20 }
    });

    // Subtle shake applied directly to elements during the error phase
    const shakeRampUp = interpolate(frame, [errorFrame, errorFrame + 5], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
    const shakeRampDown = interpolate(frame, [emailFrame, emailFrame + 5], [1, 0], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
    const shakeAmplitude = shakeRampUp * shakeRampDown * 1.5; // 1.5px subtle jitter

    const jitterX = shakeAmplitude > 0 ? (Math.sin(frame * 1.1) + Math.cos(frame * 1.7)) * shakeAmplitude : 0;
    const jitterY = shakeAmplitude > 0 ? (Math.cos(frame * 1.3) + Math.sin(frame * 0.9)) * shakeAmplitude : 0;

    const animatedSuffix = (
        <div style={{ position: "relative", width: 56, height: 56, marginTop: 12 }}>
            <div style={{ position: "absolute", inset: 0, transform: `scale(${alertScale})`, opacity: alertScale, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <AlertTriangle size={56} color="#ef4444" strokeWidth={3} />
            </div>
            <div style={{ position: "absolute", inset: 0, transform: `scale(${sentSpring})`, opacity: sentSpring, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Send size={48} color="#22c55e" strokeWidth={3} />
            </div>
        </div>
    );

    const customTitle = (
        <div style={{ transform: `scale(${sceneExitScale})`, opacity: sceneExitOpacity, display: "flex", justifyContent: "center", width: "100%" }}>
            <div style={{ position: "relative", height: 86, width: "100%", textAlign: "center", display: "flex", justifyContent: "center" }}>
                <div style={{ position: "absolute", transform: `scale(${title1Scale})`, opacity: title1Opacity, width: "100%", left: 0 }}>
                    <CinematicTitle text=". . . . ." textColor="#0f172a" delay={2} />
                </div>
                <div style={{ position: "absolute", width: "100%", left: 0, opacity: title2Opacity, transform: `perspective(600px) rotateX(${title2RotateX}deg)` }}>
                    <CinematicTitle text="Swftly extracts the info." textColor="#0f172a" delay={50} wordStagger={2} />
                </div>
                <div style={{ position: "absolute", width: "100%", left: 0, opacity: title3Opacity, transform: `perspective(600px) rotateX(${title3RotateX}deg)`, display: "flex", justifyContent: "center", gap: 18, alignItems: "baseline" }}>
                    <div style={{ position: "relative" }}>
                        <div style={{ opacity: title3WordOpacity, transform: `perspective(600px) rotateX(${title3WordRotateX}deg)` }}>
                            <CinematicTitle text="Detects" textColor="#ef4444" delay={0} />
                        </div>
                        <div style={{ position: "absolute", top: 0, right: 0, opacity: title4WordOpacity, transform: `perspective(600px) rotateX(${title4WordRotateX}deg)` }}>
                            <CinematicTitle text="Resolves" textColor="#22c55e" delay={0} />
                        </div>
                    </div>
                    <div>
                        <CinematicTitle
                            text="Issues"
                            textColor="#ef4444"
                            delay={5}
                            suffixIcon={animatedSuffix}
                            suffixIconDelay={111}
                        />
                    </div>
                </div>
            </div>
        </div>
    );

    const innerBorderColor1 = interpolateColors(titleFlipProgress, [0, 1], ["rgba(29, 78, 216, 0.3)", "rgba(239, 68, 68, 0.5)"]);
    const innerBorderColor2 = interpolateColors(titleFlipProgress, [0, 1], ["rgba(29, 78, 216, 0.1)", "rgba(239, 68, 68, 0.2)"]);
    const innerGradColor = interpolateColors(titleFlipProgress, [0, 1], ["rgba(29, 78, 216, 0.2)", "rgba(239, 68, 68, 0.2)"]);
    const linesColor1 = interpolateColors(titleFlipProgress, [0, 1], ["rgba(29, 78, 216, 0.6)", "rgba(239, 68, 68, 0.6)"]);
    const linesColor2 = interpolateColors(titleFlipProgress, [0, 1], ["rgba(29, 78, 216, 0.4)", "rgba(239, 68, 68, 0.4)"]);

    return (
        <SceneWrapper
            title={customTitle}
            theme="light"
            errorGlowFrame={84}
            errorRecoverFrame={recoverFrame}
            successGlowFrame={emailFrame}
            successRecoverFrame={recoverFrame}
            zoomAmount={1 + scanZoomBonus}
            cameraY={scanHoverY}
            cameraRotate={scanHoverRotate}
        >
            <div style={{
                transform: `scale(${finalScale}) translate(${jitterX}px, ${jitterY}px)`,
                opacity,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative"
            }}>
                <MockupContainer errorProgress={titleFlipProgress}>
                    <div style={{ position: "absolute", inset: 0, borderRadius: 12, border: `1.5px solid ${innerBorderColor1}`, pointerEvents: "none", zIndex: 5 }}>
                        <div style={{ width: "100%", height: "100%", borderRadius: 10, border: `1px solid ${innerBorderColor2}` }} />
                    </div>
                    <div style={{ position: "absolute", inset: 0, background: `linear-gradient(135deg, ${innerGradColor} 0%, transparent 100%)`, pointerEvents: "none" }} />

                    <div style={{ width: 40, height: 8, backgroundColor: linesColor1, borderRadius: 4, marginBottom: 16 }} />
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
                        <div style={{ width: "100%", height: 4, backgroundColor: linesColor2, borderRadius: 4 }} />
                        <div style={{ width: "85%", height: 4, backgroundColor: linesColor2, borderRadius: 4 }} />
                    </div>

                    <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 16 }}>
                        {[1, 2, 3].map(i => (
                            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div style={{ width: 56, height: 4, backgroundColor: linesColor1, borderRadius: 4 }} />
                                <div style={{ width: 24, height: 4, backgroundColor: linesColor1, borderRadius: 4 }} />
                            </div>
                        ))}
                    </div>

                    {(isScanning || isExtracted) && (
                        <div style={{
                            position: "absolute",
                            top: `${scanProgress * 100}%`,
                            left: 0,
                            right: 0,
                            height: 4,
                            background: "linear-gradient(90deg, transparent, #2c19fc, transparent)",
                            boxShadow: "0 0 15px rgba(44, 25, 252, 0.6)",
                            zIndex: 30,
                            opacity: isScanning ? 1 - titleFlipProgress : 0
                        }} />
                    )}

                    {isScanning && (
                        <div style={{ position: "absolute", inset: 0, backgroundColor: "rgba(44, 25, 252, 0.1)", zIndex: 20, opacity: 1 - titleFlipProgress }} />
                    )}
                </MockupContainer>

                {isExtracted && (
                    <div style={{ position: "absolute", inset: 0, zIndex: 40, pointerEvents: "none" }}>
                        {[
                            { label: '$142.50', x: -50, y: -35, delay: 3, color: '#2563eb' },
                            { label: 'Vendor X', x: 55, y: -15, delay: 6, color: '#4f46e5' },
                            { label: '6 Items', x: -45, y: 30, delay: 9, color: '#059669' },
                            { label: 'Processed', x: 50, y: 55, delay: 12, color: '#16a34a' }
                        ].map((chip, idx) => {
                            const chipSpring = spring({
                                frame: frame - (hoverStart + 36) - chip.delay,
                                fps,
                                config: { stiffness: 200, damping: 15 }
                            });
                            const chipsExitProgress = interpolate(frame, [errorFrame, errorFrame + 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.in(Easing.cubic) });
                            const chipScale = chipSpring * (1 - chipsExitProgress * 0.5); // scale down to half size and fade
                            const chipOpacity = chipSpring * (1 - chipsExitProgress);

                            return (
                                <div key={idx} style={{
                                    position: "absolute",
                                    left: "50%",
                                    top: "50%",
                                    marginLeft: -48,
                                    marginTop: -16,
                                    background: "rgba(255, 255, 255, 0.3)",
                                    backdropFilter: "blur(12px)",
                                    WebkitBackdropFilter: "blur(12px)",
                                    padding: "6px 12px",
                                    borderRadius: 30,
                                    boxShadow: "0 10px 40px rgba(0,0,0,0.1)",
                                    border: "1px solid rgba(255, 255, 255, 0.6)",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 10,
                                    transform: `translate(${chip.x}px, ${chip.y}px) scale(${chipScale})`,
                                    opacity: chipOpacity
                                }}>
                                    <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: chip.color }} />
                                    <span style={{ fontSize: 11, fontWeight: 900, color: chip.color, textTransform: "uppercase" }}>{chip.label}</span>
                                </div>
                            );
                        })}

                        {frame >= 111 && (() => {
                            const errorChipSpring = spring({
                                frame: frame - 111,
                                fps,
                                config: { stiffness: 200, damping: 15 }
                            });

                            const errorChipExitProgress = interpolate(frame, [146, 154], [0, 1], {
                                extrapolateLeft: 'clamp',
                                extrapolateRight: 'clamp',
                                easing: Easing.in(Easing.cubic)
                            });

                            const chipScale = errorChipSpring * (1 - errorChipExitProgress * 0.5);
                            const chipOpacity = errorChipSpring * (1 - errorChipExitProgress);

                            return (
                                <div style={{
                                    position: "absolute",
                                    left: "50%",
                                    top: "50%",
                                    transform: `translate(-50%, -50%) translate(0px, 0px) scale(${chipScale})`,
                                    background: "rgba(255, 255, 255, 0.7)",
                                    backdropFilter: "blur(16px)",
                                    WebkitBackdropFilter: "blur(16px)",
                                    padding: "8px 16px",
                                    borderRadius: 30,
                                    boxShadow: "0 10px 40px rgba(239, 68, 68, 0.4)",
                                    border: "1.5px solid rgba(239, 68, 68, 0.8)",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 10,
                                    opacity: chipOpacity,
                                }}>
                                    <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: "#ef4444" }} />
                                    <span style={{ fontSize: 13, fontWeight: 900, color: "#ef4444", textTransform: "uppercase", letterSpacing: "0.5px" }}>Overcharged!</span>
                                </div>
                            );
                        })()}

                        {frame >= 146 && (() => {
                            const emailSpring = spring({
                                frame: frame - 146,
                                fps,
                                config: { stiffness: 260, damping: 20 }
                            });

                            return (
                                <div style={{
                                    position: "absolute",
                                    left: "50%",
                                    top: "50%",
                                    transform: `translate(-50%, -50%) scale(${emailSpring})`,
                                    background: "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)",
                                    padding: "8px 16px",
                                    borderRadius: 12,
                                    boxShadow: "0 15px 45px rgba(220, 38, 38, 0.4)",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 16,
                                    opacity: emailSpring,
                                    border: "1px solid rgba(255,255,255,0.4)",
                                    whiteSpace: "nowrap"
                                }}>
                                    <Mail size={24} color="white" />
                                    <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 10 }}>
                                        <span style={{ color: "white", fontSize: 12, fontWeight: 900, textTransform: "uppercase" }}>Email Sent</span>
                                        <div style={{ width: 4, height: 4, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.4)" }} />
                                        <span style={{ color: "rgba(255,255,255,0.9)", fontSize: 12, fontWeight: 700 }}>Query: Price Mismatch</span>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                )}
            </div>
        </SceneWrapper >
    );
};



const InventoryScene = () => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    const hoverStart = 0;
    const rows = [
        { initial: 0.0, target: 1.0, icon: Shirt },
        { initial: 0.0, target: 0.8, icon: Watch },
        { initial: 0.0, target: 0.95, icon: ShoppingBag },
        { initial: 0.0, target: 1.0, icon: Package }
    ];

    const popSpring = spring({
        frame,
        fps,
        config: { damping: 14, stiffness: 200 }
    });

    const cameraZoom = interpolate(frame, [0, 165], [1, 1.25], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.out(Easing.cubic)
    });

    // Freeze the hover abruptly at frame 85 the second the progress animation stops
    const freezeFrame = 85;
    const effectiveHoverFrame = frame > freezeFrame ? freezeFrame : frame;

    // Gentle floating effect starts immediately, abruptly freezes at freezeFrame
    const hoverY = Math.sin(effectiveHoverFrame / 15) * 6;
    const hoverRotate = Math.sin(effectiveHoverFrame / 25) * 2;

    // Freeze for 5 frames, then fall quickly off the page
    const dropStartFrame = freezeFrame + 5;
    const dropProgress = interpolate(frame, [dropStartFrame, dropStartFrame + 8], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.in(Easing.exp) // Extremely rapid downward acceleration
    });
    const dropY = interpolate(dropProgress, [0, 1], [0, 1500]);
    const dropRotate = interpolate(dropProgress, [0, 1], [0, -15]);

    const scale = interpolate(popSpring, [0, 1], [0.3, 1]) * cameraZoom;
    const finalY = hoverY + dropY;
    const finalRotate = hoverRotate + dropRotate;
    const opacity = interpolate(popSpring, [0, 0.5], [0, 1], { extrapolateRight: "clamp" });

    return (
        <SceneWrapper title="Swftly restocks inventory." theme="light" exitFrame={dropStartFrame}>
            <div style={{ transform: `scale(${scale}) translateY(${finalY}px) rotate(${finalRotate}deg)`, opacity }}>
                <MockupContainer overflowVisible>
                    {[
                        { label: "Creates Products", top: -10, left: -145, delay: 15, right: null },
                        { label: "Syncs Stock", top: 40, right: -125, delay: 20, left: null },
                        { label: "Updates Prices", top: 90, left: -135, delay: 25, right: null },
                        { label: "Updates Accounting", top: 140, right: -145, delay: 30, left: null }
                    ].map((pop, i) => {
                        const popSpring = spring({
                            frame: frame - hoverStart - pop.delay,
                            fps,
                            config: { stiffness: 220, damping: 15 }
                        });
                        return (
                            <div key={`pop-${i}`} style={{
                                position: "absolute",
                                top: pop.top,
                                left: pop.left !== null ? pop.left : undefined,
                                right: pop.right !== null ? pop.right : undefined,
                                transform: `scale(${popSpring})`,
                                opacity: popSpring,
                                background: "linear-gradient(135deg, rgba(255, 255, 255, 0.45) 0%, rgba(44, 25, 252, 0.1) 100%)",
                                backdropFilter: "blur(12px)",
                                WebkitBackdropFilter: "blur(12px)",
                                padding: "8px 16px",
                                borderRadius: 12,
                                boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.18)",
                                border: "1px solid rgba(255, 255, 255, 0.45)",
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                whiteSpace: "nowrap",
                                zIndex: 20
                            }}>
                                <CheckCircle2 size={14} color="#10b981" />
                                <span style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.9)" }}>{pop.label}</span>
                            </div>
                        );
                    })}

                    <div style={{ textAlign: "center", marginBottom: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 900, color: "rgba(255,255,255,0.9)", letterSpacing: "0.2em", textTransform: "uppercase" }}>Inventory</span>
                    </div>
                    <div style={{ width: "100%", height: 1, backgroundColor: "rgba(255,255,255,0.1)", marginBottom: 8 }} />

                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {rows.map((row, idx) => {
                            const progress = spring({
                                frame: frame - hoverStart - (idx * 15), // slower onset
                                fps,
                                config: { damping: 25, stiffness: 45 } // slower filling
                            });
                            const widthStr = interpolate(progress, [0, 1], [row.initial, row.target], {
                                easing: Easing.bezier(0.23, 1, 0.32, 1)
                            });

                            return (
                                <div key={idx} style={{ display: "flex", alignItems: "center", gap: 16 }}>
                                    <row.icon size={18} color="rgba(255,255,255,0.7)" />
                                    <div style={{ flex: 1, position: "relative", display: "flex", alignItems: "center" }}>
                                        <div style={{ width: "100%", height: 8, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 4, overflow: "hidden", position: "relative" }}>
                                            <div style={{
                                                width: `${widthStr * 100}%`,
                                                height: "100%",
                                                backgroundColor: BLUE,
                                                boxShadow: "0 0 8px rgba(44, 25, 252, 0.6)",
                                                borderRadius: 4
                                            }} />
                                        </div>

                                        {[0, 1, 2].map(i => {
                                            const flyStart = hoverStart + (idx * 15) + (i * 5);
                                            const flySpring = spring({
                                                frame: frame - flyStart,
                                                fps,
                                                config: { damping: 18, stiffness: 70 }
                                            });
                                            const currentLeft = interpolate(flySpring, [0, 1], [350, widthStr * 100]);
                                            const iconOpacity = interpolate(flySpring, [0, 0.1, 0.85, 1], [0, 1, 1, 0]);
                                            const rotation = interpolate(flySpring, [0, 1], [i % 2 === 0 ? 90 : -90, 0]);
                                            const iconScale = interpolate(flySpring, [0, 1], [3, 0]);

                                            return (
                                                <div key={i} style={{
                                                    position: "absolute",
                                                    left: `${currentLeft}%`,
                                                    top: "50%",
                                                    transform: `translate(-50%, -50%) rotate(${rotation}deg) scale(${iconScale})`,
                                                    opacity: iconOpacity,
                                                    zIndex: 10
                                                }}>
                                                    <row.icon size={14} color={BLUE} style={{ filter: "drop-shadow(0 0 6px rgba(44, 25, 252, 0.6))" }} />
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </MockupContainer>
            </div>
        </SceneWrapper>
    );
};

const AppDashboardScene = () => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    const slideProgress = spring({
        frame,
        fps,
        config: { damping: 15, stiffness: 200 }
    });

    const x = interpolate(slideProgress, [0, 1], [1500, 0]);
    const windowScale = interpolate(slideProgress, [0, 1], [0.6, 0.8]);

    const titleExitStart = 30;
    const titleExitSpr = spring({
        frame: frame - titleExitStart,
        fps,
        config: { damping: 20, stiffness: 220 }
    });
    const titleScale = interpolate(titleExitSpr, [0, 1], [1, 0.8]);
    const titleOpacity = interpolate(titleExitSpr, [0, 1], [1, 0]);

    const promoStart = 25;
    const promoSpr = spring({
        frame: frame - promoStart,
        fps,
        config: { stiffness: 400, damping: 30 }
    });
    const promoY = interpolate(promoSpr, [0, 1], [-200, 120]);

    // Secondary Zoom and Click Sequence
    const zoomStart = 34;
    const zoomEnd = 69;
    const zoomSpr = spring({
        frame: frame - zoomStart,
        fps,
        config: { damping: 12, stiffness: 100 }
    });
    const secondaryZoom = interpolate(zoomSpr, [0, 1], [1, 1.8]);
    const cameraY = interpolate(zoomSpr, [0, 1], [0, 220]);

    // Cursor Movement
    const cursorStart = 19; // 5 frames before zoom (24)
    const cursorClick = 59;

    // Pop-in scale for cursor
    const cursorEntranceSpr = spring({
        frame: frame - cursorStart,
        fps,
        config: { damping: 12, stiffness: 200 }
    });
    const entranceScale = interpolate(cursorEntranceSpr, [0, 1], [0, 1]);

    const cursorProgress = spring({
        frame: frame - cursorStart,
        fps,
        config: { damping: 20, stiffness: 80 }
    });

    const cursorX = interpolate(cursorProgress, [0, 1], [400, 0]);
    const cursorY = interpolate(cursorProgress, [0, 1], [100, -360]);

    // Click Animation
    const isClicked = frame >= cursorClick;
    const clickSpr = spring({
        frame: frame - cursorClick,
        fps,
        config: { damping: 10, stiffness: 300 }
    });
    const clickScale = interpolate(clickSpr, [0, 0.5, 1], [1, 0.8, 1]);

    // White Flash
    const flashOpacity = interpolate(frame, [cursorClick + 5, cursorClick + 15], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp"
    });

    const animatedTitle = (
        <div style={{
            transform: `scale(${titleScale})`,
            opacity: titleOpacity,
            textAlign: "center"
        }}>
            <CinematicTitle text="Seamless Management" textColor="#0f172a" delay={0} />
        </div>
    );

    const promoNotification = (
        <div style={{
            position: "absolute",
            top: promoY,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1000,
            width: 520,
            pointerEvents: "none"
        }}>
            <div style={{
                display: "flex",
                alignItems: "center",
                gap: 20,
                padding: "18px 24px",
                borderRadius: 28,
                border: '1px solid rgba(255, 255, 255, 0.45)',
                backdropFilter: 'blur(60px) saturate(200%) brightness(110%)',
                WebkitBackdropFilter: 'blur(60px) saturate(200%) brightness(110%)',
                boxShadow: '0 30px 70px rgba(0,0,0,0.22), inset 0 0 0 1px rgba(255,255,255,0.25)',
                background: 'linear-gradient(135deg, rgba(245, 246, 250, 0.45) 0%, rgba(180, 185, 200, 0.25) 100%)',
                backgroundColor: 'transparent',
            }}>
                <Img
                    src={staticFile("/wallet-icon.png")}
                    style={{
                        width: 72,
                        height: 72,
                        objectFit: "contain",
                        filter: "drop-shadow(0 10px 20px rgba(0,0,0,0.15))"
                    }}
                />
                <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
                    <div style={{ fontSize: 20, fontWeight: 900, color: "#000", letterSpacing: "-0.5px" }}>Summer Flash Sale ☀️</div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: "#374151", opacity: 0.9 }}>Select categories are up to 50% off!</div>
                </div>
            </div>
        </div>
    );

    return (
        <SceneWrapper
            title={animatedTitle}
            theme="light"
            glowSet="royal"
            overlay={
                <>
                    {promoNotification}
                    {/* Cursor Overlay */}
                    {frame >= cursorStart && (
                        <div style={{
                            position: "absolute",
                            left: `calc(50% + ${cursorX}px)`,
                            top: `calc(50% + ${cursorY}px)`,
                            zIndex: 2000,
                            transform: `scale(${clickScale * entranceScale})`,
                            pointerEvents: "none"
                        }}>
                            <MousePointer2
                                size={48}
                                fill="black"
                                color="white"
                                strokeWidth={2.5}
                                style={{
                                    filter: "drop-shadow(0 5px 15px rgba(0,0,0,0.3))"
                                }}
                            />
                        </div>
                    )}
                    {/* White Flash Transition overlay */}
                    {frame >= cursorClick + 5 && (
                        <div style={{
                            position: "fixed",
                            inset: 0,
                            background: "white",
                            zIndex: 3000,
                            opacity: flashOpacity
                        }} />
                    )}
                </>
            }
            zoomAmount={secondaryZoom}
            cameraY={cameraY}
        >
            <div style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
            }}>
                <div style={{
                    transform: `translateX(${x}px) scale(${windowScale})`,
                    width: 1100,
                    display: "flex",
                    justifyContent: "center"
                }}>
                    <div style={{
                        background: "white",
                        borderRadius: 24,
                        boxShadow: "0 30px 60px rgba(0,0,0,0.12)",
                        border: "1px solid rgba(0,0,0,0.05)",
                        display: "flex",
                        flexDirection: "column",
                        height: 580,
                        overflow: "hidden",
                        fontFamily: "Inter, sans-serif"
                    }}>
                        {/* BROWSER / APP TOP BAR */}
                        <div style={{
                            height: 52,
                            borderBottom: "1px solid #eee",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "0 20px",
                            background: "white"
                        }}>
                            {/* SWFTLY Logo Section */}
                            <div style={{
                                padding: "4px 12px",
                                fontSize: 22,
                                fontWeight: 800,
                                letterSpacing: "0.5px",
                                color: BLUE,
                                fontFamily: "Inter, sans-serif"
                            }}>
                                SWFTLY
                            </div>

                            {/* Right Actions */}
                            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                                <div style={{ position: "relative", transform: "translateY(2px)" }}>
                                    <Bell size={28} color="#888" />
                                    <div style={{
                                        position: "absolute",
                                        top: -2,
                                        right: -6,
                                        minWidth: 20,
                                        height: 20,
                                        background: "#ef4444",
                                        borderRadius: 10,
                                        color: "white",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontSize: 12,
                                        fontWeight: "bold",
                                        padding: "0 4px"
                                    }}>
                                        3
                                    </div>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#4a90e2", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>DR</div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                        <span style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>Derek Rose</span>
                                        <ChevronDown size={14} color="#9ca3af" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
                            {/* SIDEBAR */}
                            <div style={{
                                width: 240,
                                borderRight: "1px solid #f1f5f9",
                                display: "flex",
                                flexDirection: "column",
                                padding: "24px 0",
                                background: "white",
                                flexShrink: 0
                            }}>
                                <div style={{ padding: "0 20px", marginBottom: 32, display: "flex", alignItems: "center", gap: 12 }}>
                                    <div style={{ width: 32, height: 32, borderRadius: 8, background: "#f1f0ff", display: "flex", alignItems: "center", justifyContent: "center", color: BLUE }}>
                                        <LayoutDashboard size={18} />
                                    </div>
                                    <span style={{ fontWeight: 800, fontSize: 15, color: "#111827" }}>Accounting</span>
                                </div>

                                {[
                                    { icon: FolderOpen, label: 'Directory', active: true },
                                    { icon: BookOpen, label: 'Chart of Accounts' },
                                    { icon: ArrowLeftRight, label: 'Transactions' },
                                    { icon: Library, label: 'Ledger' },
                                    { icon: FileBarChart, label: 'Statements' },
                                    { icon: FileText, label: 'Invoices' },
                                    { icon: Truck, label: 'Vendors' },
                                    { icon: Settings, label: 'Settings', isBottom: true },
                                ].map((item, i) => (
                                    <div key={item.label} style={{
                                        padding: "10px 20px",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 12,
                                        marginTop: item.isBottom ? "auto" : 0,
                                        background: item.active ? "#f9fafb" : "transparent",
                                        color: item.active ? "#111827" : "#6b7280"
                                    }}>
                                        <item.icon size={18} strokeWidth={item.active ? 2.5 : 2} />
                                        <span style={{ fontSize: 14, fontWeight: item.active ? 700 : 500 }}>{item.label}</span>
                                    </div>
                                ))}
                            </div>

                            {/* MAIN CONTENT AREA */}
                            <div style={{
                                flex: 1,
                                padding: "12px 32px 32px 32px", // pt-3 px-8 pb-8
                                display: "flex",
                                flexDirection: "column",
                                gap: 48, // space-y-12
                                background: "white", // Matching website's bg-white
                                overflow: "hidden"
                            }}>
                                {/* Top Nav Row Containers */}
                                <div style={{ display: "flex", gap: 16, alignItems: "start", position: "relative", padding: "0 16px" }}>
                                    {/* Statements Button */}
                                    <div style={{
                                        padding: "10px 24px",
                                        background: "linear-gradient(#fff, #f5f5fa)",
                                        borderRadius: 9999,
                                        color: "#484c7a",
                                        fontSize: 14,
                                        fontWeight: 700,
                                        boxShadow: "rgba(37, 44, 97, .15) 0 4px 11px 0, rgba(93, 100, 148, .2) 0 1px 3px 0",
                                        lineHeight: 1.15
                                    }}>
                                        Statements
                                    </div>

                                    <div style={{ position: "relative" }}>
                                        {/* Payroll Button (Blue) */}
                                        <div style={{
                                            padding: "10px 24px",
                                            background: "linear-gradient(#2c19fc, #1a0fb3)",
                                            borderRadius: 9999,
                                            color: "white",
                                            fontSize: 14,
                                            fontWeight: 700,
                                            boxShadow: "rgba(44, 25, 252, .3) 0 4px 11px 0, rgba(44, 25, 252, .2) 0 1px 3px 0",
                                            lineHeight: 1.15
                                        }}>
                                            Payroll
                                        </div>

                                        {/* Floating Dropdown Pop-out Overlay - White Glassy Style */}
                                        <div
                                            style={{
                                                position: 'absolute',
                                                top: 'calc(100% + 6px)',
                                                left: '50%',
                                                transform: 'translateX(-50%)',
                                                width: '100%',
                                                borderRadius: 20,
                                                border: '1px solid rgba(255, 255, 255, 0.6)',
                                                backdropFilter: 'blur(24px)',
                                                WebkitBackdropFilter: 'blur(24px)',
                                                padding: '6px 0 6px 6px',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: 10,
                                                zIndex: 50,
                                                background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.85) 0%, rgba(44, 25, 252, 0.12) 100%)',
                                                boxShadow: 'rgba(50, 50, 93, 0.25) 0px 2px 5px -1px, rgba(0, 0, 0, 0.3) 0px 1px 3px -1px',
                                            }}
                                        >
                                            {[
                                                { name: 'ADP', icon: 'adp.svg' },
                                                { name: 'JustWorks', icon: 'justworks.svg' },
                                                { name: 'Gusto', icon: 'gusto.svg' },
                                            ].map((opt, i) => (
                                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <Plus size={10} strokeWidth={4} color="#d1d5db" style={{ flexShrink: 0 }} />
                                                    <Img
                                                        src={staticFile(`/${opt.icon}`)}
                                                        alt=""
                                                        style={{
                                                            height: opt.name === 'JustWorks' ? 10 : 12,
                                                            width: 'auto',
                                                            objectFit: 'contain',
                                                            maxWidth: 70
                                                        }}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Vendors Button */}
                                    <div style={{
                                        padding: "10px 24px",
                                        background: "linear-gradient(#fff, #f5f5fa)",
                                        borderRadius: 9999,
                                        color: "#484c7a",
                                        fontSize: 14,
                                        fontWeight: 700,
                                        boxShadow: "rgba(37, 44, 97, .15) 0 4px 11px 0, rgba(93, 100, 148, .2) 0 1px 3px 0",
                                        lineHeight: 1.15
                                    }}>
                                        Vendors
                                    </div>
                                </div>

                                <div style={{ display: "flex", gap: 24, flex: 1 }}>
                                    {/* Cash Flow Section */}
                                    <div style={{ flex: 2, background: "white", borderRadius: 20, padding: 24, border: "1px solid #f1f5f9", display: "flex", flexDirection: "column" }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 24 }}>
                                            <div>
                                                <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: "#1e293b" }}>Cash Flow</h3>
                                                <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 0 0" }}>Revenue vs Expenditures</p>
                                            </div>
                                            <div style={{ display: "flex", gap: 8 }}>
                                                <div style={{ padding: "4px 12px", background: "#f0f0ff", borderRadius: 20, fontSize: 11, fontWeight: 800, color: BLUE }}>Revenue</div>
                                                <div style={{ padding: "4px 12px", background: "#f8fafc", borderRadius: 20, fontSize: 11, fontWeight: 800, color: "#94a3b8" }}>Expense</div>
                                            </div>
                                        </div>

                                        <div style={{ flex: 1, background: "#fcfcff", borderRadius: 12, position: "relative", display: "flex", alignItems: "end", padding: 16, border: "1px solid #f1f0ff" }}>
                                            <svg viewBox="0 0 100 40" style={{ width: "100%", height: "100%" }} preserveAspectRatio="none">
                                                <defs>
                                                    <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="0%" stopColor="rgba(44, 25, 252, 0.2)" />
                                                        <stop offset="100%" stopColor="rgba(44, 25, 252, 0)" />
                                                    </linearGradient>
                                                </defs>
                                                <path d="M0,35 Q10,32 20,28 T40,22 T60,25 T80,15 T100,5 V40 H0 Z" fill="url(#chartGrad)" />
                                                <path d="M0,35 Q10,32 20,28 T40,22 T60,25 T80,15 T100,5" fill="none" stroke={BLUE} strokeWidth="1.5" strokeLinecap="round" />
                                                <circle cx="100" cy="5" r="2" fill={BLUE} />
                                            </svg>
                                        </div>
                                    </div>

                                    {/* Ledger Section */}
                                    <div style={{ flex: 1, background: "white", borderRadius: 20, padding: 24, border: "1px solid #f1f5f9", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
                                        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, color: "#111827", display: "flex", alignItems: "center", gap: 8 }}>
                                            <Library size={18} color={BLUE} />
                                            Ledger Reports
                                        </h3>
                                        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                                            {[
                                                'General Ledger Summary',
                                                'Accounts Payable',
                                                'Accounts Receivable',
                                                'Cash Flow Statement',
                                                'Employee Payroll Report'
                                            ].map((report, i) => (
                                                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 10, borderBottom: "1px solid #f9fafb" }}>
                                                    <span style={{ fontSize: 12, fontWeight: 600, color: "#374151", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{report}</span>
                                                    <ExternalLink size={14} color="#d1d5db" />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Floating Notification Stack */}
                            <div style={{
                                position: "absolute",
                                right: 24,
                                top: 16,
                                display: "flex",
                                flexDirection: "column",
                                gap: 10,
                                zIndex: 200,
                                width: 240,
                                pointerEvents: "none"
                            }}>
                                {[
                                    { icon: 'shopify.svg', title: 'New Shopify Order', subtitle: '#SP-3301 · Today · 6:58 PM', rgb: '100,148,62' },
                                    { icon: 'doordash.svg', title: 'New DoorDash Order', subtitle: '#DD-4821 · Today · 7:14 PM', rgb: '255,48,8' },
                                    { icon: 'ubereats.svg', title: 'New Uber Eats Order', subtitle: '#UE-9241 · Today · 8:12 PM', rgb: '5,189,114' }
                                ].map((notif, idx) => {
                                    const notifProgress = spring({
                                        frame: frame - (10 + idx * 5),
                                        fps,
                                        config: { damping: 14, stiffness: 220 }
                                    });
                                    const notifX = interpolate(notifProgress, [0, 1], [400, 12]);
                                    const notifOpacity = interpolate(notifProgress, [0, 0.2], [0, 1]);

                                    const exitStart = 65;
                                    const exitSpr = spring({
                                        frame: frame - exitStart - (idx * 3),
                                        fps,
                                        config: { damping: 15, stiffness: 200 }
                                    });
                                    const exitScale = interpolate(exitSpr, [0, 1], [1, 0]);
                                    const exitOpacity = interpolate(exitSpr, [0, 0.5], [1, 0]);

                                    return (
                                        <div key={idx} style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 12,
                                            padding: 14,
                                            borderRadius: 22,
                                            border: '1px solid rgba(255, 255, 255, 0.6)',
                                            backdropFilter: 'blur(32px)',
                                            WebkitBackdropFilter: 'blur(32px)',
                                            boxShadow: '0 15px 35px rgba(0,0,0,0.1), 0 5px 15px rgba(0,0,0,0.05)',
                                            background: `linear-gradient(135deg, rgba(255,255,255,0.85) 0%, rgba(${notif.rgb},0.15) 100%)`,
                                            backgroundColor: 'rgba(255, 255, 255, 0.8)',
                                            transform: `translateX(${notifX}px) scale(${exitScale})`,
                                            opacity: notifOpacity * exitOpacity
                                        }}>
                                            <Img src={staticFile(`/${notif.icon}`)} style={{ width: 32, height: 32, objectFit: "contain" }} />
                                            <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                                                <div style={{ fontSize: 13, fontWeight: 800, color: "#111", textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{notif.title}</div>
                                                <div style={{ fontSize: 11, fontWeight: 500, color: "rgba(107, 114, 128, 0.8)" }}>{notif.subtitle}</div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </SceneWrapper>
    );
};

const MarketingTaglineScene = () => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    const words1 = ["Swftly", "runs", "your", "marketing", "."];
    const words2 = ["Generate", "SMS", "Campaigns"];
    const themeColors = ["#0091ff", "#4aa9e2", "#bf5fff", BLUE];
    const stagger = 6;

    const flipStart = 46;
    const flipSpr = spring({
        frame: frame - flipStart,
        fps,
        config: { damping: 14, stiffness: 80 }
    });

    const flipRotation = interpolate(flipSpr, [0, 1], [0, -90]);
    const flipInRotation = interpolate(flipSpr, [0, 1], [90, 0]);
    const flipOpacity = interpolate(flipSpr, [0, 0.4], [1, 0]);
    const flipInOpacity = interpolate(flipSpr, [0.6, 1], [0, 1]);

    // Red Glow during flip
    const redGlowSpr = spring({
        frame: frame - flipStart,
        fps,
        config: { damping: 20, stiffness: 40 }
    });
    // Red Glow (Phase 2 Living Orb)
    const redGlowOpacity = interpolate(redGlowSpr, [0, 0.5, 1], [0, 0.8, 0.65]);
    const redGlowScale = interpolate(redGlowSpr, [0, 1], [0.2, 1.0]);
    // Throbbing effect to make it feel alive (More prominent)
    const orbThrob = Math.sin((frame - flipStart) / 6) * 0.12;

    // Phase 3 Flip (SMS -> Email)
    const flip2Start = 100;
    const flip2Spr = spring({
        frame: frame - flip2Start,
        fps,
        config: { damping: 14, stiffness: 80 }
    });

    const orbMain = interpolateColors(flip2Spr, [0, 1], ["rgba(34, 197, 94, 0.9)", "rgba(239, 68, 68, 0.9)"]);
    const orbOuter = interpolateColors(flip2Spr, [0, 1], ["rgba(34, 197, 94, 0.4)", "rgba(239, 68, 68, 0.4)"]);
    const orbShrinkScale = interpolate(flip2Spr, [0, 0.5, 1], [1, 0.1, 1.4]);

    const finalOrbScale = (redGlowScale * orbShrinkScale) + (redGlowScale > 0.5 ? orbThrob : 0);

    const smsFlipRotation = interpolate(flip2Spr, [0, 1], [0, -90]);
    const emailFlipRotation = interpolate(flip2Spr, [0, 1], [90, 0]);
    const smsOpacity = interpolate(flip2Spr, [0, 0.4], [1, 0]);
    const emailOpacity = interpolate(flip2Spr, [0.6, 1], [0, 1]);

    // Smooth Transition from Red to Green on Click
    const clickGlowColor = interpolateColors(
        spring({
            frame: frame - 167, // clickFrame
            fps,
            config: { stiffness: 60, damping: 20 }
        }),
        [0, 1],
        ["#ff1f1f", "#22c55e"]
    );


    // Final Tagline Exit (Delayed from Click)
    const clickFrame = 157;
    const exitSpr = spring({
        frame: frame - (clickFrame + 25),
        fps,
        config: { stiffness: 120, damping: 14 }
    });
    const taglineExitScale = interpolate(exitSpr, [0, 0.4, 1], [1, 1.15, 0]);
    const taglineExitOpacity = interpolate(exitSpr, [0, 0.4, 1], [1, 1, 0]);

    // Final Zoom (on Mockup)
    const zoomStart = 190;
    const zoomSpr = spring({
        frame: frame - zoomStart,
        fps,
        config: { stiffness: 60, damping: 22 } // Slower, more cinematic glide
    });
    const contentTranslateY = interpolate(zoomSpr, [0, 1], [0, -50]);
    const contentRotateX = interpolate(zoomSpr, [0, 1], [0, 12]); // Elevated tilt for cinematic depth
    const contentRotateY = interpolate(zoomSpr, [0, 1], [0, -8]);

    const finalOrbMain = interpolateColors(zoomSpr, [0, 1], [orbMain, "rgba(34, 197, 94, 0.9)"]);
    const finalOrbOuter = interpolateColors(zoomSpr, [0, 1], [orbOuter, "rgba(34, 197, 94, 0.4)"]);


    // Apple Wallet Click
    const walletClickFrame = 224;
    const walletClickEase = spring({
        frame: frame - walletClickFrame,
        fps,
        config: { stiffness: 800, damping: 30 }
    });

    // Success Container Phase
    const successStart = walletClickFrame + 3;
    const successSpr = spring({
        frame: frame - successStart,
        fps,
        config: { stiffness: 400, damping: 30 }
    });
    const successOpacity = interpolate(successSpr, [0, 0.4], [0, 1]);
    const successScale = interpolate(successSpr, [0, 1], [0, 1]);
    const successTranslateX = interpolate(successSpr, [0, 1], [-130, 0]);
    const successTranslateY = interpolate(successSpr, [0, 1], [250, 0]);

    // Falling Mockup Phase
    const fallStart = walletClickFrame + 21;
    const fallSpr = spring({
        frame: frame - fallStart,
        fps,
        config: { stiffness: 30, damping: 15, mass: 2 }
    });
    const fallY = interpolate(fallSpr, [0, 1], [0, 1200]);
    const fallRotate = interpolate(fallSpr, [0, 1], [0, 25]);
    const fallOpacity = interpolate(fallSpr, [0, 0.15], [1, 0]);

    // Final Tagline Phase
    const taglineBlurStart = successStart + 15;
    const finalTaglineSpr = spring({
        frame: frame - taglineBlurStart,
        fps,
        config: { stiffness: 40, damping: 20 }
    });
    const finalTaglineY = interpolate(finalTaglineSpr, [0, 1], [30, 0]);
    const finalTaglineBlur = interpolate(finalTaglineSpr, [0, 1], [15, 0]);
    const finalTaglineOpacity = interpolate(finalTaglineSpr, [0, 0.4], [0, 1]);

    // Overall Scene Zoom (Delayed by 15 frames)
    const zoomInStart = successStart + 15;
    const zoomInSpr = spring({
        frame: frame - zoomInStart,
        fps,
        config: { stiffness: 40, damping: 20 }
    });
    const finalShotZoom = interpolate(zoomInSpr, [0, 1], [1, 1.1]);

    // Final Scene Exit
    const exitSequenceStart = 283;
    const finalExitSpr = spring({
        frame: frame - exitSequenceStart,
        fps,
        config: { stiffness: 200, damping: 25 }
    });
    const finalExitScale = interpolate(finalExitSpr, [0, 1], [1, 0.4]);
    const finalExitOpacity = interpolate(finalExitSpr, [0, 0.5], [1, 0]);

    // Final Glow Transition (back to first scene star colors)
    const finalSceneGlow = interpolateColors(
        finalExitSpr,
        [0, 1],
        [clickGlowColor, "#ffffff"]
    );
    const finalBg1 = interpolateColors(finalExitSpr, [0, 1], ["#ffffff", "#0a0a1a"]);
    const finalBg2 = interpolateColors(finalExitSpr, [0, 1], ["#ffffff", "#170ba3"]);

    return (
        <AbsoluteFill style={{
            background: `linear-gradient(135deg, ${finalBg1} 0%, ${finalBg2} 100%)`,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            overflow: "hidden",
            perspective: "1000px"
        }}>
            <AbsoluteFill style={{
                transform: `scale(${finalShotZoom}) translateY(${contentTranslateY}px) rotateX(${contentRotateX}deg) rotateY(${contentRotateY}deg)`,
                transformOrigin: "center",
                display: "flex",
                justifyContent: "center",
                alignItems: "center"
            }}>
                {/* Phase 1 Glows */}
                {themeColors.map((color, idx) => {
                    const startFrame = idx * stagger;
                    const glowSpr = spring({
                        frame: frame - startFrame,
                        fps,
                        config: { damping: 20, stiffness: 60 }
                    });
                    const glowOpacity = interpolate(glowSpr, [0, 0.4, 1], [0, 0.4, 0.25]);
                    const exitOpacity = interpolate(flipSpr, [0, 0.5], [1, 0]);
                    const glowScale = interpolate(glowSpr, [0, 1], [0.8, 1.4]);

                    return (
                        <div key={`glow-${idx}`} style={{
                            position: "absolute",
                            bottom: -100,
                            left: "-10%",
                            width: "120%",
                            height: "100%",
                            background: `radial-gradient(circle at 50% 100%, ${color} 0%, transparent 70%)`,
                            opacity: glowOpacity * exitOpacity,
                            transform: `scale(${glowScale})`,
                            pointerEvents: "none",
                            zIndex: 0
                        }} />
                    );
                })}

                {/* Living Orb Background */}
                <div style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    marginTop: -300,
                    marginLeft: -300,
                    width: 600,
                    height: 600,
                    background: `radial-gradient(circle, ${finalOrbMain} 0%, ${finalOrbOuter} 40%, transparent 70%)`,
                    opacity: redGlowOpacity * (1 - finalExitSpr),
                    transform: `scale(${finalOrbScale})`,
                    pointerEvents: "none",
                    zIndex: 0,
                    mixBlendMode: "screen",
                    filter: "blur(20px)"
                }} />
                {/* Tagline 1 */}
                <div style={{
                    display: "flex",
                    gap: "10px",
                    alignItems: "baseline",
                    position: "absolute",
                    padding: "0 40px",
                    zIndex: 10,
                    transform: `rotateX(${flipRotation}deg) translateY(${interpolate(flipSpr, [0, 1], [0, -100])}px)`,
                    opacity: flipOpacity,
                    backfaceVisibility: "hidden"
                }}>
                    {words1.map((word, i) => {
                        const isPeriod = word === ".";
                        const isFirst = i === 0;
                        const startFrame = i * stagger;

                        if (isPeriod) {
                            const spr = spring({
                                frame: frame - startFrame,
                                fps,
                                config: { stiffness: 800, damping: 20, mass: 0.8 }
                            });
                            return (
                                <div key={i} style={{
                                    fontSize: "100px", fontWeight: 400, color: "#000", fontFamily: "EB Garamond, serif",
                                    transform: `scale(${interpolate(spr, [0, 1], [6, 1])})`,
                                    opacity: interpolate(spr, [0, 0.15], [0, 1]),
                                    marginLeft: "-35px"
                                }}>.</div>
                            );
                        }

                        const spr = spring({ frame: frame - startFrame, fps, config: { damping: 15, stiffness: 200 } });
                        const translateY = isFirst ? 0 : interpolate(spr, [0, 1], [140, 0]);
                        const scale = isFirst ? interpolate(spr, [0, 1], [0.8, 1]) : 1;
                        const blur = interpolate(spr, [0, 0.8, 1], [isFirst ? 30 : 20, 5, 0]);
                        const opacity = interpolate(spr, [0, 0.4], [0, 1]);

                        const colorProgress = spring({
                            frame: frame - startFrame - 8,
                            fps,
                            config: { damping: 20, stiffness: 100 }
                        });
                        const currentColor = isFirst ? "#000000" : interpolateColors(colorProgress, [0, 1], [themeColors[i], "#000000"]);
                        const width = interpolate(spr, [0, 1], [0, [265, 165, 180, 415][i]]);

                        return (
                            <div key={i} style={{ overflow: "hidden", width, display: "flex", justifyContent: "flex-start", paddingLeft: isFirst ? "15px" : 0, opacity }}>
                                <div style={{
                                    transform: `translateY(${translateY}px) scale(${scale})`,
                                    fontSize: "100px", fontWeight: 400, color: currentColor, fontFamily: "EB Garamond, serif",
                                    letterSpacing: "-2px", whiteSpace: "nowrap", filter: `blur(${blur}px)`
                                }}>{word}</div>
                            </div>
                        );
                    })}
                </div>

                {/* Tagline 2 */}
                <div style={{
                    display: "flex",
                    gap: "10px",
                    alignItems: "baseline",
                    position: "absolute",
                    padding: "0 40px",
                    zIndex: 11,
                    transform: `rotateX(${flipInRotation}deg) translateY(${interpolate(flipSpr, [0, 1], [100, 0])}px) scale(${taglineExitScale})`,
                    opacity: flipInOpacity * taglineExitOpacity,
                    backfaceVisibility: "hidden"
                }}>
                    {words2.map((word, i) => {
                        const isSMS = word === "SMS";
                        const containerWidth = isSMS ? interpolate(flip2Spr, [0, 1], [175, 215]) : "auto";
                        return (
                            <div key={i} style={{ position: "relative", width: containerWidth }}>
                                {/* Original Word (SMS) */}
                                <div style={{
                                    fontSize: "100px",
                                    fontWeight: 400,
                                    color: isSMS ? "#22c55e" : "#000",
                                    fontFamily: "EB Garamond, serif",
                                    letterSpacing: "-2px",
                                    whiteSpace: "nowrap",
                                    transform: isSMS ? `rotateX(${smsFlipRotation}deg)` : "none",
                                    opacity: isSMS ? smsOpacity : 1,
                                    backfaceVisibility: "hidden"
                                }}>
                                    {word}
                                </div>

                                {/* Replacement Word (Email) */}
                                {isSMS && (
                                    <div style={{
                                        position: "absolute",
                                        top: 0,
                                        left: 0,
                                        fontSize: "100px",
                                        fontWeight: 400,
                                        color: "#ff1f1f",
                                        fontFamily: "EB Garamond, serif",
                                        letterSpacing: "-2px",
                                        whiteSpace: "nowrap",
                                        transform: `rotateX(${emailFlipRotation}deg)`,
                                        opacity: emailOpacity,
                                        backfaceVisibility: "hidden"
                                    }}>
                                        Email
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {/* Icon Container */}
                    <div style={{ position: "relative", width: 80, marginLeft: "15px" }}>
                        {/* Animated SMS Icon */}
                        {(() => {
                            const iconDelay = flipStart + 25;
                            const spr = spring({
                                frame: frame - iconDelay,
                                fps,
                                config: { stiffness: 600, damping: 20, mass: 0.5 }
                            });
                            const scale = interpolate(spr, [0, 1], [0, 1]);
                            const opacity = interpolate(spr, [0, 0.15], [0, 1]);

                            const exitSpr = spring({
                                frame: frame - flip2Start,
                                fps,
                                config: { stiffness: 600, damping: 30 }
                            });
                            const exitScale = interpolate(exitSpr, [0, 1], [1, 0]);
                            const exitOpacity = interpolate(exitSpr, [0, 0.2], [1, 0]);

                            return (
                                <div style={{
                                    opacity: opacity * exitOpacity,
                                    transform: `scale(${scale * exitScale}) translateY(15px)`,
                                    display: "flex",
                                    alignItems: "center"
                                }}>
                                    <MessageSquare size={80} color="#22c55e" strokeWidth={1.5} />
                                </div>
                            );
                        })()}

                        {/* Animated Email Icon (Phase 3) */}
                        {(() => {
                            const iconDelay = flip2Start + 17;
                            const spr = spring({
                                frame: frame - iconDelay,
                                fps,
                                config: { stiffness: 600, damping: 20, mass: 0.5 }
                            });
                            const scale = interpolate(spr, [0, 1], [0, 1]);
                            const fadeInOpacity = interpolate(spr, [0, 0.15], [0, 1]);
                            const opacity = fadeInOpacity * taglineExitOpacity;
                            const finalEmailScale = scale * taglineExitScale;

                            // Dot notification
                            const dotStart = 127;
                            const dotSpr = spring({
                                frame: frame - dotStart,
                                fps,
                                config: { stiffness: 800, damping: 20 }
                            });
                            const dotScale = interpolate(dotSpr, [0, 1], [0, 1]);

                            return (
                                <div style={{
                                    position: "absolute",
                                    top: 0,
                                    left: 0,
                                    opacity,
                                    transform: `scale(${finalEmailScale}) translateY(15px)`,
                                    display: "flex",
                                    alignItems: "center"
                                }}>
                                    <Mail size={80} color="#ff1f1f" strokeWidth={1.5} />

                                    {/* Red Notification Dot */}
                                    <div style={{
                                        position: "absolute",
                                        top: -5,
                                        right: -5,
                                        width: 32,
                                        height: 32,
                                        background: "#ff1f1f",
                                        borderRadius: "50%",
                                        border: "3px solid #fff",
                                        display: "flex",
                                        justifyContent: "center",
                                        alignItems: "center",
                                        transform: `scale(${dotScale})`,
                                        boxShadow: "0 4px 12px rgba(255, 31, 31, 0.3)"
                                    }}>
                                        <span style={{ color: "white", fontSize: "16px", fontWeight: 900, fontFamily: "Inter, sans-serif" }}>1</span>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                </div>

                {/* Cursor Section */}
                {(() => {
                    const cursorReveal = 137;
                    const clickEase = spring({
                        frame: frame - clickFrame,
                        fps,
                        config: { stiffness: 1500, damping: 15 }
                    });

                    const cursorSpr = spring({
                        frame: frame - cursorReveal,
                        fps,
                        config: { damping: 18, stiffness: 350 }
                    });

                    const targetX = 1460;
                    const targetY = 560;

                    const cursorX = interpolate(cursorSpr, [0, 1], [1800, targetX]);
                    const cursorY = interpolate(cursorSpr, [0, 1], [900, targetY]);
                    const cursorFadeIn = interpolate(frame, [cursorReveal, cursorReveal + 10], [0, 1]);
                    const cursorOpacity = cursorFadeIn * taglineExitOpacity;

                    const clickScale = interpolate(clickEase, [0, 0.3, 1], [1, 0.6, 1]);
                    const clickRotate = interpolate(clickEase, [0, 0.3, 1], [0, -15, 0]);
                    const finalCursorScale = clickScale * taglineExitScale;

                    // Ripple Effect
                    const rippleSpr = spring({
                        frame: frame - clickFrame,
                        fps,
                        config: { stiffness: 400, damping: 25 }
                    });
                    const rippleOpacity = interpolate(rippleSpr, [0, 0.6, 1], [0, 0.8, 0]);
                    const rippleRingScale = interpolate(rippleSpr, [0, 1], [0.1, 4.0]);
                    const rippleCoreScale = interpolate(rippleSpr, [0, 1], [0.1, 2.0]);

                    return (
                        <>
                            {/* Click Ripple: Outer Ring */}
                            <div style={{
                                position: "absolute",
                                top: targetY,
                                left: targetX,
                                width: 40,
                                height: 40,
                                borderRadius: "50%",
                                border: "4px solid #fff",
                                opacity: rippleOpacity,
                                transform: `translate(-50%, -50%) scale(${rippleRingScale})`,
                                pointerEvents: "none",
                                zIndex: 99,
                                boxShadow: "0 0 15px rgba(255,255,255,0.5)"
                            }} />

                            {/* Click Ripple: Inner Red Core */}
                            <div style={{
                                position: "absolute",
                                top: targetY,
                                left: targetX,
                                width: 40,
                                height: 40,
                                borderRadius: "50%",
                                background: "#ff1f1f",
                                opacity: rippleOpacity * 0.7,
                                transform: `translate(-50%, -50%) scale(${rippleCoreScale})`,
                                pointerEvents: "none",
                                zIndex: 98,
                                filter: "blur(4px)"
                            }} />

                            {/* Cursor */}
                            <div style={{
                                position: "absolute",
                                top: cursorY,
                                left: cursorX,
                                opacity: cursorOpacity,
                                transform: `scale(${finalCursorScale}) rotate(${clickRotate}deg)`,
                                zIndex: 100,
                                pointerEvents: "none",
                                filter: "drop-shadow(0_4px_12px_rgba(0,0,0,0.15))"
                            }}>
                                <MousePointer2 size={45} color="black" fill="white" />
                            </div>
                        </>
                    );
                })()}

                {/* Floating Marketing Email (Phase 3 - Pop in at Center) */}
                {(() => {
                    const mockupStart = clickFrame + 16;
                    const popSpr = spring({
                        frame: frame - mockupStart,
                        fps,
                        config: { stiffness: 600, damping: 35 }
                    });

                    const entranceOpacity = interpolate(popSpr, [0, 0.2], [0, 1]);
                    const popScale = interpolate(popSpr, [0, 1], [0, 1]);
                    const popX = interpolate(popSpr, [0, 1], [500, 0]); // targetX (1460) - center (960)
                    const popY = interpolate(popSpr, [0, 1], [20, 0]);  // targetY (560) - center (540)
                    const rotate = interpolate(popSpr, [0, 1], [-5, 0]);

                    // Ripple for Wallet Button
                    const walletRippleSpr = spring({
                        frame: frame - walletClickFrame,
                        fps,
                        config: { stiffness: 300, damping: 30 }
                    });
                    const walletRippleOpacity = interpolate(walletRippleSpr, [0, 0.5, 1], [0, 0.5, 0]);
                    const walletRippleScale = interpolate(walletRippleSpr, [0, 1], [0.5, 3]);

                    return (
                        <div style={{
                            pointerEvents: "none",
                            opacity: entranceOpacity * fallOpacity,
                            transform: `translate(${popX}px, ${popY}px) scale(${popScale}) rotate(${rotate + fallRotate}deg) translateY(${fallY}px)`,
                            position: "relative",
                            zIndex: 20
                        }}>
                            <div key="marketing-email" style={{
                                width: 520,
                                background: "white",
                                borderRadius: "32px",
                                boxShadow: "0 40px 120px rgba(0,0,0,0.25)",
                                overflow: "hidden",
                                display: "flex",
                                flexDirection: "column",
                                border: "1px solid rgba(0,0,0,0.05)"
                            }}>
                                {/* Email Header */}
                                <div style={{ padding: "24px 32px", borderBottom: "1px solid rgba(0,0,0,0.03)", background: "#f8fafc" }}>
                                    <div style={{ fontSize: "12px", fontWeight: 700, color: "#94a3b8", display: "flex", gap: "12px", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "1px" }}>
                                        <span style={{ width: 25, flexShrink: 0 }}>To:</span>
                                        <span style={{ color: "#475569" }}>Valued Member</span>
                                    </div>
                                    <div style={{ fontSize: "12px", fontWeight: 700, color: "#94a3b8", display: "flex", gap: "12px", textTransform: "uppercase", letterSpacing: "1px" }}>
                                        <span style={{ width: 25, flexShrink: 0 }}>Re:</span>
                                        <span style={{ color: "#475569" }}>Exclusive Weekend Brunch Invite! ✨</span>
                                    </div>
                                </div>

                                {/* Hero Image */}
                                <div style={{ width: "100%", height: 260, overflow: "hidden" }}>
                                    <Img
                                        src={staticFile("marketing-email.png")}
                                        style={{
                                            width: "100%",
                                            height: "100%",
                                            objectFit: "cover"
                                        }}
                                        draggable={false}
                                    />
                                </div>

                                {/* Email Content */}
                                <div style={{ padding: "40px", textAlign: "center" }}>
                                    <div style={{ fontSize: "32px", fontWeight: 400, color: "#1e293b", fontFamily: "EB Garamond, serif", marginBottom: "16px", lineHeight: 1.2 }}>
                                        Fresh Brews & Better Mornings
                                    </div>

                                    <div style={{ fontSize: "16px", color: "#64748b", lineHeight: 1.6, marginBottom: "32px" }}>
                                        We've missed you! Use this exclusive digital pass for a complimentary treat with your next visit.
                                    </div>

                                    {/* Wallet Buttons (Center aligned inside) */}
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", justifyContent: "center", position: "relative" }}>
                                        <div style={{ height: 54, position: "relative" }}>
                                            <Img src={staticFile("apple-wallet.svg")} style={{
                                                height: "100%",
                                                width: "auto",
                                                transform: `scale(${interpolate(walletClickEase, [0, 0.5, 1], [1, 0.9, 1])})`
                                            }} />
                                        </div>
                                        <div style={{ height: 54 }}>
                                            <Img src={staticFile("google-wallet.svg")} style={{ height: "100%", width: "auto" }} />
                                        </div>

                                        {/* Local Ripple for Wallet */}
                                        <div style={{
                                            position: "absolute",
                                            top: 27,
                                            left: 130, // Rough center of Apple Wallet button
                                            width: 80,
                                            height: 80,
                                            background: "rgba(0,0,0,0.1)",
                                            borderRadius: "50%",
                                            transform: `translate(-50%, -50%) scale(${walletRippleScale})`,
                                            opacity: walletRippleOpacity,
                                            zIndex: 10
                                        }} />
                                    </div>
                                </div>
                            </div>

                            {/* Second Cursor (Specifically for Apple Wallet) */}
                            {(() => {
                                const secondCursorReveal = walletClickFrame - 10;
                                const cursorHide = walletClickFrame + 20;

                                const secondCursorX = interpolate(frame, [secondCursorReveal, walletClickFrame], [400, 130], {
                                    extrapolateRight: "clamp",
                                    easing: Easing.out(Easing.quad) // Fluid movement
                                });
                                const secondCursorY = interpolate(frame, [secondCursorReveal, walletClickFrame], [650, 560], {
                                    extrapolateRight: "clamp",
                                    easing: Easing.out(Easing.quad) // Fluid movement
                                });
                                const opacity = interpolate(frame, [secondCursorReveal, secondCursorReveal + 5, cursorHide, cursorHide + 10], [0, 1, 1, 0]);
                                const clickS = interpolate(walletClickEase, [0, 0.5, 1], [1, 0.7, 1]);

                                return (
                                    <div style={{
                                        position: "absolute",
                                        top: secondCursorY,
                                        left: secondCursorX,
                                        opacity,
                                        transform: `scale(${clickS})`,
                                        zIndex: 100,
                                        filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.15))"
                                    }}>
                                        <MousePointer2 size={45} color="black" fill="white" />
                                    </div>
                                );
                            })()}
                        </div>
                    );
                })()}
                {/* Final Glassy Rewards Card */}
                {frame >= successStart && (
                    <AbsoluteFill style={{
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        flexDirection: "column",
                        gap: "40px",
                        pointerEvents: "none",
                        zIndex: 100,
                        opacity: successOpacity * finalExitOpacity,
                        transform: `scale(${finalExitScale})`
                    }}>
                        {/* The Reward Card */}
                        <div style={{
                            width: 580,
                            height: 360,
                            borderRadius: "44px",
                            background: "linear-gradient(135deg, rgba(34, 197, 94, 0.25) 0%, rgba(255, 255, 255, 0.6) 50%, rgba(34, 197, 94, 0.15) 100%)",
                            backdropFilter: "blur(80px) saturate(200%)",
                            WebkitBackdropFilter: "blur(80px) saturate(200%)",
                            border: "1px solid rgba(255, 255, 255, 0.6)",
                            boxShadow: "0 40px 100px rgba(0,0,0,0.18)",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "space-between",
                            padding: "48px",
                            opacity: successOpacity,
                            transform: `translate(${successTranslateX}px, ${successTranslateY}px) scale(${successScale}) rotateX(${interpolate(successSpr, [0, 1], [15, 0])}deg)`,
                            position: "relative",
                            overflow: "hidden"
                        }}>
                            {/* Card Glow Edge */}
                            <div style={{
                                position: "absolute",
                                top: -100,
                                right: -100,
                                width: 250,
                                height: 250,
                                background: "radial-gradient(circle, rgba(34, 197, 94, 0.4) 0%, transparent 70%)",
                                zIndex: -1
                            }} />

                            {/* Card Header */}
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", width: "100%" }}>
                                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                    <h2 style={{
                                        fontSize: "42px",
                                        fontWeight: 800,
                                        color: "#1e293b",
                                        fontFamily: "Inter, sans-serif",
                                        margin: 0,
                                        letterSpacing: "-1.5px"
                                    }}>
                                        Linden Café
                                    </h2>
                                    <div style={{
                                        fontSize: "13px",
                                        color: "#22c55e",
                                        fontWeight: 800,
                                        textTransform: "uppercase",
                                        letterSpacing: "2.5px"
                                    }}>
                                        Moments
                                    </div>
                                </div>
                                <div style={{
                                    marginTop: "10px"
                                }}>
                                    <Coffee size={60} color="#22c55e" strokeWidth={2} />
                                </div>
                            </div>

                            {/* Card Center Detail */}
                            <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                                <div style={{ fontSize: "56px", fontWeight: 400, color: "#0f172a", fontFamily: "EB Garamond, serif", lineHeight: 1, letterSpacing: "-1.5px" }}>
                                    10% OFF <span style={{ color: "#22c55e" }}>EARNED</span>
                                </div>
                                <div style={{ fontSize: "16px", color: "#64748b", marginTop: "12px", display: "flex", gap: "8px", alignItems: "center" }}>
                                    Your digital pass is now in your Apple Wallet
                                </div>
                            </div>

                            {/* Card Footer */}
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                                <div style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "10px",
                                    marginBottom: "10px"
                                }}>
                                    <Star size={36} color="#22c55e" fill="#22c55e" strokeWidth={0} />
                                    <span style={{
                                        fontSize: "28px",
                                        fontWeight: 800,
                                        color: "#334155",
                                        fontFamily: "Inter, sans-serif"
                                    }}>
                                        1,250
                                    </span>
                                </div>

                                <div style={{
                                    width: 80,
                                    height: 80,
                                    background: "white",
                                    padding: "6px",
                                    borderRadius: "12px",
                                    boxShadow: "0 8px 20px rgba(0,0,0,0.06)",
                                    display: "flex",
                                    justifyContent: "center",
                                    alignItems: "center",
                                    overflow: "hidden"
                                }}>
                                    <Img
                                        src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://swftly.app&bgcolor=ffffff&color=0f172a&margin=0"
                                        style={{ width: "100%", height: "100%", objectFit: "contain" }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Animated Tagline */}
                        <div style={{
                            fontSize: "44px",
                            fontWeight: 400,
                            color: "#0f172a",
                            fontFamily: "EB Garamond, serif",
                            opacity: finalTaglineOpacity,
                            filter: `blur(${finalTaglineBlur}px)`,
                            transform: `translateY(${finalTaglineY}px)`,
                            letterSpacing: "-1px"
                        }}>
                            Create custom digital passes.
                        </div>
                    </AbsoluteFill>
                )}

                {/* Floating Glassy Promo Messages */}
                {(() => {
                    const messages = [
                        { text: "SUMMER SALE IS LIVE! ☀️", x: "12%", delay: 0 },
                        { text: "GET 50% OFF TODAY ONLY!", x: "72%", delay: 25 },
                        { text: "USE CODE: SWFTLY 🚀", x: "38%", delay: 12 },
                        { text: "BOGO FREE ON ALL ITEMS! 🛍️", x: "18%", delay: 35 },
                        { text: "NEW ARRIVALS JUST DROPPED! ✨", x: "62%", delay: 48 }
                    ];

                    return messages.map((m, idx) => {
                        const localStart = flipStart + 10 + m.delay;
                        const floatSpr = spring({
                            frame: frame - localStart,
                            fps,
                            config: { damping: 35, stiffness: 25 } // Slower, more graceful float
                        });

                        // Float higher: from bottom to well above center
                        const translateY = interpolate(floatSpr, [0, 1], [850, -350]);
                        const opacity = interpolate(floatSpr, [0, 0.05, 0.9, 1], [0, 1, 1, 0]);
                        const scale = interpolate(floatSpr, [0, 1], [0.9, 1.1]);

                        const driftY = Math.sin((frame - localStart) / 20) * 20;
                        const driftX = Math.cos((frame - localStart) / 25) * 15;

                        return (
                            <div key={idx} style={{
                                position: "absolute",
                                left: m.x,
                                bottom: "10%",
                                transform: `translate(${driftX}px, ${translateY + driftY}px) scale(${scale})`,
                                opacity,
                                padding: "24px 40px",
                                background: "rgba(255, 255, 255, 0.45)",
                                backdropFilter: "blur(16px)",
                                borderRadius: "30px",
                                border: "1px solid rgba(255, 255, 255, 0.6)",
                                boxShadow: "0 12px 40px rgba(0,0,0,0.06)",
                                zIndex: 5,
                                display: "flex",
                                alignItems: "center"
                            }}>
                                <span style={{
                                    color: "#1e293b",
                                    fontSize: "24px",
                                    fontWeight: 800,
                                    fontFamily: "Inter, sans-serif",
                                    letterSpacing: "-0.5px",
                                    whiteSpace: "nowrap"
                                }}>
                                    {m.text}
                                </span>
                            </div>
                        );
                    });
                })()}
            </AbsoluteFill>
        </AbsoluteFill>
    );
};

const FinalConclusionScene = () => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    // Animate swftly.app text in after logo has landed
    const linkStartFrame = 80;
    const linkSpr = spring({
        frame: frame - linkStartFrame,
        fps,
        config: { damping: 15, stiffness: 80 }
    });

    const linkOpacity = interpolate(linkSpr, [0, 1], [0, 1]);
    const linkY = interpolate(linkSpr, [0, 1], [20, 0]);

    return (
        <AbsoluteFill style={{
            background: `linear-gradient(135deg, #0a0a1a 0%, #170ba3 100%)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "Inter, system-ui, sans-serif",
            overflow: "hidden"
        }}>
            <AmbientGlow color="#ffffff" delay={0} x="50%" />
            <AmbientGlow color="#3b82f6" delay={4} x="40%" />
            <AmbientGlow color="#6366f1" delay={8} x="60%" />
            <AmbientGlow color="#8b5cf6" delay={12} x="50%" />

            <div style={{ zIndex: 10, position: "absolute", top: "65%", width: "100%", display: "flex", justifyContent: "center" }}>
                <CinematicTitle text="Swftly does it all." textColor="#fff" delay={10} />
            </div>

            <ThreeLogoRemotion />

            {/* swftly.app Call to Action */}
            <div style={{
                position: "absolute",
                top: "75%",
                width: "100%",
                display: "flex",
                justifyContent: "center",
                zIndex: 20,
                opacity: linkOpacity,
                transform: `translateY(${linkY}px)`
            }}>
                <span style={{
                    color: "rgba(255, 255, 255, 0.8)",
                    fontSize: "24px",
                    fontWeight: 600,
                    letterSpacing: "2px",
                    fontFamily: "Inter, sans-serif",
                    fontStyle: "italic"
                }}>
                    swftly.app
                </span>
            </div>
        </AbsoluteFill>
    );
};

export const WebsiteVideo: React.FC = () => {
    return (
        <AbsoluteFill style={{ backgroundColor: BLUE }}>
            <Series>
                <Series.Sequence durationInFrames={70}>
                    <UploadScene />
                </Series.Sequence>

                <Series.Sequence durationInFrames={SCENE_DURATION + 26}>
                    <ExtractionScene />
                </Series.Sequence>



                <Series.Sequence durationInFrames={101}>
                    <InventoryScene />
                </Series.Sequence>

                <Series.Sequence durationInFrames={77}>
                    <AppDashboardScene />
                </Series.Sequence>

                <Series.Sequence durationInFrames={293}>
                    <MarketingTaglineScene />
                </Series.Sequence>

                <Series.Sequence durationInFrames={330}>
                    <FinalConclusionScene />
                </Series.Sequence>
            </Series>
        </AbsoluteFill>
    );
};

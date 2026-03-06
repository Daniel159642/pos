import React from "react";
import {
    AbsoluteFill,
    interpolate,
    spring,
    useCurrentFrame,
    useVideoConfig,
    Easing,
    staticFile,
    Audio,
} from "remotion";
import { MousePointer2 } from "lucide-react";
import { mouseClick } from "@remotion/sfx";

export const MacDock: React.FC<{ show?: 'dock' | 'cursor' | 'all' }> = ({ show = 'all' }) => {
    const frame = useCurrentFrame();
    const { fps, width, height } = useVideoConfig();

    // 1. Entrance logic
    const dockEntry = spring({
        frame: frame - 5,
        fps,
        config: { damping: 18, stiffness: 180 },
    });
    const dockY = interpolate(dockEntry, [0, 1], [150, 0]);

    // 2. Faster Initial Mouse movement (To App Icon)
    const mouseProgress1 = interpolate(frame, [20, 65], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.bezier(0.4, 0, 0.2, 1),
    });

    const startX = width / 2 + 500;
    const startY = height + 200;
    const appIconX = width / 2; // Center-aligned for Swftly hero launch
    const appIconY = height - 85;

    // 3. Second Mouse movement (To Shipment/Inventory Bento)
    // Starts exactly after window opening animation (frame 65 + 35) settles
    const mouseProgress2 = interpolate(frame, [105, 145], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.bezier(0.4, 0, 0.2, 1),
    });

    // Approximation for Inventory Bento (Left side, bottom-ish)
    const shipmentX = width * 0.24;
    const shipmentY = height * 0.72;

    const mouseExitScale = interpolate(frame, [153, 163], [1, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.in(Easing.back(1.7))
    });

    const currentMouseX = frame < 105
        ? interpolate(mouseProgress1, [0, 1], [startX, appIconX])
        : frame < 165
            ? interpolate(mouseProgress2, [0, 1], [appIconX, shipmentX])
            : shipmentX;

    const currentMouseY = frame < 105
        ? interpolate(mouseProgress1, [0, 1], [startY, appIconY])
        : frame < 165
            ? interpolate(mouseProgress2, [0, 1], [appIconY, shipmentY])
            : shipmentY;

    // 4. Click animations
    const click1 = spring({
        frame: frame - 65,
        fps,
        config: { damping: 12, stiffness: 200 },
    });

    const click2 = spring({
        frame: frame - 150,
        fps,
        config: { damping: 10, stiffness: 200 },
    });

    // Combined click scale effect + Exit scale
    const mouseScale = interpolate(click1, [0, 0.2, 0.5], [1, 0.8, 1], { extrapolateRight: "clamp" })
        * interpolate(click2, [0, 0.2, 0.5], [1, 0.8, 1], { extrapolateRight: "clamp" })
        * mouseExitScale;

    // 5. Dock Persistence (No longer disappears)
    const dockScale = 1;
    const dockOpacity = interpolate(frame, [5, 20], [0, 1]); // Fades in early in intro scene

    // More subtle Swftly Icon press effect
    const swftlyIconScale = interpolate(click1, [0, 0.2, 0.6, 1], [1, 0.92, 1.08, 1], {
        extrapolateRight: "clamp"
    });

    const apps = [
        { color: "255, 107, 150", gradient: "linear-gradient(145deg, rgba(255,107,150,0.6), rgba(255,107,150,0.2))" }, // Rose Glass
        { color: "255, 180, 0", gradient: "linear-gradient(145deg, rgba(255,180,0,0.6), rgba(255,180,0,0.2))" }, // Amber Glass
        { icon: staticFile("app-logo.png"), isSwftly: true, color: "0, 102, 255", gradient: "linear-gradient(145deg, rgba(0,102,255,0.7), rgba(0,102,255,0.3))" }, // Swftly Hero
        { color: "0, 210, 160", gradient: "linear-gradient(145deg, rgba(0,210,160,0.6), rgba(0,210,160,0.2))" }, // Emerald Glass
        { color: "155, 89, 255", gradient: "linear-gradient(145deg, rgba(155,89,255,0.6), rgba(155,89,255,0.2))" }, // Purple Glass
    ];

    return (
        <AbsoluteFill style={{ pointerEvents: "none" }}>
            {/* Click SFX */}
            {show !== 'dock' && (
                <>
                    {frame === 65 && <Audio src={mouseClick} />}
                    {frame === 150 && <Audio src={mouseClick} />}
                </>
            )}

            {/* Dock Container */}
            {show !== 'cursor' && (
                <div
                    style={{
                        position: "absolute",
                        bottom: 30,
                        left: "50%",
                        transform: `translateX(-50%) translateY(${dockY}px) scale(${dockScale})`,
                        opacity: dockOpacity,
                        height: 104,
                        background: "rgba(255, 255, 255, 0.25)",
                        backdropFilter: "blur(40px) saturate(2)",
                        borderRadius: 32,
                        display: "flex",
                        alignItems: "center",
                        padding: "0 24px",
                        gap: 14,
                        border: "1px solid rgba(255, 255, 255, 0.45)",
                        boxShadow: "0 30px 60px -15px rgba(0, 0, 0, 0.2)",
                        zIndex: 150,
                    }}
                >
                    {apps.map((app, i) => (
                        <div key={i} style={{
                            width: 72,
                            height: 72,
                            position: "relative",
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            transform: app.isSwftly ? `scale(${swftlyIconScale})` : "none",
                        }}>
                            {/* Colorful Glassy Container */}
                            <div style={{
                                position: "absolute",
                                inset: 0,
                                borderRadius: 20,
                                border: `2px solid rgba(${app.color}, 0.5)`,
                                background: app.gradient,
                                backdropFilter: "blur(10px) saturate(1.5)",
                                zIndex: -1,
                                boxShadow: `0 8px 24px rgba(${app.color}, 0.25)`,
                                overflow: 'hidden'
                            }}>
                                {/* Subtle sheen highlight */}
                                <div style={{
                                    position: 'absolute',
                                    top: 0, left: 0, right: 0, height: '50%',
                                    background: 'linear-gradient(to bottom, rgba(255,255,255,0.2), transparent)',
                                }} />
                            </div>

                            {app.isSwftly ? (
                                <img src={app.icon} style={{
                                    width: "80%",
                                    height: "80%",
                                    objectFit: "contain",
                                    filter: "drop-shadow(0 4px 12px rgba(0, 0, 0, 0.25))"
                                }} />
                            ) : null}

                            {app.isSwftly && (
                                <div style={{
                                    position: "absolute",
                                    bottom: -14,
                                    width: 6,
                                    height: 6,
                                    background: "#0066ff",
                                    borderRadius: "50%",
                                    boxShadow: "0 0 10px rgba(0, 102, 255, 0.8)"
                                }} />
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Mouse Cursor (Persistent OS Style) */}
            {show !== 'dock' && (
                <div
                    style={{
                        position: "absolute",
                        left: currentMouseX,
                        top: currentMouseY,
                        transform: `translate(-15%, -15%) scale(${mouseScale})`,
                        zIndex: 300, // Top-most
                        color: "black",
                        filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.3))",
                    }}
                >
                    <div style={{ position: 'relative', width: 44, height: 54 }}>
                        <svg width="44" height="54" viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M2 2L2 28L8.5 21.5L12.5 31L16 29.5L12 20L20.5 20L2 2Z" fill="white" stroke="#111" strokeWidth="1.8" strokeLinejoin="round" />
                        </svg>
                    </div>
                </div>
            )}
        </AbsoluteFill>
    );
};

import React from "react";
import { AbsoluteFill, Series, useCurrentFrame, useVideoConfig, interpolate, Easing, spring } from "remotion";
import { CheckCircle, PackagePlus, DollarSign, AlertTriangle, Send } from "lucide-react";

import { IntroScene } from "./scenes/IntroScene";
import { DashboardScene } from "./scenes/DashboardScene";
import { BagsScene } from "./scenes/BagsScene";
import { MacDock } from "./components/MacDock";
import { ScannerOverlay } from "./components/ScannerOverlay";
import { FloatingLogoLayer } from "./components/FloatingLogoLayer";
import { MainProps } from "./schema";

export const Main: React.FC<MainProps> = ({
    brandName = "SWFTLY",
    brandColor = "#2c19fc",
    scannerStartFrame = 950,
}) => {
    const frame = useCurrentFrame();
    const { width, height } = useVideoConfig();

    // --- CINEMATIC CAMERA — synced to DashboardScene constants ---
    //   85  = shipmentClickFrame (bento click)
    //   129 = invoiceRiseSpring starts (cursor releases doc, begins rising)
    //   165 = invoiceRiseSpring settled (damping:15 stiffness:110 ≈ 36 frames)
    //   175 = highlightBase — first row scan starts
    //   280 = phaseA_End  — Row 6 red (issue found)
    //   285 = modal3Start — alert modal appears
    //   527 = clickFrameM3 — Send clicked
    //   551 = highlightC_Base — fast scan starts
    //   641 = highlightC_Base + stepC*9 — fast scan ends

    // Sync points from DashboardScene (local + 65): 
    // bentoClick(150), scanStart(217), modalOpen(304), sendClick(434), fastScanStart(458), scanEnd(538), sceneEnd(678)
    const lastScanGlobal = 538;
    const dashboardEnd = 678;

    const cameraZoom = interpolate(
        frame,
        // doc-drop  zoom-out  zoom-out  doc-risen  rows-start  Row6-STOP  ←zoom-out-for-MODAL  ←send-clicked  fastscan-in  fastscan-hold  last-scan
        [150, 164, 175, 217, 303, 315, 434, 458, 482, 538],
        [1.0, 0.82, 0.82, 1.75, 1.75, 1.05, 1.05, 1.60, 1.60, 1.0],
        {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.bezier(0.42, 0, 0.58, 1)
        }
    );


    // Subtle drift only while rows are actively scanning
    // Phase A rows: global 217-294. Fast scan: global 458-548
    const isScanning = (frame > 217 && frame < 294) || (frame > 458 && frame < 548);
    const hoverX = isScanning ? Math.sin(frame * 0.06) * 3 : 0;
    const hoverY = isScanning ? Math.cos(frame * 0.05) * 2 : 0;

    // X stays centered — document is centered in the window
    const cameraOriginX = width / 2 + hoverX;

    // Y origin — 3 phases with different easing per phase:
    //   Phase 1 (before scan):   smooth eased entry, locks on doc top at 217
    //   Phase 2 (scan 217→259): LINEAR constant speed glide — stops cold at Row 6
    //   Phase 3 (after Row 6):  smooth eased transitions for modal and fast scan
    //
    //   Row 6 global = highlightBase(152) + 6×step(11) = 218 local = 283 global
    const cameraOriginY = (() => {
        if (frame < 217) {
            return interpolate(
                frame,
                [129, 165, 217],
                [height * 0.52, height * 0.50, height * 0.18],
                { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.quad) }
            );
        }
        if (frame < 283) {
            // LINEAR glide — constant speed, stops cold at Row 6
            return interpolate(
                frame,
                [217, 283],
                [height * 0.18, height * 0.50],
                { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
            );
        }
        // After Row 6: hold then smooth modal/fast-scan transitions
        return interpolate(
            frame,
            [283, 304, 334, 458, 548],
            [height * 0.50, height * 0.52, height * 0.52, height * 0.38, height * 0.75],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.quad) }
        );
    })() + hoverY;


    // White fade: reaches full intensity at 577 (19.22s) then cuts to show next scene
    const exitOpacity = interpolate(frame, [lastScanGlobal + 10, 577, 578], [0, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

    return (
        <AbsoluteFill style={{ backgroundColor: '#fff' }}>
            {/* Main Application Window Layer (Scaled by Camera) */}
            <div style={{
                width: '100%',
                height: '100%',
                transform: `scale(${cameraZoom})`,
                transformOrigin: `${cameraOriginX}px ${cameraOriginY}px`,
                position: 'relative',
            }}>
                {/* OS DOCK LAYER — above intro scene, behind doc during dashboard */}
                {(frame < 577 || frame >= 777) && (
                    <div style={{ position: 'absolute', inset: 0, zIndex: frame < 65 ? 20 : 5 }}>
                        <MacDock show="dock" />
                    </div>
                )}

                {/* APPLICATION SCENE LAYER (Contains the Invoice) */}
                <div style={{ position: 'absolute', inset: 0, zIndex: 10 }}>
                    <Series>
                        {/* Phase 1: Intro (0-65) */}
                        <Series.Sequence durationInFrames={65}>
                            <IntroScene />
                        </Series.Sequence>

                        {/* Phase 2: Core Demo (65 → 577 global = 512 local frames) */}
                        <Series.Sequence durationInFrames={512}>
                            <DashboardScene />
                        </Series.Sequence>

                        {/* Phase 2.5: Scanner Scene (577 → 777 global = 200 frames) */}
                        <Series.Sequence durationInFrames={200}>
                            <ScannerOverlay
                                startFrame={0}
                                brandName={brandName}
                                brandColor={brandColor}
                            />
                        </Series.Sequence>

                        {/* Phase 3: Shipping Workflow (777+) */}
                        <Series.Sequence durationInFrames={2000}>
                            <BagsScene />
                        </Series.Sequence>
                    </Series>
                </div>

                {/* CURSOR LAYER — hidden during scanner scene */}
                {(frame < 577 || frame >= 777) && (
                    <div style={{ position: 'absolute', inset: 0, zIndex: 1000 }}>
                        <MacDock show="cursor" />
                    </div>
                )}
            </div>

            {/* Dashboard Cursor — Floating above camera-scaled layer if needed? 
                Actually MacDock 'all' includes cursor, so no separate cursor needed here. */}


            {/* EXIT TRANSITION OVERLAY */}
            {exitOpacity > 0 && (
                <AbsoluteFill style={{
                    backgroundColor: 'white',
                    opacity: exitOpacity,
                    zIndex: 2000,
                    pointerEvents: 'none'
                }} />
            )}

            {/* PERSISTENT 3D LOGO — always in front, above white fade */}
            <FloatingLogoLayer />

            {/* NOTIFICATION OVERLAY — outside camera zoom, always at screen coords */}
            {(() => {
                // All frames are GLOBAL. DashboardScene starts at global 65.
                // Phase A: highlightBase local=152 → global=217 | step=11
                // Phase C: highlightC_Base local=393 → global=458 | stepC=10
                // clickFrameM3 local=369 → global=434
                const HB = 217; // Phase A base (global)
                const ST = 11;  // Phase A step
                const HC = 458; // Phase C base (global) = highlightC_Base local(393)+65
                const STC = 10;  // Phase C step
                const SEND_FRAME = 434;
                const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", sans-serif';
                const BLUE = '#2c19fc';

                const SWFTLY_PATH = "M 100.70843,160.00743 c -3.281969,-3.905 -7.969358,-5.67688 -10.158465,-10.75651 -3.404128,-7.89895 3.005204,-14.76252 9.074232,-18.8786 6.759713,-4.5845 14.259513,-7.44695 21.901443,-10.12861 3.76218,-1.32021 8.21121,-1.81716 11.49284,-4.20629 4.4556,-3.24382 6.08189,-10.72567 4.55377,-15.95911 -4.94921,1.58822 -10.34123,2.20999 -15.39607,3.48929 -13.58384,3.43785 -27.808129,7.58306 -39.682817,15.32189 -2.641627,1.72157 -5.206826,3.65875 -7.353355,5.99464 -1.252993,1.36353 -2.367789,2.94161 -3.191788,4.60994 -5.203391,10.53514 5.608858,19.0483 13.580987,23.64656 4.776634,2.75513 9.947876,5.14358 15.179223,6.8668 M 107.6475,134.104 v 0.21952 c 2.56888,1.44926 5.00681,3.53626 6.99228,5.72396 6.12966,6.75398 4.65385,14.14545 -1.57113,20.17083 -7.3416,7.10619 -17.855093,10.78396 -27.322597,13.91094 -3.662956,1.20981 -8.07445,1.70072 -11.058981,4.35856 -4.581521,4.08002 -4.12024,9.71527 -4.12024,15.32579 6.19105,-0.27327 12.892491,-2.6296 18.865603,-4.22916 14.548785,-3.89608 31.853775,-8.58526 42.914925,-19.54174 1.40216,-1.38887 2.71988,-3.02626 3.66764,-4.76678 7.25254,-13.31882 -9.85806,-23.20162 -19.69366,-27.74089 -2.68757,-1.24035 -5.75437,-2.92212 -8.67384,-3.43103 z";

                const notifs = [
                    // Phase A — initial scan (rows 0-5)
                    { message: 'Added 6 units to inventory', sub: 'Stainless Stock Pot 20 Qt.', color: BLUE, pop: HB + ST * 0 + 4 },
                    { message: 'Restocked ×12', sub: "Chef's Knife 8\" Pro Series", color: BLUE, pop: HB + ST * 1 + 4 },
                    { message: 'Price updated', sub: 'Non-Stick Skillet 12" Ceramic', color: BLUE, pop: HB + ST * 2 + 4 },
                    { message: 'Added 10 units to inventory', sub: 'Magnetic Knife Strip 18"', color: BLUE, pop: HB + ST * 3 + 4 },
                    { message: 'Restocked ×15', sub: 'Silicone Utensil Set (6-Piece)', color: BLUE, pop: HB + ST * 4 + 4 },
                    { message: 'Price updated', sub: 'Instant-Read Thermometer', color: BLUE, pop: HB + ST * 5 + 4 },
                    // Row 6 — issue (holds until send)
                    { message: 'Mispricing Issue Detected', sub: 'Mixing Bowl Set · KP-BW-3302', color: '#dc2020', pop: HB + ST * 6 + 4, exitAt: SEND_FRAME },
                    // Send confirmation
                    { message: 'Email Sent', sub: 'KitchenPro Supply Co.', color: '#16a34a', pop: SEND_FRAME + 6 },
                    // Phase C — fast scan continuation (rows 7-15)
                    { message: 'Restocked ×24', sub: 'Half-Size Sheet Pan (Aluminum)', color: BLUE, pop: HC + STC * 0 + 4 },
                    { message: 'Added 8 units to inventory', sub: 'Commercial Peeler Set', color: BLUE, pop: HC + STC * 1 + 4 },
                    { message: 'Price updated', sub: 'Wire Mesh Strainer 8"', color: BLUE, pop: HC + STC * 2 + 4 },
                    { message: 'Restocked ×6', sub: 'Cast Iron Skillet 10"', color: BLUE, pop: HC + STC * 3 + 4 },
                    { message: 'Added 3 units to inventory', sub: 'Digital Kitchen Scale Pro', color: BLUE, pop: HC + STC * 4 + 4 },
                    { message: 'Price updated', sub: 'Stainless Steel Ladle Set', color: BLUE, pop: HC + STC * 5 + 4 },
                    { message: 'Restocked ×10', sub: 'Silicone Baking Mat Set', color: BLUE, pop: HC + STC * 6 + 4 },
                    { message: 'Added 5 units to inventory', sub: "Chef's Prep Cutting Board", color: BLUE, pop: HC + STC * 7 + 4 },
                    { message: 'Price updated', sub: 'Prep Station Organizer XL', color: BLUE, pop: HC + STC * 8 + 4 },
                ] as Array<{ message: string; sub: string; color: string; pop: number; exitAt?: number }>;

                // Collect currently-visible notifications and assign stack slot
                const visible: Array<{ n: typeof notifs[0]; enter: number; exit: number; slot: number }> = [];
                notifs.forEach((n) => {
                    const enter = spring({ frame: frame - n.pop, fps: 30, config: { damping: 22, stiffness: 320 } });
                    const exitStart = n.exitAt ?? (n.pop + 28);
                    const exit = interpolate(frame, [exitStart, exitStart + 14], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
                    if (enter > 0.01 && exit < 0.99) {
                        visible.push({ n, enter, exit, slot: visible.length });
                    }
                });

                const transitionExit = spring({
                    frame: frame - lastScanGlobal,
                    fps: 30,
                    config: { damping: 24, stiffness: 80 }
                });

                return visible.map(({ n, enter, exit, slot }) => {
                    const slideInX = interpolate(enter, [0, 1], [440, 0]);
                    const forceExitX = interpolate(transitionExit, [0, 1], [0, 600]);
                    const slideX = slideInX + forceExitX;
                    const opacity = enter * (1 - exit);
                    const topOffset = 48 + slot * 96;
                    const isError = n.color === '#dc2020';
                    // Gradient tinted toward notification color
                    const bg = isError
                        ? 'linear-gradient(135deg, rgba(255,255,255,0.88) 0%, rgba(220,32,32,0.08) 100%)'
                        : `linear-gradient(135deg, rgba(255,255,255,0.88) 0%, ${n.color}0D 100%)`;
                    return (
                        <div key={n.pop} style={{
                            position: 'absolute',
                            top: topOffset,
                            right: 44,
                            transform: `translateX(${slideX}px)`,
                            opacity,
                            pointerEvents: 'none',
                            zIndex: 99999,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 16,
                            background: bg,
                            backdropFilter: 'blur(40px) saturate(2.2) brightness(1.05)',
                            WebkitBackdropFilter: 'blur(40px) saturate(2.2) brightness(1.05)',
                            borderRadius: 22,
                            border: `1.5px solid ${n.color}50`,
                            boxShadow: `0 12px 40px rgba(0,0,0,0.13), 0 0 0 1px rgba(255,255,255,0.8), 0 4px 16px ${n.color}30`,
                            padding: '18px 26px 18px 20px',
                            minWidth: 370,
                            fontFamily: FONT,
                        }}>
                            {isError ? (
                                <AlertTriangle size={30} color={n.color} strokeWidth={2.3} style={{ flexShrink: 0 }} />
                            ) : (
                                <svg width="40" height="25" viewBox="38 100 130 100" style={{ flexShrink: 0 }}>
                                    <path fill={n.color} d={SWFTLY_PATH} />
                                </svg>
                            )}
                            <div>
                                <div style={{ fontSize: 18, fontWeight: 800, color: '#111', lineHeight: 1.2 }}>{n.message}</div>
                                <div style={{ fontSize: 13.5, color: '#555', marginTop: 4, fontWeight: 500, letterSpacing: '0.1px' }}>{n.sub}</div>
                            </div>
                        </div>
                    );
                });
            })()}
        </AbsoluteFill>
    );
};

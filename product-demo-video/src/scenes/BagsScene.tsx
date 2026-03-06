import React from 'react';
import {
    AbsoluteFill,
    interpolate,
    spring,
    useCurrentFrame,
    useVideoConfig,
    Img,
    staticFile,
    Easing,
} from 'remotion';
import {
    BookOpen,
    ArrowLeftRight,
    Library,
    FileBarChart,
    FileText,
    Users,
    Mail,
    MessageSquare,
    Wallet,
    Gift,
} from 'lucide-react';
import { ThreeCanvas } from "@remotion/three";
import { ThreeDLogo } from "../components/ThreeDLogo";
import { Environment } from "@react-three/drei";

const BRAND_BLUE = '#0066ff';
const APP_FONT_STACK = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const tankerFontUrl = "https://api.fontshare.com/v2/css?f[]=tanker@400&display=swap";

const CARDS = [
    {
        id: 'shopify',
        logoFile: 'shopify.svg',
        logoH: 22,
        themeColor: '#5A863E',
        accentRgb: '100,148,62',
        watermarkFile: 'shopify.svg',
        orderNumber: '#SP-3301',
        total: '$124.00',
        date: 'Today · 6:58 PM',
        status: 'Ready to Ship',
        items: ['Classic Hoodie ×2', 'Logo Tee ×1'],
        shipTo: { name: 'Jordan Williams', address: '91 Ocean Dr, Miami, FL 33139' },
        stagger: 0,
    },
    {
        id: 'doordash',
        logoFile: 'doordash.svg',
        logoH: 20,
        themeColor: '#FF3008',
        accentRgb: '255,48,8',
        watermarkFile: 'doordash.svg',
        orderNumber: '#DD-4821',
        total: '$38.50',
        date: 'Today · 7:14 PM',
        status: 'In Progress',
        items: ['Grilled Chicken Wrap ×1', 'Side Salad ×1', 'Lemonade ×2'],
        address: '482 Maple Ave, Brooklyn, NY 11203',
        driver: { name: 'Marcus T.', vehicle: 'Toyota Camry · Silver', eta: '12 min' },
        stagger: 14,
    },
    {
        id: 'ubereats',
        logoFile: 'ubereats.svg',
        logoH: 18,
        themeColor: '#06c167',
        accentRgb: '6,193,103',
        watermarkFile: 'ubereats.svg',
        orderNumber: '#UE-9174',
        total: '$52.75',
        date: 'Today · 7:02 PM',
        status: 'Out for Delivery',
        items: ['Margherita Pizza ×1', 'Garlic Bread ×2', 'Coke ×1'],
        address: '14 Riverview Ln, Jersey City, NJ 07302',
        driver: { name: 'Sofia R.', vehicle: 'Honda Civic · Black', eta: '8 min' },
        stagger: 28,
    },
] as const;

const ACCOUNTING_MODULES = [
    { id: 'coa', icon: BookOpen, label: 'Chart of Accounts', x: 200, y: 300 },
    { id: 'ledger', icon: Library, label: 'Ledger', x: 1400, y: 250 },
    { id: 'transactions', icon: ArrowLeftRight, label: 'Transactions', x: 1500, y: 700 },
    { id: 'statements', icon: FileBarChart, label: 'Financial Statements', x: 400, y: 800 },
    { id: 'invoices', icon: FileText, label: 'Invoices', x: 100, y: 600 },
    { id: 'payroll', icon: Users, label: 'Payroll', x: 1600, y: 500 },
];

const MARKETING_ITEMS = [
    { id: 'sms', icon: MessageSquare, label: 'SMS Marketing', image: 'sms.png' },
    { id: 'rewardsm', icon: Gift, label: 'Customer Rewards', image: 'rewardsm.png' },
    { id: 'rewards', icon: Gift, label: 'Digital Rewards', image: 'rewards.png' },
];

const CARD_WIDTH = 640;
const CARD_GAP = 24;

const Word: React.FC<{
    children: string;
    show: boolean;
    prog: number;
    stay?: boolean;
    color?: string;
}> = ({ children, show, prog, stay, color }) => {
    const opacity = stay ? 1 : show ? prog : (1 - prog);
    const yTranslate = stay ? 0 : show ? interpolate(prog, [0, 1], [10, 0]) : interpolate(prog, [0, 1], [0, -10]);
    if (!stay && ((show && prog < 0.01) || (!show && prog > 0.99))) return null;
    return (
        <span style={{
            display: 'inline-block', opacity,
            transform: `translateY(${yTranslate}px)`,
            color: color ?? 'inherit', margin: '0 0.15em',
        }}>
            {children}
        </span>
    );
};

export const BagsScene: React.FC = () => {
    const frame = useCurrentFrame();
    const { fps, width, height } = useVideoConfig();

    const headingProg = spring({ frame: frame - 8, fps, config: { damping: 22, stiffness: 160 } });
    const bagProg = spring({ frame: frame - 8, fps, config: { damping: 18, stiffness: 260 } });

    const cardsStart = 38;
    const cardProgs = CARDS.map((c) =>
        spring({ frame: frame - (cardsStart + c.stagger), fps, config: { damping: 22, stiffness: 200 } })
    );

    const exitStart = 80;
    const exitProgs = CARDS.map((c, i) =>
        spring({ frame: frame - (exitStart + (2 - i) * 10), fps, config: { damping: 24, stiffness: 120 } })
    );

    // Timing for the new sequence
    const ordersExitStart = 80;
    const ordersExitProg = spring({ frame: frame - ordersExitStart, fps, config: { damping: 24, stiffness: 100 } });

    // Accounting phase entrance (Closer to exit for "right after" feel)
    const accountingStart = 95;
    const accountingIntroProg = spring({ frame: frame - accountingStart, fps, config: { damping: 22, stiffness: 120 } });

    // Modules pop-in
    const modulePopStart = exitStart + 30;
    const modulePopProgs = ACCOUNTING_MODULES.map((_, i) =>
        spring({ frame: frame - (modulePopStart + i * 4), fps, config: { damping: 16, stiffness: 180 } })
    );

    // Modules move to grid
    const gridStart = modulePopStart + 60;
    const gridProg = spring({
        frame: frame - gridStart,
        fps,
        config: { damping: 24, stiffness: 100 }
    });

    // Marketing Transition
    const marketingStart = gridStart + 110;
    const marketingProg = spring({
        frame: frame - marketingStart,
        fps,
        config: { damping: 22, stiffness: 100 }
    });

    // Carousel Phase Logic
    // Phase 0: SMS (Hold)
    // Phase 1: Rewards (Flip at 340)
    // Phase 2: Wallets (Flip at 420)
    const phase1Start = marketingStart + 90;
    const phase2Start = marketingStart + 180;

    const p1Prog = spring({ frame: frame - phase1Start, fps, config: { damping: 24, stiffness: 100 } });
    const p2Prog = spring({ frame: frame - phase2Start, fps, config: { damping: 24, stiffness: 100 } });

    // Stepped rotation: 0 -> -90 -> -180
    const wheelRotation = (p1Prog * -90) + (p2Prog * -90);

    // Payment logos pop-in (Centered during phase 2)
    const logoPopStart = phase2Start + 50;
    const logoPopProg = spring({ frame: frame - logoPopStart, fps, config: { damping: 14, stiffness: 200 } });
    const logoShiftOut = spring({ frame: frame - (logoPopStart + 70), fps, config: { damping: 20, stiffness: 120 } });

    // Fade out logic for titles
    const title1Exit = p1Prog;
    const title2Exit = p2Prog;

    // Scene Exit
    const sceneExitStart = marketingStart + 1700; // Push exit much later for the final pitch
    const sceneExitProg = spring({
        frame: frame - sceneExitStart,
        fps,
        config: { damping: 20 }
    });

    // Final Pitch Transitions
    const finalPitchStart = phase2Start + 120; // Tightened sync
    const finalPitchProg = spring({
        frame: frame - finalPitchStart,
        fps,
        config: { damping: 22, stiffness: 100 }
    });

    const much2Start = finalPitchStart + 35;
    const much2Prog = spring({
        frame: frame - much2Start,
        fps,
        config: { damping: 12, stiffness: 200 }
    });

    const logoEntryStart = much2Start + 80;
    const logoEntryProg = spring({
        frame: frame - logoEntryStart,
        fps,
        config: { damping: 24, stiffness: 120 }
    });

    const finalInfoStart = logoEntryStart + 60;
    const finalInfoProg = spring({
        frame: frame - finalInfoStart,
        fps,
        config: { damping: 22, stiffness: 100 }
    });

    const totalW = CARDS.length * CARD_WIDTH + (CARDS.length - 1) * CARD_GAP;
    const cardsLeft = (width - totalW) / 2;

    const headingY = height * 0.28;

    return (
        <AbsoluteFill style={{ backgroundColor: 'white', fontFamily: APP_FONT_STACK, overflow: 'hidden' }}>
            <style>
                {`
                @import url('${tankerFontUrl}');
                
                .checkbox-wrapper-11 {
                    --text: #111;
                    --check: #0066ff;
                    --disabled: #999;
                    --border-radius: 10px;
                    border-radius: var(--border-radius);
                    position: relative;
                    padding: 8px;
                    display: grid;
                    grid-template-columns: 35px auto;
                    align-items: center;
                    width: 100%;
                    max-width: 450px;
                }
                .checkbox-wrapper-11 label {
                    color: var(--text);
                    position: relative;
                    cursor: pointer;
                    display: grid;
                    align-items: center;
                    width: fit-content;
                    transition: color 0.3s ease;
                    font-size: 32px;
                    font-weight: 700;
                    letter-spacing: -0.02em;
                }
                .checkbox-wrapper-11 label::before,
                .checkbox-wrapper-11 label::after {
                    content: "";
                    position: absolute;
                }
                .checkbox-wrapper-11 label::before {
                    height: 3px;
                    width: 0;
                    left: -32px;
                    background: var(--check);
                    border-radius: 2px;
                    transition: background 0.3s ease;
                    top: 50%;
                }
                .checkbox-wrapper-11 label:after {
                    height: 5px;
                    width: 5px;
                    top: 18px;
                    left: -28px;
                    border-radius: 50%;
                }
                .checkbox-wrapper-11 input[type=checkbox] {
                    -webkit-appearance: none;
                    -moz-appearance: none;
                    position: relative;
                    height: 22px;
                    width: 22px;
                    outline: none;
                    border: 2px solid #ddd;
                    margin: 0 15px 0 0;
                    cursor: pointer;
                    background: transparent;
                    display: grid;
                    align-items: center;
                    border-radius: 6px;
                }
                .checkbox-wrapper-11 input[type=checkbox]::before, .checkbox-wrapper-11 input[type=checkbox]::after {
                    content: "";
                    position: absolute;
                    height: 3px;
                    top: auto;
                    background: var(--check);
                    border-radius: 2px;
                }
                .checkbox-wrapper-11 input[type=checkbox]::before {
                    width: 0px;
                    right: 60%;
                    transform-origin: right bottom;
                }
                .checkbox-wrapper-11 input[type=checkbox]::after {
                    width: 0px;
                    left: 40%;
                    transform-origin: left bottom;
                }
                .checkbox-wrapper-11 input[type=checkbox]:checked {
                    border-color: var(--check);
                }
                .checkbox-wrapper-11 input[type=checkbox]:checked::before {
                    animation: check-01-11 0.4s ease forwards;
                }
                .checkbox-wrapper-11 input[type=checkbox]:checked::after {
                    animation: check-02-11 0.4s ease forwards;
                }
                .checkbox-wrapper-11 input[type=checkbox]:checked + label {
                    color: var(--disabled);
                    animation: move-11 0.3s ease 0.1s forwards;
                }
                .checkbox-wrapper-11 input[type=checkbox]:checked + label::before {
                    background: var(--disabled);
                    animation: slice-11 0.4s ease forwards;
                }
                .checkbox-wrapper-11 input[type=checkbox]:checked + label::after {
                    animation: firework-11 0.5s ease forwards 0.1s;
                }

                @keyframes move-11 {
                    50% { padding-left: 12px; }
                    100% { padding-left: 8px; }
                }
                @keyframes slice-11 {
                    60% { width: 100%; left: 0px; }
                    100% { width: 105%; left: -5px; }
                }
                @keyframes check-01-11 {
                    0% { width: 0; top: 12px; transform: rotate(45deg); }
                    100% { width: 8px; top: 12px; transform: rotate(45deg); }
                }
                @keyframes check-02-11 {
                    0% { width: 0; top: 12px; transform: rotate(-45deg); }
                    100% { width: 16px; top: 10px; transform: rotate(-45deg); }
                }
                @keyframes firework-11 {
                    0% { opacity: 1; box-shadow: 0 0 0 -2px #0066ff, 0 0 0 -2px #0066ff, 0 0 0 -2px #0066ff, 0 0 0 -2px #0066ff, 0 0 0 -2px #0066ff, 0 0 0 -2px #0066ff; }
                    30% { opacity: 1; }
                    100% { opacity: 0; box-shadow: 0 -20px 0 0px #0066ff, 18px -12px 0 0px #0066ff, 18px 12px 0 0px #0066ff, 0 20px 0 0px #0066ff, -18px 12px 0 0px #0066ff, -18px -12px 0 0px #0066ff; }
                }
                `}
            </style>

            {/* Heading Morph */}
            <div style={{
                position: 'absolute',
                top: headingY,
                left: 0, right: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: headingProg * (1 - sceneExitProg),
                transform: `translateY(${interpolate(headingProg, [0, 1], [28, 0])}px)`,
                filter: `blur(${interpolate(headingProg, [0, 1], [12, 0])}px)`,
                zIndex: 10,
            }}>
                <div style={{
                    fontSize: 56,
                    fontWeight: 800,
                    color: '#0d0d0d',
                    letterSpacing: '-0.035em',
                    lineHeight: 1.1,
                    textAlign: 'center',
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'center',
                }}>
                    {/* Part 1: Swftly puts all your orders in one place (Frame 8 -> 80) */}
                    {(frame < accountingStart + 20) && (
                        <div style={{
                            opacity: headingProg * (1 - ordersExitProg),
                            display: 'flex',
                            position: 'absolute',
                            justifyContent: 'center',
                            width: '100%',
                            filter: `blur(${ordersExitProg * 15}px)`,
                            transform: `scale(${1 + ordersExitProg * 0.1})`,
                        }}>
                            <Word stay show={true} prog={1}>Swftly</Word>
                            <Word stay show={true} prog={1}>puts</Word>
                            <Word stay show={true} prog={1}>all</Word>
                            <Word stay show={true} prog={1} color={BRAND_BLUE}>your</Word>
                            <Word stay show={true} prog={1}>orders</Word>
                            <Word stay show={true} prog={1}>in</Word>
                            <Word stay show={true} prog={1}>one</Word>
                            <Word stay show={true} prog={1}>place</Word>

                            {/* The Bag - now nested inside this relative group for better exit sync */}
                            {bagProg > 0.01 && (
                                <div style={{
                                    opacity: bagProg * (1 - ordersExitProg),
                                    transform: `scale(${interpolate(bagProg, [0, 1], [0.3, 1]) * (1 - ordersExitProg)}) rotate(${interpolate(bagProg, [0, 1], [-14, 0])}deg)`,
                                    transformOrigin: 'bottom center',
                                    marginBottom: 4,
                                    flexShrink: 0,
                                    marginLeft: 18,
                                    width: 120,
                                    height: 120,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <Img src={staticFile('bagg.png')} style={{
                                        width: '100%', height: '100%', objectFit: 'contain',
                                        filter: 'brightness(0) saturate(100%) invert(14%) sepia(93%) saturate(5000%) hue-rotate(237deg) brightness(90%)',
                                    }} />
                                </div>
                            )}
                        </div>
                    )}
                    {/* Flip Carousel Container */}
                    <div style={{
                        position: 'absolute',
                        inset: 0,
                        perspective: 1000,
                        transformStyle: 'preserve-3d',
                    }}>
                        {/* Part 1.5: Accounting (Flip out) */}
                        {(frame >= accountingStart && frame < marketingStart + 20) && (
                            <div style={{
                                opacity: accountingIntroProg * (1 - marketingProg),
                                display: 'flex',
                                position: 'absolute',
                                justifyContent: 'center',
                                width: '100%',
                                filter: `blur(${interpolate(accountingIntroProg, [0, 1], [12, 0])}px)`,
                                transform: `translateY(${interpolate(accountingIntroProg, [0, 1], [28, 0])}px) rotateX(${interpolate(marketingProg, [0, 1], [0, -90])}deg) translateZ(40px)`,
                                transformOrigin: 'center center',
                                backfaceVisibility: 'hidden',
                            }}>
                                {["Swftly", "keeps", "your", "accounting", "in", "check."].map((word, i) => (
                                    <Word key={i} stay show={true} prog={1} color="#000">
                                        {word}
                                    </Word>
                                ))}
                            </div>
                        )}

                        {/* Part 2: We even do your marketing (Flip in) */}
                        {(frame >= marketingStart && frame < phase1Start + 20) && (
                            <div style={{
                                opacity: marketingProg * (1 - title1Exit),
                                display: 'flex',
                                position: 'absolute',
                                justifyContent: 'center',
                                width: '100%',
                                filter: `blur(${interpolate(marketingProg, [0, 1], [12, 0])}px)`,
                                transform: `translateY(0px) rotateX(${interpolate(marketingProg, [0, 1], [90, 0]) + (title1Exit * -90)}deg) translateZ(40px)`,
                                transformOrigin: 'center center',
                                backfaceVisibility: 'hidden',
                            }}>
                                <Word stay show={true} prog={1}>We</Word>
                                <Word stay show={true} prog={1}>even</Word>
                                <Word stay show={true} prog={1} color={BRAND_BLUE}>do</Word>
                                <Word stay show={true} prog={1}>your</Word>
                                <Word stay show={true} prog={1} color={BRAND_BLUE}>marketing.</Word>
                            </div>
                        )}

                        {/* Part 2.5: Built in customer rewards (Flip in) */}
                        {(frame >= phase1Start && frame < phase2Start + 20) && (
                            <div style={{
                                opacity: p1Prog * (1 - title2Exit),
                                display: 'flex',
                                position: 'absolute',
                                justifyContent: 'center',
                                width: '100%',
                                filter: `blur(${interpolate(p1Prog, [0, 1], [12, 0])}px)`,
                                transform: `translateY(0px) rotateX(${interpolate(p1Prog, [0, 1], [90, 0]) + (title2Exit * -90)}deg) translateZ(40px)`,
                                transformOrigin: 'center center',
                                backfaceVisibility: 'hidden',
                            }}>
                                <Word stay show={true} prog={1}>Built</Word>
                                <Word stay show={true} prog={1}>in</Word>
                                <Word stay show={true} prog={1} color={BRAND_BLUE}>customer</Word>
                                <Word stay show={true} prog={1} color={BRAND_BLUE}>rewards.</Word>
                            </div>
                        )}

                        {/* Part 2.6: Digital Rewards (Flip in & Slide Down) */}
                        {(frame >= phase2Start && frame < finalPitchStart + 20) && (
                            <div style={{
                                opacity: p2Prog * (1 - finalPitchProg),
                                display: 'flex',
                                position: 'absolute',
                                justifyContent: 'center',
                                width: '100%',
                                filter: `blur(${interpolate(p2Prog, [0, 1], [12, 0])}px)`,
                                transform: `translateY(${finalPitchProg * 500}px) rotateX(${interpolate(p2Prog, [0, 1], [90, 0]) + (finalPitchProg * -90)}deg) translateZ(40px)`,
                                transformOrigin: 'center center',
                                backfaceVisibility: 'hidden',
                            }}>
                                <Word stay show={true} prog={1} color={BRAND_BLUE}>Digital</Word>
                                <Word stay show={true} prog={1} color={BRAND_BLUE}>Rewards.</Word>
                            </div>
                        )}

                        {/* Part 3: And we do much MUCH more... (Flip in) */}
                        {(frame >= finalPitchStart && frame < logoEntryStart + 20) && (
                            <div style={{
                                opacity: finalPitchProg * (1 - logoEntryProg),
                                display: 'flex',
                                position: 'absolute',
                                justifyContent: 'center',
                                width: '100%',
                                filter: `blur(${interpolate(finalPitchProg, [0, 1], [12, 0])}px)`,
                                transform: `translateY(0px) rotateX(${interpolate(finalPitchProg, [0, 1], [90, 0]) + (logoEntryProg * -90)}deg) translateZ(40px)`,
                                transformOrigin: 'center center',
                                backfaceVisibility: 'hidden',
                                alignItems: 'center'
                            }}>
                                <Word stay show={true} prog={1}>And</Word>
                                <Word stay show={true} prog={1}>we</Word>
                                <Word stay show={true} prog={1} color={BRAND_BLUE}>do</Word>
                                <Word stay show={true} prog={1}>much</Word>
                                <div style={{
                                    display: 'inline-block',
                                    transform: `scale(${interpolate(much2Prog, [0, 1], [1, 1.8])})`,
                                    transformOrigin: 'center center',
                                    margin: '0 0.2em'
                                }}>
                                    <Word stay show={true} prog={1} color={BRAND_BLUE}>much</Word>
                                </div>
                                <Word stay show={true} prog={1}>more...</Word>
                            </div>
                        )}
                    </div>

                </div>

            </div>

            {/* Todo List Sequence */}
            {(frame >= accountingStart && frame < marketingStart + 30) && (
                <div style={{
                    position: 'absolute',
                    top: headingY + 120,
                    left: 0, right: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 12,
                    opacity: 1 - marketingProg,
                    filter: `blur(${marketingProg * 15}px)`,
                    transform: `translateY(${interpolate(marketingProg, [0, 1], [0, -28])}px)`,
                    zIndex: 5,
                }}>
                    {ACCOUNTING_MODULES.map((module, i) => {
                        const entryDelay = i * 6;
                        const checkDelay = 25 + i * 15;
                        const entryProg = spring({ frame: (frame - accountingStart) - entryDelay, fps, config: { damping: 20, stiffness: 100 } });
                        const isChecked = (frame - accountingStart) >= checkDelay;

                        if (entryProg < 0.001) return null;

                        return (
                            <div
                                key={module.id}
                                className="checkbox-wrapper-11"
                                style={{
                                    opacity: entryProg,
                                    filter: `blur(${interpolate(entryProg, [0, 1], [15, 0])}px)`,
                                    transform: `translateY(${interpolate(entryProg, [0, 1], [20, 0])}px)`,
                                }}
                            >
                                <input
                                    id={`todo-${i}`}
                                    type="checkbox"
                                    checked={isChecked}
                                    readOnly
                                />
                                <label htmlFor={`todo-${i}`}>
                                    {module.label}
                                </label>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Focused Horizontal Angled Carousel */}
            {marketingProg > 0.01 && (
                <div style={{
                    position: 'absolute',
                    top: headingY + 120, // Move up to make room for huge assets
                    left: 0, right: 0,
                    bottom: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: marketingProg * (1 - sceneExitProg),
                    transform: `translateY(${interpolate(marketingProg, [0, 1], [500, 0])}px)`,
                    zIndex: 20,
                    perspective: 4000, // Deeper perspective for massive arc
                }}>
                    <div style={{
                        position: 'relative',
                        width: width,
                        height: 1200, // Match massive item height
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}>
                        {MARKETING_ITEMS.map((item, i) => {
                            const currentIdx = -wheelRotation / 90;
                            const relativeIdx = i - currentIdx;

                            const theta = relativeIdx * 1.57; // 90 degree spacing (PI/2)
                            const radius = 2200; // Wider radius for giganti items
                            const tx = Math.sin(theta) * radius;
                            const ty = (1 - Math.cos(theta)) * 800;
                            const tz = (Math.cos(theta) - 1) * 1500; // Push further back in 3D

                            const distFromCenter = Math.abs(relativeIdx);
                            const itemOpacity = interpolate(distFromCenter, [0, 0.8, 1.4], [1, 0.8, 0], { extrapolateRight: 'clamp' });
                            const itemScale = interpolate(distFromCenter, [0, 1.5], [1, 0.5], { extrapolateRight: 'clamp' });
                            const itemRotate = relativeIdx * -30; // Aggressive lean

                            if (itemOpacity < 0.01) return null;

                            return (
                                <div key={item.id} style={{
                                    position: 'absolute',
                                    transform: `translate3d(${tx}px, ${ty + (item.id === 'rewards' ? finalPitchProg * 1200 : 0)}px, ${tz}px) scale(${itemScale}) rotateZ(${itemRotate}deg)`,
                                    width: 900,
                                    height: 1520,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    opacity: itemOpacity,
                                    zIndex: 100 - Math.round(distFromCenter * 10),
                                }}>
                                    {item.id === 'rewards' && (
                                        <>
                                            {/* Apple Pay Logo */}
                                            <div style={{
                                                position: 'absolute',
                                                left: -240,
                                                top: '50%',
                                                transform: `translateY(-50%) scale(${logoPopProg * (1 - finalPitchProg)})`,
                                                opacity: logoPopProg * (1 - finalPitchProg),
                                            }}>
                                                <Img src={staticFile('apple-pay.svg')} style={{ width: 140, height: 'auto' }} />
                                            </div>
                                            {/* Google Pay Logo */}
                                            <div style={{
                                                position: 'absolute',
                                                right: -240,
                                                top: '50%',
                                                transform: `translateY(-50%) scale(${logoPopProg * (1 - finalPitchProg)})`,
                                                opacity: logoPopProg * (1 - finalPitchProg),
                                            }}>
                                                <Img src={staticFile('google-pay.svg')} style={{ width: 140, height: 'auto' }} />
                                            </div>
                                        </>
                                    )}
                                    {item.id === 'sms' ? (
                                        <Img
                                            src={staticFile('sms.png')}
                                            style={{
                                                width: '100%',
                                                height: 'auto',
                                            }}
                                        />
                                    ) : item.id === 'email' ? (
                                        <div style={{
                                            width: '100%', height: '100%', backgroundColor: '#f9fafb', display: 'flex', flexDirection: 'column',
                                            borderRadius: 40, boxShadow: '0 30px 90px rgba(0,0,0,0.15)', overflow: 'hidden', border: '1px solid rgba(0,0,0,0.06)'
                                        }}>
                                            {/* Email Window Header */}
                                            <div style={{ padding: '16px 24px', backgroundColor: 'white', borderBottom: '1px solid #eee', display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span style={{ fontSize: 13, color: '#999', fontWeight: 600 }}>9:41 AM</span>
                                                    <div style={{ display: 'flex', gap: 6 }}>
                                                        <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#eee' }} />
                                                        <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#eee' }} />
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
                                                    <div style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: BRAND_BLUE, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: 16 }}>S</div>
                                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                        <span style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>Swftly Marketing</span>
                                                        <span style={{ fontSize: 12, color: '#666' }}>To: Jordan Williams</span>
                                                    </div>
                                                </div>
                                                <div style={{ fontSize: 18, fontWeight: 800, color: '#111', marginTop: 12, letterSpacing: '-0.01em' }}>Your weekly coffee fix is here! ☕</div>
                                            </div>

                                            {/* Email Content Body */}
                                            <div style={{ flex: 1, padding: 24, overflow: 'hidden' }}>
                                                <div style={{ backgroundColor: 'white', borderRadius: 20, height: '100%', border: '1px solid #eee', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                                                    {/* Email Hero Image Mockup */}
                                                    <div style={{
                                                        height: 220,
                                                        background: 'linear-gradient(rgba(0,0,0,0.2), rgba(0,0,0,0.5)), url("https://images.unsplash.com/photo-1509042239860-f550ce710b93?q=80&w=600&auto=format&fit=crop")',
                                                        backgroundSize: 'cover',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        justifyContent: 'center',
                                                        alignItems: 'center',
                                                        padding: 20,
                                                        color: 'white'
                                                    }}>
                                                        <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Member Exclusive</span>
                                                        <span style={{ fontSize: 32, fontWeight: 900, textAlign: 'center' }}>20% OFF</span>
                                                        <span style={{ fontSize: 14, fontWeight: 500 }}>Your next visit</span>
                                                    </div>

                                                    {/* Marketing Copy */}
                                                    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
                                                        <span style={{ fontSize: 16, fontWeight: 700, color: '#111' }}>Hi Jordan,</span>
                                                        <span style={{ fontSize: 14, color: '#444', lineHeight: 1.5 }}>
                                                            We missed you! Come by this week and enjoy 20% off any barista-made drink. Just show this email at the counter.
                                                        </span>

                                                        <div style={{
                                                            marginTop: 'auto',
                                                            width: '100%',
                                                            height: 48,
                                                            backgroundColor: BRAND_BLUE,
                                                            borderRadius: 12,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            color: 'white',
                                                            fontWeight: 800,
                                                            fontSize: 15
                                                        }}>
                                                            Order Now
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (item.id === 'rewards' || item.id === 'rewardsm') ? (
                                        <Img
                                            src={staticFile(item.image as string)}
                                            style={{
                                                width: '100%',
                                                height: 'auto',
                                            }}
                                        />
                                    ) : (
                                        <div style={{
                                            display: 'flex', alignItems: 'center', gap: 32, width: '100%',
                                            backgroundColor: 'white', borderRadius: 32, padding: '0 40px', height: 180,
                                            boxShadow: '0 20px 50px rgba(0,0,0,0.1)'
                                        }}>
                                            <div style={{
                                                width: 100, height: 100,
                                                backgroundColor: 'rgba(0, 102, 255, 0.1)',
                                                borderRadius: 24,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            }}>
                                                <item.icon size={52} color={BRAND_BLUE} strokeWidth={2.5} />
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span style={{ fontSize: 38, fontWeight: 900, color: BRAND_BLUE, letterSpacing: '-0.02em' }}>{item.label}</span>
                                                <span style={{ fontSize: 20, color: '#666', fontWeight: 600 }}>Built-in rewards</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}


            {/* Order Notification Cards — iOS style, stacked below heading */}
            {CARDS.map((card, i) => {
                const prog = cardProgs[i];
                if (prog < 0.01) return null;

                const titles = ['New Shopify Order', 'New DoorDash Order', 'New Uber Eats Order'];
                const notifWidth = 560;
                const notifTop = headingY + 140 + i * 96;

                return (
                    <div key={card.id} style={{
                        position: 'absolute',
                        left: (width - notifWidth) / 2,
                        top: notifTop,
                        width: notifWidth,
                        transform: `translateX(${interpolate(prog, [0, 1], [70, 0])}px) scale(${interpolate(prog, [0, 1], [0.88, 1])}) translateY(${interpolate(exitProgs[i], [0, 1], [0, -60])}px)`,
                        opacity: prog * (1 - exitProgs[i]) * (1 - gridProg),
                        background: [
                            `linear-gradient(135deg, rgba(255,255,255,0.92) 0%, rgba(${card.accentRgb},0.08) 100%)`,
                            `rgba(255,255,255,0.85)`,
                        ].join(', '),
                        backdropFilter: 'blur(40px) saturate(2.2) brightness(1.05)',
                        WebkitBackdropFilter: 'blur(40px) saturate(2.2) brightness(1.05)',
                        border: `1.5px solid rgba(${card.accentRgb}, 0.35)`,
                        boxShadow: `0 8px 32px rgba(${card.accentRgb}, 0.15), 0 2px 8px rgba(0,0,0,0.07), inset 0 1px 0 rgba(255,255,255,0.8)`,
                        borderRadius: 22,
                        padding: '16px 20px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 16,
                        zIndex: 30,
                    }}>
                        {/* Platform logo pill */}
                        <div style={{
                            width: 46, height: 46,
                            borderRadius: 13,
                            background: `rgba(${card.accentRgb}, 0.12)`,
                            border: `1px solid rgba(${card.accentRgb}, 0.28)`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0,
                        }}>
                            <Img src={staticFile(card.logoFile)} style={{ width: 26, height: 26, objectFit: 'contain' }} />
                        </div>

                        {/* Title + subtitle */}
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
                            <div style={{ fontSize: 17, fontWeight: 800, color: '#111', fontFamily: APP_FONT_STACK, letterSpacing: '-0.02em' }}>
                                {titles[i]}
                            </div>
                            <div style={{ fontSize: 13, color: '#777', fontFamily: APP_FONT_STACK, fontWeight: 500 }}>
                                {card.orderNumber} · {card.date}
                            </div>
                        </div>

                        {/* Amount */}
                        <div style={{
                            fontSize: 18, fontWeight: 800,
                            color: card.themeColor,
                            fontFamily: APP_FONT_STACK,
                        }}>
                            {card.total}
                        </div>
                    </div>
                );
            })}


            {/* Scene Exit White Fade */}
            <div style={{
                position: 'absolute', inset: 0,
                backgroundColor: 'white',
                opacity: sceneExitProg,
                zIndex: 100,
                pointerEvents: 'none',
            }} />
            {/* Final Brand Information (Logo is handled globally by FloatingLogoLayer) */}
            {logoEntryProg > 0.01 && (
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: logoEntryProg * (1 - sceneExitProg),
                    zIndex: 200,
                }}>
                    <div style={{
                        marginTop: 480, // Leave room for the massive global 3D logo
                        opacity: finalInfoProg,
                        transform: `translateY(${interpolate(finalInfoProg, [0, 1], [40, 0])}px)`,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        textAlign: 'center',
                        gap: 12,
                    }}>
                        <span style={{
                            fontSize: 32,
                            fontWeight: 700,
                            color: '#444',
                            letterSpacing: '-0.01em',
                        }}>
                            Available on all devices
                        </span>
                        <span style={{
                            fontSize: 24,
                            fontWeight: 500,
                            color: '#999',
                            maxWidth: 800,
                        }}>
                            compatible with all existing hardware*
                        </span>

                        <div style={{
                            marginTop: 40,
                            fontSize: 42,
                            fontWeight: 900,
                            color: BRAND_BLUE,
                            letterSpacing: '-0.03em',
                        }}>
                            swftly.app
                        </div>
                    </div>
                </div>
            )}
        </AbsoluteFill>
    );
};

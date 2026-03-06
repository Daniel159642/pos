import React, { useMemo } from "react";
import {
    AbsoluteFill,
    interpolate,
    interpolateColors,
    spring,
    useCurrentFrame,
    useVideoConfig,
    Easing,
} from "remotion";

const WordBlur: React.FC<{
    text: string;
    delay: number;
    active: boolean;
}> = ({ text, delay, active }) => {
    const frame = useCurrentFrame();
    const words = text.split(" ");

    return (
        <div style={{
            display: "flex",
            gap: "10px",
            flexWrap: "nowrap",
            justifyContent: 'center',
            width: '100%'
        }}>
            {words.map((word, i) => {
                const wordDelay = delay + i * 3;
                const progress = interpolate(frame, [wordDelay, wordDelay + 15], [0, 1], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                    easing: Easing.out(Easing.quad),
                });

                const opacity = progress;
                const blur = interpolate(progress, [0, 1], [10, 0]);
                const translateY = interpolate(progress, [0, 1], [-20, 0]);

                return (
                    <span
                        key={i}
                        style={{
                            display: "inline-block",
                            opacity: active ? opacity : 0,
                            filter: `blur(${blur}px)`,
                            transform: `translateY(${translateY}px)`,
                            fontSize: 42,
                            fontWeight: 700,
                            color: "#000",
                            fontFamily: 'Zodiak, serif',
                            whiteSpace: "nowrap",
                            letterSpacing: '-0.02em',
                        }}
                    >
                        {word}
                    </span>
                );
            })}
        </div>
    );
};

const SmoothCharReveal: React.FC<{
    text: string;
    progress: number;
    style?: React.CSSProperties;
}> = ({ text, progress, style }) => {
    const chars = useMemo(() => text.split(""), [text]);
    const totalChars = chars.length;

    // Group characters into word tokens so the browser wraps at word boundaries, not mid-character
    const tokens = useMemo(() => {
        type Token =
            | { type: 'word'; chars: Array<{ char: string; idx: number }> }
            | { type: 'space'; char: string; idx: number };
        const result: Token[] = [];
        let wordBuf: Array<{ char: string; idx: number }> = [];
        chars.forEach((char, i) => {
            if (char === '\n' || char === ' ') {
                if (wordBuf.length > 0) { result.push({ type: 'word', chars: wordBuf }); wordBuf = []; }
                result.push({ type: 'space', char, idx: i });
            } else {
                wordBuf.push({ char, idx: i });
            }
        });
        if (wordBuf.length > 0) result.push({ type: 'word', chars: wordBuf });
        return result;
    }, [chars]);

    return (
        <span style={{ ...style }}>
            {tokens.map((token, ti) => {
                if (token.type === 'space') {
                    if (token.char === '\n') return <br key={ti} />;
                    // Fade the space in with its surrounding word
                    const prog = interpolate(progress,
                        [token.idx / totalChars * 0.85, (token.idx / totalChars * 0.85) + 0.25],
                        [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
                    return <span key={ti} style={{ display: 'inline-block', whiteSpace: 'pre', opacity: prog }}>{' '}</span>;
                }
                // Each WORD is wrapped in its own inline-block — browser wraps whole words only
                return (
                    <span key={ti} style={{ display: 'inline-block' }}>
                        {token.chars.map(({ char, idx }) => {
                            const charProg = interpolate(progress,
                                [idx / totalChars * 0.85, (idx / totalChars * 0.85) + 0.25],
                                [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
                            return (
                                <span key={idx} style={{
                                    opacity: charProg,
                                    transform: `translateY(${interpolate(charProg, [0, 1], [10, 0])}px)`,
                                    filter: `blur(${interpolate(charProg, [0, 1], [4, 0])}px)`,
                                    display: 'inline-block',
                                }}>
                                    {char}
                                </span>
                            );
                        })}
                    </span>
                );
            })}
        </span>
    );
};

import {
    Settings,
    User,
    LogOut,
    Bell,
    DollarSign,
    RotateCcw,
    Truck,
    List,
    FileText,
    PackageOpen,
    CheckCircle,
    Plus,
    ChevronDown,
    PackagePlus,
    Sparkles,
    AlertTriangle,
    Send,
    X,
    ScanLine,
} from "lucide-react";
import { ThreeCanvas } from "@remotion/three";
import { Environment } from "@react-three/drei";
import { ThreeDFolderIcon } from "../components/ThreeDFolderIcon";
import { staticFile } from "remotion";

// CORE APP FONTS & STYLES (Identical to POS Tauri App)
const APP_FONT_STACK = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const tankerFontUrl = "https://api.fontshare.com/v2/css?f[]=tanker@400&display=swap";
const zodiakFontUrl = "https://api.fontshare.com/v2/css?f[]=zodiak@400,700,800&display=swap";
const BRAND_BLUE = "#2c19fc";

const weeklyRevenue = [
    { day: 'Mon', revenue: 1250 },
    { day: 'Tue', revenue: 2100 },
    { day: 'Wed', revenue: 1800 },
    { day: 'Thu', revenue: 3200 },
    { day: 'Fri', revenue: 4500 },
    { day: 'Sat', revenue: 6100 },
    { day: 'Sun', revenue: 5300 }
];

// Actual POS App Component Replicas
const FormLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <label style={{
        display: 'block',
        marginBottom: '10px',
        fontWeight: 600,
        fontSize: '14px',
        color: '#333',
        fontFamily: APP_FONT_STACK
    }}>
        {children}
    </label>
);

const InputMock: React.FC<{ placeholder: string; hasDropdown?: boolean; type?: string }> = ({ placeholder, hasDropdown, type }) => (
    <div style={{
        width: '100%',
        padding: '5px 14px',
        minHeight: '32px',
        border: '1px solid #ddd',
        borderRadius: '8px',
        fontSize: '14px',
        backgroundColor: '#fff',
        color: '#333',
        fontFamily: APP_FONT_STACK,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '24px'
    }}>
        <span style={{ color: placeholder.includes('Select') || type === 'date' ? '#999' : '#ccc' }}>{placeholder}</span>
        {hasDropdown && <ChevronDown size={16} color="#666" />}
    </div>
);

const SwitchMock: React.FC<{ label: string; checked: boolean; description: string }> = ({ label, checked, description }) => (
    <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
            <div style={{
                appearance: 'none',
                backgroundColor: checked ? BRAND_BLUE : '#dfe1e4',
                borderRadius: '72px',
                height: '20px',
                width: '30px',
                position: 'relative',
                transition: 'all 100ms ease-out'
            }}>
                <div style={{
                    backgroundColor: '#fff',
                    borderRadius: '50%',
                    height: '14px',
                    width: '14px',
                    position: 'absolute',
                    top: '3px',
                    left: checked ? '13px' : '3px',
                    transition: 'all 100ms ease-out'
                }} />
            </div>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#333', fontFamily: APP_FONT_STACK }}>{label}</span>
        </div>
        <div style={{ fontSize: 13, color: '#666', marginTop: 8, lineHeight: 1.5, fontFamily: APP_FONT_STACK }}>
            {description}
        </div>
    </div>
);

const InvoiceDraft: React.FC<{
    contactHighlight?: number;
    activeRow?: number;
    activeRowProg?: number;
    style?: React.CSSProperties
}> = ({ contactHighlight = 0, activeRow = -1, activeRowProg = 0, style }) => (
    <div style={{
        width: 820,
        backgroundColor: 'white',
        borderRadius: 0,
        padding: '44px 56px 56px',
        fontFamily: APP_FONT_STACK,
        ...style
    }}>
        {/* Company Header */}
        <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#111', letterSpacing: '-0.02em' }}>KitchenPro Supply Co.</div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>Commercial Kitchen Essentials</div>
            <div style={{ fontSize: 11, color: '#aaa', marginTop: 3, position: 'relative' }}>
                142 Warehouse Blvd, Suite 5 · Newark, NJ 07102 · (800) 555-2947 · orders@kitchenprosupply.com
                {contactHighlight > 0.01 && (
                    <div style={{
                        position: 'absolute',
                        inset: '-3px -6px',
                        background: `rgba(220,40,40,${contactHighlight * 0.12})`,
                        border: `1.5px solid rgba(220,40,40,${contactHighlight * 0.55})`,
                        borderRadius: 4,
                        boxShadow: `0 0 10px rgba(220,40,40,${contactHighlight * 0.2})`,
                        pointerEvents: 'none',
                    }} />
                )}
            </div>
        </div>

        <div style={{ borderTop: '2px solid #111', marginTop: 16, marginBottom: 16 }} />

        {/* Invoice Title Row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div>
                <div style={{ fontSize: 26, fontWeight: 800, color: '#111', letterSpacing: '-0.03em', marginBottom: 6 }}>Invoice</div>
                <div style={{ fontSize: 12, color: '#555' }}><span style={{ color: '#aaa' }}>No.</span> INV-2026-04471 &nbsp;·&nbsp; <span style={{ color: '#aaa' }}>PO</span> PO-88321</div>
                <div style={{ fontSize: 12, color: '#555', marginTop: 3 }}><span style={{ color: '#aaa' }}>Date</span> March 3, 2026 &nbsp;·&nbsp; <span style={{ color: '#aaa' }}>Due</span> April 2, 2026</div>
            </div>
            <div style={{ background: '#111', color: 'white', fontSize: 11, fontWeight: 700, padding: '6px 16px', borderRadius: 4, letterSpacing: 1 }}>PAID IN FULL</div>
        </div>


        {/* Items Table Header */}
        <div style={{ display: 'flex', gap: 8, padding: '8px 0', borderBottom: '2px solid #111', marginBottom: 14 }}>
            <div style={{ flex: 3, fontSize: 10, fontWeight: 700, color: '#111', letterSpacing: 0.5 }}>PRODUCT</div>
            <div style={{ width: 90, fontSize: 10, fontWeight: 700, color: '#111', letterSpacing: 0.5 }}>SKU</div>
            <div style={{ width: 80, fontSize: 10, fontWeight: 700, color: '#111', letterSpacing: 0.5 }}>CATEGORY</div>
            <div style={{ width: 35, fontSize: 10, fontWeight: 700, color: '#111', letterSpacing: 0.5, textAlign: 'right' }}>QTY</div>
            <div style={{ width: 70, fontSize: 10, fontWeight: 700, color: '#111', letterSpacing: 0.5, textAlign: 'right' }}>UNIT</div>
            <div style={{ width: 70, fontSize: 10, fontWeight: 700, color: '#111', letterSpacing: 0.5, textAlign: 'right' }}>TOTAL</div>
        </div>

        {/* Line Items */}
        {[
            { name: 'Stainless Steel Stock Pot 20 Qt.', sub: '18/8 stainless, riveted handles', sku: 'KP-CW-2001', cat: 'Cookware', qty: 6, unit: '$89.99', total: '$539.94' },
            { name: "Chef's Knife 8\" — Pro Series", sub: 'Forged high-carbon steel, full tang', sku: 'KP-CU-0812', cat: 'Cutlery', qty: 12, unit: '$54.50', total: '$654.00' },
            { name: 'Non-Stick Skillet 12" — Ceramic', sub: 'PFOA-free, induction-compatible', sku: 'KP-CW-1204', cat: 'Cookware', qty: 8, unit: '$42.00', total: '$336.00' },
            { name: 'Magnetic Knife Strip 18"', sub: 'Beechwood mount, neodymium magnets', sku: 'KP-SO-1801', cat: 'Storage', qty: 10, unit: '$28.75', total: '$287.50' },
            { name: 'Silicone Utensil Set (6-Piece)', sub: 'Heat-resistant 480°F, dishwasher-safe', sku: 'KP-TU-0603', cat: 'Utensils', qty: 15, unit: '$19.99', total: '$299.85' },
            { name: 'Instant-Read Thermometer — Digital', sub: '±0.9°F accuracy, waterproof', sku: 'KP-ME-4410', cat: 'Measurement', qty: 20, unit: '$15.00', total: '$300.00' },
            { name: 'Stainless Mixing Bowl Set (3-Pc)', sub: '3 / 5 / 8 Qt nesting, non-slip base', sku: 'KP-BW-3302', cat: 'Bakeware', qty: 10, unit: '$36.00', total: '$360.00' },
            { name: 'Half-Size Sheet Pan (Aluminum)', sub: '18×13", commercial-grade, 1" rim', sku: 'KP-BW-0501', cat: 'Bakeware', qty: 24, unit: '$12.50', total: '$300.00' },
            { name: 'Cast Iron Dutch Oven 6 Qt.', sub: 'Enameled interior, oven-safe to 500°F', sku: 'KP-CW-0600', cat: 'Cookware', qty: 5, unit: '$74.00', total: '$370.00' },
            { name: 'Santoku Knife 7" — Granton Edge', sub: 'German steel, ergonomic handle', sku: 'KP-CU-0709', cat: 'Cutlery', qty: 10, unit: '$48.00', total: '$480.00' },
            { name: 'Wooden Cutting Board 18×12"', sub: 'End-grain acacia, juice groove', sku: 'KP-TU-1812', cat: 'Prep', qty: 8, unit: '$39.00', total: '$312.00' },
            { name: 'Stainless Colander 5 Qt.', sub: 'Fine mesh, two handles, stable base', sku: 'KP-TU-0501', cat: 'Prep', qty: 12, unit: '$22.00', total: '$264.00' },
            { name: 'Digital Kitchen Scale — 11 lb', sub: '0.1 oz precision, tare function', sku: 'KP-ME-1100', cat: 'Measurement', qty: 14, unit: '$18.50', total: '$259.00' },
            { name: 'Wire Cooling Rack (Set of 2)', sub: 'Oven-safe, fits half-sheet pan', sku: 'KP-BW-0202', cat: 'Bakeware', qty: 18, unit: '$14.00', total: '$252.00' },
            { name: 'Mandoline Slicer — Adjustable', sub: '5 blades, safety glove included', sku: 'KP-TU-0405', cat: 'Prep', qty: 7, unit: '$34.99', total: '$244.93' },
            { name: 'Apron — Heavy Canvas, Adjustable', sub: '100% cotton canvas, 3 pockets', sku: 'KP-LN-0301', cat: 'Linens', qty: 20, unit: '$16.00', total: '$320.00' },
        ].map((item, i) => {
            const isHighlighted = i === activeRow;
            const hProg = isHighlighted ? activeRowProg : 0;
            const isRed = i === 6; // Issue row
            const highlightColor = isRed ? '220,40,40' : '44,25,252';

            return (
                <div key={i} style={{
                    display: 'flex', gap: 8,
                    padding: isHighlighted ? '9px 12px' : '9px 0',
                    margin: isHighlighted ? '2px -12px' : '0',
                    borderBottom: isHighlighted ? 'none' : '1px solid #f0f0f0',
                    alignItems: 'flex-start',
                    background: isHighlighted ? `rgba(${highlightColor},${hProg * 0.07})` : 'transparent',
                    borderRadius: isHighlighted ? 10 : 0,
                    transform: isHighlighted ? `translateY(${interpolate(hProg, [0, 1], [0, -5])}px)` : 'none',
                    boxShadow: isHighlighted
                        ? `0 ${interpolate(hProg, [0, 1], [0, 8])}px ${interpolate(hProg, [0, 1], [0, 24])}px rgba(${highlightColor},${hProg * 0.14}), 0 0 0 ${interpolate(hProg, [0, 1], [0, 1.5])}px rgba(${highlightColor},${hProg * 0.35})`
                        : 'none',
                    zIndex: isHighlighted ? 2 : 1,
                    position: 'relative',
                }}>
                    <div style={{ flex: 3 }}>
                        <div style={{
                            fontSize: 12,
                            fontWeight: isHighlighted ? 700 : 600,
                            color: isHighlighted
                                ? `rgb(${Math.round(17 + (isRed ? 203 : 27) * hProg)},${Math.round(17 + (isRed ? 23 : 8) * hProg)},${Math.round(17 + (isRed ? 0 : 235) * hProg)})`
                                : '#111'
                        }}>{item.name}</div>
                        <div style={{ fontSize: 10, color: '#aaa', marginTop: 1 }}>{item.sub}</div>
                    </div>
                    <div style={{ width: 90, fontSize: 11, color: '#666', paddingTop: 1 }}>{item.sku}</div>
                    <div style={{ width: 80, fontSize: 11, color: '#666', paddingTop: 1 }}>{item.cat}</div>
                    <div style={{ width: 35, fontSize: 12, fontWeight: 600, color: '#333', textAlign: 'right', paddingTop: 1 }}>{item.qty}</div>
                    <div style={{ width: 70, fontSize: 12, color: '#555', textAlign: 'right', paddingTop: 1 }}>{item.unit}</div>
                    <div style={{ width: 70, fontSize: 12, fontWeight: 700, color: '#111', textAlign: 'right', paddingTop: 1 }}>{item.total}</div>
                </div>
            )
        })}
        {/* Bill To / Ship To / Payment — Moved beneath line items */}
        <div style={{ display: 'flex', gap: 0, marginTop: 20, marginBottom: 20, background: '#f8f8f8', borderRadius: 8, overflow: 'hidden' }}>
            {[{
                label: 'BILL TO',
                lines: ['Maple Street Kitchen Store', 'Attn: Sarah Goldstein', '84 Maple St, Brooklyn NY 11201', 'sarah@maplekitchen.com · (718) 555-0192']
            }, {
                label: 'SHIP TO',
                lines: ['Maple Street Kitchen Store', '84 Maple St, Brooklyn NY 11201', 'Loading Dock — Rear Entrance', '']
            }, {
                label: 'PAYMENT',
                lines: ['Terms: Net 30 · ACH/Wire', 'Rep: Marcus T.', 'Acct: MSKNY-0042', 'Tax ID: 47-2938401']
            }].map((section, i) => (
                <div key={i} style={{ flex: 1, padding: '16px 20px', borderRight: i < 2 ? '1px solid #eee' : 'none' }}>
                    <div style={{ fontSize: 9, fontWeight: 800, color: '#aaa', letterSpacing: 1.5, marginBottom: 8 }}>{section.label}</div>
                    {section.lines.map((l, j) => (
                        <div key={j} style={{ fontSize: 11, color: j === 0 ? '#111' : '#666', fontWeight: j === 0 ? 600 : 400, lineHeight: 1.6 }}>{l}</div>
                    ))}
                </div>
            ))}
        </div>

        {/* Totals + Shipping footer */}
        <div style={{ display: 'flex', gap: 40, marginTop: 28 }}>
            <div style={{ flex: 1 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#aaa', letterSpacing: 1, marginBottom: 6 }}>TERMS & NOTES</div>
                <div style={{ fontSize: 10, color: '#999', lineHeight: 1.7 }}>Payment due within 30 days. Late payments subject to 1.5%/mo finance charge. Returns require prior authorization. Damaged goods must be reported within 5 business days.</div>
            </div>
            <div style={{ width: 240 }}>
                {[
                    { label: 'Subtotal (16 items)', val: '$5,579.22', bold: false },
                    { label: 'Account Discount (5%)', val: '− $278.96', bold: false, accent: true },
                    { label: 'Freight & Handling', val: '$72.00', bold: false },
                    { label: 'NY Sales Tax (8.875%)', val: '$473.94', bold: false },
                ].map((row, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f0f0f0' }}>
                        <div style={{ fontSize: 11, color: row.accent ? '#2c7a2c' : '#666' }}>{row.label}</div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: row.accent ? '#2c7a2c' : '#333' }}>{row.val}</div>
                    </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: '2px solid #111', marginTop: 4 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#111' }}>Total Due (USD)</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#111' }}>$5,846.20</div>
                </div>
            </div>
        </div>

        {/* Shipping Bar */}
        <div style={{ display: 'flex', gap: 0, background: '#f8f8f8', borderRadius: 6, marginTop: 24, overflow: 'hidden' }}>
            {[
                { label: 'Carrier', val: 'UPS Ground' },
                { label: 'Ship Date', val: 'Mar 3, 2026' },
                { label: 'Est. Delivery', val: 'Mar 7, 2026' },
                { label: 'Tracking', val: '1Z999AA10123456784' },
                { label: 'Weight', val: '148 lbs' },
                { label: 'Packages', val: '6 Boxes' },
            ].map((cell, i) => (
                <div key={i} style={{ flex: 1, padding: '12px 14px', borderRight: i < 5 ? '1px solid #eee' : 'none' }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: '#aaa', letterSpacing: 1, marginBottom: 4 }}>{cell.label.toUpperCase()}</div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#333' }}>{cell.val}</div>
                </div>
            ))}
        </div>
    </div>
);

const ShipmentVerificationUI: React.FC<{ progress: number }> = ({ progress }) => {
    const sidebarWidth = "25%";
    const menuItems = [
        { icon: List, label: "All Shipments", active: false },
        { icon: PackageOpen, label: "In Progress", active: false },
        { icon: CheckCircle, label: "Completed", active: false },
        { icon: Plus, label: "New Shipment", active: true },
    ];

    const inProgressShipments = [
        { vendor: 'KitchenPro Supply Co.', po: 'PO-2026-0041', items: 24, received: 18, progress: 75, status: 'In Progress', color: '#2c19fc', uploadedBy: 'M. Torres', date: 'Mar 3, 2026' },
        { vendor: 'Nordic Linen & Textiles', po: 'PO-2026-0039', items: 60, received: 30, progress: 50, status: 'Partial', color: '#f59e0b', uploadedBy: 'J. Kim', date: 'Mar 1, 2026' },
        { vendor: 'Pacific Rim Foods', po: 'PO-2026-0038', items: 12, received: 2, progress: 17, status: 'Started', color: '#10b981', uploadedBy: 'A. Reyes', date: 'Feb 28, 2026' },
    ];

    return (
        <div style={{ display: "flex", width: "100%", height: "100%", backgroundColor: "white", opacity: progress }}>
            {/* Sidebar — matched to production app UI */}
            <div style={{
                width: sidebarWidth,
                borderRight: "1px solid #e0e0e0",
                display: "flex",
                flexDirection: "column",
                padding: "32px 12px",
                gap: 6,
                backgroundColor: 'white'
            }}>
                {/* Header Style Button */}
                <div style={{
                    display: "flex",
                    alignItems: "center",
                    height: 64,
                    padding: "0 16px",
                    marginBottom: 20,
                    backgroundColor: 'rgba(44, 25, 252, 0.08)',
                    borderRadius: 8,
                    color: BRAND_BLUE,
                    fontWeight: 800,
                    fontSize: 24,
                    fontFamily: APP_FONT_STACK,
                    gap: 16
                }}>
                    <Truck size={36} />
                    <span>Shipments</span>
                </div>

                {menuItems.map((item, i) => (
                    <div key={i} style={{
                        display: "flex",
                        alignItems: "center",
                        height: 64,
                        padding: "0 16px",
                        gap: 20,
                        borderRadius: 8,
                        backgroundColor: item.active ? "rgba(0, 0, 0, 0.05)" : "transparent",
                        color: item.active ? "#333" : "#666",
                        cursor: "pointer",
                        fontWeight: item.active ? 800 : 500,
                        fontFamily: APP_FONT_STACK,
                        transition: 'background 0.2s ease'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40 }}>
                            <item.icon size={32} />
                        </div>
                        <span style={{ fontSize: 20 }}>{item.label}</span>
                    </div>
                ))}
            </div>

            {/* Main content */}
            <div style={{ flex: 1, padding: "32px 40px", display: "flex", flexDirection: "column", gap: 28, overflowY: "auto", backgroundColor: "white" }}>

                {/* File Drop Zone — primary action */}
                <div style={{
                    border: '2px dashed #c7c7e8',
                    borderRadius: 16,
                    padding: '36px 32px',
                    background: 'linear-gradient(135deg, #f7f8ff 0%, #f0f0ff 100%)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 12,
                    textAlign: 'center',
                    position: 'relative',
                    flexShrink: 0,
                }}>
                    {/* Upload icon — no circle */}
                    <div style={{ marginBottom: 8 }}>
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke={BRAND_BLUE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="17 8 12 3 7 8" />
                            <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                    </div>
                    <div style={{ fontSize: 48, fontWeight: 900, color: '#111', fontFamily: APP_FONT_STACK, letterSpacing: '-0.03em', lineHeight: 1 }}>
                        New Shipment
                    </div>
                    <div style={{ fontSize: 16, color: '#666', fontFamily: APP_FONT_STACK, maxWidth: 500, marginTop: 4 }}>
                        Drop shipment document here to auto-extract line items
                    </div>
                    <div style={{
                        marginTop: 12, padding: '10px 28px',
                        background: BRAND_BLUE, color: 'white',
                        borderRadius: 10, fontSize: 14, fontWeight: 800,
                        fontFamily: APP_FONT_STACK,
                        boxShadow: '0 4px 14px rgba(44,25,252,0.35)',
                    }}>
                        Browse files
                    </div>
                </div>

                {/* In Progress section — matches real POS ShipmentCard style exactly */}
                <div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#444', fontFamily: APP_FONT_STACK, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
                        <PackageOpen size={26} color="#888" />
                        In Progress — {inProgressShipments.length} shipments
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        {inProgressShipments.map((s, i) => (
                            <div key={i} style={{
                                background: [
                                    'linear-gradient(145deg, rgba(44,25,252,0.12) 0%, transparent 40%, transparent 55%, rgba(44,25,252,0.06) 100%)',
                                    'rgba(255,255,255,0.7)',
                                ].join(', '),
                                backdropFilter: 'blur(20px) saturate(1.8)',
                                WebkitBackdropFilter: 'blur(20px) saturate(1.8)',
                                borderRadius: 16,
                                padding: 20,
                                border: '1.5px solid rgba(44,25,252,0.2)',
                                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.06)',
                                cursor: 'pointer',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 0,
                            }}>
                                {/* Header — vendor + status badge */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                                    <div>
                                        <div style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#111', marginBottom: 6, fontFamily: APP_FONT_STACK }}>
                                            {s.vendor}
                                        </div>
                                        <div style={{ fontSize: 18, color: '#444', fontFamily: APP_FONT_STACK, fontWeight: 600 }}>
                                            PO: {s.po}
                                        </div>
                                    </div>
                                    <div style={{
                                        padding: '6px 16px', borderRadius: 14,
                                        backgroundColor: `rgba(${parseInt(BRAND_BLUE.slice(1), 16) >> 16 & 255}, ${parseInt(BRAND_BLUE.slice(1), 16) >> 8 & 255}, ${parseInt(BRAND_BLUE.slice(1), 16) & 255}, 0.15)`,
                                        color: BRAND_BLUE,
                                        fontSize: 14, fontWeight: 800,
                                        border: `1.5px solid ${BRAND_BLUE}`,
                                        fontFamily: APP_FONT_STACK,
                                        whiteSpace: 'nowrap',
                                        textTransform: 'capitalize',
                                    }}>
                                        In Progress
                                    </div>
                                </div>

                                {/* Progress bar */}
                                <div style={{ marginBottom: 20 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 16, color: '#666', fontFamily: APP_FONT_STACK }}>
                                        <span style={{ fontWeight: 600 }}>Progress</span>
                                        <span style={{ fontWeight: 800, color: '#111' }}>{s.progress}%</span>
                                    </div>
                                    <div style={{ width: '100%', height: 10, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 5, overflow: 'hidden' }}>
                                        <div style={{ width: `${s.progress}%`, height: '100%', backgroundColor: BRAND_BLUE, borderRadius: 5 }} />
                                    </div>
                                </div>

                                {/* Stats grid */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 18 }}>
                                    <div>
                                        <div style={{ fontSize: 14, color: '#555', marginBottom: 6, fontWeight: 600, fontFamily: APP_FONT_STACK }}>Items Received</div>
                                        <div style={{ fontSize: 20, fontWeight: 800, color: '#111', fontFamily: APP_FONT_STACK }}>{s.received} / {s.items}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 14, color: '#555', marginBottom: 6, fontWeight: 600, fontFamily: APP_FONT_STACK }}>Total Items</div>
                                        <div style={{ fontSize: 20, fontWeight: 800, color: '#111', fontFamily: APP_FONT_STACK }}>{s.items}</div>
                                    </div>
                                </div>

                                {/* Footer */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14, color: '#888', paddingTop: 14, borderTop: '1px solid rgba(0,0,0,0.06)', fontFamily: APP_FONT_STACK, fontWeight: 500 }}>
                                    <span>Uploaded by {s.uploadedBy}</span>
                                    <span>{s.date}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export const DashboardScene: React.FC = () => {
    const frame = useCurrentFrame();
    const { fps, width, height } = useVideoConfig();

    const openProgress = spring({
        frame,
        fps,
        config: { damping: 20, stiffness: 100, mass: 1 },
        durationInFrames: 35,
    });

    const windowScale = interpolate(openProgress, [0, 1], [0.1, 1]);
    const windowOpacity = interpolate(openProgress, [0, 0.2, 1], [0, 1, 1]);

    const startY = height - 30 - 34;
    const startX = width / 2 + 41.5;

    const currentY = interpolate(openProgress, [0, 1], [startY, height / 2 - 20]);
    const currentX = interpolate(openProgress, [0, 1], [startX, width / 2]);

    const headerEntrance = spring({
        frame: frame,
        fps,
        config: { damping: 15 },
    });

    const bodyEntrance = interpolate(frame, [0, 10], [0, 1], { extrapolateLeft: "clamp" });

    const HeaderButton: React.FC<{ icon: any; label: string; delay: number }> = ({ icon: Icon, label, delay }) => {
        const entrance = spring({
            frame: frame - delay,
            fps: 30,
            config: { damping: 12 },
        });

        return (
            <div style={{
                background: "#fff",
                border: "2px solid #888",
                fontSize: 13,
                borderRadius: 8,
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.08), 2px 4px 6px rgba(0, 0, 0, 0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 0,
                opacity: entrance,
                transform: `translateY(${interpolate(entrance, [0, 1], [5, 0])}px)`,
                fontFamily: APP_FONT_STACK,
            }}>
                <div style={{
                    padding: "6px 12px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    borderRadius: 6,
                    boxShadow: "inset 0 -3px #d5d7de, 0 -1px #ffffff",
                    width: "100%",
                    height: "100%",
                }}>
                    <Icon size={14} style={{ color: "#888", transform: "translateY(-1px)" }} />
                    <span style={{ color: "#888", fontWeight: 600, transform: "translateY(-1px)", whiteSpace: "nowrap" }}>{label}</span>
                </div>
            </div>
        );
    };

    const MagicBentoCard: React.FC<{
        title: string;
        spanCol?: number;
        spanRow?: number;
        delay: number;
        children?: React.ReactNode;
        isWhite?: boolean;
        isOutline?: boolean;
        scaling?: number;
    }> = ({ title, spanCol = 1, spanRow = 1, delay, children, isWhite, isOutline, scaling = 1 }) => {
        const entrance = spring({
            frame: frame - delay,
            fps: 30,
            config: { damping: 15, stiffness: 100 },
        });

        return (
            <div style={{
                gridColumn: `span ${spanCol}`,
                gridRow: `span ${spanRow}`,
                backgroundColor: isWhite ? "white" : BRAND_BLUE,
                backgroundImage: isWhite ? "none" : `linear-gradient(to bottom, #4a3dfc, ${BRAND_BLUE})`,
                borderRadius: 8,
                padding: "1.25em",
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-end",
                alignItems: "flex-end",
                color: isWhite ? "#333" : "white",
                fontWeight: 600,
                overflow: "hidden",
                boxShadow: isWhite ? "0 2px 8px rgba(0,0,0,0.08)" : "inset 0 -8px rgb(0 0 0/0.4), 0 2px 4px rgb(0 0 0/0.2)",
                border: isOutline ? `3px solid #4a3dfc` : "none",
                opacity: entrance,
                transform: `translateY(${interpolate(entrance, [0, 1], [20, 0])}px) scale(${interpolate(entrance, [0, 1], [0.98, 1]) * scaling})`,
                position: "relative",
                minHeight: 0,
                fontFamily: APP_FONT_STACK,
            }}>
                {children ? (
                    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
                        {children}
                    </div>
                ) : (
                    <div style={{
                        fontSize: 22,
                        textAlign: "right",
                        width: "100%",
                        marginTop: "auto"
                    }}>
                        {title}
                    </div>
                )}
            </div>
        );
    };

    // Timing Context — orchestrated sequence starts here
    const shipmentClickFrame = 85;
    const isShipmentClicked = frame >= shipmentClickFrame;

    // HIGHLIGHT SCAN SEQUENCE: Row-by-Row rapid fire
    // Target: 7.23s global = global frame 217 = local frame 152 (DashboardScene starts at global 65)
    // local 152 = shipmentClickFrame(85) + 67
    const highlightBase = shipmentClickFrame + 67; // Row 0 at local 152 = global 217 = 7.23s
    const step = 11; // frames per row (was 8 — slightly slower for readability)

    // PHASE A: Scan until Row 6 (Issue)
    // phaseA_End = 152 + (8 × 7) = 208
    const phaseA_End = highlightBase + step * 7;

    // PHASE B: Transition and Modal — phaseA_End=208, modal opens 10 frames later
    const modal3Start = phaseA_End + 10; // tight gap after issue row freezes
    const clickFrameM3 = modal3Start + 130; // Send clicked after 130 frames (was 242)

    // Modal 3 Exit (Scale down on click)
    const modal3ExitProg = spring({
        frame: frame - (clickFrameM3 + 4),
        fps,
        config: { damping: 22, stiffness: 120 } // slower exit = smoother scale-down dismiss
    });

    // PHASE C: Fast Completion (Global frames matched)
    // Scan remaining rows (7-15) rapidly after modal resolution
    const highlightC_Base = clickFrameM3 + 24; // Resumes as modal closes
    const stepC = 10; // High-speed scan for completion

    // CALCULATE ACTIVE ROW INDEX
    let finalActiveRow = -1;
    let finalRowProg = 0;

    if (frame < phaseA_End) {
        // Initial Scan phase
        // ramp = fade-in/out duration. Must satisfy: 2*ramp < step (strictly increasing)
        const ramp = Math.max(1, Math.floor(step / 4)); // step=8 → ramp=2; step=15 → ramp=3
        const idx = Math.floor(interpolate(frame, [highlightBase, phaseA_End], [0, 7], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }));
        finalActiveRow = idx < 7 ? idx : 6;
        const rowStart = highlightBase + finalActiveRow * step;
        const rowEnd = highlightBase + (finalActiveRow + 1) * step;
        finalRowProg = interpolate(frame,
            [rowStart, rowStart + ramp, rowEnd - ramp, rowEnd],
            [0, 1, 1, 0],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
        );
        // Hold Row 6 (Issue) at the end of Phase A
        if (finalActiveRow === 6 && frame >= (highlightBase + 6 * step + ramp)) {
            finalRowProg = 1;
        }
    } else if (frame < highlightC_Base) {
        // Hold Row 6 RED while modal is open
        finalActiveRow = 6;
        finalRowProg = 1;
    } else {
        // Post-Issue Fast Completion Scan (Rows 7-15)
        const idxC = Math.floor(interpolate(frame, [highlightC_Base, highlightC_Base + stepC * 9], [7, 16], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }));
        finalActiveRow = idxC < 16 ? idxC : 15;
        finalRowProg = interpolate(frame,
            [highlightC_Base + (finalActiveRow - 7) * stepC, highlightC_Base + (finalActiveRow - 7) * stepC + 3, highlightC_Base + (finalActiveRow - 6) * stepC - 3, highlightC_Base + (finalActiveRow - 6) * stepC],
            [0, 1, 1, 0],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
        );
    }

    // Completion animation: triggered at last Phase C row
    const lastRowFrame = highlightC_Base + stepC * 8;
    const phase4Start = lastRowFrame;

    // Departure Sequence (Phase 4): Invoice slides down
    const docExit = spring({ frame: frame - (phase4Start + 10), fps, config: { damping: 24, stiffness: 80 } });
    const m3Exit = spring({ frame: frame - phase4Start, fps, config: { damping: 22, stiffness: 220 } });

    const windowExitProgress = interpolate(
        frame,
        [129, 139],
        [0, 1],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );

    const windowBlur = interpolate(windowExitProgress, [0, 1], [0, 8]);
    const windowFinalOpacity = 1; // No more fade out here, handled by zoom-out in Main

    const bentoClickProg = spring({
        frame: frame - 85,
        fps,
        config: { damping: 20, stiffness: 150 }
    });

    const windowTiltProgress = spring({
        frame: frame - 85,
        fps,
        config: { damping: 20, stiffness: 120 }
    });

    // Suble 3D tilt for depth
    const rotateX = interpolate(windowTiltProgress, [0, 1], [0, 1.5]);
    const rotateY = interpolate(windowTiltProgress, [0, 1], [0, -3]);
    const translateX = interpolate(windowTiltProgress, [0, 1], [0, 10]);

    const gridOpacity = isShipmentClicked ? 0 : 1;
    const gridScale = 1;

    const shipmentViewOpacity = isShipmentClicked ? 1 : 0;

    // Folder stays static as the slip covers it — no ascent
    const exitElevation = 0;
    const exitSpin = 0; // No spin during exit

    // Modal 3 Progress
    const modal3Progress = spring({ frame: frame - modal3Start, fps, config: { damping: 16, stiffness: 65 } }); // slower, more cinematic pop-in

    // Email / Interactive logic — sped up: fields appear faster, send button sooner
    const contactHighlight = interpolate(frame, [modal3Start + 4, modal3Start + 14], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    const emailTo = spring({ frame: frame - (modal3Start + 15), fps, config: { damping: 40, stiffness: 100 } });
    const emailSubj = spring({ frame: frame - (modal3Start + 30), fps, config: { damping: 40, stiffness: 100 } });
    const emailBody = spring({ frame: frame - (modal3Start + 50), fps, config: { damping: 28, stiffness: 35 } }); // slow deliberate reveal
    const sendProg = spring({ frame: frame - (modal3Start + 20), fps, config: { damping: 25, stiffness: 100 } });
    const sentProg = spring({ frame: frame - (modal3Start + 110), fps, config: { damping: 25, stiffness: 100 } });

    // Skeleton pulse
    const skeletonPulse = 0.4 + Math.sin(frame * 0.35) * 0.15;

    // Text + scan button — appear after everything cleared (Global ~950)
    const p4TextStart = phase4Start + 135;
    const p4HeadingProg = spring({ frame: frame - p4TextStart, fps, config: { damping: 22, stiffness: 180 } });
    const p4ScanBtnProg = spring({ frame: frame - (p4TextStart + 16), fps, config: { damping: 20, stiffness: 260 } });

    // Cursor 1: glides to the Scan button inline with the text and clicks it
    const scanBtnX = 1490; // approx center-x of scan button on 1920px canvas
    const scanBtnY = 492;  // approx center-y
    const c1Start = p4TextStart + 22;
    const c1MoveX = interpolate(frame, [c1Start, c1Start + 24], [960, scanBtnX], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    const c1MoveY = interpolate(frame, [c1Start, c1Start + 24], [660, scanBtnY], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    const c1Visible = interpolate(frame, [c1Start, c1Start + 5], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    const clickFrame1 = c1Start + 26;
    const clickFlash1 = spring({ frame: frame - clickFrame1, fps, config: { damping: 14, stiffness: 500 } });
    const clickScale1 = 1 - interpolate(clickFlash1, [0, 0.5, 1], [0, 0.3, 0]);
    const c1FadeOut = interpolate(frame, [clickFrame1 + 2, clickFrame1 + 8], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

    // Cursor M3: glide to Send button on billing alert (now the bottom-right circle button)
    const cM3X = 1020; // Moved left to better center on Send button
    const cM3Y_Target = 972;
    const cM3Start = clickFrameM3 - 25; // cursor arrives 25f before click (was modal3Start+215, broke when modal shortened)
    // clickFrameM3 is already defined in Phase B logic above

    // Y moves: up from bottom -> target -> down to bottom
    const cM3MoveY = interpolate(frame,
        [cM3Start, cM3Start + 22, clickFrameM3 + 12, clickFrameM3 + 30],
        [height + 100, cM3Y_Target, cM3Y_Target, height + 100],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );
    // X follows the target
    const cM3MoveX = cM3X;

    const cM3Visible = interpolate(frame, [cM3Start, cM3Start + 4], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    const clickFlashM3 = spring({ frame: frame - clickFrameM3, fps, config: { damping: 14, stiffness: 500 } });
    const clickScaleM3 = 1 - interpolate(clickFlashM3, [0, 0.5, 1], [0, 0.3, 0]);
    // Fade out later, after it goes back down
    const cM3FadeOut = interpolate(frame, [clickFrameM3 + 30, clickFrameM3 + 40], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

    // Scanner opens right after the click
    const p4ScannerStart = clickFrame1 + 3;
    const scannerModalProg = spring({ frame: frame - p4ScannerStart, fps, config: { damping: 22, stiffness: 220 } });

    // Subtitle + progress bar appear after scanner is visible
    const p4SubProg = spring({ frame: frame - (p4ScannerStart + 12), fps, config: { damping: 20, stiffness: 200 } });
    const p4BarStart = p4ScannerStart + 20;
    const p4BarIn = spring({ frame: frame - p4BarStart, fps, config: { damping: 20, stiffness: 200 } });

    // Notifications — 8 milestones, slow stepped progression
    const notifs = [
        { label: '+1 item verified', threshold: 0.08, popFrame: p4BarStart + 14 },
        { label: '+3 items verified', threshold: 0.20, popFrame: p4BarStart + 48 },
        { label: '+5 items verified', threshold: 0.33, popFrame: p4BarStart + 82 },
        { label: '+7 items verified', threshold: 0.46, popFrame: p4BarStart + 116 },
        { label: '+9 items verified', threshold: 0.58, popFrame: p4BarStart + 150 },
        { label: '+11 items verified', threshold: 0.69, popFrame: p4BarStart + 188 },
        { label: '+14 items verified', threshold: 0.82, popFrame: p4BarStart + 230 },
        { label: '+16 items verified', threshold: 1.00, popFrame: p4BarStart + 280 },
    ];
    const p4Fill = (() => {
        let fill = 0;
        for (const n of notifs) {
            const stepProg = spring({ frame: frame - (n.popFrame + 8), fps, config: { damping: 16, stiffness: 140 } });
            fill = Math.max(fill, n.threshold * stepProg);
        }
        return Math.min(fill, 1);
    })();

    // Phase 5 — after progress complete: cursor2 moves to scanner X, clicks, everything exits
    const phase5Start = p4BarStart + 300;
    const xBtnX = (width - 380) / 2 + 380 + 12 - 16; // centered card right edge + X button offset = 1146
    const xBtnY = height - 28 - 298 - 12 + 16;
    const cursorMoveX = interpolate(frame, [phase5Start, phase5Start + 22], [width * 0.5, xBtnX], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    const cursorMoveY = interpolate(frame, [phase5Start, phase5Start + 22], [height * 0.6, xBtnY], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    const cursorVisible = interpolate(frame, [phase5Start, phase5Start + 4], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    const clickFlash = spring({ frame: frame - (phase5Start + 24), fps, config: { damping: 14, stiffness: 500 } });
    const clickScale = 1 - interpolate(clickFlash, [0, 0.5, 1], [0, 0.35, 0]);
    const scannerExit = spring({ frame: frame - (phase5Start + 26), fps, config: { damping: 18, stiffness: 180 } });
    const p4Exit = spring({ frame: frame - (phase5Start + 30), fps, config: { damping: 18, stiffness: 160 } });

    // Positions for drop target and invoice flow
    const winLeft = currentX - (width * 0.85 * windowScale / 2);
    const winTop = currentY - (height * 0.75 * windowScale / 2);
    const dropX = winLeft + width * 0.85 * windowScale * 0.625;
    const dropY = winTop + height * 0.75 * windowScale * 0.30;

    // Shipment slip scales up from the dropped file position (starts at frame 129 = when cursor releases)
    const invoiceRiseSpring = spring({
        frame: frame - 129,
        fps,
        config: { damping: 15, stiffness: 110 }
    });

    const invoiceRotation = interpolate(invoiceRiseSpring, [0, 0.3, 0.7, 1], [-8, 2, -1, 0]);
    const invoiceShadowSize = interpolate(invoiceRiseSpring, [0, 1], [20, 100]);
    const invoiceBlur = interpolate(invoiceRiseSpring, [0, 0.2, 0.8, 1], [4, 0, 0, 0]);

    return (
        <AbsoluteFill style={{ backgroundColor: "transparent", overflow: 'hidden', perspective: 2000 }}>
            <style>
                {`@import url('${tankerFontUrl}');`}
                {`@import url('${zodiakFontUrl}');`}
            </style>

            <div
                style={{
                    position: "absolute",
                    left: currentX,
                    top: currentY,
                    width: width * 0.85,
                    height: height * 0.75,
                    transform: `translate(-50%, -50%) scale(${windowScale}) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateX(${translateX}px)`,
                    opacity: windowOpacity * windowFinalOpacity,
                    filter: `blur(${windowBlur}px)`,
                    backgroundColor: "white",
                    borderRadius: 24,
                    boxShadow: "0 50px 100px rgba(0,0,0,0.4), 0 0 0 1px rgba(0,0,0,0.05)",
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                    zIndex: 500,
                }}
            >
                {/* Header UI - Sized exactly to POS App (52px) */}
                <header style={{
                    height: 52,
                    backgroundColor: "white",
                    borderBottom: "3px solid #ddd",
                    padding: "12px 20px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingLeft: 72,
                    flexShrink: 0,
                    fontFamily: APP_FONT_STACK,
                    opacity: headerEntrance,
                    transform: `translateY(${interpolate(headerEntrance, [0, 1], [-10, 0])}px)`,
                }}>
                    <div style={{
                        color: BRAND_BLUE,
                        fontSize: "26px",
                        fontFamily: "'Tanker', sans-serif",
                        fontWeight: 400,
                        letterSpacing: "1px",
                        lineHeight: 1.2,
                        padding: "4px 12px 2px 12px",
                        marginLeft: 48
                    }}>
                        SWFTLY
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ marginRight: 10 }}>
                            <Bell size={28} style={{ color: '#888' }} />
                        </div>
                        <HeaderButton icon={Settings} label="Settings" delay={0} />
                        <HeaderButton icon={User} label="Profile" delay={2} />
                        <HeaderButton icon={LogOut} label="Logout" delay={4} />
                    </div>
                </header>

                {/* Main Content Area */}
                <div style={{ flex: 1, position: "relative" }}>
                    {/* 1. Grid View (Bento boxes) */}
                    <main style={{
                        position: "absolute",
                        inset: 0,
                        padding: "20px 12px 12px 12px",
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 10,
                        opacity: bodyEntrance * gridOpacity,
                        transform: `scale(${gridScale})`,
                        pointerEvents: isShipmentClicked ? "none" : "auto",
                    }}>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gridTemplateRows: "repeat(3, 1fr)", gap: 10 }}>
                            <MagicBentoCard title="Statistics" spanCol={2} spanRow={2} delay={0} isWhite isOutline>
                                <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 15 }}>
                                        <div style={{ display: "flex", gap: 10 }}><DollarSign size={18} color={BRAND_BLUE} /><RotateCcw size={18} color="#888" /></div>
                                        <div style={{ fontSize: 13, color: "#666", fontWeight: 500 }}>Weekly Revenue</div>
                                    </div>
                                    <div style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: 12, paddingBottom: 15 }}>
                                        {weeklyRevenue.map((d, i) => {
                                            const h = (d.revenue / 6500) * 100;
                                            const barGrow = spring({ frame: frame - 0 - i * 2, fps: 30, config: { damping: 12, stiffness: 100 } });
                                            return (
                                                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'flex-end', gap: 8 }}>
                                                    <div style={{ backgroundColor: i % 2 === 0 ? "rgba(44, 25, 252, 0.85)" : "rgba(44, 25, 252, 0.65)", height: barGrow * h + "%", borderRadius: "10px 10px 0 0", minHeight: '6px', boxShadow: "0 4px 12px rgba(0,0,0,0.06)", display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                                        {barGrow > 0.8 && h > 30 && <span style={{ fontSize: 10, color: 'white', fontWeight: 800, transform: 'rotate(-90deg)', whiteSpace: 'nowrap' }}>${d.revenue}</span>}
                                                    </div>
                                                    <div style={{ fontSize: 11, color: "#999", textAlign: "center", fontWeight: 600 }}>{d.day}</div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div style={{ fontSize: 15, fontWeight: 800, textAlign: "center", color: "#333", borderTop: "1px solid #eee", paddingTop: 10 }}>Weekly Revenue (Last 7 Days)</div>
                                </div>
                            </MagicBentoCard>
                            <MagicBentoCard title="Inventory" delay={1} scaling={interpolate(bentoClickProg, [0, 0.2, 0.6, 1], [1, 0.96, 1.02, 1])} />
                            <MagicBentoCard title="Accounting" delay={2} />
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gridTemplateRows: "repeat(3, 1fr)", gap: 10 }}>
                            <MagicBentoCard title="Calendar" delay={3} />
                            <MagicBentoCard title="POS" delay={4} />
                            <MagicBentoCard title="Orders" delay={5} />
                            <MagicBentoCard title="Customers" delay={6} />
                            <MagicBentoCard title="Product Log" delay={7} />
                            <MagicBentoCard title="Tables" delay={8} />
                        </div>
                    </main>

                    {/* 2. Shipment Detail View (ACTUAL POS APP UI) */}
                    <div style={{
                        position: "absolute",
                        inset: 0,
                        backgroundColor: "white",
                        opacity: shipmentViewOpacity,
                        display: "flex",
                        flexDirection: "column",
                        pointerEvents: isShipmentClicked ? "auto" : "none",
                    }}>
                        <ShipmentVerificationUI progress={shipmentViewOpacity} />

                    </div>
                </div>
            </div>

            {/* File-drag cursor — appears after MacDock cursor exits (Global 163 = Local 98), positioned over full scene (above toolbar) */}
            {frame >= 98 && frame < 134 && (() => {
                const startCX = winLeft + width * 0.85 * windowScale * 0.50;
                const startCY = winTop + height * 0.75 * windowScale * 1.00;
                const cX = interpolate(frame, [98, 121], [startCX, dropX], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
                const cY = interpolate(frame, [98, 121], [startCY, dropY], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
                const dropArrival = interpolate(frame, [121, 129], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
                const released = dropArrival > 0.5;
                const fileOpacity = interpolate(frame, [129, 134], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
                const cardTilt = interpolate(frame, [98, 121], [-6, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

                return (
                    <div style={{
                        position: 'absolute',
                        left: cX,
                        top: cY,
                        opacity: fileOpacity,
                        zIndex: 9999,
                        pointerEvents: 'none',
                        transform: `translate(-8px, -8px)`,
                    }}>
                        {/* Document preview card — now positioned below the hand */}
                        <div style={{
                            position: 'absolute',
                            top: 20,
                            left: -45,
                            width: 820,
                            overflow: 'hidden',
                            opacity: 0.98,
                            transform: `rotate(${cardTilt}deg) scale(0.11)`,
                            transformOrigin: 'top left',
                            boxShadow: '0 32px 80px rgba(0,0,0,0.35), 0 4px 12px rgba(0,0,0,0.22)',
                        }}>
                            <InvoiceDraft />
                        </div>

                        {/* Filename Pill — positioned beneath the mini invoice */}
                        <div style={{
                            position: 'absolute',
                            top: 160,
                            left: -60,
                            backgroundColor: 'white',
                            padding: '6px 14px',
                            borderRadius: 12,
                            boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            border: '1px solid rgba(0,0,0,0.06)',
                            whiteSpace: 'nowrap',
                            zIndex: 10,
                        }}>
                            <FileText size={16} color={BRAND_BLUE} strokeWidth={2.5} />
                            <span style={{
                                fontSize: 14,
                                fontWeight: 700,
                                color: '#1a1a1a',
                                fontFamily: APP_FONT_STACK,
                                letterSpacing: '-0.01em'
                            }}>
                                invoice_KP_03_2026.pdf
                            </span>
                        </div>

                        {/* Hand cursor — rendered at the root of the follow-div so it stays at the top */}
                        <svg width="54" height="64" viewBox="0 0 54 64" fill="none" xmlns="http://www.w3.org/2000/svg"
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                filter: 'drop-shadow(1px 3px 5px rgba(0,0,0,0.4))',
                                zIndex: 20
                            }}>
                            {released ? (
                                // Open releasing hand
                                <g>
                                    <path d="M10 38 C10 48 18 56 27 56 C36 56 44 48 44 38 L44 22 C44 20 42 18 40 18 C38 16 36 16 35 18 L35 16 C35 14 33 12 31 12 C29 10 27 10 26 12 L26 10 C26 8 24 6 22 6 C20 4 18 6 18 8 L18 28 C17 26 15 24 13 24 C11 24 9 26 9 28 C9 30 10 34 10 38 Z"
                                        fill="white" stroke="#111" strokeWidth="2" strokeLinejoin="round" />
                                    <path d="M26 12 L26 6 M31 12 L32 6 M35 18 L37 12 M40 22 L42 16" stroke="#aaa" strokeWidth="1" strokeLinecap="round" />
                                </g>
                            ) : (
                                // Closed grabbing hand (fist)
                                <g>
                                    <path d="M12 36 C12 46 20 54 27 54 C34 54 42 46 42 36 L42 26 C42 24 40 22 38 22 L38 28 C38 26 36 24 34 24 L34 28 C34 26 32 24 30 24 L30 28 C30 26 28 24 26 24 L26 28 C25 26 23 24 21 25 C19 26 17 28 16 30 L12 36 Z"
                                        fill="white" stroke="#111" strokeWidth="2" strokeLinejoin="round" />
                                    <path d="M26 28 Q28 26 30 28 M30 28 Q32 26 34 28 M34 28 Q36 26 38 28" stroke="#ccc" strokeWidth="1" fill="none" />
                                    <path d="M26 28 C24 26 20 26 18 28 C16 30 16 32 18 34" stroke="#111" strokeWidth="2" fill="none" strokeLinecap="round" />
                                </g>
                            )}
                        </svg>
                    </div>
                );
            })()}

            {/* Invoice — pops in from the drop zone position and scales up into full document */}
            {invoiceRiseSpring > 0.01 && (
                <div style={{
                    position: 'absolute',
                    left: interpolate(invoiceRiseSpring, [0, 1], [dropX, width / 2]),
                    top: interpolate(invoiceRiseSpring, [0, 1], [dropY + 85, height * 0.65]),
                    transform: `translateX(-50%) translateY(calc(-50% + ${docExit * 1000}px)) scale(${interpolate(invoiceRiseSpring, [0, 1], [0.11, 1.15])}) rotate(${invoiceRotation}deg)`,
                    transformOrigin: 'center center',
                    opacity: interpolate(invoiceRiseSpring, [0, 0.1], [0, 1]),
                    boxShadow: `0 ${invoiceShadowSize / 2}px ${invoiceShadowSize}px rgba(0,0,0,${interpolate(invoiceRiseSpring, [0, 1], [0.15, 0.35])})`,
                    filter: `blur(${invoiceBlur}px)`,
                    zIndex: 700,
                    pointerEvents: 'none',
                    overflow: 'hidden',
                    borderRadius: 0,
                }}>
                    <InvoiceDraft
                        contactHighlight={contactHighlight}
                        activeRow={finalActiveRow}
                        activeRowProg={finalRowProg}
                    />


                </div>
            )}

            {/* Inventory Add Modal */}

            {/* Modal 3 — Shipment Issue Alert, bottom center */}
            {modal3Progress > 0.01 && (
                <div style={{
                    position: 'absolute',
                    left: '50%',
                    bottom: 40,
                    // Scales up from 0.6× — visible pop-in from smaller size
                    transform: `translateX(-80%) scale(${interpolate(modal3Progress, [0, 1], [0.6, 1]) * interpolate(modal3ExitProg, [0, 1], [1, 0])})`,
                    transformOrigin: 'bottom center',
                    width: 860,
                    opacity: (1 - modal3ExitProg) * modal3Progress,
                    // Much softer red background
                    background: [
                        'linear-gradient(145deg, rgba(220,40,40,0.38) 0%, rgba(220,40,40,0.12) 40%, rgba(220,40,40,0.06) 55%, rgba(220,40,40,0.28) 100%)',
                        'rgba(220,40,40,0.08)',
                    ].join(', '),
                    backdropFilter: 'blur(52px) saturate(1.55)',
                    WebkitBackdropFilter: 'blur(52px) saturate(1.55)',
                    borderRadius: 36,
                    border: '1px solid rgba(220,40,40,0.45)',
                    boxShadow: [
                        '0 0 0 1px rgba(255,255,255,0.55)',
                        '0 0 0 2px rgba(220,40,40,0.25)',
                        '0 -8px 40px rgba(220,40,40,0.15)',
                        'inset 0 1px 0 rgba(255,255,255,0.50)',
                        'inset 0 -1px 0 rgba(255,255,255,0.10)',
                    ].join(', '),
                    overflow: 'hidden',
                    fontFamily: APP_FONT_STACK,
                    zIndex: 900,
                }}>
                    {/* Header — always visible immediately */}
                    <div style={{ padding: '24px 40px 12px', display: 'flex', alignItems: 'center', gap: 20 }}>
                        <AlertTriangle size={42} color="#c0180f" strokeWidth={2.8} style={{ flexShrink: 0 }} />
                        <div style={{ fontSize: 38, fontWeight: 850, color: '#111', lineHeight: 1.1 }}>Swftly Detects &amp; Resolves Issues</div>
                    </div>



                    {/* Email compose — skeleton fields fill in sequentially */}
                    <div style={{ padding: '4px 40px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>


                        {/* TO field */}
                        {[
                            { label: 'TO', value: 'orders@kitchenprosupply.com', prog: emailTo, red: true },
                            { label: 'RE', value: 'Pricing Discrepancy — Invoice INV-2026-04471', prog: emailSubj, red: true },
                        ].map((row, i) => {
                            const isFilled = row.prog > 0.05;
                            return (
                                <div key={i} style={{
                                    background: interpolateColors(row.prog, [0, 0.1], [`rgba(0,0,0,${skeletonPulse * 0.04})`, 'rgba(255,255,255,0.28)']),
                                    border: `1.5px solid ${interpolateColors(row.prog, [0, 0.1], [`rgba(0,0,0,${skeletonPulse * 0.07})`, 'rgba(220,40,40,0.35)'])}`,
                                    borderRadius: 14, padding: '0 24px', display: 'flex', alignItems: 'center', gap: 16, height: 68,
                                }}>
                                    <span style={{ fontSize: 14, fontWeight: 850, color: '#111', letterSpacing: 1.2, minWidth: 40 }}>{row.label}</span>
                                    {row.prog > 0.01 ? (
                                        <SmoothCharReveal
                                            text={row.value}
                                            progress={row.prog}
                                            style={{ fontSize: 26, color: '#111', fontWeight: 600, flex: 1, overflow: 'hidden', whiteSpace: 'nowrap' }}
                                        />
                                    ) : (
                                        <div style={{ height: 20, width: '55%', background: `rgba(0,0,0,${skeletonPulse * 0.1})`, borderRadius: 8 }} />
                                    )}
                                </div>
                            );
                        })}

                        {/* Email body */}
                        <div style={{
                            background: emailBody > 0.05 ? 'rgba(255,255,255,0.28)' : `rgba(0,0,0,${skeletonPulse * 0.04})`,
                            border: emailBody > 0.05 ? '1.5px solid rgba(220,40,40,0.35)' : `1.5px solid rgba(0,0,0,${skeletonPulse * 0.07})`,
                            borderRadius: 14, padding: '24px', height: 260, overflow: 'hidden', position: 'relative'
                        }}>
                            {emailBody > 0.05 ? (
                                <>
                                    {/* Scrolling container — translateY scrolls content up as it reveals */}
                                    <div style={{
                                        transform: `translateY(${interpolate(emailBody, [0, 1], [0, -200])}px)`,
                                        transition: 'none',
                                    }}>
                                        <SmoothCharReveal
                                            text={`Hi Sarah,

I hope this message finds you well. I am writing on behalf of Maple Street Kitchen Store regarding Invoice INV-2026-04471 (PO-88321), dated March 3, 2026.

Upon processing your invoice, our Swftly procurement system automatically flagged a unit price discrepancy on the following line item:

  Item:      Stainless Mixing Bowl Set (3-Pc) — KP-BW-3302
  Invoiced:  $36.00/unit × 10 units = $360.00
  Agreed:    $32.00/unit × 10 units = $320.00
  Variance:  $4.00/unit | Total Due: $40.00 credit

Per our current vendor pricing agreement effective January 1, 2026, the contracted unit rate for SKU KP-BW-3302 is $32.00. We kindly request that KitchenPro Supply issue a credit memo in the amount of $40.00 against Invoice INV-2026-04471, referencing PO-88321.

If you believe this was issued in error, please forward an updated copy of the current pricing schedule at your earliest convenience. We would like to resolve this prior to the Net 30 payment window closing on April 2, 2026.

Thank you for your prompt attention to this matter. We value our continued partnership and look forward to your swift resolution.

Warm regards,
Marcus T.
Procurement & Accounts Payable
Maple Street Kitchen Store
+1 (718) 555-0192 · accounting@maplekitchen.com`}
                                            progress={emailBody}
                                            style={{ whiteSpace: 'pre-wrap', display: 'block', lineHeight: 1.6, letterSpacing: '0.3px', fontSize: 22, color: '#111', fontWeight: 500 }}
                                        />
                                    </div>
                                    <div style={{
                                        position: 'absolute',
                                        bottom: 0,
                                        left: 0,
                                        right: 0,
                                        height: 80,
                                        background: 'linear-gradient(transparent, rgba(255,255,255,0.5))',
                                        pointerEvents: 'none',
                                    }} />
                                    {/* Professional Scroll Handle to imply more content */}
                                    <div style={{
                                        position: 'absolute',
                                        right: 12,
                                        top: 24,
                                        bottom: 24,
                                        width: 6,
                                        background: 'rgba(220,40,40,0.08)',
                                        borderRadius: 3
                                    }}>
                                        <div style={{
                                            position: 'absolute',
                                            top: interpolate(emailBody, [0, 1], [0, 40]),
                                            left: 0,
                                            width: '100%',
                                            height: 60,
                                            background: 'rgba(220,40,40,0.3)',
                                            borderRadius: 3,
                                            border: '1px solid rgba(220,40,40,0.15)'
                                        }} />
                                    </div>
                                </>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                    <div style={{ height: 22, width: '40%', background: `rgba(0,0,0,${skeletonPulse * 0.1})`, borderRadius: 6 }} />
                                    <div style={{ height: 22, width: '90%', background: `rgba(0,0,0,${skeletonPulse * 0.08})`, borderRadius: 6, marginTop: 12 }} />
                                    <div style={{ height: 22, width: '65%', background: `rgba(0,0,0,${skeletonPulse * 0.06})`, borderRadius: 6 }} />
                                </div>
                            )}
                        </div>

                        {/* Circular Send button — pops in at bottom right after typing finishes */}
                        <div style={{
                            position: 'absolute',
                            bottom: 32,
                            right: 32,
                            transform: `scale(${sendProg * clickScaleM3})`,
                            opacity: frame >= clickFrameM3 + 2 ? 0 : 1, // Disappears after click
                            pointerEvents: 'none',
                            zIndex: 10
                        }}>
                            <div style={{
                                width: 96,
                                height: 96,
                                borderRadius: '50%',
                                background: 'linear-gradient(135deg, #e11d48 0%, #be123c 100%)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                boxShadow: '0 10px 25px rgba(190, 18, 60, 0.4), inset 0 2px 2px rgba(255,255,255,0.3)',
                                border: '2px solid rgba(255,255,255,0.1)'
                            }}>
                                <Send size={42} strokeWidth={2.5} fill="white" />
                            </div>
                        </div>
                    </div>
                </div>
            )}


            {/* Cursor M3 — pops in, clicks Send button on the issue modal, exits below */}
            {cM3Visible > 0 && (
                <div style={{
                    position: 'absolute',
                    left: cM3MoveX,
                    top: cM3MoveY,
                    opacity: cM3Visible * cM3FadeOut,
                    transform: `scale(${clickScaleM3})`,
                    pointerEvents: 'none',
                    zIndex: 9999,
                    width: 64,
                    height: 64,
                }}>
                    {/* Mac-style arrow cursor */}
                    <svg width="64" height="64" viewBox="0 0 36 36" fill="none">
                        <path
                            d="M6 4 L6 28 L11 23 L15.5 32 L18.5 30.5 L14 21.5 L21 21.5 Z"
                            fill="white"
                            stroke="black"
                            strokeWidth="1.5"
                            strokeLinejoin="round"
                        />
                    </svg>
                </div>
            )}



        </AbsoluteFill>
    );
};


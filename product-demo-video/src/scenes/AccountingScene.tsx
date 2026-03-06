import React from 'react';
import {
    AbsoluteFill,
    interpolate,
    spring,
    useCurrentFrame,
    useVideoConfig,
} from 'remotion';
import {
    FolderOpen,
    Settings as SettingsIcon,
    BookOpen,
    ArrowLeftRight,
    Library,
    FileBarChart,
    FileText,
    Truck,
    LayoutDashboard,
    Search,
} from 'lucide-react';

const BRAND_BLUE = '#2c19fc';
const APP_FONT_STACK = "'Inter', 'SF Pro Display', -apple-system, sans-serif";

const REPORTS = [
    { name: 'Trial Balance_2024-03-01.pdf', saved: 'Today · 12:45 PM' },
    { name: 'Profit and Loss_Q1_Final.xlsx', saved: 'Yesterday · 4:12 PM' },
    { name: 'Balance Sheet_2024-02-29.pdf', saved: 'Feb 29, 2024 · 9:00 AM' },
    { name: 'Cash Flow Statement_Feb.csv', saved: 'Feb 28, 2024 · 11:30 PM' },
];

const SHIPMENTS = [
    { name: 'UPS_Label_Shipment_99182.pdf', saved: 'Today · 2:15 PM' },
    { name: 'FedEx_Commercial_Invoice_EU.pdf', saved: 'Yesterday · 3:45 PM' },
];

export const AccountingScene: React.FC = () => {
    const frame = useCurrentFrame();
    const { fps, width, height } = useVideoConfig();

    // Opening animation: slides up from bottom
    const openProg = spring({
        frame,
        fps,
        config: { damping: 20, stiffness: 120 },
    });

    const windowY = interpolate(openProg, [0, 1], [height, height * 0.15]);
    const windowOpacity = interpolate(openProg, [0, 0.1, 1], [0, 1, 1]);

    const isDarkMode = false; // Using the light theme for better visibility in the video
    const textColor = '#111827';
    const textSecondary = '#6b7280';
    const borderColor = '#e5e7eb';
    const bgPrimary = '#ffffff';
    const bgSecondary = '#f9fafb';

    return (
        <AbsoluteFill style={{ backgroundColor: 'white', fontFamily: APP_FONT_STACK, overflow: 'hidden' }}>
            {/* The persistent text from the previous scene is handled by the caller or stays rendered */}

            {/* App Window Wrapper */}
            <div style={{
                position: 'absolute',
                top: windowY,
                left: '10%',
                width: '80%',
                height: height * 0.8,
                backgroundColor: bgPrimary,
                borderRadius: '16px 16px 0 0',
                boxShadow: '0 -20px 50px rgba(0,0,0,0.15)',
                border: `1px solid ${borderColor}`,
                opacity: windowOpacity,
                display: 'flex',
                overflow: 'hidden',
            }}>
                {/* 1. Sidebar */}
                <div style={{
                    width: '240px',
                    borderRight: `1px solid ${borderColor}`,
                    backgroundColor: bgPrimary,
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '24px 0',
                }}>
                    <div style={{ padding: '0 20px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                            width: 32, height: 32, borderRadius: 8,
                            backgroundColor: 'rgba(59, 130, 246, 0.1)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#3b82f6'
                        }}>
                            <LayoutDashboard size={18} />
                        </div>
                        <span style={{ fontWeight: 700, fontSize: 15, color: textColor }}>Accounting</span>
                    </div>

                    {[
                        { icon: FolderOpen, label: 'Directory', active: true },
                        { icon: SettingsIcon, label: 'Settings' },
                        { icon: BookOpen, label: 'Chart of Accounts' },
                        { icon: ArrowLeftRight, label: 'Transactions' },
                        { icon: Library, label: 'Ledger' },
                        { icon: FileBarChart, label: 'Statements' },
                        { icon: FileText, label: 'Invoices' },
                        { icon: Truck, label: 'Vendors' },
                    ].map((item, i) => (
                        <div key={item.label} style={{
                            padding: '10px 20px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            backgroundColor: item.active ? 'rgba(0,0,0,0.04)' : 'transparent',
                            color: item.active ? textColor : textSecondary,
                            fontWeight: item.active ? 600 : 500,
                            fontSize: 14,
                            cursor: 'pointer',
                        }}>
                            <item.icon size={18} strokeWidth={item.active ? 2.5 : 2} />
                            {item.label}
                        </div>
                    ))}
                </div>

                {/* 2. Main Content */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '40px 48px', overflow: 'hidden' }}>
                    <div style={{ marginBottom: 32 }}>
                        <h1 style={{ fontSize: 24, fontWeight: 700, color: textColor, marginBottom: 8 }}>Directory</h1>
                        <p style={{ fontSize: 14, color: textSecondary }}>Manage your saved reports and shipment documentation.</p>
                    </div>

                    {/* Search Bar */}
                    <div style={{ position: 'relative', marginBottom: 32 }}>
                        <Search size={18} style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', color: textSecondary }} />
                        <div style={{
                            borderBottom: `2px solid ${borderColor}`,
                            padding: '8px 0 8px 28px',
                            fontSize: 14,
                            color: textSecondary,
                            width: '100%',
                        }}>
                            Search reports and documents...
                        </div>
                    </div>

                    {/* Tables */}
                    <div style={{ flex: 1, overflowY: 'auto' }}>
                        <h4 style={{ fontSize: 16, fontWeight: 600, color: textColor, marginBottom: 16 }}>Saved Reports</h4>
                        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 40 }}>
                            <thead style={{ backgroundColor: bgSecondary }}>
                                <tr>
                                    <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: 11, fontWeight: 600, color: textSecondary, textTransform: 'uppercase' }}>Name</th>
                                    <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: 11, fontWeight: 600, color: textSecondary, textTransform: 'uppercase' }}>Saved</th>
                                    <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: 11, fontWeight: 600, color: textSecondary, textTransform: 'uppercase' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {REPORTS.map((report, i) => (
                                    <tr key={i} style={{ borderBottom: `1px solid ${borderColor}` }}>
                                        <td style={{ padding: '14px 16px', fontSize: 14, color: textColor, fontWeight: 500 }}>{report.name}</td>
                                        <td style={{ padding: '14px 16px', fontSize: 13, color: textSecondary }}>{report.saved}</td>
                                        <td style={{ padding: '14px 16px', textAlign: 'right', color: textSecondary }}>⋯</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <h4 style={{ fontSize: 16, fontWeight: 600, color: textColor, marginBottom: 16 }}>Shipment Documents</h4>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead style={{ backgroundColor: bgSecondary }}>
                                <tr>
                                    <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: 11, fontWeight: 600, color: textSecondary, textTransform: 'uppercase' }}>Name</th>
                                    <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: 11, fontWeight: 600, color: textSecondary, textTransform: 'uppercase' }}>Uploaded</th>
                                    <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: 11, fontWeight: 600, color: textSecondary, textTransform: 'uppercase' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {SHIPMENTS.map((ship, i) => (
                                    <tr key={i} style={{ borderBottom: `1px solid ${borderColor}` }}>
                                        <td style={{ padding: '14px 16px', fontSize: 14, color: textColor, fontWeight: 500 }}>{ship.name}</td>
                                        <td style={{ padding: '14px 16px', fontSize: 13, color: textSecondary }}>{ship.saved}</td>
                                        <td style={{ padding: '14px 16px', textAlign: 'right', color: textSecondary }}>⋯</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </AbsoluteFill>
    );
};

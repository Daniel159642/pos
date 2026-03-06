'use client';

import { motion, AnimatePresence } from 'motion/react';
import { useState, useRef, useEffect } from 'react';
import { Upload, Scan, FileSearch, Store, FileText, FileImage, FileSpreadsheet, Package, RefreshCw, Building2, AlertCircle, TriangleAlert, Mail, Send, MousePointer2, Check, Shirt, Watch, ShoppingBag } from 'lucide-react';

/* 
  ARCHIVED HERO ANIMATIONS
  This file contains the interactive steps from the first section of the Hero.
  To restore them, copy these components back into page.tsx.
*/

const Counter = ({ targetValue, delay }: { targetValue: number; delay: number }) => {
    const [count, setCount] = useState(0);

    useEffect(() => {
        let timeout = setTimeout(() => {
            let current = 0;
            const interval = setInterval(() => {
                if (current >= targetValue) {
                    clearInterval(interval);
                } else {
                    current += Math.ceil(targetValue / 20);
                    if (current > targetValue) current = targetValue;
                    setCount(current);
                }
            }, 30);
        }, delay * 1000);

        return () => clearTimeout(timeout);
    }, [targetValue, delay]);

    return <>{count}</>;
};

export const UploadMockup = ({ isHovered }: { isHovered: boolean }) => {
    return (
        <div className="absolute inset-0 flex items-center justify-center p-8 z-20">
            <motion.div
                className="w-full h-full border-2 border-dashed border-white/40 rounded-xl flex flex-col items-center justify-center relative overflow-hidden bg-white/40 backdrop-blur-md shadow-[0_8px_32px_0_rgba(255,255,255,0.18)]"
                animate={{
                    borderColor: isHovered ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.4)',
                    backgroundColor: isHovered ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.4)',
                }}
            >
                {/* Inner Gradient Border Effect */}
                <div className="absolute inset-0 rounded-[10px] border border-white/50 pointer-events-none px-[1.5px] py-[1.5px] m-[1px]">
                    <div className="w-full h-full rounded-[8px] border border-white/20" />
                </div>

                <div className="flex flex-col items-center relative z-10">
                    <Upload size={32} className="text-white/60 mb-3" />
                    <span className="text-white/80 font-black text-xs tracking-[0.2em] uppercase font-sans">Drop files</span>
                </div>
            </motion.div>

            <AnimatePresence>
                {isHovered && (
                    <motion.div
                        key="drag-animation"
                        initial={{ x: 200, y: 200, opacity: 0 }}
                        animate={{ x: 0, y: 25, opacity: 1 }}
                        exit={{ opacity: 0, x: 200, y: 200, transition: { duration: 0.4 } }}
                        transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
                        className="absolute z-50 pointer-events-none"
                    >
                        <div className="relative">
                            <div className="absolute -top-20 -left-14 flex flex-col opacity-100 scale-90">
                                <motion.div
                                    initial={{ x: 10, opacity: 0 }}
                                    animate={{ x: 0, opacity: 1 }}
                                    transition={{ delay: 0.2 }}
                                    className="w-fit h-9 bg-white rounded-md shadow-lg border border-gray-100 px-3 flex items-center gap-3 -rotate-[2deg] relative z-10"
                                >
                                    <FileSpreadsheet size={18} className="text-green-600" />
                                    <span className="text-[12px] font-extrabold text-[#111] whitespace-nowrap">inventory.xls</span>
                                </motion.div>

                                <motion.div
                                    initial={{ x: 20, opacity: 0 }}
                                    animate={{ x: 5, opacity: 1 }}
                                    transition={{ delay: 0.3 }}
                                    className="w-fit h-9 bg-white rounded-md shadow-lg border border-gray-100 px-3 flex items-center gap-3 translate-y-[-12px] rotate-[1deg] relative z-20"
                                >
                                    <FileText size={18} className="text-red-500" />
                                    <span className="text-[12px] font-extrabold text-[#111] whitespace-nowrap">invoice.pdf</span>
                                </motion.div>

                                <motion.div
                                    initial={{ x: 30, opacity: 0 }}
                                    animate={{ x: 10, opacity: 1 }}
                                    transition={{ delay: 0.4 }}
                                    className="w-fit h-9 bg-white rounded-md shadow-lg border border-gray-100 px-3 flex items-center gap-3 translate-y-[-24px] -rotate-[1deg] relative z-30"
                                >
                                    <FileImage size={18} className="text-blue-500" />
                                    <span className="text-[12px] font-extrabold text-[#111] whitespace-nowrap">photo.jpg</span>
                                </motion.div>
                            </div>
                            <MousePointer2 size={36} className="text-white fill-black drop-shadow-[0_5px_15px_rgba(0,0,0,0.3)]" />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export const AIExtractionMockup = ({ isHovered }: { isHovered: boolean }) => {
    const [isExtracted, setIsExtracted] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [key, setKey] = useState(0);

    useEffect(() => {
        let timeout: NodeJS.Timeout;
        if (isHovered) {
            setIsExtracted(false);
            setIsScanning(true);
            setKey(prev => prev + 1);
            timeout = setTimeout(() => {
                setIsScanning(false);
                setIsExtracted(true);
            }, 1200);
        } else {
            if (isScanning) setIsScanning(false);
        }
        return () => clearTimeout(timeout);
    }, [isHovered]);

    return (
        <div className="absolute inset-0 flex items-center justify-center p-8 z-20 overflow-hidden">
            <div className="relative w-28 h-36 bg-white/40 backdrop-blur-md rounded-xl shadow-[0_8px_32px_0_rgba(255,255,255,0.18)] border border-white/40 flex flex-col p-3 overflow-hidden">
                <div className="absolute inset-0 rounded-xl border border-blue-700/30 pointer-events-none px-[1.5px] py-[1.5px]">
                    <div className="w-full h-full rounded-[10px] border border-blue-600/10" />
                </div>
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-blue-700/20 via-transparent to-blue-800/10 pointer-events-none" />

                <div className="w-8 h-1.5 bg-blue-700/60 rounded-full mb-3" />
                <div className="w-full space-y-1.5 px-0.5">
                    <div className="w-full h-0.5 bg-blue-600/40 rounded-full" />
                    <div className="w-[80%] h-0.5 bg-blue-600/40 rounded-full" />
                </div>

                <div className="mt-4 space-y-3 px-1">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="flex justify-between items-center">
                            <div className="w-10 h-0.5 bg-blue-700/60 rounded-full" />
                            <div className="w-4 h-0.5 bg-blue-700/60 rounded-full" />
                        </div>
                    ))}
                </div>

                <AnimatePresence mode="wait">
                    {isScanning && (
                        <motion.div
                            key={`scan-bar-${key}`}
                            initial={{ top: -10 }}
                            animate={{ top: '100%' }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 1.2, ease: "linear" }}
                            className="absolute left-0 right-0 h-1 z-30 bg-gradient-to-r from-transparent via-[#2c19fc]/40 to-transparent shadow-[0_0_15px_rgba(44,25,252,0.6)]"
                        />
                    )}
                </AnimatePresence>
            </div>

            <AnimatePresence>
                {isExtracted && (
                    <div className="absolute inset-0 pointer-events-none z-40">
                        {[
                            { label: '$142.50', x: -50, y: -35, delay: 0.1, color: 'text-blue-600' },
                            { label: 'Vendor X', x: 55, y: -15, delay: 0.2, color: 'text-indigo-600' },
                            { label: '6 Items', x: -45, y: 30, delay: 0.3, color: 'text-emerald-600' },
                            { label: 'Processed', x: 50, y: 55, delay: 0.4, color: 'text-green-600' }
                        ].map((chip, idx) => (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
                                animate={{ opacity: 1, scale: 1, x: chip.x, y: chip.y }}
                                exit={{ opacity: 0, scale: 0 }}
                                transition={{ delay: chip.delay, type: 'spring', stiffness: 200, damping: 15 }}
                                className="absolute left-1/2 top-1/2 -ml-12 -mt-4 bg-white/30 backdrop-blur-xl px-2.5 py-1 rounded-full shadow-[0_10px_40px_rgba(0,0,0,0.1)] border border-white/60 flex items-center gap-2"
                            >
                                <div className={`w-1.5 h-1.5 rounded-full bg-current ${chip.color}`} />
                                <span className={`text-[9px] font-black uppercase tracking-tight ${chip.color}`}>{chip.label}</span>
                            </motion.div>
                        ))}
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export const PrecisionProofingMockup = ({ isHovered }: { isHovered: boolean }) => {
    return (
        <div className="absolute inset-0 flex items-center justify-center p-8 z-20 overflow-hidden">
            <div className="relative w-28 h-36 bg-white/40 backdrop-blur-md rounded-xl shadow-[0_8px_32px_0_rgba(239,68,68,0.3)] border border-red-500/40 flex flex-col p-3 overflow-hidden">
                <div className="absolute inset-0 rounded-xl border border-red-500/50 pointer-events-none px-[1.5px] py-[1.5px]">
                    <div className="w-full h-full rounded-[10px] border border-red-400/20" />
                </div>
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-red-500/20 via-transparent to-red-600/10 pointer-events-none" />

                <div className="w-8 h-1.5 bg-white/40 rounded-full mb-3" />
                <div className="w-full space-y-1.5">
                    <div className="w-full h-0.5 bg-white/20 rounded-full" />
                    <div className="w-[80%] h-0.5 bg-white/20 rounded-full" />
                </div>

                <div className="mt-4 space-y-3 px-1">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="flex justify-between items-center">
                            <div className="w-12 h-0.5 bg-white/30 rounded-full" />
                            <div className="w-6 h-0.5 bg-white/30 rounded-full" />
                        </div>
                    ))}
                </div>

                <motion.div
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.5, duration: 0.4 }}
                    className="absolute right-3 bottom-12"
                >
                    <div className="w-5 h-5 rounded-full bg-red-600 flex items-center justify-center border border-white/20 shadow-lg">
                        <TriangleAlert className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: '100%' }}
                    className="absolute top-[108px] left-0 h-4 bg-red-500/10 pointer-events-none"
                />
            </div>

            <AnimatePresence>
                {isHovered && (
                    <div className="absolute inset-0 pointer-events-none z-40 flex items-center justify-center">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.8, x: 0 }}
                            animate={{ opacity: 1, scale: 1, x: 0 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                            className="relative bg-gradient-to-br from-red-500 to-red-700 px-4 py-2 rounded-xl shadow-[0_15px_45px_rgba(220,38,38,0.4)] flex items-center gap-4 overflow-hidden"
                        >
                            <div className="absolute inset-0 rounded-xl border border-white/40 pointer-events-none" />
                            <div className="absolute inset-[1px] rounded-[11px] border border-white/10 pointer-events-none" />
                            <Mail className="w-5 h-5 text-white relative z-10" />
                            <div className="flex flex-col relative z-10">
                                <span className="text-white text-[10px] font-black uppercase tracking-tight">Email Sent</span>
                                <span className="text-white/80 text-[8px] font-bold">Query: Price Mismatch</span>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export const LiveInventoryMockup = ({ isHovered }: { isHovered: boolean }) => {
    const rows = [
        { initial: 0.8, target: 1.0, icon: Shirt },
        { initial: 0.1, target: 0.8, icon: Watch },
        { initial: 0.4, target: 0.95, icon: ShoppingBag },
        { initial: 0.2, target: 1.0, icon: Package }
    ];

    return (
        <div className="absolute inset-0 flex items-center justify-center p-6 z-20 overflow-hidden">
            <div className="relative w-44 h-36 bg-white/40 backdrop-blur-md rounded-lg border border-white/40 shadow-[0_8px_32px_0_rgba(255,255,255,0.18),inset_0_0_0_1px_rgba(255,255,255,0.2)] flex flex-col p-3 overflow-hidden">
                <div className="flex items-center justify-center mb-1">
                    <span className="text-[10px] font-black text-white/90 tracking-[0.2em] uppercase">Inventory</span>
                </div>
                <div className="w-full h-px bg-white/10 mb-1" />
                <div className="space-y-2">
                    {rows.map((row, idx) => (
                        <div key={idx} className="flex items-center gap-3">
                            <div className="shrink-0 w-4 h-4 flex items-center justify-center">
                                <row.icon size={15} className="text-white/70" />
                            </div>
                            <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden relative">
                                <motion.div
                                    initial={{ width: `${row.initial * 100}%` }}
                                    animate={{ width: isHovered ? `${row.target * 100}%` : `${row.initial * 100}%` }}
                                    transition={{
                                        delay: isHovered ? idx * 0.1 : 0,
                                        duration: 0.6,
                                        ease: "circOut"
                                    }}
                                    className="absolute inset-y-0 left-0 bg-blue-700 shadow-[0_0_8px_rgba(29,78,216,0.6)] rounded-full"
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

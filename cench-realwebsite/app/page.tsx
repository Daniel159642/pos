'use client';

import Image from 'next/image';
import { motion, AnimatePresence } from 'motion/react';
import { useState, useRef, useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}
import BlurText from './components/BlurText';
import LogoLoop from './components/LogoLoop';
import { ArrowUpRight, Settings, User, LogOut, Bell, Camera, CreditCard, Search, Check, ChevronRight, ChevronDown, Upload, Scan, FileSearch, Store, FileText, FileImage, FileSpreadsheet, Package, RefreshCw, Building2, AlertCircle, TriangleAlert, Mail, Send, MousePointer2, LayoutDashboard, FolderOpen, BookOpen, ArrowLeftRight, Library, FileBarChart, Truck, TrendingUp, DollarSign, Users, Activity, ClipboardList, SquareArrowOutUpRight, Plus, Gift, Ticket, UserPlus, Shirt, Watch, Smartphone, ShoppingBag, Monitor, ScanLine, Utensils } from 'lucide-react';
import Link from 'next/link';
import ThreeLogo, { StaticLogo } from "./components/ThreeLogo";
import GradualBlur from './components/GradualBlur';

import Grainient from './components/Grainient';
import ScrollReveal from './components/ScrollReveal';

const NotificationCard = ({
  icon,
  title,
  subtitle,
  accentColor,
  accentRgb,
  className = ""
}: {
  icon: string,
  title: string,
  subtitle: string,
  accentColor: string,
  accentRgb: string,
  className?: string
}) => (
  <div className={`flex items-center gap-4 p-3.5 rounded-[22px] border border-white/60 backdrop-blur-[32px] shadow-[0_15px_35px_rgba(0,0,0,0.1),0_5px_15px_rgba(0,0,0,0.05)] ${className}`}
    style={{
      background: `linear-gradient(135deg, rgba(255,255,255,0.85) 0%, rgba(${accentRgb},0.15) 100%)`,
      backgroundColor: 'rgba(255, 255, 255, 0.8)',
      fontFamily: 'var(--font-geist-sans), Inter, system-ui, sans-serif'
    }}
  >
    {/* Inner Highlight for Glass Effect */}
    <div className="absolute inset-0 rounded-[22px] border border-white/50 pointer-events-none" />

    <div className="relative z-10 flex items-center gap-3 w-full">
      <img src={icon} alt="" className="w-8 h-8 object-contain flex-shrink-0" />
      <div className="flex-1 flex flex-col gap-0.5 min-w-0">
        <div className="text-[14px] font-bold text-[#111] leading-tight tracking-[-0.03em] whitespace-nowrap overflow-hidden text-ellipsis uppercase">{title}</div>
        <div className="text-[11px] font-medium text-gray-500/80 leading-tight tracking-tight">{subtitle}</div>
      </div>
    </div>
  </div>
);

const RewardsMockup = () => {
  const baseCustomers = [
    { id: 1, name: "Alice J.", points: 450, status: "Gold" },
    { id: 2, name: "Bob M.", points: 120, status: "Silver" },
    { id: 3, name: "Diana S.", points: 80, status: "Bronze" },
  ];

  const [customers, setCustomers] = useState(baseCustomers);
  const [isHovered, setIsHovered] = useState(false);
  const [isClicked, setIsClicked] = useState(false);

  useEffect(() => {
    let isActive = true;

    const runSequence = async () => {
      while (isActive) {
        // Wait before starting sequence
        await new Promise(r => setTimeout(r, 1000));
        if (!isActive) break;

        // Cursor hovers button
        setIsHovered(true);
        await new Promise(r => setTimeout(r, 600));
        if (!isActive) break;

        // Cursor clicks down
        setIsClicked(true);
        await new Promise(r => setTimeout(r, 150));
        if (!isActive) break;

        // Button unclicks, add 0-point customer
        setIsClicked(false);
        const newNames = ["Charlie D.", "Diana S.", "Evan R.", "Fiona W.", "George T."];
        const newC = {
          id: Date.now(),
          name: newNames[Math.floor(Math.random() * newNames.length)],
          points: 0,
          status: "New"
        };
        setCustomers([newC, ...baseCustomers]);

        await new Promise(r => setTimeout(r, 400));
        if (!isActive) break;

        // Cursor moves away
        setIsHovered(false);

        // Keep the new customer on screen for 4 seconds
        await new Promise(r => setTimeout(r, 4000));
        if (!isActive) break;

        // Remove new customer (triggers exit animation)
        setCustomers(baseCustomers);

        // Wait for removal animation to complete before repeating loop
        await new Promise(r => setTimeout(r, 800));
      }
    };

    runSequence();

    return () => { isActive = false; };
  }, []);

  return (
    <div className="w-full max-w-sm mx-auto md:ml-auto md:mr-0 flex flex-col gap-4 bg-white/10 backdrop-blur-xl border border-white/20 p-6 rounded-[24px] shadow-[0_20px_40px_rgba(0,0,0,0.5)] font-sans relative group/mockup">
      {/* Background inner glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none rounded-[24px]" />

      <div className="flex justify-between items-center mb-2 relative z-10 w-full">
        <h4 className="text-white text-2xl font-black tracking-tight">
          Customers
        </h4>
        <div className="absolute -top-10 -right-6 md:-top-11 md:-right-8 z-30">
          <button
            className={`button-24 button-24--blue !p-0 !rounded-full !w-14 !h-14 md:!w-16 md:!h-16 shadow-xl z-20 transition-all duration-150 relative ${isHovered ? 'scale-105' : ''} ${isClicked ? 'scale-95 bg-[#1f11c7]' : 'scale-100'}`}
          >
            <UserPlus size={24} className="md:w-7 md:h-7 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </button>

          {/* Animated Cursor */}
          <motion.div
            initial={{ x: 50, y: 70, opacity: 0 }}
            animate={isHovered ? { x: 12, y: 12, opacity: 1 } : { x: 50, y: 70, opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="absolute top-1/2 left-1/2 pointer-events-none z-50 text-white drop-shadow-xl origin-top-left"
          >
            <MousePointer2 size={32} className="fill-black/50" />
          </motion.div>
        </div>
      </div>

      <div
        className="flex flex-col relative z-10 h-[220px] overflow-hidden"
        style={{ maskImage: 'linear-gradient(to bottom, black 50%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, black 50%, transparent 100%)' }}
      >
        <AnimatePresence initial={false}>
          {customers.map((c) => (
            <motion.div
              layout
              key={c.id}
              initial={{ opacity: 0, y: -60 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, height: 0, padding: 0, marginBottom: 0, overflow: 'hidden' }}
              transition={{ duration: 0.4, ease: [0.25, 1, 0.5, 1] }}
              className="flex justify-between items-center shrink-0 p-3 rounded-[16px] bg-black/40 border border-white/10 backdrop-blur-md mb-3"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#5e30eb] to-[#2c19fc] flex items-center justify-center text-white text-sm font-bold border border-white/20 shadow-inner">
                  {c.name.charAt(0)}
                </div>
                <div className="flex flex-col">
                  <span className="text-white text-sm font-bold tracking-tight">{c.name}</span>
                  <span className={`text-[10px] uppercase tracking-widest font-bold ${c.status === 'New' ? 'text-green-400' : 'text-white/50'}`}>{c.status}</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-white font-bold text-sm tracking-tight"><span className="text-[#5e30eb] mr-0.5">★</span> {c.points} <span className="text-white/50 text-xs font-medium">pts</span></span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

const SchedulingMockup = () => {
  const [step, setStep] = useState(0);
  const [isCardHovered, setIsCardHovered] = useState(false);
  const isHoveredRef = useRef(false);
  const isAnimatingRef = useRef(false);

  const sequence = [
    { duration: 800 },  // 0: Start
    { duration: 700 },  // 1: Moving to date
    { duration: 150 },  // 2: Click
    { duration: 700 },  // 3: Moving to end date
    { duration: 150 },  // 4: Click (Range Highlighted)
    { duration: 700 },  // 5: Moving to Generate
    { duration: 150 },  // 6: Click
    { duration: 2500 }, // 7: Displaying shifts
    { duration: 800 },  // 8: Final pause before reset
  ];

  useEffect(() => {
    isHoveredRef.current = isCardHovered;

    if (isCardHovered && !isAnimatingRef.current) {
      isAnimatingRef.current = true;

      const runStep = (idx: number) => {
        setStep(idx);
        setTimeout(() => {
          if (idx < sequence.length - 1) {
            runStep(idx + 1);
          } else {
            // Cycle complete
            if (isHoveredRef.current) {
              runStep(0);
            } else {
              setStep(0);
              isAnimatingRef.current = false;
            }
          }
        }, sequence[idx].duration);
      };

      runStep(0);
    }
  }, [isCardHovered]);

  const days = Array.from({ length: 35 }, (_, i) => i + 1);
  const weekDays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  const startDay = 4;
  const endDay = 10;

  return (
    <div
      onMouseEnter={() => setIsCardHovered(true)}
      onMouseLeave={() => setIsCardHovered(false)}
      className="w-[340px] h-[340px] md:w-[420px] md:h-[420px] bg-white/10 backdrop-blur-xl rounded-[24px] border border-white/20 p-8 flex flex-col shadow-2xl overflow-hidden relative group/calendar z-30 cursor-pointer"
    >
      {/* Calendar Header */}
      <div className="flex justify-between items-center mb-6 relative z-10">
        <div>
          <div className="text-white text-xl font-bold tracking-tight" style={{ fontFamily: 'Zodiak, serif' }}>December 2026</div>
          <div className="text-white/40 text-[10px] font-bold uppercase tracking-widest mt-0.5">Automated Planning</div>
        </div>
        <motion.div
          animate={{
            scale: step === 6 ? 0.92 : 1, // "Push-in" click effect
            y: step === 6 ? 2 : 0,
          }}
          transition={{ duration: 0.1 }}
          className="button-24 !px-6 !py-2.5 !rounded-full shadow-xl cursor-default border-transparent bg-white !text-black flex items-center justify-center font-medium"
          style={{ fontFamily: 'var(--font-geist-sans), Inter, sans-serif', textTransform: 'none' }}
        >
          <span className="text-black">Generate</span>
        </motion.div>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1 md:gap-2 relative z-10">
        {weekDays.map((d, i) => (
          <div key={i} className="text-center text-white/30 text-[9px] font-black pb-2">{d}</div>
        ))}
        {days.map((day, i) => {
          const date = i; // Dec 1st 2026 is a Tuesday (i=1 if i=0 is Monday)
          const isDate = date > 0 && date <= 31;

          // Selection logic - Selecting a full week from Dec 7 (Mon) to Dec 13 (Sun)
          const isInRange = date >= 7 && date <= 13 && step >= 4;
          const isStart = date === 7 && step >= 2;
          const isEnd = date === 13 && step >= 4;

          return (
            <motion.div
              key={i}
              animate={{
                scale: (isStart || isEnd) && step < 7 ? [1, 1.05, 1] : 1,
              }}
              transition={{ repeat: (isStart || isEnd) && step < 7 ? Infinity : 0, duration: 2 }}
              className={`relative aspect-square flex flex-col items-center justify-center rounded-xl transition-all duration-300 ${isDate ? 'bg-white/5 border border-white/5' : ''
                } ${isInRange ? 'bg-gradient-to-br from-[#2c19fc]/60 to-[#2c19fc]/30 border-2 border-[#2c19fc] shadow-[inset_0_0_10px_rgba(255,255,255,0.2)]' : ''} ${isStart || isEnd ? 'bg-[#2c19fc] border-2 border-white/30 shadow-[0_0_30px_rgba(44,25,252,0.6)] scale-105 z-20' : ''}`}
            >
              {isDate && (
                <span className={`text-[11px] font-bold ${isStart || isEnd ? 'text-white' : isInRange ? 'text-white' : 'text-white/80'}`}>{date}</span>
              )}

              {/* Shifts Populating Animation */}
              {step >= 7 && isInRange && isDate && (
                <motion.div
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="absolute bottom-1.5 flex gap-0.5"
                >
                  <div className="w-1 h-1 rounded-full bg-white" />
                  <div className="w-1 h-1 rounded-full bg-white" />
                </motion.div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Interactive Cursor Animation - Aligned to Dec 7th to Dec 13th */}
      <motion.div
        animate={
          step === 0 ? { x: 300, y: 350, opacity: 0 } :
            step === 1 ? { x: 38, y: 170, opacity: 1 } :   // Dec 7 (Monday, Row 2) 
              step === 2 ? { x: 38, y: 170, scale: 0.8 } :
                step === 3 ? { x: 354, y: 170, opacity: 1, scale: 1 } :  // Dec 13 (Sunday, Row 2)
                  step === 4 ? { x: 354, y: 170, scale: 0.8 } :
                    step === 5 ? { x: 320, y: 20, opacity: 1, scale: 1 } :   // Generate Button
                      step === 6 ? { x: 320, y: 20, scale: 0.8 } :
                        step === 7 ? { x: 320, y: 20, scale: 0, opacity: 0 } :
                          { opacity: 0 }
        }
        transition={{
          duration: [1, 3, 5].includes(step) ? 0.7 : 0.15, // Movement takes 0.7s, Clicks take 0.15s
          ease: "circOut"
        }}
        className="absolute z-50 pointer-events-none"
      >
        <MousePointer2 size={24} className="text-white fill-black drop-shadow-[0_5px_15px_rgba(0,0,0,0.5)]" />
      </motion.div>
    </div>
  );
};



const UploadMockup = ({ isHovered }: { isHovered: boolean }) => {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-6 z-20">
      <motion.div
        className="w-52 h-44 border-2 border-dashed border-white/40 rounded-xl flex flex-col items-center justify-center relative overflow-hidden bg-white/40 backdrop-blur-md shadow-[0_8px_32px_0_rgba(255,255,255,0.18)]"
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
          <img src="/upload-icon.svg" className="w-12 h-12 mb-1.5 opacity-60 invert" alt="Upload" />
          <span className="text-white/80 font-black text-[10px] tracking-[0.2em] uppercase font-sans mb-3">Drop files</span>

          <div className="flex gap-1.5">
            {[
              { icon: FileSpreadsheet, label: "XLS", color: "text-green-400" },
              { icon: FileText, label: "PDF", color: "text-red-400" },
              { icon: FileImage, label: "IMG", color: "text-blue-400" }
            ].map((file, i) => (
              <div key={i} className="px-2 py-1.5 rounded-md bg-white/10 border border-white/20 backdrop-blur-sm flex items-center gap-1.5 shadow-sm">
                <file.icon size={10} className={file.color} />
                <span className="text-[9px] font-black text-white/90">{file.label}</span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Floating cursor dragging files - moved outside overflow-hidden to start from "outside" */}
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
              {/* Stacked Mock Files attached to cursor */}
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

const AIExtractionMockup = ({ isHovered }: { isHovered: boolean }) => {
  const [isExtracted, setIsExtracted] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [key, setKey] = useState(0);

  useEffect(() => {
    let timeout: NodeJS.Timeout;

    if (isHovered) {
      // Always reset and start fresh on a new hover
      setIsExtracted(false);
      setIsScanning(true);
      setKey(prev => prev + 1);

      // Stop scanning and show chips after 1 cycle (approx 1.2s)
      timeout = setTimeout(() => {
        setIsScanning(false);
        setIsExtracted(true);
      }, 1200);
    } else {
      // If we leave while scanning, stop it
      if (isScanning) {
        setIsScanning(false);
      }
      // Note: isExtracted STAYS true if it was already finished (sticky popouts)
    }

    return () => clearTimeout(timeout);
  }, [isHovered]);

  return (
    <div className="absolute inset-0 flex items-center justify-center p-6 z-20 overflow-hidden">
      <div className="relative w-52 h-44 bg-white/40 backdrop-blur-md rounded-xl shadow-[0_8px_32px_0_rgba(255,255,255,0.18)] border border-white/40 flex flex-col p-3 overflow-hidden">
        {/* Inner Gradient Border Effect */}
        <div className="absolute inset-0 rounded-xl border border-blue-700/30 pointer-events-none px-[1.5px] py-[1.5px]">
          <div className="w-full h-full rounded-[10px] border border-blue-600/10" />
        </div>
        <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-blue-700/20 via-transparent to-blue-800/10 pointer-events-none" />

        {/* Document Header lines */}
        <div className="w-10 h-2 bg-blue-700/60 rounded-full mb-4" />
        <div className="w-full space-y-2 px-0.5">
          <div className="w-full h-1 bg-blue-600/40 rounded-full" />
          <div className="w-[85%] h-1 bg-blue-600/40 rounded-full" />
        </div>

        {/* Document Body lines */}
        <div className="mt-5 space-y-4 px-1">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex justify-between items-center">
              <div className="w-14 h-1 bg-blue-700/60 rounded-full" />
              <div className="w-6 h-1 bg-blue-700/60 rounded-full" />
            </div>
          ))}
        </div>

        {/* Scanning Bar Animation */}
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

        {/* Shine Overlay when scanning */}
        <AnimatePresence>
          {isScanning && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-[#2c19fc]/10 z-20 pointer-events-none"
            />
          )}
        </AnimatePresence>
      </div>

      {/* Extracted Data Chips */}
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
                className="absolute left-1/2 top-1/2 -ml-12 -mt-4 bg-white/30 backdrop-blur-xl px-3 py-1.5 rounded-full shadow-[0_10px_40px_rgba(0,0,0,0.1)] border border-white/60 flex items-center gap-2.5"
              >
                <div className={`w-2 h-2 rounded-full bg-current ${chip.color}`} />
                <span className={`text-[11px] font-black uppercase tracking-tight ${chip.color}`}>{chip.label}</span>
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const PrecisionProofingMockup = ({ isHovered }: { isHovered: boolean }) => {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-6 z-20 overflow-hidden">
      {/* Mock Document */}
      <div className="relative w-52 h-44 bg-white/40 backdrop-blur-md rounded-xl shadow-[0_8px_32px_0_rgba(239,68,68,0.3)] border border-red-500/40 flex flex-col p-3 overflow-hidden">
        {/* Inner Gradient Border Effect */}
        <div className="absolute inset-0 rounded-xl border border-red-500/50 pointer-events-none px-[1.5px] py-[1.5px]">
          <div className="w-full h-full rounded-[10px] border border-red-400/20" />
        </div>
        <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-red-500/20 via-transparent to-red-600/10 pointer-events-none" />

        {/* Document Header lines */}
        <div className="w-10 h-2 bg-white/40 rounded-full mb-4" />
        <div className="w-full space-y-2">
          <div className="w-full h-1 bg-white/20 rounded-full" />
          <div className="w-[85%] h-1 bg-white/20 rounded-full" />
        </div>

        {/* Document Body lines */}
        <div className="mt-5 space-y-4 px-1">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex justify-between items-center">
              <div className="w-16 h-1 bg-white/30 rounded-full" />
              <div className="w-8 h-1 bg-white/30 rounded-full" />
            </div>
          ))}
        </div>

        {/* Red Error Symbol on Document - Static initially */}
        <div className="absolute right-3 bottom-12">
          <div className="w-5 h-5 rounded-full bg-red-600 flex items-center justify-center border border-white/20 shadow-lg" style={{ pointerEvents: 'none' }}>
            <TriangleAlert className="w-3.5 h-3.5 text-white" strokeWidth={3} />
          </div>
        </div>

        {/* Red Highlight Line on Document - Static initially */}
        <div className="absolute top-[108px] left-0 h-4 w-full bg-red-500/10 pointer-events-none" />
      </div>

      {/* Pop-out Red Container */}
      <AnimatePresence>
        {isHovered && (
          <div className="absolute inset-0 pointer-events-none z-40 flex items-center justify-center">
            {/* Pop-out Container */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8, x: 0 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20 }}
              className="relative bg-gradient-to-br from-red-500 to-red-700 px-4 py-2 rounded-xl shadow-[0_15px_45px_rgba(220,38,38,0.4)] flex items-center gap-4 overflow-hidden"
            >
              {/* Glossy Outline / Rim */}
              <div className="absolute inset-0 rounded-xl border border-white/40 pointer-events-none" />
              <div className="absolute inset-[1px] rounded-[11px] border border-white/10 pointer-events-none" />

              <Mail className="w-6 h-6 text-white relative z-10" />
              <div className="flex flex-col relative z-10">
                <span className="text-white text-[12px] font-black uppercase tracking-tight">Email Sent</span>
                <span className="text-white/80 text-[10px] font-bold">Query: Price Mismatch</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const LiveInventoryMockup = ({ isHovered }: { isHovered: boolean }) => {
  const rows = [
    { initial: 0.8, target: 1.0, icon: Shirt },
    { initial: 0.1, target: 0.8, icon: Watch },
    { initial: 0.4, target: 0.95, icon: ShoppingBag },
    { initial: 0.2, target: 1.0, icon: Package }
  ];

  return (
    <div className="absolute inset-0 flex items-center justify-center p-6 z-20 overflow-hidden">
      <div className="relative w-52 h-44 bg-white/40 backdrop-blur-md rounded-lg border border-white/40 shadow-[0_8px_32px_0_rgba(255,255,255,0.18),inset_0_0_0_1px_rgba(255,255,255,0.2)] flex flex-col p-3 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-center mb-2">
          <span className="text-[12px] font-black text-white/90 tracking-[0.2em] uppercase">Inventory</span>
        </div>

        {/* Separator */}
        <div className="w-full h-px bg-white/10 mb-2" />

        {/* List of Bars */}
        <div className="space-y-3">
          {rows.map((row, idx) => (
            <div key={idx} className="flex items-center gap-4">
              {/* Dynamic Icon on left */}
              <div className="shrink-0 w-5 h-5 flex items-center justify-center">
                <row.icon size={18} className="text-white/70" />
              </div>

              {/* Progress Bar Container */}
              <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden relative">
                {/* Internal Fill Bar */}
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

const Counter = ({ targetValue, delay }: { targetValue: number; delay: number }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime: number;
    let animationFrame: number;
    const duration = 1200; // slower count-up duration

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = timestamp - startTime;
      const currentCount = Math.min(
        Math.floor((progress / duration) * targetValue),
        targetValue
      );

      setCount(currentCount);

      if (progress < duration) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    const timeout = setTimeout(() => {
      animationFrame = requestAnimationFrame(animate);
    }, delay * 1000);

    return () => {
      clearTimeout(timeout);
      cancelAnimationFrame(animationFrame);
    };
  }, [targetValue, delay]);

  return <>{count}</>;
};

const AppSidebar = ({ className = "" }: { className?: string }) => (

  <div className={`w-[240px] border-r border-[#e5e7eb] bg-white flex flex-col py-6 shrink-0 font-sans ${className}`}>
    <div className="px-5 mb-6 flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-[#2c19fc]">
        <LayoutDashboard size={18} />
      </div>
      <span className="font-bold text-[15px] text-[#111827]">Accounting</span>
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
      <div key={item.label} className={`px-5 py-2.5 flex items-center gap-3 transition-colors font-sans ${item.isBottom ? 'mt-auto' : ''} ${item.active ? 'bg-gray-50 text-[#111827] font-semibold' : 'text-[#6b7280] font-medium'}`}>
        <item.icon size={18} strokeWidth={item.active ? 2.5 : 2} />
        <span className="text-[14px]">{item.label}</span>
      </div>
    ))}
  </div>
);

const AppDashboard = () => (
  <div className="flex-1 pt-3 px-8 pb-8 overflow-hidden bg-white custom-scrollbar font-sans">
    <div className="max-w-6xl mx-auto space-y-12">
      {/* Pill Row Containers */}
      <div className="flex gap-4 items-start relative z-[100] px-4">
        <div className="button-24 pointer-events-none">
          Statements
        </div>

        <div className="relative group">
          <div className="button-24 button-24--blue pointer-events-none">
            Payroll
          </div>

          {/* Floating Pop-out Overlay - White Glassy Style */}
          <div
            className="absolute top-[calc(100%+6px)] left-0 w-[90%] rounded-[20px] border border-white/60 backdrop-blur-[24px] p-1.5 pr-0 flex flex-col gap-2.5 transition-all duration-300 z-50 text-[#111]"
            style={{
              background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.85) 0%, rgba(44, 25, 252, 0.12) 100%)',
              boxShadow: 'rgba(50, 50, 93, 0.25) 0px 2px 5px -1px, rgba(0, 0, 0, 0.3) 0px 1px 3px -1px',
              fontFamily: 'var(--font-geist-sans), Inter, system-ui, sans-serif'
            }}
          >
            {[
              { name: 'ADP', icon: '/adp.svg' },
              { name: 'JustWorks', icon: '/justworks.svg' },
              { name: 'Gusto', icon: '/gusto.svg' },
            ].map((opt, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <Plus size={10} strokeWidth={4} className="text-gray-300 shrink-0" />
                <img
                  src={opt.icon}
                  alt=""
                  className={`${opt.name === 'JustWorks' ? 'h-2.5' : 'h-3'} w-auto object-contain max-w-[70px]`}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="button-24 pointer-events-none">
          Vendors
        </div>
      </div>

      {/* Main Row: Cash Flow Chart & Ledger Reports */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Cash Flow Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Cash Flow</h3>
              <p className="text-sm text-gray-500">Revenue vs Expenditures</p>
            </div>
            <div className="flex gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-xs font-extrabold font-sans">
                Revenue
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-50 text-gray-400 text-xs font-extrabold font-sans">
                Expense
              </div>
            </div>
          </div>

          <div className="relative h-[240px] w-full bg-[#fcfcff] rounded-xl border border-gray-50/50 flex items-end p-4">
            <svg viewBox="0 0 100 40" className="w-full h-full preserve-3d" preserveAspectRatio="none">
              <defs>
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(44, 25, 252, 0.2)" />
                  <stop offset="100%" stopColor="rgba(44, 25, 252, 0)" />
                </linearGradient>
              </defs>
              <path d="M0,35 Q10,32 20,28 T40,22 T60,25 T80,15 T100,5 V40 H0 Z" fill="url(#chartGradient)" />
              <path d="M0,35 Q10,32 20,28 T40,22 T60,25 T80,15 T100,5" fill="none" stroke="#2c19fc" strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="100" cy="5" r="1.5" fill="#2c19fc" />
            </svg>
            <div className="absolute inset-x-4 bottom-4 flex justify-between text-[10px] font-bold text-gray-300 uppercase tracking-widest">
              <span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span>
            </div>
          </div>
        </div>

        {/* Ledger & Journal Reports */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 overflow-hidden">
          <h3 className="text-lg font-bold text-gray-900 mb-6 tracking-tight">Ledger Reports</h3>
          <div className="space-y-3">
            {[
              'General Ledger Summary 2026',
              'Accounts Payable & Journal',
              'Accounts Receivable Ledger',
              'Cash Flow Statement Journal',
              'Employee Payroll Report'
            ].map((report, i) => (
              <div key={i} className="flex justify-between items-center px-1 py-3.5 rounded-xl border border-transparent transition-all">
                <div className="min-w-0 flex-1 pr-4 relative">
                  <div className="text-sm font-bold text-gray-800 tracking-tight whitespace-nowrap overflow-hidden [mask-image:linear-gradient(to_right,black_80%,transparent_100%)]">
                    {report}
                  </div>
                </div>
                <div className="text-gray-400 shrink-0">
                  <SquareArrowOutUpRight size={18} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
);
const BrandIcon = ({ name }: { name: string }) => {
  const cn = "inline-block h-5 w-auto mx-1.5 align-middle mb-0.5 filter drop-shadow-sm";
  switch (name) {
    case 'Google': return <img src="https://www.vectorlogo.zone/logos/google/google-icon.svg" className={cn} alt="Google" />;
    case 'Apple': return <img src="https://www.vectorlogo.zone/logos/apple/apple-icon.svg" className={cn + " relative -top-0.5"} alt="Apple" style={{ filter: 'brightness(0) invert(1) drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }} />;
    case 'Calendly': return <img src="/calendly.svg" className={cn} alt="Calendly" style={{ filter: 'drop-shadow(0 0 2px rgba(255,255,255,0.1))' }} />;
    case 'Outlook': return <img src="/outlook.svg" className={cn} alt="Outlook" style={{ filter: 'drop-shadow(0 0 2px rgba(255,255,255,0.1))' }} />;
    case 'Stripe': return <img src="/stripe.svg" className="inline-block h-5 w-auto mx-0.5 align-middle mb-0.5 filter drop-shadow-sm" alt="Stripe" style={{ filter: 'brightness(1.1)' }} />;
    case 'Shopify': return <img src="/shopify.svg" className={cn} alt="Shopify" style={{ filter: 'brightness(1.1)' }} />;
    case 'DoorDash': return <img src="/doordash.svg" className={cn} alt="DoorDash" style={{ filter: 'brightness(1.1)' }} />;
    case 'UberEats': return <img src="/ubereats.svg" className={cn} alt="Uber Eats" style={{ filter: 'brightness(1.1)' }} />;
    case 'ApplePay': return <img src="/apple-pay.svg" className={cn.replace('h-5', 'h-7')} alt="Apple Pay" style={{ filter: 'brightness(1.1) drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }} />;
    case 'GooglePay': return <img src="/google-pay.svg" className={cn.replace('h-5', 'h-7')} alt="Google Pay" style={{ filter: 'brightness(1.1) drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }} />;
    case 'QuickBooks': return <img src="/quickbooks.svg" className={cn} alt="QuickBooks" style={{ filter: 'brightness(1.1)' }} />;
    case 'Camera': return <Camera size={16} className="inline-block mx-1.5 align-middle mb-0.5 text-[#2c19fc] drop-shadow-[0_0_8px_rgba(44,25,252,0.4)]" />;
    case 'Wallet': return <CreditCard size={16} className="inline-block mx-1.5 align-middle mb-0.5 text-[#2c19fc] drop-shadow-[0_0_8px_rgba(44,25,252,0.4)]" />;
    default: return null;
  }
};

const PointText = ({ text }: { text: string }) => {
  const parts = text.split(/(\[(?:Google|Apple|Calendly|Outlook|Stripe|Shopify|DoorDash|UberEats|ApplePay|GooglePay|Camera|Wallet|QuickBooks)\])/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('[') && part.endsWith(']')) {
          return <BrandIcon key={i} name={part.slice(1, -1)} />;
        }
        return part;
      })}
    </>
  );
};

import { useTransition } from './TransitionContext';


export default function Home() {
  const { navigate } = useTransition();
  const NavButton = ({ children, className, isBold = false, onClick }: { children: React.ReactNode; className?: string; isBold?: boolean; onClick?: () => void }) => {
    const [isHovered, setIsHovered] = useState(false);
    const [entrySide, setEntrySide] = useState<'left' | 'right'>('left');

    return (
      <motion.button
        className={`relative group py-1 text-[11px] md:text-sm ${isBold ? 'font-semibold' : 'font-medium'} text-black overflow-hidden flex items-center gap-1 ${className || ''}`}
        onMouseEnter={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left;
          setEntrySide(x < rect.width / 2 ? 'left' : 'right');
          setIsHovered(true);
        }}
        onMouseLeave={() => setIsHovered(false)}
        whileTap={{ scale: 0.98 }}
        onClick={onClick}
      >
        <span className="relative z-10 flex items-center gap-1.5 drop-shadow-[0_0_8px_rgba(44,25,252,0.15)]">{children}</span>
        <motion.span
          className="absolute bottom-0 left-0 w-full h-[1.5px] bg-black"
          initial={false}
          animate={{
            x: isHovered ? "0%" : (entrySide === 'left' ? "-105%" : "105%"),
          }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        />
      </motion.button>
    );
  };

  const [isAgentDropdownOpen, setIsAgentDropdownOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState('Agent');
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState('Auto');
  const [isContextDropdownOpen, setIsContextDropdownOpen] = useState(false);
  const [selectedContext, setSelectedContext] = useState<string | null>(null);
  const [typedText, setTypedText] = useState('');
  const [isNavigating, setIsNavigating] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isThirdSectionInView, setIsThirdSectionInView] = useState(false);
  const [mockupScale, setMockupScale] = useState(1);
  const agentDropdownRef = useRef<HTMLDivElement>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const contextDropdownRef = useRef<HTMLDivElement>(null);
  const thirdSectionRef = useRef<HTMLElement>(null);
  const swftlyTextRef = useRef<HTMLSpanElement>(null);
  const heroTextRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hasVideoPlayed = useRef(false);
  const hasMobileVideoPlayed = useRef(false);
  const hasHitTargetTime = useRef(false);
  const [showVideoInfo, setShowVideoInfo] = useState(false);
  const [videoInfoStep, setVideoInfoStep] = useState(4);
  const [videoTime, setVideoTime] = useState(0);
  const [hasDismissedCTA, setHasDismissedCTA] = useState(false);
  const mockupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleResize = () => {
      if (typeof window !== 'undefined') {
        const width = window.innerWidth;
        setIsMobile(width < 768);
        const containerWidth = Math.min(width - 48, 1152); // max-w-6xl is 1152px
        const baseWidth = 1152;
        const newScale = containerWidth / baseWidth;
        setMockupScale(newScale);
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const [stickyStep, setStickyStep] = useState(0);
  const stickySectionRef = useRef<HTMLElement>(null);
  const scrollingContentRef = useRef<HTMLDivElement>(null);
  const mobileVideoRef = useRef<HTMLVideoElement>(null);
  const finalGetRef = useRef<HTMLHeadingElement>(null);
  const finalSwftlyRef = useRef<HTMLHeadingElement>(null);
  const [showHeavyAssets, setShowHeavyAssets] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const inventoryRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [uploadAnimKey, setUploadAnimKey] = useState(0);
  const [parseAnimKey, setParseAnimKey] = useState(0);
  const [proofAnimKey, setProofAnimKey] = useState(0);
  const [stockAnimKey, setStockAnimKey] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  // Auto-advance loop for the 4 process animations
  useEffect(() => {
    if (activeStep > 3) return;

    const durations = [5000, 6500, 8000, 9500];
    const timer = setTimeout(() => {
      const nextStep = (activeStep + 1) % 4;
      setActiveStep(nextStep);
      if (nextStep === 0) setUploadAnimKey(prev => prev + 1);
      if (nextStep === 1) setParseAnimKey(prev => prev + 1);
      if (nextStep === 2) setProofAnimKey(prev => prev + 1);
      if (nextStep === 3) setStockAnimKey(prev => prev + 1);
    }, durations[activeStep]);

    return () => clearTimeout(timer);
  }, [activeStep]);

  useEffect(() => {
    // Show background/bags almost immediately for a complete initial scene
    const timer = setTimeout(() => setShowHeavyAssets(true), 100);
    const handleScroll = () => {
      if (window.scrollY > 50) {
        setShowHeavyAssets(true);
        window.removeEventListener('scroll', handleScroll);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      clearTimeout(timer);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  useEffect(() => {
    const handleHashJump = () => {
      if (window.location.hash) {
        const id = window.location.hash.substring(1);
        const el = document.getElementById(id);
        if (el) {
          // Instant jump
          el.scrollIntoView({ behavior: 'auto', block: 'start' });
          // Ensure it sticks (sometimes hydration can reset scroll)
          setTimeout(() => el.scrollIntoView({ behavior: 'auto', block: 'start' }), 50);
        }
      }
    };

    // Run on mount and after a short delay for reliability
    handleHashJump();
    const timer = setTimeout(() => {
      handleHashJump();
      ScrollTrigger.refresh();
    }, 200);

    window.addEventListener('hashchange', handleHashJump);
    return () => {
      window.removeEventListener('hashchange', handleHashJump);
      clearTimeout(timer);
    };
  }, []);

  // GSAP ScrollTrigger for Inventory section on mobile
  useEffect(() => {
    if (!isMobile) return;

    const ctx = gsap.context(() => {
      inventoryRefs.current.forEach((ref, i) => {
        if (!ref) return;

        ScrollTrigger.create({
          trigger: ref,
          start: "top 40%",
          end: "bottom 40%",
          onEnter: () => setActiveStep(i),
          onEnterBack: () => setActiveStep(i),
        });
      });
    });

    return () => ctx.revert();
  }, [isMobile]);

  const videoHotspots = [
    {
      title: "Notifications",
      points: [
        "Receive in-app notifications regarding stock, orders, and scheduling.",
        "Receive via SMS or email alerts."
      ],
      top: "4%", left: "68.4%", width: "2.5%", height: "4%"
    },
    {
      title: "Settings",
      points: [
        "Full control over transaction fees, tips, and taxes.",
        "Integrate third-party apps and manage store info.",
        "Manage employees and their access levels.",
        "Open and close register seamlessly."
      ],
      top: "4%", left: "71.6%", width: "7.5%", height: "4%"
    },
    {
      title: "Profile",
      points: [
        "Clock in with optional location tracking and Face ID to log hours.",
        "Integrate with ADP and HCM platforms.",
        "View your shifts and personal settings."
      ],
      top: "4%", left: "79.5%", width: "5.3%", height: "4%"
    },
    {
      title: "Logout",
      points: ["Securely end the current terminal session."],
      top: "4%", left: "85.0%", width: "7.8%", height: "4%"
    },
    {
      title: "Statistics",
      points: [
        "Key insights on product restock and popular products.",
        "Product lifespan and sales analytics comparisons.",
        "Seasonal trends and employee efficiency tracking.",
        "Detect sales returns and neglected products.",
        "AI-driven statistics and automated reports."
      ],
      top: "11.5%", left: "8.5%", width: "41%", height: "54.5%"
    },
    {
      title: "Calendar",
      points: [
        "Syncs with [Google], [Apple], [Calendly], [Outlook], and more.",
        "Automate schedule and shift generation.",
        "Save hours designing schedules based on availability and seniority."
      ],
      top: "11%", left: "50%", width: "21%", height: "27%"
    },
    {
      title: "POS",
      points: [
        "Barcode and image recognition scanner [Camera] built-in (all you need is a camera on your device).",
        "Intelligent search and easy-to-use checkout UI.",
        "Integrates with [Stripe] and native merchant terminals.",
        "Supports all credit card processing and merchant types."
      ],
      top: "11%", left: "71%", width: "20.5%", height: "27%"
    },
    {
      title: "Orders",
      points: [
        "View recent orders from in-house or 3rd party apps like [Shopify], [DoorDash], and [UberEats].",
        "Manage order status and fulfillment workflow.",
        "Process returns, exchanges, and refunds."
      ],
      top: "40%", left: "50%", width: "21%", height: "26.5%"
    },
    {
      title: "Customers",
      points: [
        "Built-in rewards program with points, coupons, and discounts.",
        "Integrated SMS and Email CRM.",
        "Create passes [Wallet] for [ApplePay] and [GooglePay] Wallet.",
        "Track detailed customer purchase history."
      ],
      top: "40%", left: "71%", width: "21%", height: "26.5%"
    },
    {
      title: "Shipments",
      points: [
        "Upload vendor documents for automatic parsing and inventory updates.",
        "Check-in products and auto-flag discrepancies to vendors via email.",
        "Track shipment progress and performance."
      ],
      top: "68%", left: "8%", width: "21%", height: "27%"
    },
    {
      title: "Accounting",
      points: [
        "Chart of accounts, ledger transactions, and invoices.",
        "Generate income sheets and tax forms automatically synced to your business type.",
        "Syncs with cash flow from all parts of the app; smoothly migrate from [QuickBooks]."
      ],
      top: "68%", left: "29.5%", width: "20.5%", height: "27%"
    },
    {
      title: "Inventory",
      points: [
        "Edit and manage all items, print barcodes, and create categories.",
        "Real-time stock levels and key inventory insights."
      ],
      top: "68%", left: "50%", width: "21%", height: "27%"
    },
    {
      title: "Tables",
      points: [
        "Direct database access where all software data is stored.",
        "Edit mistakes, see and export all information collected.",
        "Completely private and and secure database."
      ],
      top: "68%", left: "71%", width: "21%", height: "27%"
    }
  ];

  const getModelOptions = () => {
    if (selectedAgent === 'Create') {
      return ['Veo3', 'Heygen', 'GPT-Image 1', 'DALLE 3', 'SORA', 'Imagen 4', 'Kling', 'Lyra'];
    } else {
      return ['Auto', 'GPT 5', 'Gemini 3', 'Claude 4.5'];
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (agentDropdownRef.current && !agentDropdownRef.current.contains(event.target as Node)) {
        setIsAgentDropdownOpen(false);
      }
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(event.target as Node)) {
        setIsModelDropdownOpen(false);
      }
      if (contextDropdownRef.current && !contextDropdownRef.current.contains(event.target as Node)) {
        setIsContextDropdownOpen(false);
      }
    };

    if (isAgentDropdownOpen || isModelDropdownOpen || isContextDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isAgentDropdownOpen, isModelDropdownOpen, isContextDropdownOpen]);

  useEffect(() => {
    // Reset model to first option when agent changes
    const options = getModelOptions();
    if (!options.includes(selectedModel)) {
      setSelectedModel(options[0]);
    }
  }, [selectedAgent, selectedModel]);

  useEffect(() => {
    const fullText = selectedAgent === 'Create'
      ? "make a skyline shot of nyc for the outro"
      : selectedAgent === 'Plan'
        ? "Lets make a plan for my last to leave the circle video like Mr Beast"
        : "Create a title that says Swftly to the Moon\nin blue";
    let currentIndex = 0;
    setTypedText('');
    let typingInterval: NodeJS.Timeout | null = null;

    // Start typing immediately
    typingInterval = setInterval(() => {
      if (currentIndex < fullText.length) {
        setTypedText(fullText.slice(0, currentIndex + 1));
        currentIndex++;
      } else {
        if (typingInterval) clearInterval(typingInterval);
      }
    }, 30); // 30ms per character

    return () => {
      if (typingInterval) clearInterval(typingInterval);
    };
  }, [selectedAgent]);



  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    // Set initial position for Swftly text to accommodate 3D logo in header
    if (swftlyTextRef.current) {
      gsap.set(swftlyTextRef.current, { x: 90 });
    }
  }, []);

  useEffect(() => {
    // Fade out hero text on scroll
    if (!heroTextRef.current) return;
    const ctx = gsap.context(() => {
      gsap.to(heroTextRef.current, {
        opacity: 0,
        y: -30,
        ease: "power2.inOut",
        scrollTrigger: {
          trigger: "body",
          start: "10px top",
          end: () => window.innerHeight * 0.4,
          scrub: 0.2
        }
      });
    });
    return () => ctx.revert();
  }, []);

  useEffect(() => {
    if (!stickySectionRef.current || !scrollingContentRef.current) return;

    const mm = gsap.matchMedia();
    const content = scrollingContentRef.current;
    const items = content.querySelectorAll('.story-item');
    if (items.length === 0) return;

    mm.add("(min-width: 768px)", () => {
      // MASTER SCROLL TRIGGER: Handles Snapping and Hotspot State
      ScrollTrigger.create({
        trigger: stickySectionRef.current,
        start: "top top",
        end: "bottom bottom",
        scrub: 2.5,
        onUpdate: (self) => {
          const progress = self.progress;

          // Video Speed/Scrub Logic
          if (videoRef.current && !hasHitTargetTime.current) {
            const firstStepEnd = 1 / items.length;
            const scrollTargetTime = (progress / firstStepEnd) * 3;

            if (videoRef.current.currentTime < 3) {
              if (scrollTargetTime > videoRef.current.currentTime) {
                videoRef.current.currentTime = Math.min(scrollTargetTime, 3);
              }
            }

            if (videoRef.current.currentTime >= 3) {
              videoRef.current.pause();
              videoRef.current.currentTime = 3;
              hasHitTargetTime.current = true;
            }
          }

          const step = Math.min(Math.floor(progress * items.length), items.length - 1);
          setStickyStep(step);

          const hotspotIndices = [4, 4, 6, 7, 8, 5, 10, 9, 11, 12, 1, 2];
          setVideoInfoStep(hotspotIndices[step] || 4);
        }
      });

      // MOVEMENT: Pull the content UP as the user scrolls DOWN
      const firstItem = items[0] as HTMLElement;
      const lastItem = items[items.length - 1] as HTMLElement;
      const startY = (window.innerHeight * 0.55) - (firstItem.offsetTop + firstItem.offsetHeight / 2);
      const endY = (window.innerHeight * 0.55) - (lastItem.offsetTop + lastItem.offsetHeight / 2);

      gsap.fromTo(content,
        { y: startY },
        {
          y: endY,
          ease: "none",
          scrollTrigger: {
            trigger: stickySectionRef.current,
            start: "top top",
            end: "bottom bottom",
            scrub: 1
          }
        }
      );

      // REVEAL TIMELINE
      const revealTl = gsap.timeline({
        scrollTrigger: {
          trigger: stickySectionRef.current,
          start: "top top",
          end: "bottom bottom",
          scrub: 1
        }
      });

      items.forEach((item, i) => {
        const snapPoint = i / (items.length - 1);
        if (i === 0) {
          gsap.set(item, { opacity: 1, filter: 'blur(0px)', y: 0 });
          revealTl.to(item, { opacity: 0, filter: 'blur(20px)', y: -50, duration: 0.1, ease: "none" }, 0.15);
        } else if (i === items.length - 1) {
          gsap.set(item, { opacity: 0, filter: 'blur(20px)', y: 50 });
          revealTl.to(item, { opacity: 1, filter: 'blur(0px)', y: 0, duration: 0.1, ease: "none" }, 0.85);
        } else {
          gsap.set(item, { opacity: 0, filter: 'blur(20px)', y: 50 });
          revealTl.to(item, { opacity: 1, filter: 'blur(0px)', y: 0, duration: 0.1, ease: "none" }, snapPoint - 0.1)
            .to(item, { opacity: 0, filter: 'blur(20px)', y: -50, duration: 0.1, ease: "none" }, snapPoint + 0.1);
        }
      });
    });

    return () => mm.revert();
  }, []);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: "#final-cta",
          start: "top 30%",
          end: "center center",
          scrub: 1,
        }
      });

      tl.fromTo(finalGetRef.current,
        { x: -500, opacity: 0, filter: 'blur(10px)' },
        { x: 0, opacity: 1, filter: 'blur(0px)', ease: "power3.out" },
        0
      );

      tl.fromTo(finalSwftlyRef.current,
        { x: 500, opacity: 0, filter: 'blur(10px)' },
        { x: 0, opacity: 1, filter: 'blur(0px)', ease: "power3.out" },
        0
      );
    });

    return () => ctx.revert();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      ScrollTrigger.refresh();
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const video = entry.target as HTMLVideoElement;
            const isMobile = video === mobileVideoRef.current;
            const hasPlayed = isMobile ? hasMobileVideoPlayed.current : hasVideoPlayed.current;

            if (!hasPlayed) {
              if (isMobile) {
                // Keep mobile video frozen
                hasMobileVideoPlayed.current = true;
              } else {
                video.play().catch(e => console.log("Video play failed:", e));
                hasVideoPlayed.current = true;
              }
            }
          }
        });
      },
      { threshold: 0.1 }
    );

    if (videoRef.current) {
      videoRef.current.load();
      observer.observe(videoRef.current);
    }
    if (mobileVideoRef.current) {
      mobileVideoRef.current.load();
      observer.observe(mobileVideoRef.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    // Detect when third section is in view
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsThirdSectionInView(true);
        }
      },
      { threshold: 0.3 }
    );

    if (thirdSectionRef.current) {
      observer.observe(thirdSectionRef.current);
    }

    return () => {
      if (thirdSectionRef.current) {
        observer.unobserve(thirdSectionRef.current);
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <GradualBlur
        target="page"
        position="bottom"
        height="4rem"
        strength={5}
        divCount={15}
        curve="bezier"
        exponential={true}
        opacity={0.85}
      />
      {/* Header */}
      <header
        className={`fixed top-4 left-4 right-4 z-[1001] will-change-transform transition-all duration-300 ${isScrolled ? 'bg-gradient-to-b from-white/60 to-white/10 backdrop-blur-xl rounded-[24px] border border-white/40 shadow-[0_8px_32px_0_rgba(0,0,0,0.06)]' : 'bg-transparent border-transparent'}`}
      >
        <div className="w-full pl-0 pr-4 py-1.5 flex items-center justify-between relative z-10">
          <div className="flex items-center gap-4 relative w-12 h-12">
            {/* 3D Logo docks here on scroll */}
            <span
              ref={swftlyTextRef}
              className="absolute left-[140px] text-sm font-bold text-black py-1 drop-shadow-[0_0_8_rgba(44,25,252,0.15)] hidden md:block whitespace-nowrap"
            >
              Swftly
            </span>
          </div>
          <div className="flex items-center gap-4 md:gap-10">
            {['Pricing', 'Book A Demo'].map((item) => {
              const handleNav = () => {
                if (item === 'Pricing') {
                  setIsNavigating(true);
                  document.getElementById('pricing-section')?.scrollIntoView({ behavior: 'smooth' });
                  setTimeout(() => setIsNavigating(false), 1200);
                } else if (item === 'Book A Demo') {
                  navigate('/book-a-demo');
                }
              };

              return (
                <div key={item} className={item === 'Book A Demo' ? '' : 'hidden md:block'}>
                  <NavButton onClick={handleNav}>
                    {item === 'Book A Demo' ? (
                      <>
                        <span className="md:hidden">Demo</span>
                        <span className="hidden md:inline">Book A Demo</span>
                      </>
                    ) : item}
                  </NavButton>
                </div>
              );
            })}
            <NavButton isBold onClick={() => navigate('/waitlist')}>
              Get Started
              <ArrowUpRight className="w-4 h-4 relative z-10" />
            </NavButton>
          </div>
        </div>
      </header>

      <ThreeLogo />

      {/* Hero Section */}
      <section className="relative w-full min-h-screen md:min-h-[170vh] bg-white overflow-hidden pb-12 md:pb-32">
        {/* Main Hero White Content Area */}
        <div className="relative w-full z-20">
          <div ref={heroTextRef} className="w-full max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center pt-[15vh] px-2 md:px-12 relative z-10 md:mt-4">
          </div>
          {/* Tagline, Button & SWFTLY Title */}
          <div className="flex flex-col items-center mt-24 mb-20">
            <div className="flex flex-col items-center mb-16 md:mb-24">
              <p className="text-4xl md:text-7xl text-black font-medium tracking-tight text-center mb-10" style={{ fontFamily: 'var(--font-eb-garamond), serif' }}>
                "Finally. A true all-in-one POS."
              </p>

              <div className="flex flex-row items-center gap-3 md:gap-6">
                <button
                  onClick={() => navigate('/waitlist')}
                  className="button-24 button-24--blue button-24--hero !px-6 md:!px-10"
                  role="button"
                >
                  <span className="text">Waitlist</span>
                </button>
                <button
                  onClick={() => navigate('/book-a-demo')}
                  className="button-24 button-24--hero !px-6 md:!px-10"
                  role="button"
                >
                  <span className="text">Book a Demo</span>
                </button>
              </div>
            </div>

            <div
              className="relative flex items-center justify-center whitespace-nowrap tracking-[0.05em] uppercase w-full mt-52 md:mt-16 transform-gpu scale-y-[1.8] md:scale-y-100 origin-bottom"
              style={{
                lineHeight: 0.8,
                fontSize: 'min(24vw, 350px)'
              }}
            >
              <span
                className="text-white relative z-10"
                style={{
                  fontFamily: 'Zodiak, serif',
                  fontWeight: 700,
                  WebkitMaskImage: 'linear-gradient(to bottom, white 40%, transparent 95%)',
                  maskImage: 'linear-gradient(to bottom, white 40%, transparent 95%)'
                }}
              >
                SWFTLY
              </span>
              {/* Foreground Floating Bags for Mobile - Integrated into branding for alignment */}
              <div className="absolute inset-0 z-30 md:hidden pointer-events-none">
                <motion.div
                  className="absolute left-[10%] bottom-[-160%] will-change-transform"
                  initial={{ opacity: 0.9, y: 0, rotate: -12, scale: 0.38 }}
                  animate={{ y: [0, -15, 0], rotate: [-12, -7, -12] }}
                  transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                >
                  <div className="relative w-[180px] h-[180px]">
                    <Image src="/bagg.png" alt="" fill className="object-contain brightness-50 opacity-90" style={{ filter: 'drop-shadow(0 20px 40px rgba(0,0,0,0.2))' }} />
                  </div>
                </motion.div>
                <motion.div
                  className="absolute right-[5%] bottom-[-140%] will-change-transform"
                  initial={{ opacity: 0.9, y: 0, rotate: 18, scale: 0.32 }}
                  animate={{ y: [0, -15, 0], rotate: [18, 23, 18] }}
                  transition={{ duration: 9, delay: 0.5, repeat: Infinity, ease: "easeInOut" }}
                >
                  <div className="relative w-[160px] h-[160px]">
                    <Image src="/bagg.png" alt="" fill className="object-contain brightness-50 opacity-90" style={{ filter: 'drop-shadow(0 20px 40px rgba(0,0,0,0.2))' }} />
                  </div>
                </motion.div>
              </div>
              {/* Subtle blur fadeout for mobile branding */}
              <div
                className="absolute inset-x-0 bottom-[-10%] h-[40%] backdrop-blur-[4px] pointer-events-none md:hidden z-20"
                style={{
                  WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 40%, black 70%, transparent)',
                  maskImage: 'linear-gradient(to bottom, transparent, black 40%, black 70%, transparent)'
                }}
              />
            </div>
          </div>
        </div>

        {/* Mobile Bottom Fade - Pushed lower into the transition area */}
        <div className="absolute bottom-[-40px] left-0 w-full h-52 bg-gradient-to-t from-white to-transparent pointer-events-none md:hidden z-20" />

        {/* Animated Grainient Background Container - Expanded white section */}
        <div className="absolute top-[70vh] left-0 w-full min-h-[115vh] z-0 flex flex-col items-center">
          <div className="absolute inset-0 z-0">
            {showHeavyAssets && (
              <Grainient
                color1="#5e30eb"
                color2="#371a94"
                color3="#ffffff"
                timeSpeed={0}
                colorBalance={0}
                warpStrength={1}
                warpFrequency={5}
                warpSpeed={0}
                warpAmplitude={50}
                blendAngle={0}
                blendSoftness={0.05}
                rotationAmount={500}
                noiseScale={2}
                grainAmount={0.1}
                grainScale={2}
                grainAnimated={false}
                contrast={1.5}
                gamma={1}
                saturation={1}
                centerX={0}
                centerY={0}
                zoom={0.9}
              />
            )}
          </div>

          {/* Floating Bags Scattered Across the Entire Background */}
          {[
            { top: '10%', left: '8%', rotate: -15, scale: 0.4, delay: 0, mobile: false },
            { top: '18%', left: '78%', rotate: 20, scale: 0.35, delay: 0.5, mobile: false },
            { top: '30%', left: '15%', rotate: 10, scale: 0.3, delay: 1, mobile: false },
            { top: '48%', left: '82%', rotate: -10, scale: 0.25, delay: 1.5, mobile: false },
            { top: '65%', left: '20%', rotate: -5, scale: 0.45, delay: 2, mobile: false },
            { top: '25%', left: '92%', rotate: 15, scale: 0.38, delay: 2.5, mobile: false },
            { top: '40%', left: '5%', rotate: -20, scale: 0.32, delay: 3, mobile: false },
            { top: '58%', left: '68%', rotate: 25, scale: 0.42, delay: 3.5, mobile: false },
            { top: '-15%', left: '15%', rotate: -12, scale: 0.38, delay: 0, mobile: false },
            { top: '-8%', left: '65%', rotate: 18, scale: 0.32, delay: 0.5, mobile: false },
          ].map((bag, i) => (
            <motion.div
              key={i}
              className={`absolute pointer-events-none will-change-transform ${!bag.mobile ? 'hidden md:block' : ''}`}
              style={{ top: bag.top, left: bag.left, zIndex: 10 }}
              initial={{ opacity: 0.85, y: 0, rotate: bag.rotate, scale: bag.scale }}
              animate={{
                y: [0, -25, 0],
                rotate: [bag.rotate, bag.rotate + 5, bag.rotate]
              }}
              transition={{
                duration: 1.2,
                delay: bag.delay,
                y: { duration: 8 + (i % 4), repeat: Infinity, ease: "easeInOut" },
                rotate: { duration: 9 + (i % 5), repeat: Infinity, ease: "easeInOut" }
              }}
            >
              <div className="relative w-[280px] h-[280px] md:w-[400px] md:h-[400px]">
                <Image
                  src="/bagg.png"
                  alt=""
                  fill
                  priority
                  unoptimized
                  className="object-contain"
                />
              </div>
            </motion.div>
          ))}

          {/* Absolute Fade to white at the section end */}
          <div className="absolute bottom-0 left-0 w-full h-[80vh] flex flex-col pointer-events-none z-[30]">
            <div className="flex-1 bg-gradient-to-t from-white via-white/40 to-transparent" />
            <div className="h-[20vh] bg-white" />
          </div>
        </div>
      </section>

      {/* Blue Gradient Feature Squares Section */}
      <section className="relative w-full py-24 bg-white z-20 overflow-hidden">
        <div className="max-w-[1600px] mx-auto px-6 md:px-12">
          {/* Section Title */}
          <div className="mb-20 text-center">
            <h2 className="text-4xl md:text-6xl font-medium tracking-tight text-black" style={{ fontFamily: 'var(--font-eb-garamond), serif' }}>
              Automate Inventory Management.
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-16 lg:gap-8 xl:gap-14">
            {[
              { title: "Upload a shipment", desc: "Upload any document type (PDFs, spreadsheets, images).", x: -0.15, y: -0.2, zoom: 0.7 },
              { title: "AI Extracts & Formats", desc: "Smart parsing for products, pricing, images, and SKUs.", x: 0.25, y: 0.15, zoom: 1.2 },
              { title: "Detects Issues", desc: "Identifies issues and resolves issues with vendors.", x: -0.2, y: 0.25, zoom: 0.9 },
              { title: "Restocks Inventory", desc: "Sync stock, create products, and update accounting.", x: 0.1, y: -0.3, zoom: 1.1 }
            ].map((item, i) => {
              const [isItemHovered, setIsItemHovered] = useState(false);
              const isActive = isMobile ? (activeStep === i) : isItemHovered;

              return (
                <div
                  key={i}
                  ref={(el) => { inventoryRefs.current[i] = el; }}
                  className="flex flex-col items-center"
                  onMouseEnter={() => !isMobile && setIsItemHovered(true)}
                  onMouseLeave={() => !isMobile && setIsItemHovered(false)}
                >
                  <div
                    className="w-7 h-7 md:w-8 md:h-8 bg-black rounded-full flex items-center justify-center mb-4 shadow-lg relative z-10"
                  >
                    <span className="text-white text-xs md:text-sm font-bold font-zodiak">{i + 1}</span>
                  </div>

                  <div
                    className="aspect-[4/3.5] w-[90%] mx-auto rounded-3xl relative overflow-hidden bg-[#2c19fc]"
                  >
                    <div className="absolute -inset-[15%] z-0">
                      {showHeavyAssets && (
                        <Grainient
                          color1="#5e30eb"
                          color2="#371a94"
                          color3="#ffffff"
                          timeSpeed={0}
                          zoom={item.zoom}
                          centerX={item.x}
                          centerY={item.y}
                          grainAmount={0.05}
                        />
                      )}
                    </div>
                    {/* Inner blue gradient glow around the border */}
                    <div className="absolute inset-0 rounded-3xl shadow-[inset_0_0_80px_rgba(44,25,252,0.5),inset_0_0_0_1.5px_rgba(255,255,255,0.3)] z-10 pointer-events-none" />
                    <div className="absolute inset-0 rounded-3xl border border-white/40 z-10 pointer-events-none" />

                    {/* Subtle internal shine for depth */}
                    <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent opacity-40 mix-blend-overlay" />

                    {/* Custom Mockups */}
                    {i === 0 && <UploadMockup isHovered={isActive} />}
                    {i === 1 && <AIExtractionMockup isHovered={isActive} />}
                    {i === 2 && <PrecisionProofingMockup isHovered={isActive} />}
                    {i === 3 && <LiveInventoryMockup isHovered={isActive} />}
                  </div>

                  <div
                    className="mt-6 text-center px-4"
                  >
                    <h3 className="text-black font-bold tracking-tight mb-2 font-sans" style={{ fontSize: '18px' }}>{item.title}</h3>
                    <p className="text-gray-500 text-sm leading-[1.4] max-w-[220px] mx-auto font-sans line-clamp-2">{item.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* New Full-Width Blue Gradient Section */}
      <section className="relative w-full min-h-[90vh] bg-[#2c19fc] z-20 overflow-hidden flex items-center justify-center py-32">
        {/* Signature Blue Grainient Background */}
        <div className="absolute inset-0 z-0">
          {showHeavyAssets && (
            <Grainient
              color1="#5e30eb"
              color2="#371a94"
              color3="#ffffff"
              timeSpeed={0}
              zoom={0.8}
              grainAmount={0.05}
            />
          )}
        </div>

        {/* Top & Bottom Shades for transition */}
        <div className="absolute top-0 left-0 w-full h-40 bg-gradient-to-b from-white to-transparent opacity-100 z-[1] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-full h-40 bg-gradient-to-t from-white to-transparent opacity-100 z-[1] pointer-events-none" />

        <div className="max-w-6xl mx-auto px-6 md:px-12 relative z-10 flex flex-col items-center w-full">
          <div className="text-center w-full max-w-5xl mx-auto mb-8 flex flex-col gap-4">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="text-white text-[36px] font-bold tracking-tight leading-[1.1] md:whitespace-nowrap"
              style={{ fontFamily: 'Zodiak, serif' }}
            >
              Accounting On Autopilot.
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.1, ease: "easeOut" }}
              className="text-white/70 text-[16px] font-medium leading-relaxed font-sans max-w-2xl mx-auto"
            >
              Sync orders from Shopify, DoorDash & more, connect payroll, and Swftly generates your reports and statements automatically.
            </motion.p>
          </div>

          {/* Software App Window Mockup - Proportional Scaling Wrapper */}
          <div
            className="w-full relative flex justify-center"
            style={{ height: `${mockupScale * 648 + 20}px` }} // 1152 * (9/16) = 648 + shadow room
          >
            <div
              className="w-[1152px] h-[648px] bg-white rounded-2xl shadow-[0_4px_12px_rgba(0,0,0,0.1)] overflow-hidden flex flex-col border border-white/10 origin-top shrink-0 relative select-none"
              style={{ transform: `scale(${mockupScale})` }}
            >
              {/* App Window Header */}
              <div className="w-full bg-white border-b border-[#eee] px-5 py-1 flex justify-between items-center z-10 relative">
                <div className="flex items-center flex-1 min-w-0 select-none">
                  <div className="px-3 py-1 text-[22px] font-bold tracking-[0.5px] text-[#2c19fc] leading-tight select-none font-sans">
                    SWFTLY
                  </div>
                </div>

                <div className="flex items-center gap-5">
                  <div className="p-1 flex items-center justify-center relative cursor-pointer group translate-y-[2px]">
                    <Bell size={28} className="text-[#888] transition-colors group-hover:text-gray-600" />
                    <div className="absolute top-0 right-0 min-w-[20px] h-5 bg-[#ef4444] rounded-full flex items-center justify-center text-white text-[12px] font-bold px-1 select-none">
                      3
                    </div>
                  </div>

                  <div className="flex items-center gap-3 cursor-pointer group">
                    <div className="w-8 h-8 rounded-full bg-[#4a90e2] flex items-center justify-center text-white text-xs font-bold shadow-sm">
                      DR
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[14px] font-semibold text-gray-700">Derek Rose</span>
                      <ChevronDown size={14} className="text-gray-400 group-hover:text-gray-600 transition-colors" />
                    </div>
                  </div>
                </div>
              </div>

              {/* App Mockup Content Area */}
              <div className="flex-1 w-full bg-white flex overflow-hidden font-sans">
                <AppSidebar />

                <div className="flex-1 bg-white relative overflow-hidden flex flex-col">
                  <AppDashboard />

                  {/* Floating Notification Stack */}
                  <div className="absolute right-6 top-4 flex flex-col gap-2.5 z-20 w-[240px] pointer-events-none">
                    <NotificationCard
                      icon="/shopify.svg"
                      title="New Shopify Order"
                      subtitle="#SP-3301 · Today · 6:58 PM"
                      accentColor="#5A863E"
                      accentRgb="100,148,62"
                      className="translate-x-3"
                    />
                    <NotificationCard
                      icon="/doordash.svg"
                      title="New DoorDash Order"
                      subtitle="#DD-4821 · Today · 7:14 PM"
                      accentColor="#FF3008"
                      accentRgb="255,48,8"
                      className="translate-x-3"
                    />
                    <NotificationCard
                      icon="/ubereats.svg"
                      title="New Uber Eats Order"
                      subtitle="#UE-9174 · Today · 7:02 PM"
                      accentColor="#06c167"
                      accentRgb="6,193,103"
                      className="translate-x-14"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Automate Growth Section */}
      <section className="relative w-full py-32 bg-white z-20">
        <div className="max-w-7xl mx-auto px-6 md:px-12 flex flex-col items-center">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="text-black text-3xl md:text-5xl font-bold tracking-tight text-center mb-4"
            style={{ fontFamily: 'Zodiak, serif' }}
          >
            Customers. Customers. Customers.
          </motion.h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-10 w-full max-w-[800px] mx-auto mt-4">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="aspect-[4/3] md:aspect-[16/9] relative rounded-[32px] overflow-hidden bg-[#2c19fc] border border-white/10"
              >
                {/* Background Texture Logic */}
                <div className="absolute -inset-[15%] z-0">
                  {showHeavyAssets && (
                    <Grainient
                      color1="#5e30eb"
                      color2="#371a94"
                      color3="#ffffff"
                      timeSpeed={0}
                      zoom={1.2 - (i * 0.1)}
                      centerX={0}
                      centerY={0}
                      grainAmount={0.06}
                    />
                  )}
                </div>

                {/* Inner blue gradient glow around the border */}
                <div className="absolute inset-0 rounded-[36px] shadow-[inset_0_0_100px_rgba(44,25,252,0.6),inset_0_0_0_1.5px_rgba(255,255,255,0.4)] z-10 pointer-events-none" />
                <div className="absolute inset-0 rounded-[36px] border border-white/40 z-10 pointer-events-none" />

                {/* Subtle internal shine for depth */}
                <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent opacity-40 mix-blend-overlay" />

                {/* Container Content Logic */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                  {i === 0 ? (
                    <div className="grid grid-cols-8 gap-2 p-4">
                      {Array.from({ length: 32 }).map((_, u) => (
                        <div
                          key={u}
                          className="w-6 h-6 md:w-8 md:h-8 rounded-full border border-white/40 bg-white/20 backdrop-blur-md flex items-center justify-center shadow-lg"
                        >
                          <User size={14} className="text-white opacity-90" />
                        </div>
                      ))}
                    </div>
                  ) : i === 1 ? (
                    <div className="relative w-full px-5 h-full flex items-center justify-center">
                      <div className="absolute top-10 right-4 w-10 h-10 rounded-full border border-white/40 bg-white/20 backdrop-blur-md flex items-center justify-center shadow-lg pointer-events-none z-30">
                        <Mail size={18} className="text-white opacity-90" />
                      </div>
                      <div className="w-full bg-white/20 backdrop-blur-xl border border-white/40 rounded-2xl p-3.5 shadow-2xl relative overflow-hidden">
                        {/* Message Header */}
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-8 h-8 rounded-full bg-orange-500 border border-white/30 flex items-center justify-center overflow-hidden shadow-inner">
                            <img src="/pizza.png" alt="Pizza Pit" className="w-full h-full object-contain p-1" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-white text-[13px] font-bold leading-tight">Pizza Pit</span>
                            <span className="text-white/50 text-[10px] uppercase tracking-wider font-semibold">Promotion · Just now</span>
                          </div>
                        </div>
                        {/* Message Body */}
                        <p className="text-white text-xs leading-relaxed font-medium">
                          🍕 <span className="text-white font-black">20% OFF!</span> We've missed you. Use code <span className="bg-white/20 px-1.5 py-0.5 rounded border border-white/20 italic font-bold tracking-widest uppercase">PIZZA20</span> to get a hot deal today. Order at <span className="underline decoration-white/30 underline-offset-2">pizzapit.com</span>
                        </p>
                      </div>
                    </div>
                  ) : i === 2 ? (
                    <div className="flex flex-col items-center justify-center h-full w-full px-6 pt-10 pb-8 gap-1">
                      {/* iOS Style Profile Header */}
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-12 h-12 rounded-full border border-white/50 bg-[#22c55e] flex items-center justify-center shadow-lg relative overflow-hidden">
                          <span className="text-2xl">🍔</span>
                          <div className="absolute inset-0 bg-gradient-to-tr from-black/20 to-transparent" />
                        </div>

                        <div className="flex flex-col items-center">
                          <span className="text-white text-[12px] font-black tracking-tight">Burger House</span>
                          <span className="text-white text-[10px] font-bold opacity-40 uppercase tracking-widest">iMessage</span>
                        </div>
                      </div>

                      {/* Glass Message Bubble */}
                      <div className="relative max-w-[95%] bg-[#3b82f6]/40 backdrop-blur-xl border border-white/30 rounded-[22px] px-4 py-2.5 shadow-2xl mt-1">
                        <p className="text-white text-[13px] leading-relaxed font-semibold">
                          <span className="font-black text-white">Hey Alex! 🌟</span> 2 orders left for your <span className="underline decoration-white/40 underline-offset-2">Free Burger</span>! 🍔🔥
                        </p>
                      </div>
                    </div>
                  ) : i === 3 ? (
                    <div className="flex flex-col items-center justify-center h-full w-full px-6 gap-6">
                      {/* Glass Notification */}
                      <div className="w-full bg-white/20 backdrop-blur-xl border border-white/40 rounded-2xl p-3.5 shadow-2xl relative overflow-hidden">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-white text-[13px] font-bold">Taco Town 🌮</span>
                        </div>
                        <p className="text-white text-xs leading-relaxed font-medium">
                          Welcome! 🎁 <span className="text-white font-black">Tap to use</span> your points, discounts, and exclusive offers instantly.
                        </p>
                      </div>

                      {/* Wallet Badges */}
                      <div className="flex flex-row flex-wrap items-center justify-center gap-4 w-full opacity-90">
                        <img
                          src="/apple-wallet.svg"
                          alt="Add to Apple Wallet"
                          className="h-10 w-auto hover:opacity-100 transition-opacity"
                        />
                        <img
                          src="/google-wallet.svg"
                          alt="Add to Google Wallet"
                          className="h-10 w-auto hover:opacity-100 transition-opacity"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="w-1/3 h-[2px] bg-white/10 rounded-full blur-sm" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI Analytics Section */}
      <section className="relative w-full min-h-[90vh] bg-[#2c19fc] z-20 overflow-hidden flex items-center justify-center py-32">
        {/* Signature Blue Grainient Background */}
        <div className="absolute inset-0 z-0">
          {showHeavyAssets && (
            <Grainient
              color1="#5e30eb"
              color2="#371a94"
              color3="#ffffff"
              timeSpeed={0}
              zoom={0.8}
              grainAmount={0.05}
            />
          )}
        </div>

        {/* Top & Bottom Shades for transition */}
        <div className="absolute top-0 left-0 w-full h-40 bg-gradient-to-b from-white to-transparent opacity-100 z-[1] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-full h-40 bg-gradient-to-t from-white via-white/40 to-transparent opacity-100 z-[1] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-6 md:px-12 relative z-10 flex flex-col items-center w-full">
          <div className="text-center w-full max-w-5xl mx-auto mb-8 md:mb-16 flex flex-col gap-2 md:gap-4">
            <motion.h2
              initial={isMobile ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              whileInView={isMobile ? { opacity: 1, y: 0 } : { opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="text-white text-[36px] font-bold tracking-tight leading-[1.1]"
              style={{ fontFamily: 'Zodiak, serif' }}
            >
              AI-Driven Analytics.
            </motion.h2>
            <motion.p
              initial={isMobile ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              whileInView={isMobile ? { opacity: 1, y: 0 } : { opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.1, ease: "easeOut" }}
              className="text-white/70 text-[16px] font-medium leading-relaxed font-sans max-w-2xl mx-auto"
            >
              Track what actually drives your business. Swftly collects meaningful data on employee activity, sales trends, inventory, and more
            </motion.p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl mx-auto mt-6 md:mt-12">
            {[
              {
                title: "Employee Productivity",
                desc: "Track employee productivity and activity in real-time.",
                chart: (
                  <div className="absolute inset-x-4 bottom-4 top-4 flex items-end justify-between opacity-30">
                    {[40, 70, 45, 90, 65, 80, 50].map((h, i) => (
                      <div
                        key={i}
                        className="w-[10%] bg-white/80 rounded-t-full shadow-[0_0_10px_rgba(255,255,255,0.2)]"
                        style={{ height: `${h}%` }}
                      />
                    ))}
                  </div>
                )
              },
              {
                title: "Popular Items & Trends",
                desc: "Identify best sellers and emerging trends instantly.",
                chart: (
                  <div className="absolute inset-4 flex items-center justify-center opacity-30">
                    <svg viewBox="0 0 200 100" className="w-full h-full p-4">
                      <path
                        d="M0,80 Q25,20 50,60 T100,20 T150,70 T200,30"
                        fill="none"
                        stroke="white"
                        strokeWidth="3"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                )
              },
              {
                title: "Revenue Insights",
                desc: "Understand your sales inside out with automated revenue mapping.",
                chart: (
                  <div className="absolute inset-6 flex items-center justify-center opacity-30">
                    <div className="grid grid-cols-4 gap-1.5 w-full h-full p-6">
                      {[1, 0.6, 0.8, 0.4, 0.7, 0.9, 0.5, 0.3].map((op, i) => (
                        <div
                          key={i}
                          className="bg-white/80 rounded-md"
                          style={{ opacity: op * 0.5 }}
                        />
                      ))}
                    </div>
                  </div>
                )
              },
              {
                title: "Inventory Alerts",
                desc: "Get notified before you run out. Tracks low stock.",
                chart: (
                  <div className="absolute inset-0 flex items-center justify-center opacity-40">
                    <div className="relative w-16 h-16">
                      <div className="absolute inset-0 border border-white/40 rounded-full scale-150" />
                      <div className="absolute inset-0 border border-white/60 rounded-full scale-100" />
                    </div>
                  </div>
                )
              },
              {
                title: "Intelligent Search",
                desc: "Find products faster with AI-powered search and image recognition.",
                chart: (
                  <div className="absolute inset-0 flex items-center justify-center opacity-30">
                    <div className="relative w-20 h-20 border-2 border-white/40 rounded-full flex items-center justify-center">
                      <div className="w-8 h-8 border-2 border-white/60 rounded-full" />
                      <div className="absolute bottom-2 right-2 w-6 h-1 bg-white/60 rotate-45 rounded-full" />
                    </div>
                  </div>
                )
              },
              {
                title: "Automated Reports",
                desc: "Full custom reports delivered to your inbox.",
                chart: (
                  <div className="absolute inset-x-8 bottom-0 top-1/4 flex flex-col gap-2 opacity-30">
                    {[1, 2, 3].map((line) => (
                      <div
                        key={line}
                        className="h-1 bg-white/80 rounded-full"
                        style={{ width: `${60 + (line * 10)}%` }}
                      />
                    ))}
                  </div>
                )
              }
            ].map((stat, i) => (
              <div
                key={i}
                className="relative h-[220px] bg-white/20 backdrop-blur-xl border border-white/40 rounded-2xl overflow-hidden shadow-[0_8px_32px_0_rgba(255,255,255,0.1),inset_0_0_0_1px_rgba(255,255,255,0.2)]"
              >
                {/* Static Background Chart */}
                {stat.chart}

                {/* Text Content Overlay */}
                <div className="absolute bottom-4 left-4 right-4 p-4 py-3 bg-white/30 backdrop-blur-xl border border-white/50 rounded-xl shadow-lg z-20">
                  <h3 className="text-white text-base font-bold mb-0.5" style={{ fontFamily: 'Zodiak, serif' }}>{stat.title}</h3>
                  <p className="text-white/80 text-[11px] font-sans leading-[1.3]">{stat.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section >

      {/* Schedule Shift Section */}
      < section className="relative w-full py-32 bg-white z-20" >
        <div className="max-w-7xl mx-auto px-6 md:px-12 flex flex-col items-center">
          <motion.h2
            initial={isMobile ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            whileInView={isMobile ? { opacity: 1, y: 0 } : { opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="text-black text-[36px] font-medium tracking-tight text-center mb-8"
            style={{ fontFamily: 'var(--font-eb-garamond), serif' }}
          >
            Schedule Shifts In One Click.
          </motion.h2>

          <div className="flex flex-col gap-8 w-full max-w-5xl mx-auto items-center">
            <motion.div
              initial={isMobile ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
              whileInView={isMobile ? { opacity: 1, y: 0 } : { opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="relative w-full min-h-[500px] md:h-[550px] rounded-3xl overflow-hidden bg-[#2c19fc] flex flex-col md:flex-row transition-transform duration-500"
            >
              {/* Internal Polish Layers - Exact Replica of Automate Inventory Section */}
              <div className="absolute inset-0 rounded-3xl shadow-[inset_0_0_80px_rgba(44,25,252,0.5),inset_0_0_0_1.5px_rgba(255,255,255,0.3)] z-10 pointer-events-none" />
              <div className="absolute inset-0 rounded-3xl border border-white/40 z-10 pointer-events-none" />
              <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent opacity-40 mix-blend-overlay z-10 pointer-events-none" />

              {/* Background Gradient */}
              <div className="absolute -inset-[15%] z-0">
                {showHeavyAssets && (
                  <Grainient
                    color1="#5e30eb"
                    color2="#371a94"
                    color3="#ffffff"
                    timeSpeed={0}
                    zoom={1.5}
                    grainAmount={0.05}
                  />
                )}
              </div>

              <div className="relative z-20 flex flex-col justify-start pt-12 md:pt-16 p-8 md:p-16 h-full w-full md:w-[45%] lg:w-[40%] text-white" style={{ fontFamily: 'var(--font-geist-sans), Inter, sans-serif' }}>
                <p className="text-xl font-bold mb-4">Schedules Based On:</p>
                <ul className="space-y-2 mb-8 text-white text-lg font-medium">
                  <li className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                    Peak Hours
                  </li>
                  <li className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                    Employee Availability
                  </li>
                  <li className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                    Labor Costs
                  </li>
                </ul>
                <p className="text-white/60 text-lg font-medium italic">
                  Swftly handles the complexity.
                </p>

                {/* Integration Logos - Floating App Icon Style with Individual Fades */}
                <div className="flex flex-wrap items-center gap-10 mt-4 md:mt-10 relative h-32 w-full max-w-[400px]">
                  <div
                    className="absolute left-0 top-0 w-10 h-10 md:w-14 md:h-14 bg-white rounded-2xl flex items-center justify-center p-2.5 shadow-2xl shadow-black/20 -translate-y-4 -rotate-6"
                    style={{ maskImage: 'linear-gradient(to bottom, black 50%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, black 50%, transparent 100%)' }}
                  >
                    <img src="/calendly.png" alt="Calendly" className="w-full h-full object-contain" />
                  </div>
                  <div
                    className="absolute left-1/4 top-1/2 w-10 h-10 md:w-14 md:h-14 bg-white rounded-2xl flex items-center justify-center p-2.5 shadow-2xl shadow-black/20 translate-y-2 rotate-12"
                    style={{ maskImage: 'linear-gradient(to bottom, black 50%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, black 50%, transparent 100%)' }}
                  >
                    <img src="/google-calendar.svg" alt="Google Calendar" className="w-full h-full object-contain" />
                  </div>
                  {/* Apple Calendar - Large Floating */}
                  <div
                    className="absolute left-1/2 top-0 -translate-x-4 -translate-y-4 -rotate-3 z-10"
                    style={{ maskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)' }}
                  >
                    <img src="/apple-calendar.png" alt="Apple Calendar" className="w-[65px] h-[65px] md:w-[75px] md:h-[75px] object-contain drop-shadow-2xl" />
                  </div>
                  <div
                    className="absolute right-0 top-1/3 w-10 h-10 md:w-14 md:h-14 bg-white rounded-2xl flex items-center justify-center p-2.5 shadow-2xl shadow-black/20 translate-y-0 rotate-[-12deg]"
                    style={{ maskImage: 'linear-gradient(to bottom, black 50%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, black 50%, transparent 100%)' }}
                  >
                    <img src="/outlook.svg" alt="Outlook" className="w-full h-full object-contain" />
                  </div>
                </div>
                {/* Mobile-only Generate Button above Asterisk */}
                {isMobile && (
                  <div className="flex justify-end mt-2">
                    <div
                      className="button-24 !px-6 !py-2.5 !rounded-full shadow-xl cursor-default border-transparent bg-white !text-black flex items-center justify-center font-medium scale-90 origin-right"
                      style={{ fontFamily: 'var(--font-geist-sans), Inter, sans-serif', textTransform: 'none' }}
                    >
                      <span className="text-black">Generate</span>
                    </div>
                  </div>
                )}

                {/* Integration Footnote */}
                <p className={`${isMobile ? 'mt-2' : 'mt-8'} text-white/40 text-[10px] md:text-xs font-medium tracking-tight text-right md:text-left`} style={{ fontFamily: 'var(--font-geist-sans), Inter, sans-serif' }}>
                  *Integrate with Google Calendar, Apple Calendar, Microsoft Calendar, Calendly +
                </p>
              </div>

              {/* Mockup Area - Hidden on Mobile */}
              <div className="relative z-20 w-full md:w-[55%] lg:w-[60%] hidden md:flex items-center justify-center p-6 md:p-12 h-full">
                <SchedulingMockup />
              </div>
            </motion.div>
          </div>
        </div>
      </section >

      {/* Choose Your Hardware Section */}
      < section className="relative w-full py-32 bg-white z-20" >
        <div className="max-w-7xl mx-auto px-6 md:px-12 text-center">
          <motion.h2
            initial={isMobile ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            whileInView={isMobile ? { opacity: 1, y: 0 } : { opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="text-black text-[46px] font-medium tracking-tight mb-4"
            style={{ fontFamily: 'var(--font-eb-garamond), serif' }}
          >
            Choose Your Hardware
          </motion.h2>

          {/* Hero Hardware Image */}
          <motion.img
            initial={isMobile ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
            whileInView={isMobile ? { opacity: 1, y: 0 } : { opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1, ease: "easeOut" }}
            src="/hardware-hero.png"
            alt="Hardware Ecosystem"
            className="w-full h-auto max-w-2xl mx-auto translate-x-4 md:-translate-x-8 mb-12 block rounded-none shadow-none"
          />

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-20">
            {[
              {
                title: "Mobile & Desktop",
                desc: "Your POS, your device — your choice.",
              },
              {
                title: "Use Existing Hardware",
                desc: "Your scanners, printers, and terminals — plug in and go.",
              },
              {
                title: "Connect Your Processor",
                desc: "Stripe built-in, or connect any provider you already use.",
              }
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={isMobile ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
                whileInView={isMobile ? { opacity: 1, y: 0 } : { opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.1 }}
                className="bg-gray-50 rounded-[32px] p-10 flex flex-col items-start text-left border border-transparent shadow-sm"
              >
                <h3 className="text-black text-xl xl:text-2xl font-bold mb-4 whitespace-nowrap" style={{ fontFamily: 'Zodiak, serif' }}>{item.title}</h3>
                <p className="text-gray-500 text-base md:text-lg leading-relaxed" style={{ fontFamily: 'var(--font-geist-sans), Inter, sans-serif' }}>
                  {item.desc}
                </p>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={isMobile ? { opacity: 1 } : { opacity: 0 }}
            whileInView={isMobile ? { opacity: 1 } : { opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1 }}
            className="border-t border-gray-100 pt-12 text-left"
          >
            <p className="text-gray-400 text-sm md:text-base leading-relaxed max-w-4xl tracking-tight" style={{ fontFamily: 'var(--font-geist-sans), Inter, sans-serif' }}>
              <span className="font-bold text-gray-900">*Swftly does not take a percentage of your transactions.</span> Our default processor is Stripe Online orders: 2.9% + 30¢.
              In-Person (Stripe Terminal): 2.7% + 5¢, all other terminals can be seamlessly configured in-app.
            </p>
          </motion.div>
        </div>
      </section >

      {/* Pricing Comparison Section */}
      < section id="pricing-section" className="relative w-full py-40 overflow-hidden" >
        {/* Animated Grainient Background */}
        < div className="absolute inset-0 z-0" >
          {showHeavyAssets && (
            <Grainient
              color1="#5e30eb"
              color2="#371a94"
              color3="#ffffff"
              timeSpeed={0}
              zoom={0.8}
              grainAmount={0.05}
            />
          )}
        </div >

        {/* Top & Bottom Shades for transition */}
        < div className="absolute top-0 left-0 w-full h-40 bg-gradient-to-b from-white to-transparent opacity-100 z-[1] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-full h-40 bg-gradient-to-t from-white to-transparent opacity-100 z-[1] pointer-events-none" />

        <div className="max-w-6xl mx-auto px-6 md:px-12 flex justify-center relative z-10">
          <div className="w-full">
            <div className="relative">
              {/* Solid White Card Behind */}
              <div className="absolute inset-0 bg-white/90 rounded-[40px]" />

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="relative pos-card-glass-inhouse rounded-[40px] p-8 md:p-12 shadow-[0_40px_100px_rgba(44,25,252,0.15)] overflow-hidden flex flex-col md:flex-row gap-12 group transition-all duration-500"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-[#2c19fc]/5 via-transparent to-transparent pointer-events-none" />

                {/* Left Side: Brand & Billing */}
                <div className="md:w-1/3 flex flex-col justify-between relative z-10">
                  <div>
                    <div className="flex items-center gap-4 mb-8">
                      <div className="relative w-14 h-14 flex items-center justify-center transform-gpu perspective-1000 group-hover:rotate-y-12 transition-transform duration-500">
                        <div className="absolute inset-0 bg-[#2c19fc] rounded-xl rotate-6 translate-x-1 translate-y-1 opacity-20" />
                        <div className="relative w-full h-full bg-gradient-to-br from-[#2c19fc] to-[#1a0fb3] rounded-2xl flex items-center justify-center shadow-xl border border-white/20 p-1">
                          <img src="/Swftly.svg" alt="Swftly" className="w-full h-full object-contain brightness-0 invert" />
                        </div>
                      </div>
                      <span className="text-3xl font-bold text-black tracking-tight" style={{ fontFamily: 'var(--font-eb-garamond), serif' }}>Swftly</span>
                    </div>

                    <div className="mb-8">
                      <div className="flex items-baseline gap-1 mb-2">
                        <span className="text-6xl font-black text-black tracking-tighter">$34.99</span>
                        <span className="text-xl font-bold text-gray-400">/mo</span>
                      </div>
                      <p className="text-gray-500 text-base font-medium">All-in-one software suite</p>
                    </div>
                  </div>

                  <button
                    onClick={() => navigate('/waitlist')}
                    className="button-7 button-7--blue !w-full !mx-0 !mb-0 hidden md:flex justify-center items-center py-5 text-lg"
                  >
                    <span className="text">Switch to Swftly</span>
                  </button>
                </div>

                {/* Right Side: Features Grid */}
                <div className="md:w-2/3 flex flex-col relative z-10">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6 mb-12">
                    {[
                      { label: "Rewards & Marketing", value: "Built-In", desc: "Emails, SMS & Digital Passes" },
                      { label: "Hardware Compatibility", value: "Any Device", desc: "iOS, Android, Chrome, Windows" },
                      { label: "3rd Party Aggregates", value: "Unlimited", desc: "DoorDash, UberEats, etc." },
                      { label: "Automated Accounting", value: "Included", desc: "Real-time sync to leading books" },
                      { label: "Flexible Processing", value: "Universal", desc: "Works with your existing terminal" },
                      { label: "And much more", value: "Included", desc: "Inventory, Scheduling, Analytics +" }
                    ].map((item, i) => (
                      <div key={i} className="flex flex-col pb-4 border-b border-gray-100 last:md:border-b-0">
                        <div className="flex justify-between items-center mb-1">
                          <p className="text-black font-bold text-lg">{item.label}</p>
                          <Check className="w-5 h-5 text-[#2c19fc] stroke-[3.5]" />
                        </div>
                        <p className="text-gray-500 text-sm leading-relaxed">{item.desc}</p>
                      </div>
                    ))}
                  </div>

                  {/* Mobile-only CTA at the bottom of the card */}
                  <button
                    onClick={() => navigate('/waitlist')}
                    className="button-7 button-7--blue !w-full !mx-0 !mb-0 flex md:hidden justify-center items-center py-5 text-lg"
                  >
                    <span className="text">Switch to Swftly</span>
                  </button>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section >

      {/* Final CTA Section */}
      < section id="final-cta" className="relative w-full h-screen flex flex-col bg-white overflow-hidden" >
        <div className="flex-1 flex items-center justify-center">
          <div className="max-w-7xl mx-auto px-4 flex items-center justify-center gap-2 md:gap-32 mt-20">
            <h2
              ref={finalGetRef}
              className="text-[10vw] md:text-[120px] font-bold text-black tracking-tight translate-x-[2vw] md:translate-x-[-288px]"
              style={{ fontFamily: 'Zodiak, serif' }}
            >
              Get
            </h2>
            {/* Mac App Symbol for Mobile, Gap for 3D Logo on Desktop */}
            <div className="w-16 h-24 md:w-[220px] flex items-center justify-center relative">
              <motion.div
                className="md:hidden w-16 h-16 bg-gradient-to-br from-[#2c19fc] to-[#1a0fb3] rounded-[18px] flex items-center justify-center shadow-[0_10px_30px_rgba(44,25,252,0.3)] border border-white/10 p-2.5"
                initial={{ scale: 0, opacity: 0 }}
                whileInView={{ scale: 1, opacity: 1 }}
                viewport={{ once: false, amount: 0.5 }}
                transition={{
                  type: "spring",
                  stiffness: 260,
                  damping: 20,
                  duration: 0.6
                }}
              >
                <img src="/Swftly.svg" alt="Swftly" className="w-full h-full object-contain brightness-0 invert" />
              </motion.div>
            </div>
            <h2
              ref={finalSwftlyRef}
              className="text-[10vw] md:text-[120px] font-bold text-black tracking-tight -translate-x-[2vw] md:translate-x-0"
              style={{ fontFamily: 'Zodiak, serif' }}
            >
              Swftly.
            </h2>
          </div>
        </div>

        {/* Integrated Footer */}
        <div className="w-full pt-8 pb-16 px-4 relative z-10 bg-white">
          <div className="max-w-7xl mx-auto flex flex-row items-center justify-between gap-2 border-t border-gray-50 pt-8">
            <div className="flex items-center">
              <span className="text-[10px] md:text-sm text-gray-400 font-medium whitespace-nowrap">© 2026 Swftly.</span>
            </div>
            <div className="flex items-center gap-2 md:gap-10">
              <NavButton className="text-[10px] md:text-sm" onClick={() => window.open('https://instagram.com/getswftly', '_blank')}>Instagram</NavButton>
              <NavButton className="text-[10px] md:text-sm" onClick={() => window.open('https://instagram.com/getswftly', '_blank')}>X</NavButton>
              <NavButton className="text-[10px] md:text-sm" onClick={() => navigate('/book-a-demo')}>Contact</NavButton>
            </div>
          </div>
        </div>
      </section >


    </div >
  );
}

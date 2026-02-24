'use client';

import { motion } from 'motion/react';
import { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Check, Send, ChevronRight, Loader2, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import ThreeLogo from '../components/ThreeLogo';
import Grainient from '../components/Grainient';

export default function BookADemo() {
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const NavButton = ({ children, className, isBold = false, onClick }: { children: React.ReactNode; className?: string; isBold?: boolean; onClick?: () => void }) => {
        const [isHovered, setIsHovered] = useState(false);
        const [entrySide, setEntrySide] = useState<'left' | 'right'>('left');

        return (
            <motion.button
                className={`relative group py-1 text-sm ${isBold ? 'font-semibold' : 'font-medium'} text-black overflow-hidden flex items-center gap-1.5 ${className || ''}`}
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

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        // Simulate API call
        setTimeout(() => {
            setIsLoading(false);
            setIsSubmitted(true);
        }, 1500);
    };

    return (
        <div className="min-h-screen bg-white font-sans overflow-hidden">
            {/* Header - Matching main page */}
            <motion.header
                className="fixed top-2 left-4 right-4 z-[1001]"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
            >
                <div className="max-w-7xl mx-auto px-4 py-1.5 flex items-center justify-between relative z-10">
                    <Link href="/" className="flex items-center gap-4 relative w-12 h-12 group">
                        <motion.span
                            className="absolute left-[90px] text-sm font-medium text-black px-3 py-1 drop-shadow-[0_0_8px_rgba(44,25,252,0.15)]"
                        >
                            Swftly
                        </motion.span>
                    </Link>
                    <div className="flex items-center gap-10">
                        <Link href="/#software-section">
                            <NavButton>Software</NavButton>
                        </Link>
                        <Link href="/#pricing-section">
                            <NavButton>Pricing</NavButton>
                        </Link>
                        <NavButton className="text-[#2c19fc]">
                            Book A Demo
                        </NavButton>
                        <NavButton isBold>
                            Get Started
                            <ArrowUpRight className="w-4 h-4 relative z-10" />
                        </NavButton>
                    </div>
                </div>
            </motion.header>

            {/* Reuse the 3D Logo - It will naturally stay in the header if we don't scroll */}
            <ThreeLogo forceDock={true} />

            <main className="relative pt-40 pb-20 px-4 min-h-screen flex flex-col items-center">
                {/* Background Grainient */}
                <div className="absolute inset-0 z-0">
                    <Grainient
                        color1="#f0f2ff"
                        color2="#ffffff"
                        color3="#eef0ff"
                        timeSpeed={0.15}
                        zoom={1.2}
                        contrast={1.1}
                        grainAmount={0.02}
                    />
                </div>

                <div className="relative z-10 w-full max-w-2xl">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.2 }}
                        className="text-center mb-12"
                    >
                        <h1 className="text-5xl md:text-6xl font-black text-black tracking-tighter mb-4" style={{ fontFamily: 'Zodiak, serif' }}>
                            Experience Swftly.
                        </h1>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#2c19fc]/10 border border-[#2c19fc]/20 mb-6">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#2c19fc] animate-pulse" />
                            <span className="text-[#2c19fc] text-xs font-bold uppercase tracking-widest">We're in beta currently</span>
                        </div>
                        <p className="text-gray-500 text-lg md:text-xl font-medium max-w-lg mx-auto leading-relaxed">
                            Complete the form below and our team will be in touch within 24 hours to schedule your personalized walkthrough.
                        </p>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.8, delay: 0.4 }}
                        className="relative"
                    >
                        {/* Form Container with Premium Styling */}
                        <div className="absolute inset-0 bg-white/60 rounded-[40px] blur-xl" />

                        <div className="relative pos-card-glass-inhouse rounded-[40px] p-8 md:p-12 shadow-[0_40px_100px_rgba(44,25,252,0.15)] overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-br from-[#2c19fc]/5 via-transparent to-transparent pointer-events-none" />

                            {!isSubmitted ? (
                                <form onSubmit={handleSubmit} className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold uppercase tracking-widest text-gray-400 ml-1">First Name</label>
                                            <input
                                                required
                                                type="text"
                                                className="w-full bg-white/50 border border-gray-200 rounded-2xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-[#2c19fc]/20 focus:border-[#2c19fc] transition-all text-black font-medium"
                                                placeholder="First"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold uppercase tracking-widest text-gray-400 ml-1">Last Name</label>
                                            <input
                                                required
                                                type="text"
                                                className="w-full bg-white/50 border border-gray-200 rounded-2xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-[#2c19fc]/20 focus:border-[#2c19fc] transition-all text-black font-medium"
                                                placeholder="Last"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-widest text-gray-400 ml-1">Work Email</label>
                                        <input
                                            required
                                            type="email"
                                            className="w-full bg-white/50 border border-gray-200 rounded-2xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-[#2c19fc]/20 focus:border-[#2c19fc] transition-all text-black font-medium"
                                            placeholder="Email"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-widest text-gray-400 ml-1">Business Type</label>
                                        <input
                                            required
                                            type="text"
                                            className="w-full bg-white/50 border border-gray-200 rounded-2xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-[#2c19fc]/20 focus:border-[#2c19fc] transition-all text-black font-medium"
                                            placeholder="Retail, Restaurant, etc."
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-widest text-gray-400 ml-1">Message (Optional)</label>
                                        <textarea
                                            className="w-full bg-white/50 border border-gray-200 rounded-2xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-[#2c19fc]/20 focus:border-[#2c19fc] transition-all text-black font-medium min-h-[120px]"
                                            placeholder="Tell us about your needs..."
                                        ></textarea>
                                    </div>

                                    <button
                                        disabled={isLoading}
                                        type="submit"
                                        className="button-49 w-full !mx-0 !mt-8 flex justify-center items-center gap-2 group"
                                    >
                                        {isLoading ? (
                                            <motion.div
                                                animate={{ rotate: 360 }}
                                                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                                            >
                                                <Loader2 className="w-5 h-5 text-white" />
                                            </motion.div>
                                        ) : (
                                            <>
                                                <span className="text">Request Demo Now</span>
                                                <ChevronRight className="w-5 h-5 text-white group-hover:translate-x-1 transition-transform" />
                                            </>
                                        )}
                                    </button>
                                </form>
                            ) : (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="py-12 flex flex-col items-center text-center"
                                >
                                    <div className="w-20 h-20 bg-[#2c19fc] rounded-full flex items-center justify-center mb-6 shadow-lg shadow-[#2c19fc]/20">
                                        <Check className="w-10 h-10 text-white" />
                                    </div>
                                    <h2 className="text-3xl font-bold text-black mb-4 tracking-tight">Request Received!</h2>
                                    <p className="text-gray-500 font-medium mb-8 max-w-xs">
                                        We've sent a confirmation to your email. One of our specialists will be in touch shortly.
                                    </p>
                                    <Link href="/">
                                        <button className="flex items-center gap-2 text-[#2c19fc] font-bold hover:gap-3 transition-all underline underline-offset-4">
                                            <ArrowLeft className="w-4 h-4" />
                                            Return Home
                                        </button>
                                    </Link>
                                </motion.div>
                            )}
                        </div>
                    </motion.div>
                </div>
            </main>

            {/* Footer */}
            <footer className="bg-white/80 backdrop-blur-md border-t border-gray-100 py-8 px-4 relative z-10 w-full mt-auto">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">© 2024 Swftly. All rights reserved.</span>
                    </div>
                    <div className="flex items-center gap-6">
                        <a href="#" className="text-sm text-gray-500 hover:text-[#2c19fc] transition-colors">Instagram</a>
                        <a href="#" className="text-sm text-gray-500 hover:text-[#2c19fc] transition-colors">X</a>
                        <a href="#" className="text-sm text-gray-500 hover:text-[#2c19fc] transition-colors">Contact</a>
                    </div>
                </div>
            </footer>
        </div>
    );
}

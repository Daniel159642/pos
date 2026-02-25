'use client';

import { motion } from 'motion/react';
import { useState, useEffect } from 'react';
import { ArrowLeft, Check, ChevronRight, Loader2, ArrowUpRight, Sparkles } from 'lucide-react';
import ThreeLogo from '../components/ThreeLogo';
import Grainient from '../components/Grainient';
import { useTransition } from '../TransitionContext';

export default function WaitlistPage() {
    const { navigate } = useTransition();
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

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

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        businessName: '',
        businessType: '',
    });
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/contact', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    firstName: formData.name,
                    email: formData.email,
                    businessName: formData.businessName,
                    businessType: formData.businessType,
                    message: 'WAITLIST SIGNUP'
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to join waitlist');
            }

            setIsSubmitted(true);
        } catch (err) {
            setError('Something went wrong. Please try again later.');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-white font-sans overflow-hidden">
            {/* Header */}
            <motion.header
                className="fixed top-2 left-4 right-4 z-[1001]"
                initial={false}
                animate={{ opacity: 1, y: 0 }}
            >
                <div className="max-w-7xl mx-auto px-4 py-1.5 flex items-center justify-between relative z-10">
                    <button onClick={() => navigate('/')} className="flex items-center gap-4 relative w-12 h-12 group focus:outline-none">
                        <motion.span
                            className="absolute left-[90px] text-sm font-medium text-black px-3 py-1 drop-shadow-[0_0_8px_rgba(44,25,252,0.15)] hidden md:block"
                        >
                            Swftly
                        </motion.span>
                    </button>
                    <div className="flex items-center gap-4 md:gap-10">
                        <NavButton onClick={() => navigate('/#software-section')}>Software</NavButton>
                        <NavButton onClick={() => navigate('/#pricing-section')}>Pricing</NavButton>
                        <NavButton onClick={() => navigate('/book-a-demo')}>
                            <span className="md:hidden">Demo</span>
                            <span className="hidden md:inline">Book A Demo</span>
                        </NavButton>
                        <NavButton isBold className="text-[#2c19fc]">
                            Join Waitlist
                            <ArrowUpRight className="w-4 h-4 relative z-10" />
                        </NavButton>
                    </div>
                </div>
            </motion.header>

            <ThreeLogo forceDock={true} />

            <main className="relative pt-40 pb-20 px-4 min-h-screen flex flex-col items-center justify-center">
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

                <div className="relative z-10 w-full max-w-xl">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        className="text-center mb-10"
                    >
                        <h1 className="text-5xl md:text-6xl font-black text-black tracking-tighter mb-4" style={{ fontFamily: 'Zodiak, serif' }}>
                            Get Early Access.
                        </h1>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#2c19fc]/10 border border-[#2c19fc]/20 mb-6">
                            <Sparkles className="w-4 h-4 text-[#2c19fc]" />
                            <span className="text-[#2c19fc] text-xs font-bold uppercase tracking-widest">Join the exclusive waitlist</span>
                        </div>
                        <p className="text-gray-500 text-lg md:text-xl font-medium max-w-md mx-auto leading-relaxed">
                            We're rolling out access to a limited number of businesses each week. Secure your spot in line today.
                        </p>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                        className="relative"
                    >
                        <div className="absolute inset-0 bg-white/60 rounded-[40px] blur-xl" />

                        <div className="relative pos-card-glass-inhouse rounded-[40px] p-8 md:p-12 shadow-[0_40px_100px_rgba(44,25,252,0.15)] overflow-hidden border border-white/50">
                            <div className="absolute inset-0 bg-gradient-to-br from-[#2c19fc]/5 via-transparent to-transparent pointer-events-none" />

                            {!isSubmitted ? (
                                <form onSubmit={handleSubmit} className="space-y-6">
                                    {error && (
                                        <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl text-sm font-medium">
                                            {error}
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-widest text-gray-400 ml-1">Full Name</label>
                                        <input
                                            required
                                            type="text"
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            className="w-full bg-white/50 border border-gray-200 rounded-2xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-[#2c19fc]/20 focus:border-[#2c19fc] transition-all text-black font-medium"
                                            placeholder="Enter your name"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-widest text-gray-400 ml-1">Business Email</label>
                                        <input
                                            required
                                            type="email"
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            className="w-full bg-white/50 border border-gray-200 rounded-2xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-[#2c19fc]/20 focus:border-[#2c19fc] transition-all text-black font-medium"
                                            placeholder="you@company.com"
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold uppercase tracking-widest text-gray-400 ml-1">Business Name</label>
                                            <input
                                                required
                                                type="text"
                                                value={formData.businessName}
                                                onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                                                className="w-full bg-white/50 border border-gray-200 rounded-2xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-[#2c19fc]/20 focus:border-[#2c19fc] transition-all text-black font-medium"
                                                placeholder="Company Name"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold uppercase tracking-widest text-gray-400 ml-1">Business Type</label>
                                            <input
                                                required
                                                type="text"
                                                value={formData.businessType}
                                                onChange={(e) => setFormData({ ...formData, businessType: e.target.value })}
                                                className="w-full bg-white/50 border border-gray-200 rounded-2xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-[#2c19fc]/20 focus:border-[#2c19fc] transition-all text-black font-medium"
                                                placeholder="Retail, Cafe, etc."
                                            />
                                        </div>
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
                                                <span className="text">Secure My Spot</span>
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
                                    <h2 className="text-3xl font-bold text-black mb-4 tracking-tight">You're on the list!</h2>
                                    <p className="text-gray-500 font-medium mb-8 max-w-xs mx-auto">
                                        Thank you for your interest in Swftly. We'll reach out as soon as a spot opens up for your business.
                                    </p>
                                    <button
                                        onClick={() => navigate('/')}
                                        className="flex items-center gap-2 text-[#2c19fc] font-bold hover:gap-3 transition-all underline underline-offset-4"
                                    >
                                        <ArrowLeft className="w-4 h-4" />
                                        Return Home
                                    </button>
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
                </div>
            </footer>
        </div>
    );
}

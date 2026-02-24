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
import { ArrowUpRight, Settings, User, LogOut, Bell, Camera, CreditCard, Search, Check, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import ThreeLogo, { StaticLogo } from "./components/ThreeLogo";
import GradualBlur from './components/GradualBlur';

import Grainient from './components/Grainient';
import ScrollReveal from './components/ScrollReveal';

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
  const [mobileStep, setMobileStep] = useState(0);
  const [isThirdSectionInView, setIsThirdSectionInView] = useState(false);
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
  const [videoInfoStep, setVideoInfoStep] = useState(0);
  const [videoTime, setVideoTime] = useState(0);
  const [hasDismissedCTA, setHasDismissedCTA] = useState(false);
  const [stickyStep, setStickyStep] = useState(0);
  const stickySectionRef = useRef<HTMLElement>(null);
  const scrollingContentRef = useRef<HTMLDivElement>(null);
  const mobileVideoRef = useRef<HTMLVideoElement>(null);
  const finalGetRef = useRef<HTMLHeadingElement>(null);
  const finalSwftlyRef = useRef<HTMLHeadingElement>(null);
  const [showHeavyAssets, setShowHeavyAssets] = useState(false);

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
    // Sync the "Swftly" text animation exactly with the 3D Logo scroll trigger
    if (!swftlyTextRef.current) return;

    const ctx = gsap.context(() => {
      gsap.to(swftlyTextRef.current, {
        x: 90, // Increased to accommodate larger logo
        ease: "power2.inOut", // Match ThreeLogo easing
        scrollTrigger: {
          trigger: "body",
          start: "top top",
          end: () => window.innerHeight, // Match ThreeLogo scroll duration
          scrub: 0.2 // Match ThreeLogo scrub delay to prevent desynchronization
        }
      });
    });

    return () => ctx.revert();
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
              setTimeout(() => {
                video.play().catch(e => console.log("Video play failed:", e));
                if (isMobile) hasMobileVideoPlayed.current = true;
                else hasVideoPlayed.current = true;
              }, 1000);
            }
          }
        });
      },
      { threshold: 0.1 }
    );

    if (videoRef.current) observer.observe(videoRef.current);
    if (mobileVideoRef.current) observer.observe(mobileVideoRef.current);

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
      <motion.header
        className="fixed top-2 left-4 right-4 z-[1001] will-change-transform"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.0, delay: 0.5 }}
      >
        <div className="max-w-7xl mx-auto px-4 py-1.5 flex items-center justify-between relative z-10">
          <div className="flex items-center gap-4 relative w-12 h-12">
            {/* 3D Logo docks here on scroll */}
            <motion.span
              ref={swftlyTextRef}
              className="absolute left-0 text-sm font-medium text-black px-3 py-1 drop-shadow-[0_0_8px_rgba(44,25,252,0.15)] hidden md:block"
            >
              Swftly
            </motion.span>
          </div>
          <div className="flex items-center gap-4 md:gap-10">
            {['Software', 'Pricing', 'Book A Demo'].map((item) => {
              const button = (
                <NavButton
                  key={item}
                  onClick={item === 'Pricing' ? () => {
                    setIsNavigating(true);
                    document.getElementById('pricing-section')?.scrollIntoView({ behavior: 'smooth' });
                    setTimeout(() => setIsNavigating(false), 1200);
                  } : item === 'Software' ? () => {
                    setIsNavigating(true);
                    const isMobile = window.innerWidth < 768;
                    const targetId = isMobile ? 'mobile-software-section' : 'software-section';
                    document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth' });
                    setTimeout(() => setIsNavigating(false), 1200);
                  } : item === 'Book A Demo' ? () => {
                    navigate('/book-a-demo');
                  } : undefined}
                >
                  {item === 'Book A Demo' ? (
                    <>
                      <span className="md:hidden">Demo</span>
                      <span className="hidden md:inline">Book A Demo</span>
                    </>
                  ) : item}
                </NavButton>
              );

              return button;
            })}
            <NavButton isBold onClick={() => navigate('/book-a-demo')}>
              Get Started
              <ArrowUpRight className="w-4 h-4 relative z-10" />
            </NavButton>
          </div>
        </div>
      </motion.header>

      <ThreeLogo />

      {/* Hero Section */}
      {/* Hero Section */}
      <section className="relative w-full min-h-[300vh] bg-white overflow-hidden pb-32">
        {/* Main Hero White Content Area */}
        <div className="relative w-full z-20 pointer-events-none">
          <div ref={heroTextRef} className="w-full max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center pt-[15vh] px-2 md:px-12 relative z-10 md:mt-4">
            {/* Split Desktop Layout */}
            <div className="hidden md:flex flex-1 justify-end pr-4 md:pr-12">
              <BlurText
                text="Everything you need."
                delay={1200}
                animateBy="words"
                direction="top"
                once={true}
                className="text-2xl md:text-3xl font-bold text-black text-right font-zodiak"
              />
            </div>

            {/* Middle Spacer for Logo */}
            <div className="w-[120px] md:w-[240px] h-32 md:h-[300px]"></div>

            {/* Mobile Centered Layout */}
            <div className="md:hidden flex flex-col items-center mt-[30vh]">
              <BlurText
                text="Everything you need. All in one place."
                delay={1200}
                animateBy="words"
                direction="top"
                once={true}
                className="text-[15px] font-bold text-black text-center font-zodiak whitespace-nowrap"
              />
            </div>

            <div className="hidden md:flex flex-1 justify-start pl-8 md:pl-24">
              <BlurText
                text="All in one place."
                delay={1800}
                animateBy="words"
                direction="top"
                once={true}
                className="text-2xl md:text-3xl font-bold text-black text-left font-zodiak"
              />
            </div>
          </div>
        </div>

        {/* Animated Grainient Background Container - Starts lower to show white section first */}
        <div className="absolute top-[65vh] left-0 w-full min-h-[235vh] z-0 flex flex-col items-center">
          <div className="absolute inset-0 z-0">
            {showHeavyAssets && (
              <Grainient
                color1="#5e30eb"
                color2="#371a94"
                color3="#ffffff"
                timeSpeed={0.25}
                colorBalance={0}
                warpStrength={1}
                warpFrequency={5}
                warpSpeed={2}
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
            { top: '5%', left: '5%', rotate: -15, scale: 0.4, delay: 0 },
            { top: '25%', left: '85%', rotate: 20, scale: 0.35, delay: 0.5 },
            { top: '45%', left: '10%', rotate: 10, scale: 0.3, delay: 1 },
            { top: '65%', left: '75%', rotate: -10, scale: 0.25, delay: 1.5 },
            { top: '85%', left: '20%', rotate: -5, scale: 0.45, delay: 2 },
            { top: '15%', left: '90%', rotate: 15, scale: 0.38, delay: 2.5 },
            { top: '35%', left: '5%', rotate: -20, scale: 0.32, delay: 3 },
            { top: '55%', left: '80%', rotate: 25, scale: 0.42, delay: 3.5 },
            { top: '75%', left: '15%', rotate: -12, scale: 0.28, delay: 4 },
            { top: '95%', left: '85%', rotate: 18, scale: 0.36, delay: 4.5 },
            { top: '40%', left: '92%', rotate: -8, scale: 0.22, delay: 1.2 },
            { top: '60%', left: '4%', rotate: 30, scale: 0.34, delay: 2.2 },
          ].map((bag, i) => (
            <motion.div
              key={i}
              className="absolute pointer-events-none will-change-transform"
              style={{ top: bag.top, left: bag.left, zIndex: 1 }}
              initial={{ opacity: 0, y: 40, rotate: bag.rotate, scale: bag.scale }}
              whileInView={{ opacity: 0.35, y: 0 }}
              viewport={{ once: true }}
              animate={{
                y: [0, -25, 0],
                rotate: [bag.rotate, bag.rotate + 5, bag.rotate]
              }}
              transition={{
                duration: 1.2,
                delay: bag.delay,
                y: { duration: 8 + (i % 4), repeat: Infinity, ease: "easeInOut" },
                rotate: { duration: 9 + (i % 5), repeat: Infinity, ease: "easeInOut" },
                opacity: { duration: 1.2, delay: bag.delay }
              }}
            >
              <Image
                src="/bagg.png"
                alt="bag"
                width={400}
                height={400}
                className="filter brightness-0 invert opacity-40"
              />
            </motion.div>
          ))}

          {/* Bottom Fade to White */}
          <div className="absolute bottom-0 left-0 w-full h-[30vh] bg-gradient-to-t from-white to-transparent z-[5] md:h-[40vh] pointer-events-none" />

          <div className="relative w-full flex flex-col items-center pt-12 pb-24 z-10 pointer-events-none">
            {/* SWFTLY Title - Pushed down to appear after logo section */}
            <div
              className="relative flex items-center justify-center whitespace-nowrap tracking-[0.05em] uppercase w-full mb-32"
              style={{
                lineHeight: 0.8,
                fontSize: 'min(18vw, 320px)'
              }}
            >
              <span className="text-white relative z-10" style={{ fontFamily: 'Zodiak, serif', fontWeight: 700 }}>SWFTLY</span>
            </div>
          </div>
        </div>
      </section>

      {/* Scroll-Driven Storytelling Section (Desktop) */}
      <section id="software-section" ref={stickySectionRef} className="hidden md:block relative w-full min-h-[1800vh] bg-white z-20">
        <div className="sticky top-0 h-screen w-full flex items-center overflow-hidden px-4 md:px-12">
          <div className="w-full max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-20 items-center">

            {/* Left Column: Master Timeline Stack */}
            <div className="relative h-screen flex flex-col justify-start overflow-hidden pl-4">
              <div
                ref={scrollingContentRef}
                className="flex flex-col gap-[30vh] py-0 pr-8" // Adding right padding to prevent cutoffs
              >
                {/* Intro Block */}
                <div className="story-item opacity-0 flex flex-col gap-6">
                  <h2 className="text-black text-6xl md:text-7xl font-bold font-tanker leading-[0.9] tracking-tight uppercase">
                    Automate the boring stuff.
                  </h2>
                </div>

                {/* Statistics Block */}
                <div className="story-item opacity-0 flex flex-col gap-6">
                  <h2 className="text-black text-6xl md:text-7xl font-bold font-tanker leading-[0.9] tracking-tight uppercase">
                    AI-driven insights.
                  </h2>
                  <ul className="space-y-4">
                    {videoHotspots[4].points?.map((point, i) => (
                      <li key={i} className="text-gray-500 text-lg md:text-xl font-medium leading-relaxed flex items-start gap-4">
                        <span className="mt-2.5 w-2 h-2 rounded-full bg-[#2c19fc]/30 shrink-0" />
                        <span><PointText text={point} /></span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* POS Block */}
                <div className="story-item opacity-0 flex flex-col gap-6">
                  <h2 className="text-black text-6xl md:text-7xl font-bold font-tanker leading-[0.9] tracking-tight uppercase">
                    Checkout in seconds.
                  </h2>
                  <ul className="space-y-4">
                    {videoHotspots[6].points?.map((point, i) => (
                      <li key={i} className="text-gray-500 text-lg md:text-xl font-medium leading-relaxed flex items-start gap-4">
                        <span className="mt-2.5 w-2 h-2 rounded-full bg-[#2c19fc]/30 shrink-0" />
                        <span><PointText text={point} /></span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Orders Block */}
                <div className="story-item opacity-0 flex flex-col gap-6">
                  <h2 className="text-black text-6xl md:text-7xl font-bold font-tanker leading-[0.9] tracking-tight uppercase">
                    Universal Fulfillment.
                  </h2>
                  <ul className="space-y-4">
                    {videoHotspots[7].points?.map((point, i) => (
                      <li key={i} className="text-gray-500 text-lg md:text-xl font-medium leading-relaxed flex items-start gap-4">
                        <span className="mt-2.5 w-2 h-2 rounded-full bg-[#2c19fc]/30 shrink-0" />
                        <span><PointText text={point} /></span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Customers Block */}
                <div className="story-item opacity-0 flex flex-col gap-6">
                  <h2 className="text-black text-6xl md:text-7xl font-bold font-tanker leading-[0.9] tracking-tight uppercase">
                    Know your regulars.
                  </h2>
                  <ul className="space-y-4">
                    {videoHotspots[8].points?.map((point, i) => (
                      <li key={i} className="text-gray-500 text-lg md:text-xl font-medium leading-relaxed flex items-start gap-4">
                        <span className="mt-2.5 w-2 h-2 rounded-full bg-[#2c19fc]/30 shrink-0" />
                        <span><PointText text={point} /></span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Calendar Block */}
                <div className="story-item opacity-0 flex flex-col gap-6">
                  <h2 className="text-black text-6xl md:text-7xl font-bold font-tanker leading-[0.9] tracking-tight uppercase">
                    Smarter scheduling.
                  </h2>
                  <ul className="space-y-4">
                    {videoHotspots[5].points?.map((point, i) => (
                      <li key={i} className="text-gray-500 text-lg md:text-xl font-medium leading-relaxed flex items-start gap-4">
                        <span className="mt-2.5 w-2 h-2 rounded-full bg-[#2c19fc]/30 shrink-0" />
                        <span><PointText text={point} /></span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Accounting Block */}
                <div className="story-item opacity-0 flex flex-col gap-6">
                  <h2 className="text-black text-6xl md:text-7xl font-bold font-tanker leading-[0.9] tracking-tight uppercase">
                    Ledger on autopilot.
                  </h2>
                  <ul className="space-y-4">
                    {videoHotspots[10].points?.map((point, i) => (
                      <li key={i} className="text-gray-500 text-lg md:text-xl font-medium leading-relaxed flex items-start gap-4">
                        <span className="mt-2.5 w-2 h-2 rounded-full bg-[#2c19fc]/30 shrink-0" />
                        <span><PointText text={point} /></span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Shipments Block */}
                <div className="story-item opacity-0 flex flex-col gap-6">
                  <h2 className="text-black text-6xl md:text-7xl font-bold font-tanker leading-[0.9] tracking-tight uppercase">
                    Seamless Logistics.
                  </h2>
                  <ul className="space-y-4">
                    {videoHotspots[9].points?.map((point, i) => (
                      <li key={i} className="text-gray-500 text-lg md:text-xl font-medium leading-relaxed flex items-start gap-4">
                        <span className="mt-2.5 w-2 h-2 rounded-full bg-[#2c19fc]/30 shrink-0" />
                        <span><PointText text={point} /></span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Inventory Block */}
                <div className="story-item opacity-0 flex flex-col gap-6">
                  <h2 className="text-black text-6xl md:text-7xl font-bold font-tanker leading-[0.9] tracking-tight uppercase">
                    Real-time stock.
                  </h2>
                  <ul className="space-y-4">
                    {videoHotspots[11].points?.map((point, i) => (
                      <li key={i} className="text-gray-500 text-lg md:text-xl font-medium leading-relaxed flex items-start gap-4">
                        <span className="mt-2.5 w-2 h-2 rounded-full bg-[#2c19fc]/30 shrink-0" />
                        <span><PointText text={point} /></span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Tables Block */}
                <div className="story-item opacity-0 flex flex-col gap-6">
                  <h2 className="text-black text-6xl md:text-7xl font-bold font-tanker leading-[0.9] tracking-tight uppercase">
                    Raw Data Control.
                  </h2>
                  <ul className="space-y-4">
                    {videoHotspots[12].points?.map((point, i) => (
                      <li key={i} className="text-gray-500 text-lg md:text-xl font-medium leading-relaxed flex items-start gap-4">
                        <span className="mt-2.5 w-2 h-2 rounded-full bg-[#2c19fc]/30 shrink-0" />
                        <span><PointText text={point} /></span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Settings Block */}
                <div className="story-item opacity-0 flex flex-col gap-6">
                  <h2 className="text-black text-6xl md:text-7xl font-bold font-tanker leading-[0.9] tracking-tight uppercase">
                    Customized Control.
                  </h2>
                  <ul className="space-y-4">
                    {videoHotspots[1].points?.map((point, i) => (
                      <li key={i} className="text-gray-500 text-lg md:text-xl font-medium leading-relaxed flex items-start gap-4">
                        <span className="mt-2.5 w-2 h-2 rounded-full bg-[#2c19fc]/30 shrink-0" />
                        <span><PointText text={point} /></span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Profile Block */}
                <div className="story-item opacity-0 flex flex-col gap-6">
                  <h2 className="text-black text-6xl md:text-7xl font-bold leading-[1.1]">
                    Personalized Access.
                  </h2>
                  <ul className="space-y-4">
                    {videoHotspots[2].points?.map((point, i) => (
                      <li key={i} className="text-gray-500 text-lg md:text-xl font-medium leading-relaxed flex items-start gap-4">
                        <span className="mt-2.5 w-2 h-2 rounded-full bg-[#2c19fc]/30 shrink-0" />
                        <span><PointText text={point} /></span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Right Column: Fixed Sticky Video Preview */}
            <div className="w-full flex justify-end">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 1 }}
                className="w-full aspect-video bg-neutral-100 rounded-[40px] border border-gray-100 shadow-[0_40px_100px_rgba(0,0,0,0.08)] relative overflow-hidden"
              >
                <video
                  ref={videoRef}
                  src="/pt2DASH.mp4"
                  muted
                  playsInline
                  preload="metadata"
                  className="w-full h-full object-cover"
                />

                {/* Dynamic Hotspot Highlight */}
                <motion.div
                  className="absolute border-2 border-[#2c19fc] rounded-xl shadow-[0_0_30px_rgba(44,25,252,0.3)] bg-[#2c19fc]/5 z-50 pointer-events-none"
                  initial={{ opacity: 0 }}
                  animate={{
                    top: videoHotspots[videoInfoStep].top,
                    left: videoHotspots[videoInfoStep].left,
                    width: videoHotspots[videoInfoStep].width,
                    height: videoHotspots[videoInfoStep].height,
                    opacity: isNavigating ? 0 : (stickyStep === 0 ? 0 : 1),
                  }}
                  transition={isNavigating ? { duration: 0 } : { type: "spring", damping: 25, stiffness: 120 }}
                />

                <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent pointer-events-none" />
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Scroll-Driven Storytelling Section (Mobile) */}
      <section id="mobile-software-section" className="md:hidden flex flex-col min-h-screen bg-white pt-24 pb-12 px-6">
        {/* Mobile Video on Top */}
        <div className="w-full aspect-video relative rounded-3xl overflow-hidden shadow-2xl border border-gray-100 mb-8">
          <video
            ref={mobileVideoRef}
            src="/pt2DASH.mp4"
            className="w-full h-full object-cover"
            muted
            playsInline
            preload="auto"
          />
          {/* Hotspot Highlight on Mobile */}
          <motion.div
            className="absolute border-2 border-[#2c19fc] rounded-xl shadow-[0_0_30px_rgba(44,25,252,0.3)] bg-[#2c19fc]/5 z-50 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{
              top: videoHotspots[videoInfoStep].top,
              left: videoHotspots[videoInfoStep].left,
              width: videoHotspots[videoInfoStep].width,
              height: videoHotspots[videoInfoStep].height,
              opacity: mobileStep === 0 ? 0 : 1,
            }}
            transition={{ type: "spring", damping: 25, stiffness: 120 }}
          />
        </div>

        {/* Mobile Info Carousel Below */}
        <div className="flex-1 flex flex-col relative">
          <div className="flex-1 relative mt-4">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={mobileStep}
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="h-full flex flex-col px-4"
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                onDragEnd={(_, info) => {
                  if (info.offset.x < -50 && mobileStep < 11) {
                    const newStep = mobileStep + 1;
                    setMobileStep(newStep);
                    const hotspotIndices = [4, 4, 6, 7, 8, 5, 10, 9, 11, 12, 1, 2];
                    setVideoInfoStep(hotspotIndices[newStep]);
                    if (mobileVideoRef.current) {
                      mobileVideoRef.current.currentTime = 4;
                      mobileVideoRef.current.pause();
                    }
                  } else if (info.offset.x > 50 && mobileStep > 0) {
                    const newStep = mobileStep - 1;
                    setMobileStep(newStep);
                    const hotspotIndices = [4, 4, 6, 7, 8, 5, 10, 9, 11, 12, 1, 2];
                    setVideoInfoStep(hotspotIndices[newStep]);
                    if (mobileVideoRef.current) {
                      mobileVideoRef.current.currentTime = newStep === 0 ? 0 : 4;
                      mobileVideoRef.current.pause();
                    }
                  }
                }}
              >
                <h2 className="text-black text-3xl font-bold font-tanker leading-[0.9] tracking-tight uppercase mb-4 min-h-[4rem] px-2 flex items-center">
                  {mobileStep === 0 ? "Automate the boring stuff." :
                    mobileStep === 1 ? "AI-driven insights." :
                      mobileStep === 2 ? "Checkout in seconds." :
                        mobileStep === 3 ? "Universal Fulfillment." :
                          mobileStep === 4 ? "Know your regulars." :
                            mobileStep === 5 ? "Smarter scheduling." :
                              mobileStep === 6 ? "Ledger on autopilot." :
                                mobileStep === 7 ? "Seamless Logistics." :
                                  mobileStep === 8 ? "Real-time stock." :
                                    mobileStep === 9 ? "Raw Data Control." :
                                      mobileStep === 10 ? "Customized Control." : "Personalized Access."}
                </h2>

                <div className="flex-1 overflow-y-auto pr-2 scrollbar-hide py-2">
                  {mobileStep !== 0 && (
                    <ul className="space-y-3 px-2">
                      {videoHotspots[videoInfoStep].points?.map((point, i) => (
                        <li key={i} className="text-gray-500 text-sm font-medium leading-relaxed flex items-start gap-4">
                          <span className="mt-2 w-1.5 h-1.5 rounded-full bg-[#2c19fc]/30 shrink-0" />
                          <span><PointText text={point} /></span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Side Arrows */}
            <button
              onClick={() => {
                const newStep = Math.max(0, mobileStep - 1);
                setMobileStep(newStep);
                const hotspotIndices = [4, 4, 6, 7, 8, 5, 10, 9, 11, 12, 1, 2];
                setVideoInfoStep(hotspotIndices[newStep]);
                if (mobileVideoRef.current) {
                  mobileVideoRef.current.currentTime = newStep === 0 ? 0 : 4;
                  mobileVideoRef.current.pause();
                }
              }}
              disabled={mobileStep === 0}
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 w-10 h-10 rounded-full border border-gray-100 flex items-center justify-center bg-white/80 backdrop-blur-sm shadow-sm disabled:opacity-0 active:scale-95 transition-all z-10"
            >
              <ChevronRight className="w-5 h-5 rotate-180 text-black" />
            </button>
            <button
              onClick={() => {
                const newStep = Math.min(11, mobileStep + 1);
                setMobileStep(newStep);
                const hotspotIndices = [4, 4, 6, 7, 8, 5, 10, 9, 11, 12, 1, 2];
                setVideoInfoStep(hotspotIndices[newStep]);
                if (mobileVideoRef.current) {
                  mobileVideoRef.current.currentTime = 4;
                  mobileVideoRef.current.pause();
                }
              }}
              disabled={mobileStep === 11}
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 w-10 h-10 rounded-full bg-black/80 backdrop-blur-sm flex items-center justify-center shadow-lg disabled:opacity-0 active:scale-95 transition-all z-10"
            >
              <ChevronRight className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Mobile Progress Indicator */}
          <div className="flex items-center justify-center pt-8">
            <div className="flex gap-1.5">
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={i}
                  className={`h-1 rounded-full transition-all duration-300 ${mobileStep === i ? 'w-6 bg-[#2c19fc]' : 'w-2 bg-gray-200'}`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Comparison Section */}
      <section id="pricing-section" className="relative w-full py-40 overflow-hidden">
        {/* Animated Grainient Background */}
        <div className="absolute inset-0 z-0">
          <Grainient
            color1="#5e30eb"
            color2="#371a94"
            color3="#ffffff"
            timeSpeed={0.25}
            zoom={0.9}
            contrast={1.5}
            grainAmount={0.05}
          />
        </div>

        {/* Top Fade from White */}
        <div className="absolute top-0 left-0 w-full h-[20vh] bg-gradient-to-b from-white to-transparent z-[1] pointer-events-none" />

        <div className="max-w-4xl mx-auto px-4 md:px-12 flex justify-center relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center w-full">
            <div className="relative h-full">
              {/* Solid White Card Behind - Slight transparency to allow blur to show through */}
              <div className="absolute inset-0 bg-white/90 rounded-[40px]" />

              <motion.div
                initial={{ opacity: 0, y: 0 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="relative pos-card-glass-inhouse rounded-[40px] pt-6 px-6 pb-8 shadow-[0_40px_100px_rgba(44,25,252,0.15)] overflow-hidden flex flex-col group transition-all duration-500 h-full"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-[#2c19fc]/10 via-transparent to-transparent pointer-events-none" />

                <div className="flex items-center gap-4 mb-6 relative">
                  {/* 3D Swftly Logo Representation */}
                  <div className="relative w-12 h-12 flex items-center justify-center transform-gpu perspective-1000 group-hover:rotate-y-12 transition-transform duration-500">
                    <div className="absolute inset-0 bg-[#2c19fc] rounded-xl rotate-6 translate-x-1 translate-y-1 opacity-20" />
                    <div className="absolute inset-0 bg-[#2c19fc] rounded-xl -rotate-3 -translate-x-0.5 -translate-y-0.5 opacity-40" />
                    <div className="relative w-full h-full bg-gradient-to-br from-[#2c19fc] to-[#1a0fb3] rounded-xl flex items-center justify-center shadow-xl border border-white/20 p-0.5">
                      <img src="/Swftly.svg" alt="Swftly" className="w-full h-full object-contain brightness-0 invert" />
                    </div>
                  </div>
                  <span className="text-2xl font-bold text-black tracking-tight">Swftly</span>
                </div>

                <div className="mb-6">
                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="text-5xl font-black text-black tracking-tighter">$34.99</span>
                    <span className="text-lg font-bold text-gray-400">/month</span>
                  </div>
                  <p className="text-gray-500 text-sm font-medium">All-in-one software suite</p>
                </div>

                <div className="space-y-3 flex-grow">
                  {[
                    { label: "Rewards & Marketing", value: "Built-In", desc: "Emails, SMS & Customer Loyalty" },
                    { label: "Hardware Compatibility", value: "Any Device", desc: "iOS, Android, Chrome, Windows" },
                    { label: "AI Business Suite", value: "Included", desc: "Full access to Swftly AI" },
                    { label: "3rd Party Aggregates", value: "Unlimited", desc: "DoorDash, UberEats, etc." },
                    { label: "Automated Accounting", value: "Included", desc: "Real-time sync to leading books" }
                  ].map((item, i) => (
                    <div key={i} className="flex justify-between items-start pb-3.5 border-b border-gray-50 last:border-0 last:pb-0">
                      <div>
                        <p className="text-black font-semibold mb-0.5">{item.label}</p>
                        <p className="text-gray-400 text-sm">{item.desc}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[#2c19fc] font-bold text-right">{item.value}</span>
                        <Check className="w-4 h-4 text-[#2c19fc] stroke-[3.5]" />
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => navigate('/book-a-demo')}
                  className="button-7 button-7--blue !mt-6 w-full !mx-0 !mb-0 flex justify-center items-center"
                >
                  <span className="text">Switch to Swftly</span>
                </button>
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 0 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="pos-card-glass rounded-[40px] p-8 flex flex-col grayscale opacity-80 scale-90"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="w-10 h-10 flex items-center justify-center opacity-60">
                  <img src="/square.svg" alt="Square" className="w-full h-full object-contain" />
                </div>
                <span className="text-xl font-bold text-black tracking-tight opacity-50">Standard POS</span>
              </div>

              <div className="mb-8">
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-4xl font-black text-gray-400 tracking-tighter">up to $149.99</span>
                  <span className="text-lg font-bold text-gray-300">/mo</span>
                </div>
                <p className="text-gray-400 text-sm font-medium tracking-tight">Average legacy costs</p>
              </div>

              <div className="space-y-3 flex-grow">
                {[
                  { label: "Rewards & Marketing", value: "Paid Add-on", desc: "Additional monthly subscription" },
                  { label: "Hardware Compatibility", value: "Proprietary", desc: "Locked to brand-specific devices" },
                  { label: "AI Business Suite", value: "Add-on", desc: "Extra monthly charges apply" },
                  { label: "3rd Party Aggregates", value: "Usage Based", desc: "Varies significantly by volume" }
                ].map((item, i) => (
                  <div key={i} className="flex justify-between items-start pb-3.5 border-b border-gray-200 last:border-0 last:pb-0 opacity-40">
                    <div>
                      <p className="text-black font-semibold mb-0.5">{item.label}</p>
                      <p className="text-gray-400 text-sm">{item.desc}</p>
                    </div>
                    <span className="text-black font-bold text-right">{item.value}</span>
                  </div>
                ))}
              </div>

              <div className="mt-8 p-5 rounded-2xl bg-neutral-200/50 flex flex-col items-center justify-center text-center">
                <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-1">Potential Savings</p>
                <p className="text-black text-2xl font-black tracking-tighter">$1,200+/yearly</p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section id="final-cta" className="relative w-full h-screen flex flex-col bg-white overflow-hidden">
        <div className="flex-1 flex items-center justify-center">
          <div className="max-w-7xl mx-auto px-4 flex items-center justify-center gap-8 md:gap-16 mt-20">
            <h2
              ref={finalGetRef}
              className="text-[10vw] md:text-[120px] font-bold text-black tracking-tight md:-translate-x-24"
              style={{ fontFamily: 'Zodiak, serif' }}
            >
              Get
            </h2>
            {/* Static logo for mobile, 3D logo docks to nav on desktop */}
            <div className="w-40 h-40 md:w-[220px] flex items-center justify-center -mx-8 relative">
              <StaticLogo className="w-64 h-64 md:hidden absolute" />
            </div>
            <h2
              ref={finalSwftlyRef}
              className="text-[10vw] md:text-[120px] font-bold text-black tracking-tight"
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
              <span className="text-[10px] md:text-sm text-gray-400 font-medium whitespace-nowrap">© 2024 Swftly.</span>
            </div>
            <div className="flex items-center gap-2 md:gap-10">
              <NavButton className="text-[10px] md:text-sm" onClick={() => window.open('https://instagram.com/getswftly', '_blank')}>Instagram</NavButton>
              <NavButton className="text-[10px] md:text-sm" onClick={() => window.open('https://x.com', '_blank')}>X</NavButton>
              <NavButton className="text-[10px] md:text-sm" onClick={() => window.open('mailto:contact@swftly.com')}>Contact</NavButton>
            </div>
          </div>
        </div>
      </section>


    </div >
  );
}

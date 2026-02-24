'use client';

import { useEffect, useRef, useMemo } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import './ScrollReveal.css';

if (typeof window !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger);
}

interface ScrollRevealProps {
    children: React.ReactNode;
    scrollContainerRef?: React.RefObject<HTMLElement | null>;
    enableBlur?: boolean;
    baseOpacity?: number;
    baseRotation?: number;
    blurStrength?: number;
    containerClassName?: string;
    textClassName?: string;
    rotationEnd?: string;
    wordAnimationEnd?: string;
}

const ScrollReveal = ({
    children,
    scrollContainerRef,
    enableBlur = true,
    baseOpacity = 0.1,
    baseRotation = 3,
    blurStrength = 4,
    containerClassName = '',
    textClassName = '',
    rotationEnd = 'bottom bottom',
    wordAnimationEnd = 'bottom bottom'
}: ScrollRevealProps) => {
    const containerRef = useRef<HTMLHeadingElement>(null);

    const isString = typeof children === 'string';
    const splitText = useMemo(() => {
        if (!isString) return children;
        const text = children as string;
        return text.split(/(\s+)/).map((word, index) => {
            if (word.match(/^\s+$/)) return word;
            return (
                <span className="word" key={index}>
                    {word}
                </span>
            );
        });
    }, [children, isString]);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const ctx = gsap.context(() => {
            const targets = isString ? el.querySelectorAll('.word') : [el];

            // Timeline for synchronized reveal focused around the center "viewer" area
            const tl = gsap.timeline({
                scrollTrigger: {
                    trigger: el,
                    start: 'top 85%', // starts revealing just below the middle
                    end: 'top 15%',   // fully gone by the time it reaches the top
                    scrub: true,
                }
            });

            // Entrance state (Blur/Transparent -> Clear/Solid)
            tl.fromTo(
                targets,
                {
                    opacity: baseOpacity,
                    filter: enableBlur ? `blur(${blurStrength}px)` : 'none',
                    y: !isString ? 40 : 10
                },
                {
                    ease: 'none',
                    opacity: 1,
                    filter: 'blur(0px)',
                    y: 0,
                    stagger: 0.05,
                    duration: 0.35
                }
            );

            // "Active" plateau in the center - stay clear for 0.3 of the timeline
            tl.to({}, { duration: 0.3 });

            // Exit state (Clear/Solid -> Blur/Transparent)
            tl.to(
                targets,
                {
                    ease: 'none',
                    opacity: baseOpacity,
                    filter: enableBlur ? `blur(${blurStrength}px)` : 'none',
                    y: !isString ? -40 : -10,
                    stagger: 0.05,
                    duration: 0.35
                }
            );

            if (isString) {
                tl.fromTo(
                    el,
                    { transformOrigin: '0% 50%', rotate: baseRotation },
                    {
                        ease: 'none',
                        rotate: 0,
                        duration: 0.4
                    },
                    0
                );
            }
        });

        return () => ctx.revert();
    }, [enableBlur, baseRotation, baseOpacity, blurStrength, isString]);

    return (
        <div ref={containerRef} className={`scroll-reveal ${containerClassName}`}>
            {isString ? (
                <div className={`scroll-reveal-text ${textClassName}`}>{splitText}</div>
            ) : (
                <div className={textClassName}>{children}</div>
            )}
        </div>
    );
};

export default ScrollReveal;

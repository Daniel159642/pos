'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';

interface Logo {
  src: string;
  alt: string;
}

interface LogoLoopProps {
  logos: Logo[];
  speed?: number;
  direction?: 'left' | 'right';
  logoHeight?: number;
  gap?: number;
  pauseOnHover?: boolean;
  fadeOut?: boolean;
  fadeOutColor?: string;
  ariaLabel?: string;
}

export default function LogoLoop({
  logos,
  speed = 50,
  direction = 'left',
  logoHeight = 40,
  gap = 40,
  pauseOnHover = false,
  fadeOut = false,
  fadeOutColor = '#ffffff',
  ariaLabel,
}: LogoLoopProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (!scrollContainerRef.current || !containerRef.current) return;

    const scrollContainer = scrollContainerRef.current;
    const container = containerRef.current;
    let animationId: number;
    let position = 0;
    // Slower speed - reduce the multiplier
    const scrollSpeed = direction === 'left' ? -speed : speed;
    
    // Calculate the actual width of one set of logos
    const calculateWidth = () => {
      if (scrollContainer.children.length === 0) return 0;
      // Get the width of the first set of logos
      const firstSetEnd = logos.length;
      let totalWidth = 0;
      for (let i = 0; i < firstSetEnd; i++) {
        const child = scrollContainer.children[i] as HTMLElement;
        if (child) {
          totalWidth += child.offsetWidth;
        }
      }
      return totalWidth || logos.length * (logoHeight + gap);
    };

    let oneSetWidth = 0;

    const animate = () => {
      if (!isPaused && scrollContainer) {
        // Much slower - reduce the multiplier from 0.1 to 0.05
        position += scrollSpeed * 0.05;
        
        // Calculate width on first frame or if not set
        if (oneSetWidth === 0) {
          oneSetWidth = calculateWidth();
        }
        
        // Reset position when one set has scrolled past for seamless infinite loop
        if (oneSetWidth > 0) {
          if (direction === 'left' && position <= -oneSetWidth) {
            position += oneSetWidth;
          } else if (direction === 'right' && position >= oneSetWidth) {
            position -= oneSetWidth;
          }
        }
        
        scrollContainer.style.transform = `translateX(${position}px)`;
      }
      animationId = requestAnimationFrame(animate);
    };

    // Wait for images to load before starting animation
    const timeoutId = setTimeout(() => {
      oneSetWidth = calculateWidth();
      animationId = requestAnimationFrame(animate);
    }, 200);

    return () => {
      clearTimeout(timeoutId);
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [speed, direction, isPaused, logos.length, logoHeight, gap]);

  const handleMouseEnter = () => {
    if (pauseOnHover) {
      setIsPaused(true);
    }
  };

  const handleMouseLeave = () => {
    if (pauseOnHover) {
      setIsPaused(false);
    }
  };

  // Duplicate logos multiple times for seamless infinite loop
  // Need enough duplicates to ensure smooth continuous scrolling
  const duplicatedLogos = [...logos, ...logos, ...logos, ...logos];

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      aria-label={ariaLabel}
    >
      {fadeOut && (
        <>
          <div
            className="absolute left-0 top-0 bottom-0 w-20 z-10 pointer-events-none"
            style={{
              background: `linear-gradient(to right, ${fadeOutColor}, transparent)`,
            }}
          />
          <div
            className="absolute right-0 top-0 bottom-0 w-20 z-10 pointer-events-none"
            style={{
              background: `linear-gradient(to left, ${fadeOutColor}, transparent)`,
            }}
          />
        </>
      )}
      <div 
        ref={scrollContainerRef}
        className="logo-scroll-container flex items-center nowrap" 
        style={{ 
          willChange: 'transform',
          whiteSpace: 'nowrap',
        }}
      >
        {duplicatedLogos.map((logo, index) => (
          <div
            key={`${logo.src}-${index}`}
            className="flex-shrink-0 flex items-center justify-center"
            style={{
              marginRight: index < duplicatedLogos.length - 1 ? `${gap}px` : '0',
              height: `${logoHeight}px`,
              minWidth: `${logoHeight}px`,
            }}
          >
            <Image
              src={logo.src}
              alt={logo.alt}
              width={logoHeight}
              height={logoHeight}
              className="object-contain"
              style={{ 
                height: `${logoHeight}px`, 
                width: 'auto',
                maxWidth: `${logoHeight}px`,
              }}
              unoptimized
            />
          </div>
        ))}
      </div>
    </div>
  );
}

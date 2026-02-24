'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';

interface BlurTextProps {
  text: string;
  delay?: number;
  animateBy?: 'words' | 'letters';
  direction?: 'top' | 'bottom' | 'left' | 'right';
  onAnimationComplete?: () => void;
  className?: string;
  once?: boolean;
}

export default function BlurText({
  text,
  delay = 0,
  animateBy = 'words',
  direction = 'top',
  onAnimationComplete,
  className = '',
  once = false,
}: BlurTextProps) {
  const getInitialPosition = () => {
    switch (direction) {
      case 'top':
        return { y: -20, opacity: 0, filter: 'blur(10px)' };
      case 'bottom':
        return { y: 20, opacity: 0, filter: 'blur(10px)' };
      case 'left':
        return { x: -20, opacity: 0, filter: 'blur(10px)' };
      case 'right':
        return { x: 20, opacity: 0, filter: 'blur(10px)' };
      default:
        return { y: -20, opacity: 0, filter: 'blur(10px)' };
    }
  };

  const getAnimatePosition = () => {
    return { y: 0, x: 0, opacity: 1, filter: 'blur(0px)' };
  };

  const viewportConfig = { once, amount: 0.5 as const };

  if (animateBy === 'words') {
    const words = text.split(' ');
    return (
      <div className={className}>
        {words.map((word, index) => (
          <motion.span
            key={index}
            initial={getInitialPosition()}
            whileInView={getAnimatePosition()}
            exit={getInitialPosition()}
            viewport={viewportConfig}
            transition={{
              duration: 0.5,
              delay: (delay / 1000) + (index * 0.1),
              ease: 'easeOut',
            }}
            onAnimationComplete={
              index === words.length - 1 ? onAnimationComplete : undefined
            }
            className="inline-block mr-2"
          >
            {word}
          </motion.span>
        ))}
      </div>
    );
  }

  // Animate by letters
  return (
    <div className={className}>
      {text.split('').map((char, index) => (
        <motion.span
          key={index}
          initial={getInitialPosition()}
          whileInView={getAnimatePosition()}
          exit={getInitialPosition()}
          viewport={viewportConfig}
          transition={{
            duration: 0.3,
            delay: (delay / 1000) + (index * 0.05),
            ease: 'easeOut',
          }}
          onAnimationComplete={
            index === text.length - 1 ? onAnimationComplete : undefined
          }
          className="inline-block"
        >
          {char === ' ' ? '\u00A0' : char}
        </motion.span>
      ))}
    </div>
  );
}

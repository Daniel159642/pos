'use client';

import React, { useRef, useMemo, useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { Center, Environment, Float, PresentationControls } from '@react-three/drei';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

if (typeof window !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger);
}

// Global mouse tracker to allow responsiveness even when pointer-events are disabled on the canvas
const gMouse = { x: 0, y: 0 };
if (typeof window !== 'undefined') {
    window.addEventListener('mousemove', (e) => {
        gMouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        gMouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    });
}

const ExtrudedLogo = ({ url, onScrollProgress, forceDock = false, isStatic = false }: {
    url: string,
    onScrollProgress: (p: number) => void,
    forceDock?: boolean,
    isStatic?: boolean
}) => {
    const groupRef = useRef<THREE.Group>(null);
    const entryRef = useRef<THREE.Group>(null);
    const innerRef = useRef<THREE.Group>(null);
    const svgData = useLoader(SVGLoader, url);
    const [hasEntered, setHasEntered] = useState(false);
    const { viewport, size } = useThree();
    const pixelToUnit = viewport.width / size.width;
    const paddingX = size.width > 1280 ? (size.width - 1280) / 2 + 16 : 16;
    const targetX = -viewport.width / 2 + (paddingX + 32) * pixelToUnit;
    const targetY = viewport.height / 2 - (16 + 12 + 33) * pixelToUnit;
    const targetScale = 0.45;

    useEffect(() => {
        // If already scrolled, skip fly-in
        if (window.scrollY > 50 || isStatic) {
            setHasEntered(true);
            return;
        }
        // Delay the fly-in animation until after the canvas is stable
        const timer = setTimeout(() => setHasEntered(true), 50);
        return () => clearTimeout(timer);
    }, [isStatic]);

    useEffect(() => {
        if (!groupRef.current || forceDock || isStatic) return;

        const ctx = gsap.context(() => {
            // Unified rotation logic for the entire scroll height
            gsap.to(groupRef.current!.rotation, {
                y: Math.PI * 18, // 9 full spins across the entire site
                ease: "none",
                scrollTrigger: {
                    trigger: "body",
                    start: "top top",
                    end: "bottom bottom",
                    scrub: size.width < 768 ? 0.4 : 1.2 // Smoother momentum for both mobile and desktop
                }
            });

            // Position and scale transitions (Docking into navbar)
            const dockTl = gsap.timeline({
                scrollTrigger: {
                    trigger: "body",
                    start: "top top",
                    end: () => window.innerHeight,
                    scrub: 1.2,
                    onUpdate: (self) => {
                        onScrollProgress(self.progress);
                    }
                }
            });

            dockTl.to(groupRef.current!.position, {
                x: targetX,
                y: targetY,
                z: 0,
                ease: "none"
            }, 0);

            dockTl.to(groupRef.current!.scale, {
                x: targetScale,
                y: targetScale,
                z: targetScale,
                ease: "none"
            }, 0);

            // Final transition: Move from navbar to center of '#final-cta'
            const isMobile = size.width < 768;
            const finalScale = isMobile ? 0.35 : 1.8;
            const finalX = isMobile ? -7 : -30; // Better balance between -2 and -12
            const finalY = isMobile ? 12 : 0;   // Lift slightly for mobile viewport alignment

            if (isMobile) return;

            const finalTl = gsap.timeline({
                scrollTrigger: {
                    trigger: "#final-cta",
                    start: "top 110%", // Start slightly earlier
                    end: "top 20%",   // Give it more vertical space to travel
                    scrub: 1.5        // High momentum for smooth catch-up
                }
            });

            finalTl.to(groupRef.current!.position, {
                x: finalX,
                y: finalY,
                ease: "none" // In scrubbed timelines, ease: "none" is better for linear scroll tracking
            }, 0);

            finalTl.to(groupRef.current!.scale, {
                x: finalScale,
                y: finalScale,
                z: finalScale,
                ease: "none"
            }, 0);

            finalTl.to(groupRef.current!.rotation, {
                y: Math.PI * 8,
                ease: "none"
            }, 0);
        });

        return () => ctx.revert();
    }, [viewport, size, onScrollProgress, forceDock, targetX, targetY, targetScale, isStatic]);

    useFrame((state, delta) => {
        const scrollProgress = !forceDock ? (ScrollTrigger.getAll()[0]?.progress || 0) : 0;

        // Separation of concerns: Entry animation handles fly-in independently from GSAP group
        if (entryRef.current && !(forceDock || isStatic)) {
            if (!hasEntered) {
                entryRef.current.position.x = -1500;
                entryRef.current.rotation.y = -Math.PI * 6;
            } else {
                // Much smoother arrive at center (lower lerp factor)
                entryRef.current.position.x = THREE.MathUtils.lerp(entryRef.current.position.x, 0, delta * 2.5);
                entryRef.current.rotation.y = THREE.MathUtils.lerp(entryRef.current.rotation.y, 0, delta * 2.5);
            }
        }

        // Subtle mouse reactivity on the inner logo component - always active once entered
        if (innerRef.current && (hasEntered || forceDock || isStatic)) {
            // Use global mouse state since R3F internal pointer is cut off by pointer-events: none
            const targetRotX = -gMouse.y * 0.2;
            const targetRotY = gMouse.x * 0.2;

            innerRef.current.rotation.x = THREE.MathUtils.lerp(innerRef.current.rotation.x, targetRotX, delta * 8);
            innerRef.current.rotation.y = THREE.MathUtils.lerp(innerRef.current.rotation.y, targetRotY, delta * 8);
        }
    });

    const shapes = useMemo(() => {
        return svgData.paths.flatMap((path) => {
            const pathShapes = SVGLoader.createShapes(path);
            return pathShapes.map((shape) => ({
                shape,
                color: path.color,
                index: 0
            }));
        });
    }, [svgData]);

    const extrudeSettings = {
        steps: 1,
        depth: 8,
        bevelEnabled: true,
        bevelThickness: 4,
        bevelSize: 3,
        bevelOffset: 0,
        bevelSegments: 10,
        curveSegments: 64,
    };

    return (
        <group
            ref={groupRef}
            position={isStatic ? [2, 0, 0] : (forceDock ? [targetX, targetY, 0] : [0, 40, 0])}
            scale={isStatic ? [0.75, 0.75, 0.75] : (forceDock ? [targetScale, targetScale, targetScale] : [1.4, 1.4, 1.4])}
        >
            <group ref={entryRef} position={(forceDock || isStatic) ? [0, 0, 0] : [-1500, 0, 0]} rotation={(forceDock || isStatic) ? [0, 0, 0] : [0, -Math.PI * 6, 0]}>
                <group ref={innerRef}>
                    <Center>
                        <group scale={0.8} rotation={[Math.PI, 0, 0]}>
                            {shapes.map((item, index) => (
                                <mesh key={index} castShadow receiveShadow>
                                    <extrudeGeometry args={[item.shape, extrudeSettings]} />
                                    <meshPhysicalMaterial
                                        color={isStatic ? "#ffffff" : "#2c19fc"}
                                        metalness={isStatic ? 1 : 0.1}
                                        roughness={isStatic ? 0.1 : 0.05}
                                        envMapIntensity={isStatic ? 3.5 : 2.5}
                                        clearcoat={1}
                                        clearcoatRoughness={0}
                                        reflectivity={isStatic ? 1 : 0.9}
                                        ior={isStatic ? 2.5 : 1.5}
                                        specularIntensity={isStatic ? 1.5 : 1.2}
                                    />
                                </mesh>
                            ))}
                        </group>
                    </Center>
                </group>
            </group>
        </group>
    );
};

const ThreeLogoInner = ({ forceDock }: { forceDock?: boolean }) => {
    const [progress, setProgress] = useState(0);

    return (
        <>
            <ambientLight intensity={0.5} />
            <pointLight position={[100, 100, 100]} intensity={1} castShadow />
            <spotLight position={[-100, 100, 100]} angle={0.15} penumbra={1} intensity={1} castShadow />

            <Float
                speed={2}
                rotationIntensity={forceDock ? 0 : 0.5 * (1 - progress)}
                floatIntensity={forceDock ? 0 : 1 * (1 - progress)}
            >
                <React.Suspense fallback={null}>
                    <ExtrudedLogo url="/Swftly.svg" onScrollProgress={setProgress} forceDock={forceDock} />
                </React.Suspense>
            </Float>
            <React.Suspense fallback={null}>
                <Environment preset="city" />
            </React.Suspense>
        </>
    );
};

export default function ThreeLogo({ forceDock = false }: { forceDock?: boolean }) {
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        if (forceDock) {
            setMounted(true);
            ScrollTrigger.refresh();
            return;
        }
        // Longer delay to let the initial text animations start smoothly
        const timer = setTimeout(() => setMounted(true), 100);
        // Force scroll trigger refresh
        setTimeout(() => ScrollTrigger.refresh(), 500);
        return () => clearTimeout(timer);
    }, [forceDock]);

    if (!mounted) return null;

    return (
        <motion.div
            className="fixed inset-0 w-full h-full pointer-events-none z-[1005]"
            initial={forceDock ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={forceDock ? { duration: 0 } : { duration: 0.8, ease: "easeOut" }}
        >
            <Canvas
                shadows
                dpr={typeof window !== 'undefined' ? Math.min(window.devicePixelRatio, 2) : 1}
                camera={{ position: [0, 0, 300], fov: 45 }}
                gl={{
                    antialias: true,
                    alpha: true,
                    powerPreference: "high-performance",
                    precision: "mediump"
                }}
                style={{ pointerEvents: 'none' }}
                performance={{ min: 0.5 }}
            >
                <React.Suspense fallback={null}>
                    <ThreeLogoInner forceDock={forceDock} />
                </React.Suspense>
            </Canvas>
        </motion.div>
    );
}

// A static version that can be placed inline (used for mobile final CTA)
export function StaticLogo({ className }: { className?: string }) {
    return (
        <div className={`relative pointer-events-none ${className}`}>
            <Canvas
                shadows
                dpr={typeof window !== 'undefined' ? Math.min(window.devicePixelRatio, 2) : 1}
                camera={{ position: [0, 0, 100], fov: 45 }}
                gl={{
                    antialias: true,
                    alpha: true,
                    powerPreference: "high-performance",
                }}
                style={{ background: 'transparent' }}
            >
                <ambientLight intensity={0.5} />
                <pointLight position={[100, 100, 100]} intensity={1} />
                <spotLight position={[-100, 100, 100]} angle={0.15} penumbra={1} intensity={1} />

                <React.Suspense fallback={null}>
                    <ExtrudedLogo url="/Swftly.svg" onScrollProgress={() => { }} isStatic={true} />
                    <Environment preset="city" />
                </React.Suspense>
            </Canvas>
        </div>
    );
}

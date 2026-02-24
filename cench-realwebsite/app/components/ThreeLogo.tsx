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

const ExtrudedLogo = ({ url, onScrollProgress, forceDock = false }: { url: string, onScrollProgress: (p: number) => void, forceDock?: boolean }) => {
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
        if (window.scrollY > 50) {
            setHasEntered(true);
            return;
        }
        // Delay the fly-in animation until after the canvas is stable
        const timer = setTimeout(() => setHasEntered(true), 50);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (!groupRef.current || forceDock) return;

        const ctx = gsap.context(() => {
            // First transition: Dock into navbar
            const tl = gsap.timeline({
                scrollTrigger: {
                    trigger: "body",
                    start: "top top",
                    end: () => window.innerHeight,
                    scrub: 0.4, // Slightly smoother scrub for better performance
                    onUpdate: (self) => {
                        onScrollProgress(self.progress);
                    }
                }
            });

            tl.to(groupRef.current!.position, {
                x: targetX,
                y: targetY,
                z: 0,
                ease: "power2.inOut"
            }, 0);

            tl.to(groupRef.current!.scale, {
                x: targetScale,
                y: targetScale,
                z: targetScale,
                ease: "power2.inOut"
            }, 0);

            tl.to(groupRef.current!.rotation, {
                x: 0,
                y: Math.PI * 2, // 1 full spin during dock, lands completely flat
                z: 0,
                ease: "power2.inOut"
            }, 0);

            // Second transition: Extra spin when scrolling down the next section
            gsap.to(groupRef.current!.rotation, {
                y: Math.PI * 4, // 1 more full spin, landing flat again
                ease: "power2.inOut",
                scrollTrigger: {
                    trigger: "body",
                    start: () => window.innerHeight,
                    end: () => window.innerHeight * 2,
                    scrub: 0.2
                }
            });

            // Third transition: Extra spin when scrolling past that
            gsap.to(groupRef.current!.rotation, {
                y: Math.PI * 6, // 1 more full spin, landing flat again
                ease: "power2.inOut",
                scrollTrigger: {
                    trigger: "body",
                    start: () => window.innerHeight * 2,
                    end: () => window.innerHeight * 3,
                    scrub: 0.2
                }
            });

            // Final transition: Move from navbar to center of '#final-cta'
            const isMobile = size.width < 768;
            const finalScale = isMobile ? 0.45 : 1.8;
            const finalX = isMobile ? 0 : -30;
            const finalY = 0;   // Perfectly dead-center with flexbox

            const finalTl = gsap.timeline({
                scrollTrigger: {
                    trigger: "#final-cta",
                    start: "top top",
                    end: "+=200%",
                    scrub: 1
                }
            });

            finalTl.to(groupRef.current!.position, {
                x: finalX,
                y: finalY,
                ease: "power3.out"
            }, 0);

            finalTl.to(groupRef.current!.scale, {
                x: finalScale,
                y: finalScale,
                z: finalScale,
                ease: "power3.out"
            }, 0);

            finalTl.to(groupRef.current!.rotation, {
                y: Math.PI * 8, // Finish with another elegant rotation
                ease: "power3.out"
            }, 0);
        });

        return () => ctx.revert();
    }, [viewport, size, onScrollProgress, forceDock, targetX, targetY, targetScale]);

    useFrame((state, delta) => {
        const scrollProgress = !forceDock ? (ScrollTrigger.getAll()[0]?.progress || 0) : 0;

        // Separation of concerns: Entry animation handles fly-in independently from GSAP group
        if (entryRef.current && !forceDock) {
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
        if (innerRef.current && (hasEntered || forceDock)) {
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
            position={forceDock ? [targetX, targetY, 0] : [0, 40, 0]}
            scale={forceDock ? [targetScale, targetScale, targetScale] : [1.4, 1.4, 1.4]}
        >
            <group ref={entryRef} position={forceDock ? [0, 0, 0] : [-1500, 0, 0]} rotation={forceDock ? [0, 0, 0] : [0, -Math.PI * 6, 0]}>
                <group ref={innerRef}>
                    <Center>
                        <group scale={0.8} rotation={[Math.PI, 0, 0]}>
                            {shapes.map((item, index) => (
                                <mesh key={index} castShadow receiveShadow>
                                    <extrudeGeometry args={[item.shape, extrudeSettings]} />
                                    <meshPhysicalMaterial
                                        color="#2c19fc"
                                        metalness={0.1}
                                        roughness={0.05}
                                        envMapIntensity={2.5}
                                        clearcoat={1}
                                        clearcoatRoughness={0}
                                        reflectivity={0.9}
                                        ior={1.5}
                                        specularIntensity={1.2}
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


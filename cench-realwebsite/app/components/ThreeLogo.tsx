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
    onScrollProgress?: (p: number) => void,
    forceDock?: boolean,
    isStatic?: boolean
}) => {
    const groupRef = useRef<THREE.Group>(null);
    const scrollSpinRef = useRef<THREE.Group>(null); // New group for main page-scroll spin
    const entryRef = useRef<THREE.Group>(null);
    const innerRef = useRef<THREE.Group>(null);
    const svgData = useLoader(SVGLoader, url);
    const [hasEntered, setHasEntered] = useState(false);
    const { viewport, size } = useThree();
    const pixelToUnit = viewport.width / size.width;

    // Standard scale and docked position
    const targetX = -viewport.width / 2 + (size.width < 768 ? 60 : 80) * pixelToUnit;
    const targetY = viewport.height / 2 - (size.width < 768 ? 43 : 58) * pixelToUnit;
    const targetScale = size.width < 768 ? 0.3 : 0.45;

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

    // Initial positioning and scale setup - handled via ref to avoid Re-render conflicts with GSAP
    useEffect(() => {
        if (!groupRef.current) return;
        if (isStatic) {
            groupRef.current.position.set(2, 0, 0);
            groupRef.current.scale.set(0.75, 0.75, 0.75);
        } else {
            // Set initial docked position
            groupRef.current.position.set(targetX, targetY, 0);
            groupRef.current.scale.set(targetScale, targetScale, targetScale);
        }
    }, [isStatic, targetX, targetY, targetScale, hasEntered]);

    // Main Spinning Rotation Effect - isolated to scrollSpinRef
    useEffect(() => {
        if (!scrollSpinRef.current) return;
        const isMobile = size.width < 768;

        const ctx = gsap.context(() => {
            gsap.to(scrollSpinRef.current!.rotation, {
                y: isMobile ? Math.PI * 16 : Math.PI * 24,
                ease: "none",
                immediateRender: false,
                scrollTrigger: {
                    trigger: "body",
                    start: "top top",
                    end: "bottom bottom",
                    scrub: isMobile ? 0.8 : 1.5,
                    onUpdate: (self) => {
                        if (onScrollProgress) onScrollProgress(self.progress);
                    }
                }
            });
        });

        return () => ctx.revert();
    }, [isStatic, size.width]);

    // Final Position & Transition Effect - handled on the outer groupRef
    useEffect(() => {
        if (!groupRef.current || forceDock || isStatic) return;
        const isMobile = size.width < 768;
        if (isMobile) return;

        const finalScale = 1.8;
        const finalX = -35;
        const finalY = 10;

        const ctx = gsap.context(() => {
            const finalTl = gsap.timeline({
                scrollTrigger: {
                    trigger: "#final-cta",
                    start: "top 110%",
                    end: "bottom bottom",
                    scrub: 1.5
                }
            });

            finalTl.to(groupRef.current!.position, {
                x: finalX,
                y: finalY,
                ease: "none"
            }, 0);

            finalTl.to(groupRef.current!.scale, {
                x: finalScale,
                y: finalScale,
                z: finalScale,
                ease: "none"
            }, 0);

            // Add extra rotation to the parent group so it doesn't conflict with child's spin
            // We use an exact multiple of PI to ensure it lands facing forward
            finalTl.to(groupRef.current!.rotation, {
                y: Math.PI * 4,
                ease: "none"
            }, 0);
        });

        return () => ctx.revert();
    }, [size.width, viewport.height, forceDock, isStatic]);

    useFrame((state, delta) => {
        // Entry animation handles fly-in arrival
        if (entryRef.current && !(forceDock || isStatic)) {
            if (!hasEntered) {
                entryRef.current.position.x = -1500;
                entryRef.current.rotation.y = -Math.PI * 6;
            } else {
                entryRef.current.position.x = THREE.MathUtils.lerp(entryRef.current.position.x, 0, delta * 2.5);
                entryRef.current.rotation.y = THREE.MathUtils.lerp(entryRef.current.rotation.y, 0, delta * 2.5);
            }
        }

        // Mouse Parallax Effect
        if (innerRef.current && (hasEntered || forceDock || isStatic)) {
            const isMobile = size.width < 768;
            if (isMobile) {
                innerRef.current.rotation.x = THREE.MathUtils.lerp(innerRef.current.rotation.x, 0, delta * 4);
                innerRef.current.rotation.y = THREE.MathUtils.lerp(innerRef.current.rotation.y, 0, delta * 4);
            } else {
                const targetRotX = -gMouse.y * 0.2;
                const targetRotY = gMouse.x * 0.2;
                innerRef.current.rotation.x = THREE.MathUtils.lerp(innerRef.current.rotation.x, targetRotX, delta * 8);
                innerRef.current.rotation.y = THREE.MathUtils.lerp(innerRef.current.rotation.y, targetRotY, delta * 8);
            }
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
        <group ref={groupRef}>
            <group ref={scrollSpinRef}>
                <group ref={entryRef}>
                    <group ref={innerRef}>
                        <Center>
                            <group name="shapes-wrapper" scale={0.8} rotation={[Math.PI, 0, 0]}>
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
        </group>
    );
};

const ThreeLogoInner = ({ forceDock }: { forceDock?: boolean }) => {
    return (
        <>
            <ambientLight intensity={0.5} />
            <pointLight position={[100, 100, 100]} intensity={1} castShadow />
            <spotLight position={[-100, 100, 100]} angle={0.15} penumbra={1} intensity={1} castShadow />

            <Float
                speed={2}
                rotationIntensity={0}
                floatIntensity={0}
            >
                <React.Suspense fallback={null}>
                    <ExtrudedLogo url="/Swftly.svg" forceDock={forceDock} />
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
        const timer = setTimeout(() => {
            setMounted(true);
            ScrollTrigger.refresh();
        }, 100);

        // Handle Safari mobile bar resizing
        const handleResize = () => {
            ScrollTrigger.refresh();
        };
        window.addEventListener('resize', handleResize);

        // Force scroll trigger refresh
        setTimeout(() => ScrollTrigger.refresh(), 500);
        return () => {
            clearTimeout(timer);
            window.removeEventListener('resize', handleResize);
        };
    }, [forceDock]);

    if (!mounted) return null;

    return (
        <motion.div
            className="fixed inset-0 pointer-events-none z-[1005]"
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

'use client';

import React, { useRef, useMemo, useState, useEffect } from 'react';
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

    useEffect(() => {
        const timer = setTimeout(() => setHasEntered(true), 100);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (!groupRef.current) return;

        const pixelToUnit = viewport.width / size.width;
        const paddingX = size.width > 1280 ? (size.width - 1280) / 2 + 16 : 16;
        const targetX = -viewport.width / 2 + (paddingX + 32) * pixelToUnit;
        const targetY = viewport.height / 2 - (16 + 12 + 33) * pixelToUnit;
        const targetScale = 0.45;

        if (forceDock) {
            groupRef.current.position.set(targetX, targetY, 0);
            groupRef.current.scale.set(targetScale, targetScale, targetScale);
            groupRef.current.rotation.set(0, 0, 0);
            return;
        }

        const initialY = 40;
        groupRef.current.position.y = initialY;
        groupRef.current.scale.set(1.4, 1.4, 1.4);

        const ctx = gsap.context(() => {
            // First transition: Dock into navbar
            const tl = gsap.timeline({
                scrollTrigger: {
                    trigger: "body",
                    start: "top top",
                    end: () => window.innerHeight,
                    scrub: 0.2, // Tighter scrub for better sync with CSS snapping
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
        });

        return () => ctx.revert();
    }, [viewport, size, onScrollProgress, forceDock]);

    useFrame((state, delta) => {
        if (forceDock) {
            if (entryRef.current) {
                entryRef.current.position.x = 0;
                entryRef.current.rotation.y = 0;
            }
        }

        const scrollProgress = !forceDock ? (ScrollTrigger.getAll()[0]?.progress || 0) : 0;

        // Separation of concerns: Entry animation handles fly-in independently from GSAP group
        if (entryRef.current && !forceDock) {
            if (!hasEntered) {
                entryRef.current.position.x = -1500;
                entryRef.current.rotation.y = -Math.PI * 6;
            } else {
                // Smoothly arrive at center without interfering with `groupRef` (which handles GSAP scroll position)
                entryRef.current.position.x = THREE.MathUtils.lerp(entryRef.current.position.x, 0, delta * 5);
                entryRef.current.rotation.y = THREE.MathUtils.lerp(entryRef.current.rotation.y, 0, delta * 5);
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
        depth: 10,
        bevelEnabled: true,
        bevelThickness: 2,
        bevelSize: 2,
        bevelOffset: 0,
        bevelSegments: 8,
        curveSegments: 32,
    };

    return (
        <group ref={groupRef}>
            <group ref={entryRef}>
                <group ref={innerRef}>
                    <Center>
                        <group scale={0.8} rotation={[Math.PI, 0, 0]}>
                            {shapes.map((item, index) => (
                                <mesh key={index} castShadow receiveShadow>
                                    <extrudeGeometry args={[item.shape, extrudeSettings]} />
                                    <meshPhysicalMaterial
                                        color="#4169e1"
                                        metalness={0.9}
                                        roughness={0.1}
                                        envMapIntensity={1.5}
                                        clearcoat={1}
                                        clearcoatRoughness={0.1}
                                        reflectivity={1}
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
        setMounted(true);
        // Force scroll trigger refresh
        setTimeout(() => ScrollTrigger.refresh(), 100);
    }, []);

    if (!mounted) return null;

    return (
        <div className="fixed inset-0 w-full h-full pointer-events-none z-[1005]">
            <Canvas
                shadows
                camera={{ position: [0, 0, 300], fov: 50 }}
                gl={{ antialias: true, alpha: true }}
                style={{ pointerEvents: 'none' }}
            >
                <React.Suspense fallback={null}>
                    <ThreeLogoInner forceDock={forceDock} />
                </React.Suspense>
            </Canvas>
        </div>
    );
}


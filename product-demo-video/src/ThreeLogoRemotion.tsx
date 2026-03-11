import React, { useMemo } from 'react';
import { useCurrentFrame, useVideoConfig, spring, staticFile, interpolate } from 'remotion';
import { useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { Center, Environment } from '@react-three/drei';
import { ThreeCanvas } from '@remotion/three';

const BLUE = "#0a46f5";

const ExtrudedLogoShape = () => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    const svgData = useLoader(SVGLoader, staticFile('Swftly.svg')) as any;

    // Compute geometry from SVG
    const shapes = useMemo(() => {
        return svgData.paths.flatMap((path: any) => {
            const pathShapes = SVGLoader.createShapes(path);
            return pathShapes.map((shape: any) => ({ shape }));
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
        curveSegments: 32,
    };

    // Animation specific to the final scene's logo
    // Fly in from bottom / small size
    const logoSpring = spring({
        frame: frame - 20, // 10 frames after the text starts
        fps,
        config: { damping: 14, stiffness: 60 }
    });

    const scale = interpolate(logoSpring, [0, 1], [0.001, 0.85]);
    const rotationY = interpolate(logoSpring, [0, 1], [-Math.PI * 4, 0]); // Spin in
    const positionY = interpolate(logoSpring, [0, 1], [150, 10]); // Fly in from top and settle lower

    const groupScale = interpolate(frame, [0, 120], [1, 1.05]); // Continual slow zoom

    return (
        <group scale={groupScale} position={[0, positionY, 0]}>
            <group scale={scale} rotation={[0, rotationY, 0]}>
                <Center>
                    <group name="shapes-wrapper" scale={0.8} rotation={[Math.PI, 0, 0]}>
                        {shapes.map((item: any, index: number) => (
                            <mesh key={index} castShadow receiveShadow>
                                <extrudeGeometry args={[item.shape, extrudeSettings]} />
                                <meshPhysicalMaterial
                                    color={BLUE}
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
    );
};

export const ThreeLogoRemotion: React.FC = () => {
    const { width, height } = useVideoConfig();

    return (
        <div style={{ position: 'absolute', top: 0, left: 0, width, height, pointerEvents: 'none', zIndex: 100 }}>
            <ThreeCanvas
                width={width}
                height={height}
                camera={{ position: [0, 0, 300], fov: 45 }}
                shadows
                gl={{ antialias: true, alpha: true }}
            >
                <ambientLight intensity={0.5} />
                <pointLight position={[100, 100, 100]} intensity={1} castShadow />
                <spotLight position={[-100, 100, 100]} angle={0.15} penumbra={1} intensity={1} castShadow />

                <React.Suspense fallback={null}>
                    <ExtrudedLogoShape />
                    <Environment preset="city" />
                </React.Suspense>
            </ThreeCanvas>
        </div>
    );
};

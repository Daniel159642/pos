import React, { useMemo } from "react";
import { useLoader } from "@react-three/fiber";
import { SVGLoader, SVGResult } from "three-stdlib";
import * as THREE from "three";
import { Center } from "@react-three/drei";
import { staticFile, useCurrentFrame, interpolate, useVideoConfig } from "remotion";

export const ThreeDFolderIcon: React.FC<{ progress: number; extraRotation?: number; exitProgress?: number }> = ({ progress, extraRotation = 0, exitProgress = 0 }) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const svgData = useLoader(SVGLoader, staticFile("folder-up.svg")) as SVGResult;

    const items = useMemo(() => {
        const folderPath = svgData.paths[0];
        const folderShapes = SVGLoader.createShapes(folderPath);
        const folderShape = folderShapes[0];

        // 1. Arrow Shape (The punch-out and extrusion)
        const arrowShape = new THREE.Shape();
        arrowShape.moveTo(12, 10);
        arrowShape.lineTo(15.5, 13.5);
        arrowShape.lineTo(13.2, 13.5);
        arrowShape.lineTo(13.2, 16.5);
        arrowShape.lineTo(10.8, 16.5);
        arrowShape.lineTo(10.8, 13.5);
        arrowShape.lineTo(8.5, 13.5);
        arrowShape.closePath();

        // 2. Punch the hole (Ensures the arrow isn't masked)
        folderShape.holes.push(arrowShape);

        const folderMesh = {
            geometry: new THREE.ExtrudeGeometry(folderShape, {
                depth: 1,
                bevelEnabled: true,
                bevelThickness: 0.5,
                bevelSize: 0.5,
                bevelSegments: 10,
            }),
            color: "#2c19fc",
            z: 0
        };

        const arrowMesh = {
            geometry: new THREE.ExtrudeGeometry(arrowShape, {
                depth: 3.0,
                bevelEnabled: true,
                bevelThickness: 0.8,
                bevelSize: 0.8,
                bevelSegments: 10,
            }),
            color: "white",
            z: -1.0
        };

        return [folderMesh, arrowMesh];
    }, [svgData]);

    const logoScale = interpolate(progress, [0, 1], [0, 5.5]);
    const entranceRotation = interpolate(progress, [0, 1], [0, Math.PI * 4]);
    const idleSway = Math.sin(frame * 0.05) * 0.15;
    const finalRotationY = entranceRotation + (progress > 0.9 ? idleSway : 0) + extraRotation;

    return (
        <group scale={logoScale} rotation={[0, finalRotationY, 0]} position={[0, progress * 10, 0]}>
            <Center>
                <group scale={0.4} rotation={[THREE.MathUtils.degToRad(180), 0, 0]}>
                    {items.map((item: any, index: number) => (
                        <mesh
                            key={index}
                            position={[0, 0, item.z]}
                            castShadow
                            receiveShadow
                            geometry={item.geometry}
                        >
                            <meshPhysicalMaterial
                                color={item.color}
                                metalness={0.1}
                                roughness={0.05}
                                clearcoat={1}
                                clearcoatRoughness={0}
                                reflectivity={0.9}
                            />
                        </mesh>
                    ))}
                </group>
            </Center>
        </group>
    );
};

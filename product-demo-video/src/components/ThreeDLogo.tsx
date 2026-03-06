import React, { useMemo } from "react";
import { useLoader } from "@react-three/fiber";
import { SVGLoader, SVGResult } from "three-stdlib";
import * as THREE from "three";
import { Center } from "@react-three/drei";
import { staticFile, useCurrentFrame, interpolate, spring, useVideoConfig, Easing } from "remotion";

export const ThreeDLogo: React.FC<{
    rotationOffset?: number;
    frameOverride?: number;
    progress?: number;
    disablePosition?: boolean;
}> = ({ rotationOffset = 0, frameOverride, progress, disablePosition = false }) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const svgData = useLoader(SVGLoader, staticFile("Swftly.svg")) as SVGResult;

    const shapes = useMemo(() => {
        return svgData.paths.flatMap((path) => {
            const pathShapes = SVGLoader.createShapes(path);
            return pathShapes.map((shape) => ({
                shape,
                color: path.color,
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

    const entrance = progress ?? spring({
        frame: frameOverride !== undefined ? frameOverride : frame,
        fps,
        config: {
            damping: 200,
            stiffness: 100,
            mass: 0.5,
        },
        durationInFrames: 90,
    });

    const posX = disablePosition ? 0 : interpolate(entrance, [0, 1], [-1500, 0], {
        extrapolateRight: "clamp",
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    });
    const rotY = interpolate(entrance, [0, 1], [-Math.PI * 6, 0], {
        extrapolateRight: "clamp",
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    });

    return (
        <group position={[posX, 0, 0]} rotation={[0, rotY + rotationOffset, 0]}>
            <Center>
                <group scale={0.5} rotation={[THREE.MathUtils.degToRad(180), 0, 0]}>
                    {shapes.map((item, index) => (
                        <mesh key={index} castShadow receiveShadow>
                            <extrudeGeometry args={[item.shape, extrudeSettings]} />
                            <meshPhysicalMaterial
                                color="#2c19fc"
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

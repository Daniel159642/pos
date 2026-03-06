import React from "react";
import {
    AbsoluteFill,
    interpolate,
    useCurrentFrame,
    useVideoConfig,
    Easing,
    spring,
} from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { ThreeDLogo } from "../components/ThreeDLogo";
import { Environment } from "@react-three/drei";

export const FloatingLogoLayer: React.FC = () => {
    const frame = useCurrentFrame();
    const { width, height, fps } = useVideoConfig();

    // 1. Initial Hero Entrance (Starts at frame 0)
    // Flies in from off-screen left and performs its signature spin
    const initialEntrance = spring({
        frame,
        fps,
        config: { damping: 40, stiffness: 40, mass: 1.2 },
    });

    const introX = interpolate(initialEntrance, [0, 1], [-2500, 0]);
    const introRotation = interpolate(initialEntrance, [0, 1], [-Math.PI * 6, 0]);

    // 2. Transition to Corner (Starts at frame 65 - when use clicks Dashboard)
    const transitionStart = 65;
    const transitionDuration = 40;
    const exitProgress = interpolate(frame, [transitionStart, transitionStart + transitionDuration], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.bezier(0.4, 0, 0.2, 1),
    });

    // Logo movement to top-left corner
    const logoScale = interpolate(exitProgress, [0, 1], [1, 0.65]);
    const logoX = interpolate(exitProgress, [0, 1], [introX, -width / 2 + 130]);
    const logoY = interpolate(exitProgress, [0, 1], [0, -height / 2 + 120]);
    const cornerRotation = introRotation + interpolate(exitProgress, [0, 1], [0, Math.PI * 4]);

    // DASHBOARD COMPLETION: No more dive as requested

    // 4. TRANSITION TO SCANNER: Spin out to left
    // Starts exactly after last dashboard scan (global 538)
    const exitBase = 538;
    const transitionExitProg = spring({
        frame: frame - exitBase,
        fps,
        config: { damping: 24, stiffness: 80 }
    });

    const exitX = interpolate(transitionExitProg, [0, 1], [0, -1000]);
    const exitRotation = interpolate(transitionExitProg, [0, 1], [0, -Math.PI * 4]);


    // 5. Final Move to Hero Center (Starts at frame 2200)
    const finalMoveStart = 2200;
    const finalMoveProg = spring({
        frame: frame - finalMoveStart,
        fps,
        config: { damping: 24, stiffness: 100 }
    });

    // Integrated Global Logo State
    const baseX = interpolate(finalMoveProg, [0, 1], [logoX + exitX, 0]);
    const baseY = interpolate(finalMoveProg, [0, 1], [logoY, 0]);
    const baseScale = interpolate(finalMoveProg, [0, 1], [logoScale, 1.5]);
    const baseRotation = cornerRotation + exitRotation + interpolate(finalMoveProg, [0, 1], [0, Math.PI * 4]);

    // SCANNER SCENE SPINS (global 678-878)
    // 1. Idle spin as text animates in (678→720) — decelerates to stop
    const scannerTextSpin = interpolate(
        frame, [678, 720], [0, Math.PI * 3],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.quad) }
    );
    // 2. Burst spin when scan button is clicked (global 750 approx)
    const scannerClickSpin = interpolate(
        frame, [750, 792], [0, Math.PI * 6],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) }
    );
    const scannerSpinExtra = scannerTextSpin + scannerClickSpin;

    // DASHBOARD SCENE SPINS — click moments only
    // 1. Shipment page click burst (global 150) — one smooth rotation
    const bentoClickSpin = interpolate(
        frame, [150, 175], [0, Math.PI * 2],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) }
    );
    // 2. Send button click burst (global 434) — one smooth rotation
    const sendClickSpin = interpolate(
        frame, [434, 459], [0, Math.PI * 2],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) }
    );
    const dashboardSpinExtra = bentoClickSpin + sendClickSpin;

    const currentX = baseX;
    const currentY = baseY;
    const currentScale = baseScale;
    const currentRotation = baseRotation + scannerSpinExtra + dashboardSpinExtra;

    // Logo visibility: Clean cut at scanner scene start
    const logoOpacity = frame < 577
        ? 1
        : frame < 777
            ? 0
            : 1;

    return (
        <AbsoluteFill style={{ pointerEvents: "none", zIndex: 99999, opacity: logoOpacity }}>

            <div style={{
                position: "absolute",
                inset: 0,
                transform: `translate(${currentX}px, ${currentY}px) scale(${currentScale})`,
                transformOrigin: "center center",
            }}>
                <ThreeCanvas width={width} height={height} camera={{ position: [0, 0, 220], fov: 45 }} style={{ pointerEvents: 'none' }}>
                    <ambientLight intensity={0.7} />
                    <pointLight position={[100, 100, 100]} intensity={1} />
                    <spotLight position={[-100, 100, 100]} angle={0.15} penumbra={1} intensity={1} />
                    <React.Suspense fallback={null}>
                        {/* Use progress={1} and disablePosition because we are choreographing the motion here */}
                        <ThreeDLogo progress={1} rotationOffset={currentRotation} disablePosition />
                        <Environment preset="city" />
                    </React.Suspense>
                </ThreeCanvas>
            </div>
        </AbsoluteFill>
    );
};


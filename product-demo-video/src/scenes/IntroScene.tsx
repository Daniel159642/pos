import React from "react";
import {
    AbsoluteFill,
    interpolate,
    useCurrentFrame,
    useVideoConfig,
    Easing,
} from "remotion";

const WordBlur: React.FC<{
    text: string;
    delay: number; // in frames
    exitProgress: number;
}> = ({ text, delay, exitProgress }) => {
    const frame = useCurrentFrame();
    const words = text.split(" ");

    return (
        <div style={{
            display: "flex",
            gap: "10px",
            flexWrap: "nowrap",
            opacity: 1 - exitProgress,
            filter: `blur(${exitProgress * 25}px)`,
            transform: `scale(${1 + exitProgress * 0.15})`,
        }}>
            {words.map((word, i) => {
                const wordDelay = delay + i * 3;
                const progress = interpolate(frame, [wordDelay, wordDelay + 15], [0, 1], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                    easing: Easing.out(Easing.quad),
                });

                const opacity = progress;
                const blur = interpolate(progress, [0, 1], [10, 0]);
                const translateY = interpolate(progress, [0, 1], [-20, 0]);

                return (
                    <span
                        key={i}
                        style={{
                            display: "inline-block",
                            opacity: opacity,
                            filter: `blur(${blur}px)`,
                            transform: `translateY(${translateY}px)`,
                            fontSize: 48,
                            fontWeight: 800,
                            color: "#1a1a1a",
                            fontFamily: "system-ui, -apple-system, sans-serif",
                            whiteSpace: "nowrap",
                        }}
                    >
                        {word}
                    </span>
                );
            })}
        </div>
    );
};

export const IntroScene: React.FC = () => {
    const frame = useCurrentFrame();
    const { width, height } = useVideoConfig();

    // Transition animation starting at frame 85 (click)
    const transitionStart = 85;
    const transitionDuration = 40;
    const exitProgress = interpolate(frame, [transitionStart, transitionStart + transitionDuration], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.bezier(0.4, 0, 0.2, 1),
    });

    return (
        <AbsoluteFill style={{ backgroundColor: "white" }}>
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 10,
                }}
            >
                <div style={{
                    display: "flex",
                    width: "100%",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "0 100px"
                }}>
                    <div style={{ flex: 1, display: "flex", justifyContent: "flex-end", paddingRight: "60px" }}>
                        <WordBlur text="Everything You Need" delay={25} exitProgress={exitProgress} />
                    </div>

                    <div style={{ width: 320 }} />

                    <div style={{ flex: 1, display: "flex", justifyContent: "flex-start", paddingLeft: "60px" }}>
                        <WordBlur text="All In One Place" delay={40} exitProgress={exitProgress} />
                    </div>
                </div>
            </div>
        </AbsoluteFill>
    );
};

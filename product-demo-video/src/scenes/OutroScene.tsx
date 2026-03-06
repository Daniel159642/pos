import React from "react";
import {
    AbsoluteFill,
    interpolate,
    spring,
    useCurrentFrame,
    useVideoConfig,
} from "remotion";

export const OutroScene: React.FC = () => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    const progress = spring({
        frame,
        fps,
        config: { damping: 200 },
    });

    const opacity = interpolate(frame, [0, 20], [0, 1]);

    return (
        <AbsoluteFill
            style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                color: "#1a1a1a",
                textAlign: "center",
                backgroundColor: "white",
                fontFamily: "system-ui, -apple-system, sans-serif",
            }}
        >
            <div style={{ opacity }}>
                <h1 style={{ fontSize: 100, marginBottom: 20, fontWeight: 800 }}>Ready to upgrade?</h1>
                <p style={{ fontSize: 40, color: "rgba(0,0,0,0.6)" }}>
                    Visit swftly.com to get started
                </p>

                <div
                    style={{
                        marginTop: 60,
                        padding: "20px 60px",
                        backgroundColor: "#2c19fc",
                        color: "white",
                        borderRadius: 50,
                        fontSize: 32,
                        fontWeight: "bold",
                        transform: `scale(${interpolate(progress, [0, 1], [0.8, 1])})`,
                        boxShadow: "0 10px 30px rgba(44, 25, 252, 0.3)",
                    }}
                >
                    Book a Demo
                </div>
            </div>
        </AbsoluteFill>
    );
};

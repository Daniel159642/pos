import React from "react";
import {
    AbsoluteFill,
    interpolate,
    spring,
    useCurrentFrame,
    useVideoConfig,
} from "remotion";

export const IntegrationScene: React.FC = () => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    const titleOpacity = interpolate(frame, [0, 20], [0, 1]);

    const items = [
        { label: "Shopify", color: "#96bf48", char: "S" },
        { label: "DoorDash", color: "#ff3008", char: "D" },
        { label: "Uber Eats", color: "#06c167", char: "U" },
    ];

    return (
        <AbsoluteFill
            style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                color: "#1a1a1a",
                backgroundColor: "white",
                fontFamily: "system-ui, -apple-system, sans-serif",
            }}
        >
            <h2 style={{ opacity: titleOpacity, marginBottom: 80, fontSize: 50, fontWeight: 800 }}>
                Seamless Integrations
            </h2>
            <div style={{ display: "flex", gap: 100 }}>
                {items.map((item, i) => {
                    const entry = spring({
                        frame,
                        fps,
                        delay: 15 + i * 15,
                        config: { damping: 12 },
                    });

                    return (
                        <div
                            key={item.label}
                            style={{
                                transform: `scale(${entry})`,
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                            }}
                        >
                            <div
                                style={{
                                    width: 180,
                                    height: 180,
                                    backgroundColor: item.color,
                                    borderRadius: "50%",
                                    display: "flex",
                                    justifyContent: "center",
                                    alignItems: "center",
                                    boxShadow: `0 20px 40px ${item.color}44`,
                                    marginBottom: 30,
                                    fontSize: 80,
                                    fontWeight: "bold",
                                    color: "white",
                                }}
                            >
                                {item.char}
                            </div>
                            <span style={{ fontSize: 30, fontWeight: 600 }}>{item.label}</span>
                        </div>
                    );
                })}
            </div>
        </AbsoluteFill>
    );
};

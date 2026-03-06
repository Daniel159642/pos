import React from "react";
import {
    AbsoluteFill,
    interpolate,
    spring,
    useCurrentFrame,
    useVideoConfig,
    Sequence,
} from "remotion";
import { Upload, FileIcon, ImageIcon, FileSpreadsheet } from "lucide-react";

export const UploadScene: React.FC = () => {
    const frame = useCurrentFrame();
    const { fps, width, height } = useVideoConfig();

    // Spring animations for UI elements
    const dropAreaScale = spring({
        frame,
        fps,
        config: { damping: 12 },
    });

    const iconOpacity = interpolate(frame, [10, 25], [0, 1]);
    const textOpacity = interpolate(frame, [20, 35], [0, 1]);

    const fileTypes = [
        { Icon: FileIcon, label: "PDF", delay: 30 },
        { Icon: ImageIcon, label: "IMAGE", delay: 35 },
        { Icon: FileSpreadsheet, label: "XLS", delay: 40 },
    ];

    // Flying files animation
    const files = [
        { delay: 45, x: -100 },
        { delay: 55, x: 0 },
        { delay: 65, x: 100 },
    ];

    return (
        <AbsoluteFill
            style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                backgroundColor: "white",
                fontFamily: "Inter, system-ui, sans-serif",
                color: "black",
            }}
        >
            {/* Drop Area Rectangle */}
            <div
                style={{
                    width: width * 0.7,
                    height: height * 0.5,
                    border: "4px dashed #e5e7eb",
                    borderRadius: 40,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    alignItems: "center",
                    transform: `scale(${dropAreaScale})`,
                    backgroundColor: "#f9fafb",
                    position: "relative",
                }}
            >
                <div style={{ opacity: iconOpacity, marginBottom: 20 }}>
                    <Upload size={80} strokeWidth={1.5} color="#2c19fc" />
                </div>

                <p style={{
                    opacity: textOpacity,
                    fontSize: 32,
                    fontWeight: 600,
                    color: "#4b5563",
                    margin: 0
                }}>
                    Drop files or click to upload
                </p>

                {/* Small File Type Containers */}
                <div style={{
                    display: "flex",
                    gap: 30,
                    marginTop: 40,
                    opacity: textOpacity
                }}>
                    {fileTypes.map((type, i) => {
                        const typeSpring = spring({
                            frame,
                            fps,
                            delay: type.delay,
                            config: { damping: 10 }
                        });
                        return (
                            <div key={i} style={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                transform: `scale(${typeSpring})`
                            }}>
                                <div style={{
                                    width: 60,
                                    height: 60,
                                    backgroundColor: "white",
                                    borderRadius: 12,
                                    display: "flex",
                                    justifyContent: "center",
                                    alignItems: "center",
                                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                                    marginBottom: 10,
                                    border: "1px solid #e5e7eb"
                                }}>
                                    <type.Icon size={30} color="#6b7280" />
                                </div>
                                <span style={{ fontSize: 14, fontWeight: 700, color: "#9ca3af" }}>{type.label}</span>
                            </div>
                        );
                    })}
                </div>

                {/* Flying Files Animation */}
                {files.map((file, i) => {
                    const flyY = interpolate(
                        frame,
                        [file.delay, file.delay + 30],
                        [400, -50],
                        { extrapolateRight: "clamp" }
                    );
                    const flyOpacity = interpolate(
                        frame,
                        [file.delay, file.delay + 10, file.delay + 20, file.delay + 30],
                        [0, 1, 1, 0]
                    );

                    return (
                        <div
                            key={i}
                            style={{
                                position: "absolute",
                                bottom: 0,
                                left: `calc(50% + ${file.x}px)`,
                                transform: `translate(-50%, ${flyY}px)`,
                                opacity: flyOpacity,
                                width: 80,
                                height: 100,
                                backgroundColor: "white",
                                borderRadius: 8,
                                border: "1px solid #e5e7eb",
                                boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                                display: "flex",
                                justifyContent: "center",
                                alignItems: "center"
                            }}
                        >
                            <FileIcon size={40} color="#3b82f6" />
                        </div>
                    );
                })}
            </div>
        </AbsoluteFill>
    );
};

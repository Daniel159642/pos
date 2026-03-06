import { z } from "zod";

export const MainSchema = z.object({
    brandName: z.string().default("SWFTLY"),
    brandColor: z.string().default("#2c19fc"),
    zoomMagnitude: z.number().min(1).max(3).step(0.01).default(1.85),
    scannerStartFrame: z.number().default(950),
    exitFadeDuration: z.number().default(50),
});

export type MainProps = z.infer<typeof MainSchema>;

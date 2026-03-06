import { Composition } from "remotion";
import { Main } from "./Main";
import { MainSchema } from "./schema";

export const RemotionRoot = () => {
    return (
        <Composition
            id="Main"
            component={Main}
            durationInFrames={3100}
            fps={30}
            width={1920}
            height={1080}
            schema={MainSchema}
            defaultProps={{
                brandName: "SWFTLY",
                brandColor: "#2c19fc",
                zoomMagnitude: 1.85,
                scannerStartFrame: 950,
                exitFadeDuration: 50,
            }}
        />
    );
};

import { Composition, Folder, Still } from "remotion";
import { TimbiShowcase } from "./TimbiShowcase";
import { Thumbnail } from "./Thumbnail";
import { HookScene } from "./scenes/HookScene";
import { LogoScene } from "./scenes/LogoScene";
import { PhoneStage } from "./scenes/PhoneStage";
import { OutroScene } from "./scenes/OutroScene";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="TimbiShowcase"
        component={TimbiShowcase}
        durationInFrames={945}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ credit: "Lyrus Lei Doctolero" }}
      />
      <Still id="Thumbnail" component={Thumbnail} width={1920} height={1080} />
      <Folder name="Scenes">
        <Composition id="Hook" component={HookScene} durationInFrames={247} fps={30} width={1920} height={1080} />
        <Composition id="Logo" component={LogoScene} durationInFrames={46} fps={30} width={1920} height={1080} />
        <Composition id="PhoneDemo" component={PhoneStage} durationInFrames={522} fps={30} width={1920} height={1080} />
        <Composition
          id="Outro"
          component={OutroScene}
          durationInFrames={155}
          fps={30}
          width={1920}
          height={1080}
          defaultProps={{ credit: "Lyrus Lei Doctolero" }}
        />
      </Folder>
    </>
  );
};

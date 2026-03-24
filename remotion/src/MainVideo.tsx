import { AbsoluteFill } from "remotion";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { wipe } from "@remotion/transitions/wipe";
import { GlassBackground } from "./components/GlassBackground";
import { LogoReveal } from "./scenes/LogoReveal";
import { FeaturesGrid } from "./scenes/FeaturesGrid";
import { KPIShowcase } from "./scenes/KPIShowcase";
import { HeroPhrase } from "./scenes/HeroPhrase";
import { CTAFinal } from "./scenes/CTAFinal";

// Scene durations (in frames at 30fps)
// With 4 transitions of ~20 frames each = 80 frames overlap
// Total: 95+120+100+115+80 - 80 = 430 ≈ 450 with padding
const TRANSITION = 20;

export const MainVideo: React.FC = () => {
  return (
    <AbsoluteFill>
      {/* Persistent animated background */}
      <GlassBackground />

      {/* Scene sequence with transitions */}
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={95}>
          <LogoReveal />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={springTiming({ config: { damping: 200 }, durationInFrames: TRANSITION })}
        />

        <TransitionSeries.Sequence durationInFrames={125}>
          <FeaturesGrid />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={wipe({ direction: "from-left" })}
          timing={springTiming({ config: { damping: 200 }, durationInFrames: TRANSITION })}
        />

        <TransitionSeries.Sequence durationInFrames={110}>
          <KPIShowcase />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={springTiming({ config: { damping: 200 }, durationInFrames: TRANSITION })}
        />

        <TransitionSeries.Sequence durationInFrames={120}>
          <HeroPhrase />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={springTiming({ config: { damping: 200 }, durationInFrames: TRANSITION })}
        />

        <TransitionSeries.Sequence durationInFrames={80}>
          <CTAFinal />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};

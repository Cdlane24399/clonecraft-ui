import { Player } from "@remotion/player";
import type { CSSProperties } from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const easeOut = Easing.bezier(0.16, 1, 0.3, 1);

const highlightRects = [
  { left: 128, top: 438, width: 480, height: 116, from: 18 },
  { left: 735, top: 224, width: 466, height: 22, from: 38 },
  { left: 758, top: 493, width: 420, height: 26, from: 58 },
];

const phases = [
  { label: "Capture", detail: "screenshots and DOM", from: 12 },
  { label: "Extract", detail: "tokens and components", from: 44 },
  { label: "Generate", detail: "editable React output", from: 76 },
];

function clamp(frame: number, input: [number, number], output: [number, number]) {
  return interpolate(frame, input, output, {
    easing: easeOut,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

function CloneCraftHeroFilm() {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const imageScale = interpolate(frame, [0, durationInFrames - 1], [1.035, 1.0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const scanX = interpolate(frame, [18, 118], [-140, 1490], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={filmStyles.root}>
      <AbsoluteFill style={filmStyles.backdrop} />
      <Img
        src={staticFile("hero-clone.jpg")}
        style={{
          ...filmStyles.image,
          opacity: 1,
          transform: `scale(${imageScale})`,
        }}
      />
      <AbsoluteFill style={filmStyles.vignette} />

      <div
        style={{
          ...filmStyles.scan,
          transform: `translateX(${scanX}px)`,
          opacity: clamp(frame, [14, 28], [0, 1]) * clamp(frame, [128, 146], [1, 0]),
        }}
      />

      {highlightRects.map((rect) => {
        const reveal = clamp(frame, [rect.from, rect.from + 18], [0, 1]);
        return (
          <div
            key={`${rect.left}-${rect.top}`}
            style={{
              ...filmStyles.highlight,
              left: rect.left,
              top: rect.top,
              width: rect.width,
              height: rect.height,
              opacity: reveal * 0.85,
              transform: `scale(${0.98 + reveal * 0.02})`,
            }}
          />
        );
      })}

      <Sequence from={24}>
        <MetricCard
          frame={frame}
          from={24}
          label="Design map"
          value="42 tokens"
          detail="color, type, spacing"
          style={{ left: 72, top: 96 }}
        />
      </Sequence>
      <Sequence from={54}>
        <MetricCard
          frame={frame}
          from={54}
          label="Components"
          value="18 matched"
          detail="nav, cards, forms"
          style={{ right: 86, bottom: 92 }}
        />
      </Sequence>
      <Sequence from={82}>
        <MetricCard
          frame={frame}
          from={82}
          label="Output"
          value="React + Tailwind"
          detail="ready to edit"
          style={{ left: 404, bottom: 58 }}
          wide
        />
      </Sequence>

      <div style={filmStyles.phaseRail}>
        {phases.map((phase, index) => {
          const active = clamp(frame, [phase.from, phase.from + 20], [0, 1]);
          const done = frame > phase.from + 34;
          return (
            <div key={phase.label} style={filmStyles.phase}>
              <div
                style={{
                  ...filmStyles.phaseMarker,
                  backgroundColor: active > 0.8 || done ? "rgb(235, 103, 43)" : "rgba(255,255,255,0.18)",
                  transform: `scale(${0.78 + active * 0.22})`,
                }}
              />
              <div>
                <div style={filmStyles.phaseLabel}>{phase.label}</div>
                <div style={filmStyles.phaseDetail}>{phase.detail}</div>
              </div>
              {index < phases.length - 1 && <div style={filmStyles.phaseLine} />}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

function MetricCard({
  frame,
  from,
  label,
  value,
  detail,
  style,
  wide = false,
}: {
  frame: number;
  from: number;
  label: string;
  value: string;
  detail: string;
  style: CSSProperties;
  wide?: boolean;
}) {
  const reveal = clamp(frame, [from, from + 18], [0, 1]);
  return (
    <div
      style={{
        ...filmStyles.metric,
        ...style,
        width: wide ? 280 : 220,
        opacity: reveal,
        transform: `translateY(${22 - reveal * 22}px) scale(${0.96 + reveal * 0.04})`,
      }}
    >
      <div style={filmStyles.metricLabel}>{label}</div>
      <div style={filmStyles.metricValue}>{value}</div>
      <div style={filmStyles.metricDetail}>{detail}</div>
    </div>
  );
}

export function HeroRemotionPlayer() {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border/70 bg-card shadow-soft">
      <Player
        component={CloneCraftHeroFilm}
        durationInFrames={150}
        compositionWidth={1376}
        compositionHeight={768}
        fps={30}
        autoPlay
        loop
        initiallyMuted
        acknowledgeRemotionLicense
        controls={false}
        style={{
          width: "100%",
          height: "100%",
          aspectRatio: "1376 / 768",
          display: "block",
        }}
      />
    </div>
  );
}

const filmStyles: Record<string, CSSProperties> = {
  root: {
    backgroundColor: "rgb(12, 12, 14)",
    color: "rgb(247, 244, 238)",
    fontFamily: "Geist, Inter, ui-sans-serif, system-ui, sans-serif",
    overflow: "hidden",
  },
  backdrop: {
    background:
      "radial-gradient(circle at 22% 18%, rgba(235,103,43,0.22), transparent 28%), linear-gradient(135deg, rgb(12,12,14), rgb(21,20,22))",
  },
  image: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    transformOrigin: "50% 50%",
  },
  vignette: {
    background:
      "linear-gradient(90deg, rgba(12,12,14,0.22), transparent 28%, transparent 70%, rgba(12,12,14,0.30)), radial-gradient(circle at 50% 50%, transparent 42%, rgba(0,0,0,0.36) 100%)",
  },
  scan: {
    position: "absolute",
    top: 30,
    bottom: 30,
    width: 92,
    background:
      "linear-gradient(90deg, transparent, rgba(235,103,43,0.08), rgba(235,103,43,0.36), rgba(255,204,151,0.20), transparent)",
    mixBlendMode: "screen",
  },
  highlight: {
    position: "absolute",
    border: "2px solid rgba(235,103,43,0.86)",
    borderRadius: 14,
    boxShadow: "0 0 0 1px rgba(255,255,255,0.13) inset, 0 18px 48px rgba(235,103,43,0.15)",
    transformOrigin: "50% 50%",
  },
  metric: {
    position: "absolute",
    padding: "16px 18px",
    borderRadius: 18,
    backgroundColor: "rgba(18,18,21,0.78)",
    border: "1px solid rgba(255,255,255,0.14)",
    boxShadow: "0 22px 52px rgba(0,0,0,0.38), inset 0 1px 0 rgba(255,255,255,0.08)",
    backdropFilter: "blur(18px)",
  },
  metricLabel: {
    color: "rgba(247,244,238,0.58)",
    fontSize: 18,
    lineHeight: 1,
  },
  metricValue: {
    marginTop: 10,
    color: "rgb(247,244,238)",
    fontSize: 28,
    fontWeight: 700,
    lineHeight: 1.05,
    letterSpacing: 0,
  },
  metricDetail: {
    marginTop: 8,
    color: "rgba(247,244,238,0.62)",
    fontSize: 16,
    lineHeight: 1.2,
  },
  phaseRail: {
    position: "absolute",
    left: 74,
    right: 74,
    bottom: 26,
    display: "flex",
    alignItems: "center",
    gap: 16,
    padding: "14px 18px",
    borderRadius: 18,
    backgroundColor: "rgba(12,12,14,0.66)",
    border: "1px solid rgba(255,255,255,0.11)",
    backdropFilter: "blur(18px)",
  },
  phase: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
    flex: 1,
  },
  phaseMarker: {
    width: 12,
    height: 12,
    borderRadius: 999,
    boxShadow: "0 0 0 6px rgba(235,103,43,0.10)",
    flex: "0 0 auto",
  },
  phaseLabel: {
    color: "rgb(247,244,238)",
    fontSize: 16,
    fontWeight: 700,
    lineHeight: 1,
  },
  phaseDetail: {
    marginTop: 5,
    color: "rgba(247,244,238,0.52)",
    fontSize: 13,
    lineHeight: 1,
  },
  phaseLine: {
    position: "absolute",
    right: -6,
    width: 1,
    height: 32,
    backgroundColor: "rgba(255,255,255,0.10)",
  },
};

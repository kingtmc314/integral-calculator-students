import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  Pause,
  Play,
  RotateCcw,
} from "lucide-react";
import KaTeXRenderer from "./KaTeXRenderer";
import { useLang } from "@/contexts/LangContext";
import { reasoningScenes, type Calculation } from "@/lib/reasoning";
export default function ReasoningPlayer({ result }: { result: Calculation }) {
  const { lang } = useLang();
  const scenes = useMemo(() => reasoningScenes(result), [result]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (!playing) return;
    if (index === scenes.length - 1) {
      setPlaying(false);
      return;
    }
    const timer = window.setTimeout(
      () => setIndex(i => Math.min(i + 1, scenes.length - 1)),
      4200 / speed
    );
    return () => window.clearTimeout(timer);
  }, [playing, index, scenes.length, speed]);
  const scene = scenes[Math.min(index, scenes.length - 1)];
  const stages =
    lang === "zh"
      ? ["辨認", "設定", "計算", "檢查"]
      : ["Recognise", "Set up", "Calculate", "Check"];
  function go(i: number) {
    setPlaying(false);
    setIndex(Math.max(0, Math.min(scenes.length - 1, i)));
  }
  return (
    <section
      className="reasoning-player"
      aria-label={lang === "zh" ? "逐步思考與推導" : "Step-by-step reasoning"}
    >
      <div className="player-heading">
        <span className="flex items-center gap-2">
          <Lightbulb size={17} />
          <strong>{lang === "zh" ? "看看如何思考" : "See the thinking"}</strong>
        </span>
        <span className="small-caps">
          STEP {String(index + 1).padStart(2, "0")} /{" "}
          {String(scenes.length).padStart(2, "0")}
        </span>
      </div>
      <div className="stage-track">
        {stages.map((name, i) => (
          <span
            key={name}
            className={
              scene.stage === i ? "current" : scene.stage > i ? "done" : ""
            }
          >
            <i>{scene.stage > i ? "✓" : i + 1}</i>
            {name}
          </span>
        ))}
      </div>
      <div className="scene-viewport" aria-live={playing ? "off" : "polite"}>
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            initial={reduced ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? undefined : { opacity: 0, y: -5 }}
            transition={{ duration: 0.18 }}
          >
            <h3>{lang === "zh" ? scene.titleZh : scene.titleEn}</h3>
            <div className="thinking-note">
              <span>{lang === "zh" ? "為甚麼？" : "WHY THIS STEP?"}</span>
              <p>{lang === "zh" ? scene.thoughtZh : scene.thoughtEn}</p>
            </div>
            <div className="scene-formula">
              <KaTeXRenderer latex={scene.latex} displayMode />
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="player-controls">
        <div className="flex items-center gap-1">
          <button
            className="icon-button"
            disabled={index === 0}
            onClick={() => go(index - 1)}
            aria-label={lang === "zh" ? "上一步" : "Previous step"}
          >
            <ChevronLeft size={18} />
          </button>
          <button
            className="play-button"
            onClick={() => {
              if (index === scenes.length - 1) setIndex(0);
              setPlaying(!playing);
            }}
          >
            {playing ? <Pause size={15} /> : <Play size={15} />}
            {playing
              ? lang === "zh"
                ? "暫停"
                : "Pause"
              : lang === "zh"
                ? "播放推導"
                : "Play steps"}
          </button>
          <button
            className="icon-button"
            disabled={index === scenes.length - 1}
            onClick={() => go(index + 1)}
            aria-label={lang === "zh" ? "下一步" : "Next step"}
          >
            <ChevronRight size={18} />
          </button>
          <button
            className="icon-button"
            onClick={() => go(0)}
            aria-label={lang === "zh" ? "重播" : "Restart"}
          >
            <RotateCcw size={15} />
          </button>
        </div>
        <select
          aria-label={lang === "zh" ? "播放速度" : "Playback speed"}
          value={speed}
          onChange={e => setSpeed(Number(e.target.value))}
        >
          <option value={0.7}>0.7×</option>
          <option value={1}>1×</option>
          <option value={1.5}>1.5×</option>
          <option value={2}>2×</option>
        </select>
      </div>
      <div
        className="step-dots"
        aria-label={lang === "zh" ? "選擇步驟" : "Choose a step"}
      >
        {scenes.map((s, i) => (
          <button
            key={i}
            onClick={() => go(i)}
            aria-label={`${lang === "zh" ? "步驟" : "Step"} ${i + 1}`}
            aria-current={i === index ? "step" : undefined}
            className={i === index ? "active" : i < index ? "complete" : ""}
          />
        ))}
      </div>
      <details className="all-working">
        <summary>{lang === "zh" ? "查看完整推導" : "View all working"}</summary>
        <div>
          {scenes.slice(1).map((s, i) => (
            <div className="working-line" key={i}>
              <span>{String(i + 1).padStart(2, "0")}</span>
              <KaTeXRenderer latex={s.latex} displayMode />
            </div>
          ))}
        </div>
      </details>
    </section>
  );
}

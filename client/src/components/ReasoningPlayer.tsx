import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  Pause,
  Play,
  RotateCcw,
  ScanLine,
  BookOpen,
  TriangleAlert,
} from "lucide-react";
import KaTeXRenderer from "./KaTeXRenderer";
import { useLang } from "@/contexts/LangContext";
import { reasoningScenes, type Calculation } from "@/lib/reasoning";

function HintText({ text }: { text: string }) {
  return (
    <>
      {text
        .split(/(\$[^$]+\$)/g)
        .map((part, i) =>
          part.startsWith("$") && part.endsWith("$") ? (
            <KaTeXRenderer key={i} latex={part.slice(1, -1)} />
          ) : (
            <span key={i}>{part}</span>
          )
        )}
    </>
  );
}

export default function ReasoningPlayer({ result }: { result: Calculation }) {
  const { lang } = useLang();
  const scenes = useMemo(() => reasoningScenes(result), [result]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [highlight, setHighlight] = useState(true);
  const [tipsOpen, setTipsOpen] = useState(false);
  const [instant, setInstant] = useState(false);
  const root = useRef<HTMLElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const scene = scenes[Math.min(index, scenes.length - 1)];
  const stages =
    lang === "zh"
      ? ["辨認", "設定", "計算", "檢查"]
      : ["Recognise", "Set up", "Calculate", "Check"];
  const title = lang === "zh" ? scene.titleZh : scene.titleEn;
  const thought = lang === "zh" ? scene.thoughtZh : scene.thoughtEn;
  const details = lang === "zh" ? scene.detailsZh : scene.detailsEn;
  // Reading pace depends on this step's explanation, rather than a fixed four seconds.
  const readingTime = Math.min(
    14000,
    Math.max(6000, 4200 + thought.length * (lang === "zh" ? 60 : 22))
  );

  useEffect(() => {
    if (!playing) return;
    if (index === scenes.length - 1) {
      setPlaying(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setInstant(false);
      setIndex(i => Math.min(i + 1, scenes.length - 1));
    }, readingTime / speed);
    return () => window.clearTimeout(timer);
  }, [playing, index, scenes.length, speed, readingTime]);

  useEffect(() => {
    const hide = () => {
      if (document.hidden) setPlaying(false);
    };
    document.addEventListener("visibilitychange", hide);
    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(entries => {
            if (!entries[0]?.isIntersecting) setPlaying(false);
          });
    if (root.current) observer?.observe(root.current);
    return () => {
      document.removeEventListener("visibilitychange", hide);
      observer?.disconnect();
    };
  }, []);

  function revealStep(keyboard = false) {
    if (window.innerWidth >= 951) return;
    window.setTimeout(
      () =>
        viewport.current?.scrollIntoView({
          behavior: "auto",
          block: "nearest",
        }),
      keyboard || reduced ? 0 : 190
    );
  }
  function go(i: number, keyboard = false) {
    setPlaying(false);
    setInstant(keyboard);
    setIndex(Math.max(0, Math.min(scenes.length - 1, i)));
    revealStep(keyboard);
  }
  function togglePlay() {
    setTipsOpen(false);
    setInstant(false);
    if (index === scenes.length - 1) setIndex(0);
    setPlaying(p => !p);
  }
  function onKeys(e: KeyboardEvent<HTMLElement>) {
    if (
      (e.target as HTMLElement).closest(
        "input,select,textarea,button,summary,a"
      )
    )
      return;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(index - 1, true);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      go(index + 1, true);
    } else if (e.key === "Home") {
      e.preventDefault();
      go(0, true);
    } else if (e.key === "End") {
      e.preventDefault();
      go(scenes.length - 1, true);
    } else if (e.key === " ") {
      e.preventDefault();
      togglePlay();
    }
  }
  return (
    <section
      ref={root}
      className="reasoning-player"
      tabIndex={0}
      onKeyDown={onKeys}
      aria-label={lang === "zh" ? "逐步思考與推導" : "Step-by-step reasoning"}
      aria-keyshortcuts="ArrowLeft ArrowRight Home End Space"
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
        {stages.map((name, i) => {
          const start = scenes.findIndex(s => s.stage === i);
          return (
            <button
              key={name}
              disabled={start < 0}
              onClick={e => go(start, e.detail === 0)}
              aria-label={`${lang === "zh" ? "跳至" : "Jump to"} ${name}`}
              aria-current={scene.stage === i ? "step" : undefined}
              className={
                scene.stage === i
                  ? "current"
                  : scenes.slice(0, index).some(s => s.stage === i)
                    ? "done"
                    : ""
              }
            >
              <i>{i + 1}</i>
              {name}
            </button>
          );
        })}
      </div>
      <div className="reasoning-options">
        <span className="reading-status" role="status">
          {playing
            ? lang === "zh"
              ? "自動播放中 · 可隨時暫停"
              : "Playing · pause at any time"
            : lang === "zh"
              ? "按你的節奏，逐步理解"
              : "Understand at your own pace"}
        </span>
        <button
          className="highlight-toggle"
          aria-pressed={highlight}
          onClick={() => setHighlight(v => !v)}
        >
          <ScanLine size={13} />
          {lang === "zh" ? "高亮重點" : "Highlight"}
        </button>
      </div>
      <div
        ref={viewport}
        className="scene-viewport"
        aria-live={playing ? "off" : "polite"}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            initial={reduced || instant ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced || instant ? undefined : { opacity: 0, y: -4 }}
            transition={{ duration: reduced || instant ? 0 : 0.16 }}
          >
            <h3>{title}</h3>
            <div className="thinking-note">
              <span>{lang === "zh" ? "為甚麼這樣做？" : "WHY THIS STEP?"}</span>
              <p>
                <HintText text={thought} />
              </p>
            </div>
            <div
              className={`focus-caption ${highlight ? "is-highlighted" : ""}`}
            >
              <span className="focus-indicator" />
              {lang === "zh" ? scene.focusLabelZh : scene.focusLabelEn}
            </div>
            <div className="scene-formula">
              <KaTeXRenderer
                latex={highlight ? scene.highlightedLatex : scene.latex}
                displayMode
              />
            </div>
            {highlight && (
              <p className="highlight-legend">
                {lang === "zh"
                  ? "綠色框內是這一步正在處理的部分。"
                  : "The green box marks the part being worked on."}
              </p>
            )}
            <div className="step-help">
              <button
                className="step-help-toggle"
                aria-expanded={tipsOpen}
                onClick={() => {
                  setTipsOpen(v => !v);
                  setPlaying(false);
                }}
              >
                <BookOpen size={14} />
                {lang === "zh"
                  ? tipsOpen
                    ? "收起詳細提示"
                    : "這一步怎樣做？查看提示"
                  : tipsOpen
                    ? "Hide detailed hints"
                    : "How does this work? Show hints"}
                <ChevronRight
                  size={14}
                  className={tipsOpen ? "rotate-90" : ""}
                />
              </button>
              {tipsOpen && (
                <div className="step-help-content">
                  <h4>{lang === "zh" ? "一步一步理解" : "Break it down"}</h4>
                  <ol>
                    {details.map((detail, i) => (
                      <li key={i}>
                        <HintText text={detail} />
                      </li>
                    ))}
                  </ol>
                  <div className="step-pitfall">
                    <TriangleAlert size={14} />
                    <p>
                      <strong>
                        {lang === "zh" ? "容易出錯的地方" : "Watch out"}
                      </strong>
                      <HintText
                        text={lang === "zh" ? scene.pitfallZh : scene.pitfallEn}
                      />
                    </p>
                  </div>
                  <p className="hint-paused">
                    {lang === "zh"
                      ? "提示已暫停播放；準備好後可繼續。"
                      : "Playback is paused while you read. Continue when ready."}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="player-controls">
        <div className="flex items-center gap-1">
          <button
            className="icon-button"
            disabled={index === 0}
            onClick={e => go(index - 1, e.detail === 0)}
            aria-label={lang === "zh" ? "上一步" : "Previous step"}
          >
            <ChevronLeft size={18} />
          </button>
          <button className="play-button" onClick={togglePlay}>
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
            onClick={e => go(index + 1, e.detail === 0)}
            aria-label={lang === "zh" ? "下一步" : "Next step"}
          >
            <ChevronRight size={18} />
          </button>
          <button
            className="icon-button"
            onClick={e => go(0, e.detail === 0)}
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
      <div className="step-navigation">
        <label>
          <span>{lang === "zh" ? "跳至步驟" : "Jump to step"}</span>
          <select
            aria-label={
              lang === "zh" ? "選擇推導步驟" : "Choose reasoning step"
            }
            value={index}
            onChange={e => go(Number(e.target.value), true)}
          >
            {scenes.map((s, i) => (
              <option key={i} value={i}>
                {i + 1}. {lang === "zh" ? s.titleZh : s.titleEn}
              </option>
            ))}
          </select>
        </label>
        <div
          className="reasoning-progress"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={scenes.length}
          aria-valuenow={index + 1}
          aria-label={lang === "zh" ? "推導進度" : "Reasoning progress"}
        >
          <span
            style={{ transform: `scaleX(${(index + 1) / scenes.length})` }}
          />
        </div>
      </div>
      <div
        className="step-dots"
        aria-label={lang === "zh" ? "選擇步驟" : "Choose a step"}
      >
        {scenes.map((s, i) => (
          <button
            key={i}
            onClick={e => go(i, e.detail === 0)}
            title={lang === "zh" ? s.titleZh : s.titleEn}
            aria-label={`${lang === "zh" ? "步驟" : "Step"} ${i + 1}: ${lang === "zh" ? s.titleZh : s.titleEn}`}
            aria-current={i === index ? "step" : undefined}
            className={i === index ? "active" : i < index ? "complete" : ""}
          >
            {i + 1}
          </button>
        ))}
      </div>
      <p className="player-keyboard-hint">
        {lang === "zh"
          ? "聚焦播放器後：← → 跳步，空白鍵播放／暫停。"
          : "Focus the player: ← → to step, Space to play / pause."}
      </p>
      <details
        className="all-working"
        onToggle={e => {
          if (e.currentTarget.open) setPlaying(false);
        }}
      >
        <summary>{lang === "zh" ? "查看完整推導" : "View all working"}</summary>
        <div>
          {scenes.slice(1).map((s, i) => (
            <button
              className={`working-line ${index === i + 1 ? "current-working" : ""}`}
              key={i}
              onClick={e => {
                go(i + 1, e.detail === 0);
                root.current?.scrollIntoView({
                  behavior: "auto",
                  block: "nearest",
                });
              }}
              aria-label={`${lang === "zh" ? "回到步驟" : "Go to step"} ${i + 2}`}
            >
              <span>{String(i + 2).padStart(2, "0")}</span>
              <KaTeXRenderer latex={s.latex} displayMode />
            </button>
          ))}
        </div>
      </details>
    </section>
  );
}

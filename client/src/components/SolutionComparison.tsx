import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeftRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Columns2,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  Rows3,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useLang } from "@/contexts/LangContext";
import { isDefinite, reasoningScenes, type Calculation } from "@/lib/reasoning";
import {
  getSolutionPaths,
  type SolutionPathComparison,
} from "@/lib/solutionPaths";
import KaTeXRenderer from "./KaTeXRenderer";
import ReasoningPlayer, { type ReasoningCommand } from "./ReasoningPlayer";

export default function SolutionComparison({
  result,
  onOpen,
}: {
  result: Calculation;
  onOpen?: () => void;
}) {
  const { lang } = useLang();
  const [open, setOpen] = useState(false);
  const [comparison, setComparison] = useState<SolutionPathComparison | null>(
    null
  );
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [selection, setSelection] = useState([0, 1]);
  const [layout, setLayout] = useState<"side" | "stack">("side");
  const [playing, setPlaying] = useState([false, false]);
  const [command, setCommand] = useState<ReasoningCommand>({
    id: 0,
    action: "pause",
  });
  const serial = useRef(0);
  const leftPlaying = useCallback(
    (value: boolean) => setPlaying(p => (p[0] === value ? p : [value, p[1]])),
    []
  );
  const rightPlaying = useCallback(
    (value: boolean) => setPlaying(p => (p[1] === value ? p : [p[0], value])),
    []
  );
  const send = useCallback(
    (action: ReasoningCommand["action"], stage?: number) => {
      setCommand({ id: ++serial.current, action, stage });
    },
    []
  );
  const pauseBoth = useCallback(() => send("pause"), [send]);

  useEffect(() => {
    if (!open || comparison) return;
    setBusy(true);
    setFailed(false);
    const timer = window.setTimeout(() => {
      try {
        setComparison(getSolutionPaths(result));
      } catch {
        setFailed(true);
      } finally {
        setBusy(false);
      }
    }, 30);
    return () => window.clearTimeout(timer);
  }, [open, comparison, result]);

  const definite = isDefinite(result);
  const question = `\\int${definite ? `_{${result.lowerLatex}}^{${result.upperLatex}}` : ""} ${result.integrandLatex}\\,d${result.variableLatex ?? "x"}`;
  const paths = comparison?.paths ?? [];
  const pair = paths.length > 1;
  const stages =
    lang === "zh"
      ? ["辨認", "設定", "計算", "檢查"]
      : ["Recognise", "Set up", "Calculate", "Check"];

  return (
    <Dialog
      open={open}
      onOpenChange={value => {
        setOpen(value);
        pauseBoth();
        if (value) onOpen?.();
      }}
    >
      <DialogTrigger asChild>
        <button className="compare-trigger">
          <ArrowLeftRight size={17} />
          <span>
            <strong>
              {lang === "zh" ? "不同解法比較" : "Compare solution paths"}
            </strong>
            <small>
              {lang === "zh"
                ? "同一題，並排看不同思路"
                : "One question, different approaches side by side"}
            </small>
          </span>
          <ChevronRight size={17} />
        </button>
      </DialogTrigger>
      <DialogContent
        className="comparison-dialog"
        aria-busy={busy}
        showCloseButton={false}
      >
        <div className="comparison-close-bar">
          <DialogClose className="comparison-close">
            <X size={16} />
            {lang === "zh" ? "關閉" : "Close"}
          </DialogClose>
        </div>
        <div className="comparison-header">
          <span className="eyebrow">TWO WAYS TO THINK</span>
          <DialogTitle>
            {lang === "zh"
              ? "不同解法，同一個問題。"
              : "Different paths. The same question."}
          </DialogTitle>
          <DialogDescription>
            {lang === "zh"
              ? "每條路線獨立推導、獨立計數；分部積分各自累計最多兩次。"
              : "Each path has its own derivation and at most two total uses of integration by parts."}
          </DialogDescription>
          <div className="comparison-question">
            <KaTeXRenderer latex={question} displayMode />
          </div>
        </div>
        {busy && (
          <div className="comparison-loading" role="status">
            <Loader2 size={19} className="animate-spin" />
            <p>
              {lang === "zh"
                ? "正在找出並驗證不同解法…"
                : "Finding and verifying alternative paths…"}
            </p>
          </div>
        )}
        {failed && (
          <div className="comparison-note" role="status">
            {lang === "zh"
              ? "目前未能建立解法比較。原答案及推導仍可使用；關閉後可重新嘗試。"
              : "Comparison could not be prepared. Your original answer and working are unchanged; close and try again."}
          </div>
        )}
        {comparison && (
          <>
            <div
              className={`comparison-note ${pair ? "verified" : ""}`}
              role="status"
            >
              {pair && <CheckCircle2 size={16} />}
              <p>{lang === "zh" ? comparison.noteZh : comparison.noteEn}</p>
            </div>
            {pair && (
              <div className="comparison-toolbar">
                <div className="comparison-pair-controls">
                  <button
                    onClick={() => send("previous")}
                    aria-label={
                      lang === "zh"
                        ? "兩條路線上一步"
                        : "Previous step in both paths"
                    }
                  >
                    <ChevronLeft size={17} />
                  </button>
                  <button
                    className="pair-play"
                    onClick={() =>
                      send(playing.some(Boolean) ? "pause" : "play")
                    }
                  >
                    <span>
                      {playing.some(Boolean) ? (
                        <Pause size={14} />
                      ) : (
                        <Play size={14} />
                      )}
                    </span>
                    {lang === "zh"
                      ? playing.some(Boolean)
                        ? "一起暫停"
                        : "一起播放"
                      : playing.some(Boolean)
                        ? "Pause both"
                        : "Play both"}
                  </button>
                  <button
                    onClick={() => send("next")}
                    aria-label={
                      lang === "zh"
                        ? "兩條路線下一步"
                        : "Next step in both paths"
                    }
                  >
                    <ChevronRight size={17} />
                  </button>
                  <button
                    onClick={() => send("restart")}
                    aria-label={
                      lang === "zh" ? "兩條路線重播" : "Restart both paths"
                    }
                  >
                    <RotateCcw size={15} />
                  </button>
                </div>
                <div
                  className="comparison-layout"
                  aria-label={lang === "zh" ? "比較版面" : "Comparison layout"}
                >
                  <button
                    aria-pressed={layout === "side"}
                    onClick={() => {
                      pauseBoth();
                      setLayout("side");
                    }}
                  >
                    <Columns2 size={14} />
                    {lang === "zh" ? "並排" : "Side by side"}
                  </button>
                  <button
                    aria-pressed={layout === "stack"}
                    onClick={() => {
                      pauseBoth();
                      setLayout("stack");
                    }}
                  >
                    <Rows3 size={14} />
                    {lang === "zh" ? "上下" : "Stacked"}
                  </button>
                </div>
              </div>
            )}
            {pair && (
              <div className="comparison-stage-jumps">
                <span>
                  {lang === "zh" ? "兩邊跳至同一階段" : "Jump both to a phase"}
                </span>
                {stages.map((stage, i) => (
                  <button key={i} onClick={() => send("stage", i)}>
                    {stage}
                  </button>
                ))}
              </div>
            )}
            {pair && (
              <p className="comparison-pace-note">
                {lang === "zh"
                  ? "兩條路線的步數未必相同；一起播放會按各自的閱讀節奏前進。展開任一提示會一起暫停，亦可獨立跳步。手機並排時可在比較區左右捲動。"
                  : "Paths may have different step counts. Both play at their own reading pace; opening either hint pauses both, while each path can be stepped independently. On phones, scroll horizontally inside the comparison to see both columns."}
              </p>
            )}
            {pair && (
              <div className="comparison-mobile-overview">
                {selection.map((index, side) => {
                  const path = paths[index];
                  const r = path.result;
                  return (
                    <div key={side}>
                      <span className="path-letter">
                        {side === 0 ? "A" : "B"}
                      </span>
                      <h3>{lang === "zh" ? path.titleZh : path.titleEn}</h3>
                      <small>
                        {lang === "zh" ? "分部積分" : "By parts"}{" "}
                        {r.partsCost ?? 0} / 2
                      </small>
                      <KaTeXRenderer
                        latex={
                          (isDefinite(r) ? r.valueLatex : r.answerLatex) ?? ""
                        }
                        displayMode
                      />
                    </div>
                  );
                })}
              </div>
            )}
            <div
              className={`comparison-scroll ${layout === "stack" ? "stacked" : ""}`}
              tabIndex={pair && layout === "side" ? 0 : undefined}
              aria-label={
                lang === "zh" ? "解法比較區" : "Solution comparison area"
              }
            >
              <div
                className={`comparison-grid ${pair ? "has-pair" : "single-path"}`}
              >
                {(pair ? selection : [0]).map((pathIndex, side) => {
                  const path = paths[pathIndex];
                  if (!path) return null;
                  const r = path.result;
                  const a = isDefinite(r) ? r.valueLatex : r.answerLatex;
                  const cost =
                    r.partsCost ??
                    (isDefinite(r) ? r.indefinite?.partsCost : undefined);
                  return (
                    <article
                      className="comparison-path"
                      key={side}
                      data-path={path.id}
                    >
                      <div className="comparison-path-header">
                        <span className="path-letter">
                          {side === 0 ? "A" : "B"}
                        </span>
                        <div>
                          <h3>{lang === "zh" ? path.titleZh : path.titleEn}</h3>
                          {paths.length > 2 && (
                            <select
                              aria-label={
                                lang === "zh"
                                  ? `選擇路線 ${side === 0 ? "A" : "B"}`
                                  : `Choose path ${side === 0 ? "A" : "B"}`
                              }
                              value={pathIndex}
                              onChange={e => {
                                pauseBoth();
                                setSelection(s =>
                                  s.map((x, i) =>
                                    i === side ? Number(e.target.value) : x
                                  )
                                );
                              }}
                            >
                              {paths.map((p, i) => (
                                <option
                                  key={p.id}
                                  value={i}
                                  disabled={selection[1 - side] === i}
                                >
                                  {lang === "zh" ? p.titleZh : p.titleEn}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      </div>
                      <p className="path-rationale">
                        {lang === "zh" ? path.rationaleZh : path.rationaleEn}
                      </p>
                      <div className="path-metrics">
                        <span>
                          {lang === "zh"
                            ? `分部積分 ${cost ?? "—"} / 2 次`
                            : `By parts ${cost ?? "—"} / 2`}
                        </span>
                        <span>
                          {reasoningScenes(r).length}{" "}
                          {lang === "zh" ? "個步驟" : "steps"}
                        </span>
                      </div>
                      <div className="comparison-answer">
                        <span>
                          {lang === "zh"
                            ? "這條路線的答案"
                            : "ANSWER FOR THIS PATH"}
                        </span>
                        <KaTeXRenderer latex={a ?? ""} displayMode />
                      </div>
                      <ReasoningPlayer
                        key={path.id}
                        result={r}
                        command={command}
                        onPlayingChange={
                          side === 0 ? leftPlaying : rightPlaying
                        }
                        onInteraction={pauseBoth}
                      />
                    </article>
                  );
                })}
              </div>
            </div>
            {!pair && (
              <p className="comparison-pace-note">
                {lang === "zh"
                  ? "不會把同一解法複製成兩條。你可試 sin(x)^2、x/(x^4+4) 或 sqrt(4-x^2)，查看已支援的比較例題。"
                  : "The same working is not duplicated as a second path. Try sin(x)^2, x/(x^4+4) or sqrt(4-x^2) for supported comparison examples."}
              </p>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { Engine } from "@babylonjs/core/Engines/engine";
import { createGameScene, type GameHandle } from "@/game/scene";
import type { GameSnapshot } from "@/game/types";
import { FOREST_LEVELS, type ForestLevel, type ForestGridSize, type LevelDifficulty } from "@/game/levelBundle";
import { getLevelGroup, loadWebProgress, persistWebProgress, type CompletionMap } from "@/game/webLevelProgress";
import { addContinuation, loadContinuations, persistContinuations, type ContinuationMap } from "@/game/continuationLevels";
import { loadLaunchCatalog } from "@/game/launchCatalog";
import { getDemoGrid } from "@/game/demoPlayback";
import { drawRandomLevel, shuffleLaunchCatalog } from "@/game/randomLevelDraw";
import { loadSoundEnabled, persistSoundEnabled, playUiSound } from "@/game/soundEffects";
import { createDailyChallenge, isDailyChallengeCompleted, loadDailyChallengeProgress, markDailyChallengeCompleted, persistDailyChallengeProgress, type DailyChallengeProgress } from "@/game/dailyChallenge";

const WEB_PROGRESS_KEY = "forest-trail-web-2400-progress-v1";
const WEB_CONTINUATION_KEY = "forest-trail-web-2400-continuations-v1";
const ONBOARDING_KEY = "forest-trail-onboarding-seen-v1";

function shouldShowOnboarding(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("onboarding") === "1" || window.localStorage.getItem(ONBOARDING_KEY) !== "1";
}

const SIZES: ForestGridSize[] = ["6x6", "8x8", "10x10", "12x12"];
const DIFFICULTIES: Array<{ id: LevelDifficulty; label: string }> = [
  { id: "easy", label: "简单" },
  { id: "medium", label: "中等" },
  { id: "hard", label: "困难" },
];

function requestedDemoGrid(): ForestGridSize | null {
  return typeof window === "undefined" ? null : getDemoGrid(window.location.search);
}

function defaultSelectedLevel(): ForestLevel {
  if (requestedDemoGrid() === "8x8") {
    return FOREST_LEVELS.find((level) => level.gridSize === "8x8" && level.difficulty === "easy") ?? FOREST_LEVELS[0]!;
  }
  return FOREST_LEVELS[0]!;
}

const initialState: GameSnapshot = {
  path: [],
  status: "idle",
  nextWaypoint: 1,
  elapsedMs: 0,
  moves: 0,
  message: "正在展开林区路线图。",
  hintCells: [],
};

function formatTime(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000);
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const startedRef = useRef(false);
  const handleRef = useRef<GameHandle | null>(null);
  const completionHandledRef = useRef(false);
  const [state, setState] = useState<GameSnapshot>(initialState);
  const [levels, setLevels] = useState<ForestLevel[]>(FOREST_LEVELS);
  const [gridSize, setGridSize] = useState<ForestGridSize>("6x6");
  const [difficulty, setDifficulty] = useState<LevelDifficulty>("easy");
  const [selectedLevel, setSelectedLevel] = useState<ForestLevel>(defaultSelectedLevel);
  const [completed, setCompleted] = useState<CompletionMap>(() => typeof window === "undefined" ? {} : loadWebProgress(window.localStorage, WEB_PROGRESS_KEY));
  const [continuations, setContinuations] = useState<ContinuationMap>(() => typeof window === "undefined" ? {} : loadContinuations(window.localStorage, WEB_CONTINUATION_KEY));
  const [soundEnabled, setSoundEnabled] = useState(() => typeof window === "undefined" ? true : loadSoundEnabled(window.localStorage));
  const [dailyChallenge, setDailyChallenge] = useState(() => createDailyChallenge());
  const [dailyProgress, setDailyProgress] = useState<DailyChallengeProgress>(() => typeof window === "undefined" ? {} : loadDailyChallengeProgress(window.localStorage));
  const [playMode, setPlayMode] = useState<"standard" | "daily">("standard");
  const [onboardingStep, setOnboardingStep] = useState<number | null>(() => shouldShowOnboarding() ? 0 : null);
  const soundEnabledRef = useRef(soundEnabled);
  const lastSoundSnapshotRef = useRef<GameSnapshot>(initialState);
  const currentGroup = useMemo(() => getLevelGroup(levels, selectedLevel.gridSize, selectedLevel.difficulty), [levels, selectedLevel]);
  const hasRandomNext = playMode === "standard" && Boolean(drawRandomLevel({ levels: currentGroup, completed, gridSize: selectedLevel.gridSize, difficulty: selectedLevel.difficulty, excludeId: selectedLevel.id }));
  const difficultyLabel = DIFFICULTIES.find((item) => item.id === difficulty)?.label ?? "简单";
  const points = state.status === "completed" ? Math.max(10, Math.round(1200 / Math.max(1, state.moves))) : 0;
  const dailyCompleted = isDailyChallengeCompleted(dailyProgress, dailyChallenge);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  useEffect(() => {
    let active = true;
    loadLaunchCatalog().then((launchLevels) => {
      if (!active) return;
      const merged = shuffleLaunchCatalog([...launchLevels, ...Object.values(continuations).flat()]);
      const demoGrid = requestedDemoGrid() ?? "6x6";
      setLevels(merged);
      setGridSize(demoGrid);
      setDifficulty("easy");
      setSelectedLevel(drawRandomLevel({ levels: merged, completed, gridSize: demoGrid, difficulty: "easy" }) ?? merged[0]!);
    }).catch(() => {
      if (active) setLevels(FOREST_LEVELS);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || startedRef.current) return;
    startedRef.current = true;
    const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true, adaptToDeviceRatio: true });
    let active = true;
    completionHandledRef.current = false;
    lastSoundSnapshotRef.current = initialState;
    createGameScene(engine, canvas, {
      puzzle: selectedLevel,
      onStateChange: (next) => {
        if (!active) return;
        const previous = lastSoundSnapshotRef.current;
        if (next.status === "completed" && previous.status !== "completed") playUiSound("complete", soundEnabledRef.current);
        else if (next.path.length > previous.path.length) playUiSound("step", soundEnabledRef.current);
        else if (next.path.length < previous.path.length) playUiSound("undo", soundEnabledRef.current);
        lastSoundSnapshotRef.current = next;
        setState(next);
        if (next.status === "completed" && !completionHandledRef.current) {
          completionHandledRef.current = true;
          if (playMode === "daily") {
            setDailyProgress((current) => {
              const updated = markDailyChallengeCompleted(current, dailyChallenge);
              persistDailyChallengeProgress(window.localStorage, updated);
              return updated;
            });
          } else {
            setCompleted((current) => {
              const updated = { ...current, [selectedLevel.id]: Date.now() };
              persistWebProgress(window.localStorage, WEB_PROGRESS_KEY, updated);
              return updated;
            });
          }
        }
      },
    }).then((handle) => {
      if (!active) {
        handle.dispose();
        return;
      }
      handleRef.current = handle;
      setState(handle.getSnapshot());
      engine.runRenderLoop(() => handle.scene.render());
    });

    const timer = window.setInterval(() => {
      const handle = handleRef.current;
      if (handle) setState(handle.getSnapshot());
    }, 100);
    const onResize = () => engine.resize();
    window.addEventListener("resize", onResize);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("resize", onResize);
      handleRef.current?.dispose();
      handleRef.current = null;
      engine.dispose();
      startedRef.current = false;
    };
  }, [selectedLevel, playMode, dailyChallenge]);

  const addSeedContinuation = (targetGridSize: ForestGridSize, targetDifficulty: LevelDifficulty) => {
    const added = addContinuation({ levels, gridSize: targetGridSize, difficulty: targetDifficulty, continuations });
    setContinuations(added.continuations);
    persistContinuations(window.localStorage, WEB_CONTINUATION_KEY, added.continuations);
    setLevels((current) => [...current, added.level]);
    setState(initialState);
    setSelectedLevel(added.level);
  };

  const selectRandomPuzzle = (targetGridSize: ForestGridSize, targetDifficulty: LevelDifficulty) => {
    playUiSound("tap", soundEnabledRef.current);
    setPlayMode("standard");
    setGridSize(targetGridSize);
    setDifficulty(targetDifficulty);
    const selected = drawRandomLevel({ levels, completed, gridSize: targetGridSize, difficulty: targetDifficulty, excludeId: selectedLevel.id });
    if (selected) {
      setState(initialState);
      setSelectedLevel(selected);
    }
    else addSeedContinuation(targetGridSize, targetDifficulty);
  };

  const finishOnboarding = () => {
    playUiSound("tap", soundEnabledRef.current);
    window.localStorage.setItem(ONBOARDING_KEY, "1");
    setOnboardingStep(null);
  };

  const chooseNextLevel = () => {
    playUiSound("tap", soundEnabledRef.current);
    const selected = drawRandomLevel({ levels: currentGroup, completed, gridSize: selectedLevel.gridSize, difficulty: selectedLevel.difficulty, excludeId: selectedLevel.id });
    if (selected) {
      setState(initialState);
      setSelectedLevel(selected);
    }
    else addSeedContinuation(selectedLevel.gridSize, selectedLevel.difficulty);
  };

  const selectDailyChallenge = () => {
    playUiSound("tap", soundEnabledRef.current);
    const today = createDailyChallenge();
    setDailyChallenge(today);
    setPlayMode("daily");
    setGridSize(today.gridSize);
    setDifficulty(today.difficulty);
    setState(initialState);
    setSelectedLevel(today);
  };

  const resetCurrentPuzzle = () => {
    const handle = handleRef.current;
    if (!handle) return;
    playUiSound("reset", soundEnabledRef.current);
    lastSoundSnapshotRef.current = { ...handle.getSnapshot(), path: [] };
    handle.reset();
  };

  return (
    <main className="solo-game-shell" aria-label="森林寻径路径谜题">
      <canvas ref={canvasRef} className="solo-game-canvas" aria-label="可触摸操作的当前谜题棋盘" />

      <header className="solo-topbar" aria-label="当前谜题状态">
        <span className="solo-category">{playMode === "daily" ? "每日挑战 8x8" : `${difficultyLabel} ${gridSize}`}</span>
        <span className="solo-timer">◷ {formatTime(state.elapsedMs)}</span>
        <span className="solo-points">Points: {points}</span>
        <button type="button" className={`solo-sound-toggle ${soundEnabled ? "is-enabled" : ""}`} aria-label={soundEnabled ? "音效已开启，点击关闭" : "音效已关闭，点击开启"} aria-pressed={soundEnabled} onClick={() => {
          const nextEnabled = !soundEnabled;
          setSoundEnabled(nextEnabled);
          persistSoundEnabled(nextEnabled);
          if (nextEnabled) playUiSound("tap", true);
        }}><span>音效</span><strong>{soundEnabled ? "开" : "关"}</strong></button>
      </header>

      <section className="solo-control-stack" aria-label="棋盘控制区">
        <nav className="solo-board-actions" aria-label="棋盘操作">
          <button type="button" onClick={() => handleRef.current?.undo()} disabled={state.path.length === 0 || state.status === "completed"}>↶ 撤回</button>
          <button type="button" onClick={resetCurrentPuzzle}>⌫ 清空</button>
          <button type="button" className={`daily-challenge-action ${playMode === "daily" ? "is-selected" : ""}`} aria-pressed={playMode === "daily"} onClick={selectDailyChallenge}>每日挑战{dailyCompleted ? " ✓" : ""}</button>
        </nav>

        <section className="solo-picker" aria-label="随机谜题选择">
          <div className="solo-choice-row difficulty-choice-row" role="group" aria-label="选择难度">
            {DIFFICULTIES.map((item) => <button type="button" key={item.id} className={difficulty === item.id ? "selected" : ""} onClick={() => selectRandomPuzzle(gridSize, item.id)}><span className={`difficulty-icon difficulty-icon-${item.id}`} aria-hidden="true" />{item.label}</button>)}
          </div>
          <div className="solo-choice-row" role="group" aria-label="选择棋盘尺寸">
            {SIZES.map((size) => <button type="button" key={size} className={gridSize === size ? "selected" : ""} onClick={() => selectRandomPuzzle(size, difficulty)}>{size}</button>)}
          </div>
        </section>
      </section>

      {onboardingStep !== null && (
        <section className="onboarding-overlay" role="dialog" aria-modal="true" aria-label="新手引导">
          <div className="onboarding-shade" />
          <div className={`onboarding-focus onboarding-focus-${onboardingStep}`} aria-hidden="true" />
          <div className="onboarding-card">
            <p className="onboarding-kicker">FOREST TRAIL · 新手引导 {onboardingStep + 1}/3</p>
            <h2>{["从1号路标出发", "沿上下左右连线", "需要时撤回或清空"][onboardingStep]}</h2>
            <p>{[
              "找到棋盘里的1号黑色路标，这是每条林径的起点。",
              "按住棋盘并向上下左右滑动，依次连接数字路标，让路径覆盖整片林地。",
              "走错时点击“撤回”回到上一步；想重新开始时点击“清空”。",
            ][onboardingStep]}</p>
            <div className="onboarding-actions">
              <button type="button" className="onboarding-skip" onClick={finishOnboarding}>跳过引导</button>
              <button type="button" className="onboarding-next" onClick={() => onboardingStep === 2 ? finishOnboarding() : setOnboardingStep((step) => (step ?? 0) + 1)}>{onboardingStep === 2 ? "开始游玩" : "下一步"}</button>
            </div>
          </div>
        </section>
      )}

      {state.status === "completed" && (
        <section className="completion-panel solo-completion" role="dialog" aria-modal="true" aria-label="林径完成">
          <p>{playMode === "daily" ? "DAILY CHALLENGE COMPLETE" : "TRAIL COMPLETE"}</p>
          <h2>{playMode === "daily" ? "今日林径已走通" : "林径已走通"}</h2>
          <div className="completion-stats"><span>{formatTime(state.elapsedMs)} 用时</span><span>{points} 积分</span>{playMode === "daily" && <span>{dailyChallenge.challengeDate}</span>}</div>
          <div className="completion-actions"><button type="button" onClick={resetCurrentPuzzle}>再走一次</button><button type="button" onClick={() => playMode === "daily" ? selectRandomPuzzle(gridSize, difficulty) : chooseNextLevel()}>{playMode === "daily" ? "返回随机题" : hasRandomNext ? "随机下一题" : "生成新谜题"}</button></div>
        </section>
      )}
    </main>
  );
}

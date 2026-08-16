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

const WEB_PROGRESS_KEY = "forest-trail-web-2400-progress-v1";
const WEB_CONTINUATION_KEY = "forest-trail-web-2400-continuations-v1";

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
  const currentGroup = useMemo(() => getLevelGroup(levels, selectedLevel.gridSize, selectedLevel.difficulty), [levels, selectedLevel]);
  const hasRandomNext = Boolean(drawRandomLevel({ levels: currentGroup, completed, gridSize: selectedLevel.gridSize, difficulty: selectedLevel.difficulty, excludeId: selectedLevel.id }));
  const difficultyLabel = DIFFICULTIES.find((item) => item.id === difficulty)?.label ?? "简单";
  const points = state.status === "completed" ? Math.max(10, Math.round(1200 / Math.max(1, state.moves))) : 0;

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
    createGameScene(engine, canvas, {
      puzzle: selectedLevel,
      onStateChange: (next) => {
        if (!active) return;
        setState(next);
        if (next.status === "completed" && !completionHandledRef.current) {
          completionHandledRef.current = true;
          setCompleted((current) => {
            const updated = { ...current, [selectedLevel.id]: Date.now() };
            persistWebProgress(window.localStorage, WEB_PROGRESS_KEY, updated);
            return updated;
          });
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
  }, [selectedLevel]);

  const addSeedContinuation = (targetGridSize: ForestGridSize, targetDifficulty: LevelDifficulty) => {
    const added = addContinuation({ levels, gridSize: targetGridSize, difficulty: targetDifficulty, continuations });
    setContinuations(added.continuations);
    persistContinuations(window.localStorage, WEB_CONTINUATION_KEY, added.continuations);
    setLevels((current) => [...current, added.level]);
    setState(initialState);
    setSelectedLevel(added.level);
  };

  const selectRandomPuzzle = (targetGridSize: ForestGridSize, targetDifficulty: LevelDifficulty) => {
    setGridSize(targetGridSize);
    setDifficulty(targetDifficulty);
    const selected = drawRandomLevel({ levels, completed, gridSize: targetGridSize, difficulty: targetDifficulty, excludeId: selectedLevel.id });
    if (selected) {
      setState(initialState);
      setSelectedLevel(selected);
    }
    else addSeedContinuation(targetGridSize, targetDifficulty);
  };

  const chooseNextLevel = () => {
    const selected = drawRandomLevel({ levels: currentGroup, completed, gridSize: selectedLevel.gridSize, difficulty: selectedLevel.difficulty, excludeId: selectedLevel.id });
    if (selected) {
      setState(initialState);
      setSelectedLevel(selected);
    }
    else addSeedContinuation(selectedLevel.gridSize, selectedLevel.difficulty);
  };

  return (
    <main className="solo-game-shell" aria-label="森林寻径路径谜题">
      <canvas ref={canvasRef} className="solo-game-canvas" aria-label="可触摸操作的当前谜题棋盘" />

      <header className="solo-topbar" aria-label="当前谜题状态">
        <span className="solo-category">{difficultyLabel} {gridSize}</span>
        <span className="solo-timer">◷ {formatTime(state.elapsedMs)}</span>
        <span className="solo-points">Points: {points}</span>
      </header>

      <nav className="solo-board-actions" aria-label="棋盘操作">
        <button type="button" onClick={() => handleRef.current?.undo()} disabled={state.path.length === 0 || state.status === "completed"}>↶ 撤回</button>
        <button type="button" onClick={() => handleRef.current?.reset()}>⌫ 清空</button>
      </nav>

      <section className="solo-picker" aria-label="随机谜题选择">
        <p>难度 · 随棋盘尺寸变化</p>
        <div className="solo-choice-row" role="group" aria-label="选择难度">
          {DIFFICULTIES.map((item) => <button type="button" key={item.id} className={difficulty === item.id ? "selected" : ""} onClick={() => selectRandomPuzzle(gridSize, item.id)}>{item.label}</button>)}
        </div>
        <p>棋盘尺寸</p>
        <div className="solo-choice-row" role="group" aria-label="选择棋盘尺寸">
          {SIZES.map((size) => <button type="button" key={size} className={gridSize === size ? "selected" : ""} onClick={() => selectRandomPuzzle(size, difficulty)}>{size}</button>)}
        </div>
      </section>

      {state.status === "completed" && (
        <section className="completion-panel solo-completion" role="dialog" aria-modal="true" aria-label="林径完成">
          <p>TRAIL COMPLETE</p>
          <h2>林径已走通</h2>
          <div className="completion-stats"><span>{formatTime(state.elapsedMs)} 用时</span><span>{points} 积分</span></div>
          <div className="completion-actions"><button type="button" onClick={() => handleRef.current?.reset()}>再走一次</button><button type="button" onClick={chooseNextLevel}>{hasRandomNext ? "随机下一题" : "生成新谜题"}</button></div>
        </section>
      )}
    </main>
  );
}

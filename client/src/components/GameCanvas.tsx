/** 林下探险手册设计：React 仅承载全屏画布与可读 HUD；视觉语言为雨林墨绿、树皮与林径琥珀。 */
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

const LOGO_URL = "/manus-storage/forestpath-logo_ee30ae93.png";
const TARGET_URL = "/manus-storage/forestpath-visual-target_547d763c.png";
const WEB_PROGRESS_KEY = "forest-trail-web-2400-progress-v1";
const WEB_CONTINUATION_KEY = "forest-trail-web-2400-continuations-v1";

function requestedDemoGrid(): ForestGridSize | null {
  return typeof window === "undefined" ? null : getDemoGrid(window.location.search);
}

function defaultSelectedLevel(): ForestLevel {
  if (requestedDemoGrid() === "8x8") {
    return FOREST_LEVELS.find((level) => level.gridSize === "8x8" && level.difficulty === "easy") ?? FOREST_LEVELS[0];
  }
  return FOREST_LEVELS[0];
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
  return `${String(Math.floor(totalSeconds / 60)).padStart(2, "0")}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const startedRef = useRef(false);
  const handleRef = useRef<GameHandle | null>(null);
  const completionHandledRef = useRef(false);
  const [state, setState] = useState<GameSnapshot>(initialState);
  const [helpOpen, setHelpOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(() => typeof window === "undefined" ? true : !new URLSearchParams(window.location.search).has("demo"));
  const [levels, setLevels] = useState<ForestLevel[]>(FOREST_LEVELS);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [gridSize, setGridSize] = useState<ForestGridSize>("6x6");
  const [difficulty, setDifficulty] = useState<LevelDifficulty>("easy");
  const [page, setPage] = useState(0);
  const [selectedLevel, setSelectedLevel] = useState<ForestLevel>(defaultSelectedLevel);
  const [completed, setCompleted] = useState<CompletionMap>(() => typeof window === "undefined" ? {} : loadWebProgress(window.localStorage, WEB_PROGRESS_KEY));
  const [continuations, setContinuations] = useState<ContinuationMap>(() => typeof window === "undefined" ? {} : loadContinuations(window.localStorage, WEB_CONTINUATION_KEY));
  const availableLevels = useMemo(() => levels.filter((level) => level.gridSize === gridSize && level.difficulty === difficulty), [levels, gridSize, difficulty]);
  const currentGroup = useMemo(() => getLevelGroup(levels, selectedLevel.gridSize, selectedLevel.difficulty), [levels, selectedLevel]);
  const hasRandomNext = Boolean(drawRandomLevel({ levels: currentGroup, completed, gridSize: selectedLevel.gridSize, difficulty: selectedLevel.difficulty, excludeId: selectedLevel.id }));
  const pageSize = 12;
  const pageCount = Math.max(1, Math.ceil(availableLevels.length / pageSize));
  const visibleLevels = availableLevels.slice(page * pageSize, page * pageSize + pageSize);

  useEffect(() => {
    let active = true;
    loadLaunchCatalog().then((launchLevels) => {
      if (!active) return;
      const restored = Object.values(continuations).flat();
      const merged = shuffleLaunchCatalog([...launchLevels, ...restored]);
      setLevels(merged);
      setSelectedLevel(() => {
        const demoGrid = requestedDemoGrid();
        return merged.find((level) => level.gridSize === (demoGrid ?? "6x6") && level.difficulty === "easy") ?? merged[0]!;
      });
    }).catch(() => {
      if (active) setLevels(FOREST_LEVELS);
    }).finally(() => {
      if (active) setCatalogLoading(false);
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
    createGameScene(engine, canvas, { puzzle: selectedLevel, onStateChange: (next) => {
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
    } }).then((handle) => {
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

  useEffect(() => { setPage(0); }, [gridSize, difficulty]);

  const chooseLevel = (level: ForestLevel) => {
    setSelectedLevel(level);
    setLibraryOpen(false);
  };

  const addSeedContinuation = (targetGridSize: ForestGridSize, targetDifficulty: LevelDifficulty) => {
    const added = addContinuation({ levels, gridSize: targetGridSize, difficulty: targetDifficulty, continuations });
    setContinuations(added.continuations);
    persistContinuations(window.localStorage, WEB_CONTINUATION_KEY, added.continuations);
    setLevels((current) => [...current, added.level]);
    setSelectedLevel(added.level);
    setLibraryOpen(false);
  };

  const chooseRandomLevel = () => {
    const selected = drawRandomLevel({ levels: availableLevels, completed, gridSize, difficulty });
    if (selected) {
      chooseLevel(selected);
    } else {
      addSeedContinuation(gridSize, difficulty);
    }
  };

  const chooseNextLevel = () => {
    const selected = drawRandomLevel({ levels: currentGroup, completed, gridSize: selectedLevel.gridSize, difficulty: selectedLevel.difficulty, excludeId: selectedLevel.id });
    if (selected) {
      chooseLevel(selected);
    } else {
      addSeedContinuation(selectedLevel.gridSize, selectedLevel.difficulty);
    }
  };

  return (
    <main className="game-shell" aria-label="森林寻径路径谜题">
      <canvas ref={canvasRef} className="game-canvas" aria-label="可触摸操作的林区路线图" />

      <header className="instrument-bar" aria-label="当前林径状态">
        <div className="brand-lockup">
          <span className="brand-medallion"><img src={LOGO_URL} className="brand-mark" alt="森林寻径年轮路标" /></span>
          <div>
            <p className="brand-kicker">FOREST TRAIL NOTES</p>
            <h1>森林寻径</h1>
          </div>
        </div>
        <div className="instrument-readings" aria-live="polite">
          <div><span>林间用时</span><strong>{formatTime(state.elapsedMs)}</strong></div>
          <div><span>踏步数</span><strong>{String(state.moves).padStart(2, "0")}</strong></div>
          <button className="circle-control" type="button" aria-label="查看规则" onClick={() => setHelpOpen(true)}>?</button>
        </div>
      </header>

      <aside className="archive-label" aria-label="林区信息">
        <span>{selectedLevel.gridSize} · {selectedLevel.difficulty.toUpperCase()} · 随机林径</span>
        <strong>{selectedLevel.name}</strong>
      </aside>

      <section className="signal-readout" aria-live="polite">
        <span className="signal-dot" />
        <p>{state.message}</p>
        {state.status !== "completed" && <strong>下一路标 {state.nextWaypoint}</strong>}
      </section>

      <nav className="control-deck" aria-label="游戏控制">
        <button type="button" onClick={() => setLibraryOpen(true)}>关卡目录</button>
        <button type="button" onClick={() => handleRef.current?.undo()} disabled={state.path.length === 0 || state.status === "completed"}>踏回一步</button>
        <button type="button" className="accent-control" onClick={() => handleRef.current?.showHint()} disabled={state.status === "completed"}>叶径提示</button>
        <button type="button" onClick={() => handleRef.current?.reset()}>重新入林</button>
      </nav>

      {state.status === "completed" && (
        <section className="completion-panel" role="dialog" aria-modal="true" aria-label="林径完成">
          <p>TRAIL COMPLETE</p>
          <h2>林径已走通</h2>
          <div className="completion-stats"><span>{formatTime(state.elapsedMs)} 用时</span><span>{state.moves} 枚脚印</span></div>
          <div className="completion-actions"><button type="button" onClick={() => handleRef.current?.reset()}>再走一次</button><button type="button" onClick={chooseNextLevel}>{hasRandomNext ? "随机下一条林径" : "生成新林径"}</button></div>
        </section>
      )}

      {helpOpen && (
        <section className="guide-sheet" role="dialog" aria-modal="true" aria-label="林径规则">
          <button className="guide-close" type="button" aria-label="关闭规则" onClick={() => setHelpOpen(false)}>×</button>
          <div className="guide-art" style={{ backgroundImage: `linear-gradient(90deg, rgba(12,31,22,.96), rgba(12,31,22,.48)), url(${TARGET_URL})` }} />
          <div className="guide-copy">
            <p className="brand-kicker">TRAIL ETIQUETTE</p>
            <h2>一次走过，踏遍林地。</h2>
            <p>从 <strong>1 号林缘路标</strong>出发，沿上下左右相邻格连续滑动。请依序经过所有路标，避开倒木与灌木，并让脚印覆盖每一块林地。</p>
            <p>若选错方向，可返回上一格踩回脚印；“叶径提示”会短暂照亮接下来的安全路径。</p>
            <button type="button" onClick={() => setHelpOpen(false)}>踏入林地</button>
          </div>
        </section>
      )}

      {libraryOpen && (
        <section className="level-library" role="dialog" aria-modal="true" aria-label="2400关关卡目录">
          <header className="library-header">
            <div><p className="brand-kicker">FOREST TRAIL ARCHIVE · {catalogLoading ? "LOADING" : levels.length}</p><h2>随机抽取一片林地</h2><p>覆盖6×6、8×8、10×10与12×12，每种尺寸按林缘、林间、密林分组。每个分类随机抽题，全部走通后可继续生成新seed林径。</p></div>
            <button type="button" className="circle-control" aria-label="关闭关卡目录" onClick={() => setLibraryOpen(false)}>×</button>
          </header>
          <div className="library-filters" aria-label="关卡筛选">
            <div><span>棋盘尺寸</span>{(["6x6", "8x8", "10x10", "12x12"] as const).map((size) => <button type="button" key={size} className={gridSize === size ? "selected" : ""} onClick={() => setGridSize(size)}>{size}</button>)}</div>
            <div><span>林地难度</span>{([{ id: "easy", label: "林缘" }, { id: "medium", label: "林间" }, { id: "hard", label: "密林" }] as const).map((item) => <button type="button" key={item.id} className={difficulty === item.id ? "selected" : ""} onClick={() => setDifficulty(item.id)}>{item.label}</button>)}</div>
            <strong>已归档 {Object.keys(completed).length}/{levels.length}</strong>
          </div>
          <button type="button" className="random-draw" onClick={chooseRandomLevel}>随机抽取一条林径</button>
          <div className="level-grid">{visibleLevels.map((level, index) => {
            const groupIndex = page * pageSize + index;
            const done = Boolean(completed[level.id]);
            return <button key={level.id} type="button" className={`${done ? "done" : ""} ${level.id === selectedLevel.id ? "active" : ""}`} onClick={() => chooseLevel(level)}><span>随机 {String(groupIndex + 1).padStart(2, "0")}</span><strong>{level.name}</strong><small>{done ? "已走通" : "可进入"}</small></button>;
          })}</div>
          <footer className="library-pagination"><button type="button" disabled={page === 0} onClick={() => setPage((current) => Math.max(0, current - 1))}>← 上一页</button><span>{page + 1} / {pageCount}</span><button type="button" disabled={page >= pageCount - 1} onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}>下一页 →</button></footer>
        </section>
      )}
    </main>
  );
}

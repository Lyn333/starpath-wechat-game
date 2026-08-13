/** 林下探险手册设计：React 仅承载全屏画布与可读 HUD；视觉语言为雨林墨绿、树皮与林径琥珀。 */
import { useEffect, useRef, useState } from "react";
import { Engine } from "@babylonjs/core/Engines/engine";
import { createGameScene, type GameHandle } from "@/game/scene";
import type { GameSnapshot } from "@/game/types";

const LOGO_URL = "/manus-storage/forestpath-logo_ee30ae93.png";
const TARGET_URL = "/manus-storage/forestpath-visual-target_547d763c.png";
const COMPLETION_URL = "/manus-storage/forestpath-completion-leaves_5dc72282.png";

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
  const [state, setState] = useState<GameSnapshot>(initialState);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || startedRef.current) return;
    startedRef.current = true;
    const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true, adaptToDeviceRatio: true });
    let active = true;

    createGameScene(engine, canvas, { onStateChange: (next) => active && setState(next) }).then((handle) => {
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
  }, []);

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
        <span>TRAIL · 01</span>
        <strong>苔影林地</strong>
      </aside>

      <section className="signal-readout" aria-live="polite">
        <span className="signal-dot" />
        <p>{state.message}</p>
        {state.status !== "completed" && <strong>下一路标 {state.nextWaypoint}</strong>}
      </section>

      <nav className="control-deck" aria-label="游戏控制">
        <button type="button" onClick={() => handleRef.current?.undo()} disabled={state.path.length === 0 || state.status === "completed"}>踏回一步</button>
        <button type="button" className="accent-control" onClick={() => handleRef.current?.showHint()} disabled={state.status === "completed"}>叶径提示</button>
        <button type="button" onClick={() => handleRef.current?.reset()}>重新入林</button>
      </nav>

      {state.status === "completed" && (
        <section className="completion-panel" role="dialog" aria-modal="true" aria-label="林径完成">
          <img className="completion-stars" src={COMPLETION_URL} alt="" />
          <p>TRAIL COMPLETE</p>
          <h2>林径已走通</h2>
          <div className="completion-stats"><span>{formatTime(state.elapsedMs)} 用时</span><span>{state.moves} 枚脚印</span></div>
          <button type="button" onClick={() => handleRef.current?.reset()}>再走一次</button>
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
    </main>
  );
}

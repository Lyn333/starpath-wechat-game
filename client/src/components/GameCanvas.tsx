/** 星图档案馆设计：React 仅承载全屏画布与可读 HUD；视觉语言为深靛蓝航图、黄铜与青绿星轨。 */
import { useEffect, useRef, useState } from "react";
import { Engine } from "@babylonjs/core/Engines/engine";
import { createGameScene, type GameHandle } from "@/game/scene";
import type { GameSnapshot } from "@/game/types";

const LOGO_URL = "/manus-storage/starpath-logo_88793820.png";
const TARGET_URL = "/manus-storage/starpath-visual-target_5f85555d.png";
const COMPLETION_URL = "/manus-storage/starpath-completion-stars_d695a03b.png";

const initialState: GameSnapshot = {
  path: [],
  status: "idle",
  nextWaypoint: 1,
  elapsedMs: 0,
  moves: 0,
  message: "正在载入航图。",
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
    <main className="game-shell" aria-label="星轨寻径路径谜题">
      <canvas ref={canvasRef} className="game-canvas" aria-label="可触摸操作的星图棋盘" />

      <header className="instrument-bar" aria-label="当前航图状态">
        <div className="brand-lockup">
          <img src={LOGO_URL} className="brand-mark" alt="星轨寻径星盘标识" />
          <div>
            <p className="brand-kicker">STARPATH ARCHIVE</p>
            <h1>星轨寻径</h1>
          </div>
        </div>
        <div className="instrument-readings" aria-live="polite">
          <div><span>航行用时</span><strong>{formatTime(state.elapsedMs)}</strong></div>
          <div><span>测绘步数</span><strong>{String(state.moves).padStart(2, "0")}</strong></div>
          <button className="circle-control" type="button" aria-label="查看规则" onClick={() => setHelpOpen(true)}>?</button>
        </div>
      </header>

      <aside className="archive-label" aria-label="关卡信息">
        <span>ARCHIVE · 01</span>
        <strong>北天航图</strong>
      </aside>

      <section className="signal-readout" aria-live="polite">
        <span className="signal-dot" />
        <p>{state.message}</p>
        {state.status !== "completed" && <strong>下一信标 {state.nextWaypoint}</strong>}
      </section>

      <nav className="control-deck" aria-label="游戏控制">
        <button type="button" onClick={() => handleRef.current?.undo()} disabled={state.path.length === 0 || state.status === "completed"}>撤回</button>
        <button type="button" className="accent-control" onClick={() => handleRef.current?.showHint()} disabled={state.status === "completed"}>投射航标</button>
        <button type="button" onClick={() => handleRef.current?.reset()}>重置航图</button>
      </nav>

      {state.status === "completed" && (
        <section className="completion-panel" role="dialog" aria-modal="true" aria-label="航图完成">
          <img className="completion-stars" src={COMPLETION_URL} alt="" />
          <p>ARCHIVE SEALED</p>
          <h2>航图已校准</h2>
          <div className="completion-stats"><span>{formatTime(state.elapsedMs)} 用时</span><span>{state.moves} 步测绘</span></div>
          <button type="button" onClick={() => handleRef.current?.reset()}>再绘一次</button>
        </section>
      )}

      {helpOpen && (
        <section className="guide-sheet" role="dialog" aria-modal="true" aria-label="航图规则">
          <button className="guide-close" type="button" aria-label="关闭规则" onClick={() => setHelpOpen(false)}>×</button>
          <div className="guide-art" style={{ backgroundImage: `linear-gradient(90deg, rgba(8,21,46,.96), rgba(8,21,46,.52)), url(${TARGET_URL})` }} />
          <div className="guide-copy">
            <p className="brand-kicker">NAVIGATION PROTOCOL</p>
            <h2>一次描绘，覆盖全图。</h2>
            <p>从 <strong>1 号启明星</strong>出发，沿上下左右相邻格连续滑动。请依序经过所有信标，避开黄铜测绘墙，并让航线覆盖每一格。</p>
            <p>若走错方向，可返回上一格撤回航迹；“投射航标”会短暂标出下一段安全路线。</p>
            <button type="button" onClick={() => setHelpOpen(false)}>开始测绘</button>
          </div>
        </section>
      )}
    </main>
  );
}

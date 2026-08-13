import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { applyEditorCellEdit, makeStarterSnapshot, type EditorTool } from "@shared/levelEditorOps";
import { type Cell, type Difficulty, type GridSize, type LevelSnapshot, validateLevelSnapshot } from "@shared/levelSchema";
import { Archive, CheckCircle2, ChevronLeft, ChevronRight, ClipboardCheck, Eraser, History, Leaf, LoaderCircle, Plus, RotateCcw, Save, Send, TreePine, Undo2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const sizeOptions: GridSize[] = ["6x6", "8x8", "10x10", "12x12"];
const difficultyOptions: Difficulty[] = ["easy", "medium", "hard"];

function formatMoment(value: Date | string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function LevelEditor() {
  const { user, loading: authLoading } = useAuth();
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();
  const [gridSize, setGridSize] = useState<GridSize>("6x6");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [title, setTitle] = useState("苔影林地 · 新关卡");
  const [slug, setSlug] = useState("moss-grove-new");
  const [snapshot, setSnapshot] = useState<LevelSnapshot>(() => makeStarterSnapshot("6x6"));
  const [selectedLevelId, setSelectedLevelId] = useState<string | null>(null);
  const [tool, setTool] = useState<EditorTool>("solution");
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);

  const listQuery = trpc.levelAdmin.list.useQuery({}, { enabled: isAdmin });
  const detailQuery = trpc.levelAdmin.get.useQuery({ levelId: selectedLevelId! }, { enabled: isAdmin && Boolean(selectedLevelId) });
  const localValidation = useMemo(() => validateLevelSnapshot(gridSize, snapshot), [gridSize, snapshot]);

  const createMutation = trpc.levelAdmin.create.useMutation({
    onSuccess: async ({ levelId, versionId }) => {
      setSelectedLevelId(levelId);
      setActiveVersionId(versionId);
      toast.success("关卡草稿已创建并通过校验。");
      await utils.levelAdmin.list.invalidate();
      await utils.levelAdmin.get.invalidate({ levelId });
    },
    onError: (error) => toast.error(error.message),
  });
  const saveMutation = trpc.levelAdmin.saveDraft.useMutation({
    onSuccess: async ({ versionId }) => {
      setActiveVersionId(versionId);
      toast.success("已保存为新的不可变草稿版本。");
      if (selectedLevelId) await utils.levelAdmin.get.invalidate({ levelId: selectedLevelId });
      await utils.levelAdmin.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });
  const publishMutation = trpc.levelAdmin.publish.useMutation({
    onSuccess: async () => {
      toast.success("关卡已发布；游戏客户端将只获取此版本的安全载荷。");
      if (selectedLevelId) await utils.levelAdmin.get.invalidate({ levelId: selectedLevelId });
      await utils.levelAdmin.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });
  const rollbackMutation = trpc.levelAdmin.rollback.useMutation({
    onSuccess: async () => {
      toast.success("历史版本已重新发布。");
      if (selectedLevelId) await utils.levelAdmin.get.invalidate({ levelId: selectedLevelId });
      await utils.levelAdmin.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });
  const archiveMutation = trpc.levelAdmin.archive.useMutation({
    onSuccess: async () => {
      toast.success("关卡已归档，不再提供给游戏客户端。");
      if (selectedLevelId) await utils.levelAdmin.get.invalidate({ levelId: selectedLevelId });
      await utils.levelAdmin.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const updateGridSize = (nextSize: GridSize) => {
    setGridSize(nextSize);
    setSnapshot(makeStarterSnapshot(nextSize));
    setSelectedLevelId(null);
    setActiveVersionId(null);
  };

  const resetEditor = () => {
    setSnapshot(makeStarterSnapshot(gridSize));
    setSelectedLevelId(null);
    setActiveVersionId(null);
    setTitle("苔影林地 · 新关卡");
    setSlug("moss-grove-new");
  };

  const loadExistingLevel = (levelId: string) => {
    setSelectedLevelId(levelId);
    setActiveVersionId(null);
  };

  const loadVersion = (version: NonNullable<typeof detailQuery.data>["versions"][number]) => {
    const level = detailQuery.data?.level;
    if (!level) return;
    setGridSize(level.gridSize as GridSize);
    setDifficulty(level.difficulty as Difficulty);
    setTitle(level.title);
    setSlug(level.slug);
    setSnapshot(version.snapshot);
    setActiveVersionId(version.id);
  };

  const editCell = (cell: Cell) => {
    setSnapshot((current) => {
      const result = applyEditorCellEdit(current, cell, tool);
      if (result.message) toast.error(result.message);
      return result.snapshot;
    });
  };

  const save = () => {
    if (!localValidation.valid) return toast.error("请先修复校验面板中的问题，再保存关卡。");
    if (selectedLevelId) {
      saveMutation.mutate({ levelId: selectedLevelId, title, gridSize, difficulty, snapshot });
    } else {
      createMutation.mutate({ title, slug, gridSize, difficulty, snapshot });
    }
  };

  const activeMutating = createMutation.isPending || saveMutation.isPending || publishMutation.isPending || rollbackMutation.isPending || archiveMutation.isPending;

  if (authLoading) {
    return <DashboardLayout><div className="editor-permission-note"><LoaderCircle className="spin" size={18} />正在核验巡护权限…</div></DashboardLayout>;
  }

  if (!isAdmin) {
    return <DashboardLayout><div className="editor-permission-note"><Leaf size={20} /><div><p className="editor-eyebrow">RANGER CLEARANCE REQUIRED</p><h1>需要内容管理员权限</h1><p>当前账户可以体验游戏，但不能创建、发布或回滚林地关卡。请由项目所有者在用户管理中将该账户角色设为 <code>admin</code> 后重新打开编辑器。</p></div></div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-[1600px] space-y-5 pb-10 forest-admin" aria-label="森林寻径关卡编辑器">
        <header className="editor-masthead">
          <div className="editor-title-column">
            <div className="editor-title-lockup">
              <span className="editor-year-ring" aria-hidden="true"><i /><i /><i /></span>
              <div>
              <p className="editor-eyebrow"><Leaf size={13} /> RANGER FIELD RECORD · 01</p>
              <h1>关卡编辑器</h1>
              </div>
            </div>
            <p>在野外手册上编排林径、路标与倒木；保存形成版本，发布才会面向玩家开放。</p>
          </div>
          <div className="editor-status-chip"><span className={localValidation.valid ? "is-valid" : "is-invalid"} />{localValidation.valid ? "校验通过" : `${localValidation.errors.length} 项待修复`}</div>
        </header>

        <div className="editor-workbench">
          <aside className="editor-panel editor-settings">
            <section>
              <p className="panel-label">关卡身份</p>
              <label>标题<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} /></label>
              <label>唯一标识<input value={slug} onChange={(event) => setSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} disabled={Boolean(selectedLevelId)} maxLength={96} /></label>
            </section>
            <section className="editor-select-grid">
              <label>棋盘尺寸<select value={gridSize} onChange={(event) => updateGridSize(event.target.value as GridSize)} disabled={Boolean(selectedLevelId)}>{sizeOptions.map((size) => <option key={size} value={size}>{size}</option>)}</select></label>
              <label>推荐难度<select value={difficulty} onChange={(event) => setDifficulty(event.target.value as Difficulty)}>{difficultyOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            </section>
            <section>
              <p className="panel-label">编辑工具</p>
              <div className="tool-stack">
                <ToolButton active={tool === "solution"} onClick={() => setTool("solution")} icon={<TreePine size={15} />} label="绘制林径" hint="点击相邻格延展；点旧格回退" />
                <ToolButton active={tool === "waypoint"} onClick={() => setTool("waypoint")} icon={<Leaf size={15} />} label="放置路标" hint="仅能放在已绘制林径上" />
                <ToolButton active={tool === "wallH"} onClick={() => setTool("wallH")} icon={<ChevronRight size={15} />} label="横向倒木" hint="点击格子下边切换" />
                <ToolButton active={tool === "wallV"} onClick={() => setTool("wallV")} icon={<ChevronLeft size={15} />} label="纵向倒木" hint="点击格子右边切换" />
                <ToolButton active={tool === "erase"} onClick={() => setTool("erase")} icon={<Eraser size={15} />} label="清除格点" hint="清除当前格的路标、墙体与路径" />
              </div>
            </section>
            <section className="editor-action-pair">
              <button type="button" onClick={() => setSnapshot((current) => ({ ...current, solution: [], waypoints: [] }))}><Undo2 size={14} /> 清空林径</button>
              <button type="button" onClick={resetEditor}><RotateCcw size={14} /> 新建模板</button>
            </section>
          </aside>

          <main className="editor-canvas-panel">
            <div className="editor-board-caption"><span>林区路线图</span><strong>{gridSize} · {snapshot.solution.length}/{snapshot.rows * snapshot.cols} 格</strong></div>
            <EditorBoard snapshot={snapshot} tool={tool} onEdit={editCell} />
            <div className="editor-board-legend"><span><i className="legend-trail" />林径</span><span><i className="legend-marker" />路标</span><span><i className="legend-wall" />倒木</span></div>
          </main>

          <aside className="editor-panel editor-inspector">
            <section>
              <p className="panel-label"><ClipboardCheck size={14} /> 即时校验</p>
              <div className={`validation-summary ${localValidation.valid ? "ok" : "needs-work"}`}><strong>{localValidation.valid ? "可保存和发布" : "尚不可保存"}</strong><span>{localValidation.summary.coveredCells}/{localValidation.summary.expectedCells} 格 · {localValidation.summary.checkpointCount} 枚路标 · {localValidation.summary.wallCount} 段倒木</span></div>
              <ul className="validation-list">{localValidation.valid ? <li><CheckCircle2 size={14} />完整路径、路标顺序与倒木校验均通过。</li> : localValidation.errors.slice(0, 5).map((error) => <li key={error}>{error}</li>)}</ul>
            </section>
            <section className="editor-primary-actions">
              <button type="button" className="save-button" onClick={save} disabled={activeMutating || !localValidation.valid}><Save size={15} />{selectedLevelId ? "保存新版本" : "创建草稿"}</button>
              <button type="button" className="publish-button" onClick={() => selectedLevelId && activeVersionId && publishMutation.mutate({ levelId: selectedLevelId, versionId: activeVersionId })} disabled={!selectedLevelId || !activeVersionId || activeMutating}><Send size={15} />发布此版本</button>
              {selectedLevelId && <button type="button" className="archive-button" onClick={() => archiveMutation.mutate({ levelId: selectedLevelId })} disabled={activeMutating}><Archive size={15} />归档关卡</button>}
            </section>
            <section>
              <p className="panel-label"><History size={14} /> 版本历史</p>
              {detailQuery.isLoading && <p className="subtle"><LoaderCircle className="spin" size={15} />正在加载版本</p>}
              <div className="version-list">{detailQuery.data?.versions.map((version) => <button type="button" key={version.id} className={activeVersionId === version.id ? "version-row active" : "version-row"} onClick={() => loadVersion(version)}><span><strong>v{version.versionNumber}</strong><small>{version.validation.valid ? "已校验" : "待修复"}</small></span><time>{formatMoment(version.createdAt)}</time></button>)}</div>
              {activeVersionId && selectedLevelId && <button type="button" className="rollback-button" onClick={() => rollbackMutation.mutate({ levelId: selectedLevelId, versionId: activeVersionId })} disabled={activeMutating}>将选中版本重新发布</button>}
            </section>
          </aside>
        </div>

        <section className="library-strip">
          <div><p className="panel-label">已管理关卡</p><h2>林地目录</h2></div>
          {listQuery.isLoading ? <LoaderCircle className="spin" /> : <div className="library-cards">{listQuery.data?.length ? listQuery.data.map((level) => <button type="button" key={level.id} onClick={() => loadExistingLevel(level.id)} className={selectedLevelId === level.id ? "library-card active" : "library-card"}><span>{level.status}</span><strong>{level.title}</strong><small>{level.gridSize} · {level.difficulty} · 更新于 {formatMoment(level.updatedAt)}</small></button>) : <p className="subtle">尚无已保存关卡。请先完成一张路线图并创建草稿。</p>}</div>}
        </section>
      </div>
    </DashboardLayout>
  );
}

function ToolButton({ active, onClick, icon, label, hint }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; hint: string }) {
  return <button type="button" className={active ? "editor-tool active" : "editor-tool"} onClick={onClick}><span>{icon}{label}</span><small>{hint}</small></button>;
}

function EditorBoard({ snapshot, tool, onEdit }: { snapshot: LevelSnapshot; tool: EditorTool; onEdit: (cell: Cell) => void }) {
  const pathIndex = new Map(snapshot.solution.map((cell, index) => [`${cell.row}-${cell.col}`, index]));
  const markerIndex = new Map(snapshot.waypoints.map((marker) => [`${marker.cell.row}-${marker.cell.col}`, marker.number]));
  return <div className="editor-grid" style={{ gridTemplateColumns: `repeat(${snapshot.cols}, minmax(0, 1fr))` }} role="grid" aria-label="关卡编辑棋盘">{Array.from({ length: snapshot.rows * snapshot.cols }, (_, index) => {
    const cell = { row: Math.floor(index / snapshot.cols), col: index % snapshot.cols };
    const key = `${cell.row}-${cell.col}`;
    const order = pathIndex.get(key);
    const marker = markerIndex.get(key);
    const hasBottomWall = snapshot.walls.includes(`H_${cell.row}_${cell.col}`);
    const hasRightWall = snapshot.walls.includes(`V_${cell.row}_${cell.col}`);
    return <button type="button" key={key} aria-label={`第 ${cell.row + 1} 行第 ${cell.col + 1} 列`} onClick={() => onEdit(cell)} className={`editor-cell ${order !== undefined ? "on-trail" : ""} ${marker ? "has-marker" : ""} ${hasBottomWall ? "wall-bottom" : ""} ${hasRightWall ? "wall-right" : ""}`}><span className="cell-order">{order !== undefined ? order + 1 : ""}</span>{marker ? <strong>{marker}</strong> : null}{tool === "wallH" && cell.row < snapshot.rows - 1 ? <em className="edge-h" /> : null}{tool === "wallV" && cell.col < snapshot.cols - 1 ? <em className="edge-v" /> : null}</button>;
  })}</div>;
}

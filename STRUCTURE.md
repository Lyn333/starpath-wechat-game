# 森林寻径：架构说明

## 总览

> React 是画框；Babylon 是林区路线图画布；`game/` 是不依赖框架的路径谜题规则。

```text
client/src/
├── App.tsx                         # 满屏画布入口
├── components/
│   └── GameCanvas.tsx               # 引擎生命周期、尺寸、浏览器输入挂载
└── game/
    ├── types.ts                     # 坐标、关卡与会话类型
    ├── puzzle.ts                    # 原创林间关卡与演示路线
    ├── PathEngine.ts                # 连续林径规则、状态机、撤回与完成判定
    ├── InputAdapter.ts               # 屏幕坐标到格坐标的浏览器输入适配
    ├── GameRenderer.ts               # Babylon 相机、林地网格、脚印与 HUD 绘制
    └── scene.ts                     # createGameScene() 和 GameHandle
```

## 领域模型

| 名称 | 关键字段 | 职责 |
|---|---|---|
| `Cell` | `row`, `col` | 表示唯一的林地坐标。 |
| `PuzzleDefinition` | `size`, `waypoints`, `walls`, `solution` | 描述关卡静态规则与演示解法。 |
| `PathEngine` | `path`, `nextWaypoint`, `status`, `startedAt` | 唯一负责可走性、路标顺序、撤回、重置和完成。 |
| `InputAdapter` | `boardRect`, `engine` | 将浏览器指针事件翻译为 `PathEngine.moveTo(cell)`。 |
| `GameRenderer` | `scene`, `engine`, `layout` | 负责把规则状态变成林地网格、琥珀林径、路标和读数。 |

## 状态机

`idle → active → completed`，并允许从 `active` 回到 `idle`（重新入林），或在 `active` 内执行一次受约束的后退。`completed` 状态冻结新的路径输入，但仍支持重新入林。

## 微信小游戏迁移边界

`PathEngine`、`types` 和 `puzzle` 不依赖 DOM、React 或 Babylon。移植时保留这些文件；将 `InputAdapter` 替换为对 `wx.onTouchStart`、`wx.onTouchMove`、`wx.onTouchEnd`、`wx.onTouchCancel` 的监听，并将 `GameRenderer` 替换为 `wx.createCanvas()` 的 2D 绘制实现。微信官方文档列出 `wx.createCanvas`、`wx.onTouch*` 和本地缓存 API，可分别承担画布、输入与进度存储职责。[微信小游戏开发指南](https://developers.weixin.qq.com/minigame/dev/guide/)

## Asset Hints

| 资产 | 运行时角色 | 目标尺寸 |
|---|---|---|
| 林下背景 | 覆盖整个视口的低对比环境层 | 1920×1080px，`cover`。 |
| 年轮图标 | 顶部左侧的品牌锚点 | 52×52px。 |
| 完成叶影 | 通关时沿路线出现的轻量叠层 | 620×350px，透明。 |
| 视觉目标图 | 非交互帮助面板的艺术参考图 | 1280×720px，`cover`。 |

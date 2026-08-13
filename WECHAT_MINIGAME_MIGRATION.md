# 星轨寻径：微信小游戏迁移手册

**作者：Manus AI**  
**适用版本：浏览器原型 1.0**  
**日期：2026-08-13**

## 一、迁移结论

当前项目是一个以浏览器为运行环境的可玩原型，已经将**谜题规则**与**渲染/输入**拆开：`PathEngine.ts`、`types.ts` 与 `puzzle.ts` 不依赖 React、DOM 或 Babylon，可以原样迁入微信小游戏工程。网页端的 `GameRenderer.ts` 和 `InputAdapter.ts` 则分别替换为微信 Canvas 2D 绘制层与 `wx.onTouch*` 输入适配层即可。

微信小游戏是基于微信平台、无需安装即可使用的游戏形态；官方文档将画布、触摸、缓存、前后台生命周期和帧率控制均列为原生能力。[1] [2] 对于本游戏这种单屏、纯触摸、低资源的逻辑谜题，Canvas 2D 是比继续携带完整浏览器 UI 框架更直接的上线实现。

> “微信小游戏是小程序其中的一个类目，是一种基于微信平台开发，不需要下载安装即可使用的全新游戏应用。”——微信小游戏开发指南 [1]

| 模块 | 浏览器原型 | 微信小游戏版本 | 迁移处理 |
|---|---|---|---|
| 谜题状态 | `PathEngine.ts` | 同名文件 | 直接复用。 |
| 关卡数据 | `puzzle.ts`、`types.ts` | 同名文件 | 直接复用，并逐步扩展关卡池。 |
| 绘制 | Babylon `GameRenderer.ts` | `CanvasRenderer.ts` | 使用 Canvas 2D 画网格、墙体、信标、路径和 HUD。 |
| 输入 | `InputAdapter.ts` 的 Pointer Events | `TouchAdapter.ts` | 监听 `wx.onTouchStart`、`wx.onTouchMove`、`wx.onTouchEnd` 与 `wx.onTouchCancel`。 |
| 进度 | 暂无持久化 | `StorageService.ts` | 使用 `wx.setStorageSync` / `wx.getStorageSync` 保存已解锁关卡、最佳步数与提示数。 |
| 生命周期 | React 卸载 | `game.ts` 生命周期 | 使用 `wx.onHide` 暂停计时，`wx.onShow` 恢复计时并刷新布局。 |

## 二、推荐工程结构

建议在微信开发者工具中新建小游戏项目，并将下面的结构作为第一版工程边界。由于此文档只描述前端迁移，不包含 AppID、广告、云函数、支付或用户登录配置。

```text
starpath-minigame/
├── game.js                    # 创建 Canvas、启动主循环
├── game.json                  # 小游戏窗口与方向配置
├── project.config.json        # 微信开发者工具配置
├── src/
│   ├── core/
│   │   ├── PathEngine.ts       # 从浏览器原型直接迁入
│   │   ├── puzzle.ts           # 从浏览器原型直接迁入
│   │   └── types.ts            # 从浏览器原型直接迁入
│   ├── platform/
│   │   ├── TouchAdapter.ts     # wx 触摸事件 → Cell
│   │   ├── StorageService.ts   # wx 本地缓存
│   │   └── LifecycleService.ts # 前后台暂停/恢复
│   ├── render/
│   │   ├── CanvasRenderer.ts   # 星图背景、棋盘与路径
│   │   └── Layout.ts           # 安全区、像素比与棋盘布局
│   └── assets/
│       ├── logo.png
│       ├── archive-background.png
│       └── completion-stars.png
└── README.md
```

## 三、关键替换实现

### 3.1 Canvas 与尺寸

小游戏 API 提供 `wx.createCanvas()` 和 `Canvas.getContext()`；官方 API 目录也列出了 `requestAnimationFrame` 与 `wx.setPreferredFramesPerSecond()` 用于绘制循环与帧率控制。[2] 初始化时应读取窗口宽高和像素比，将 Canvas 物理尺寸设置为逻辑尺寸乘以像素比，再以 `ctx.scale(pixelRatio, pixelRatio)` 保持图形清晰。布局上建议继续使用当前的纵向观测台构图：顶部仪器栏、中部正方形星图、底部触控甲板。

```ts
const info = wx.getWindowInfo();
const canvas = wx.createCanvas();
canvas.width = info.windowWidth * info.pixelRatio;
canvas.height = info.windowHeight * info.pixelRatio;

const ctx = canvas.getContext("2d");
ctx.scale(info.pixelRatio, info.pixelRatio);
wx.setPreferredFramesPerSecond(60);
```

该片段应放在 `game.ts`；实际导入方式与微信开发者工具选择的 TypeScript 构建模板有关，因此不要将浏览器项目的 Vite 设置复制到小游戏项目中。

### 3.2 触摸坐标与路径输入

官方说明中明确列出了 `wx.onTouchStart`、`wx.onTouchMove`、`wx.onTouchEnd` 与 `wx.onTouchCancel`，并说明触摸坐标需要转换为 Canvas 相对坐标、考虑设备像素比。[3] 本游戏只需使用第一个有效触点；`TouchAdapter` 将触点转换为逻辑格坐标后，调用 `pathEngine.moveTo(cell)`，绝不把墙体、顺序信标或重访校验复制到适配层。

```ts
wx.onTouchMove((event) => {
  const touch = event.touches[0];
  if (!touch || !dragging) return;
  const cell = layout.pointToCell(touch.clientX, touch.clientY);
  if (cell) pathEngine.moveTo(cell);
});
```

为避免手指快速滑动时跨过格点，`pointToCell()` 与当前浏览器原型一样只返回一格；`PathEngine` 则只接受与路径端点**正交相邻**的合法位置。若未来加入更高难度的更大棋盘，可在输入层对上一个合法格与当前触点进行格线采样，但仍应将最终合法性保留在 `PathEngine`。

### 3.3 绘制顺序

`CanvasRenderer.render(snapshot)` 需要保持稳定的分层顺序，避免路径覆盖编号或 HUD。背景图、标志图和完成星尘图可以使用本项目已生成的同名素材；上线前应把源文件导出为压缩 PNG/WebP 并纳入小游戏资源管理策略。

| 绘制层 | 内容 | 说明 |
|---|---|---|
| 0 | 深靛蓝背景与天文纹理 | 低对比，不影响格线和文字可读性。 |
| 1 | 黄铜棋盘框、象牙格线、测绘墙 | 使用当前安全区计算出的正方形棋盘边界。 |
| 2 | 青绿色路径与提示投影 | 路径先于信标，确保信标数字始终清晰。 |
| 3 | 编号信标与当前信标的外环 | 已通过信标转为青绿，当前信标显示柔和外环。 |
| 4 | 顶部读数、关卡名、底部控制甲板 | 触控区域须与绘制位置使用同一布局对象。 |
| 5 | 完成态星尘与归档弹层 | 完成后冻结路径输入，仅保留重试和分享入口。 |

## 四、进度、生命周期与性能

单机版不需要服务器即可保留基础体验。官方 API 提供 `wx.setStorageSync`、`wx.getStorageSync` 等本地缓存方法，可保存关卡解锁、最佳时间和音效偏好。[2] 不建议在首次版本加入未验证的实时排行榜或网络关卡下载；它们会增加审核、隐私、网络错误处理与作弊治理成本。

应在 `wx.onHide` 时保存当前路径和暂停时间；`wx.onShow` 时恢复游戏且不将后台停留时间计入成绩。`wx.onHide` 与 `wx.onShow` 均列为小游戏基础生命周期 API。[2] 画面以 60 FPS 为上限；路径谜题只有触摸、计时和少量粒子，不需要复杂 WebGL 或 WASM。资源较多时，官方文档建议合理分离首包与资源包，并避免频繁文件系统访问。[3]

## 五、发布前检查表

| 维度 | 验收条件 |
|---|---|
| 规则 | 从 1 号信标开始；所有路径仅正交移动；墙体、跳号、重访均被拒绝；覆盖全部格并到达最后信标后只结算一次。 |
| 触摸 | 单指拖动可连续选格；快速滑动不产生斜向或跨格路径；返回倒数第二格能撤销。 |
| 适配 | 375px 宽手机无文字重叠；刘海安全区不遮挡仪器栏；横屏策略与 `game.json` 一致。 |
| 生命周期 | 切后台后计时暂停；回到前台棋盘、进度和提示状态保持。 |
| 资产 | 所有背景、图标和星尘均成功加载；无大图拉伸模糊；首屏没有空白或闪烁。 |
| 合规 | 游戏名称、图标、文案、关卡、UI 和素材均保持原创；不要使用参考站点的商标、页面文案或具体题目。 |

## 六、下一步

若要将本原型变成可在微信开发者工具中运行的小游戏工程，需要项目所有者提供并配置**微信小游戏 AppID**，再在开发者工具内创建项目、导入上述纯规则模块、建立 Canvas 绘制层并做真机调试。官方开发指南建议计划上线的项目尽早并行查看小游戏接入指引，因为审核相关资料需要准备时间。[1]

## 参考资料

[1] [微信小游戏开发指南](https://developers.weixin.qq.com/minigame/dev/guide/)

[2] [微信小游戏 API 目录](https://developers.weixin.qq.com/minigame/dev/api/)

[3] [微信小游戏通用适配技术原理：触摸、Canvas、帧率与资源](https://developers.weixin.qq.com/minigame/dev/guide/game-engine/common-adaptation/Design/TechPrinciple.html)

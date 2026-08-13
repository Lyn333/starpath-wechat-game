# 森林寻径：微信小游戏 Canvas 核心代码

本目录提供一套**独立、可复制**的微信小游戏核心玩法实现。它采用 Canvas 2D，而不是 WXML 格子组件，以便连续拖动时将路径、脚印、路标和倒木障碍绘制在同一图层中。玩法规则不依赖 `wx`，因此能够以相同的逻辑用于微信小游戏、浏览器原型和单元测试。

## 已实现能力

| 模块 | 文件 | 职责 |
|---|---|---|
| 规则引擎 | `core/TrailEngine.js` | 起点校验、正交相邻移动、倒木墙体、顺序路标、重踏拦截、回退、重置、提示和完成判定。 |
| Canvas 绘制 | `core/TrailRenderer.js` | 林下手册背景、苔藓网格、树轮路标、倒木边界、琥珀脚印路线、提示与完成态。 |
| 触摸控制 | `core/TouchController.js` | 将 `wx.onTouch*` 触点映射为逻辑格坐标，并处理底部三个操作按钮。 |
| 关卡数据 | `levels/mossGrove6x6.js` | 原创 6×6 示例关卡；可按相同数据结构替换为 8×8 或导入的关卡。 |
| 入口 | `game.js` | 创建 Canvas、订阅引擎状态、注册触摸与窗口尺寸变化。 |

## 接入步骤

在微信开发者工具中新建**小游戏**项目，将本目录复制到项目根目录，使用此目录的 `game.js` 与 `game.json`，然后启动预览。若项目已有入口，请保留其初始化内容，并只合并 `TrailEngine`、`TrailRenderer`、`TouchController` 和 `mossGrove6x6` 的引入、实例化与事件绑定代码。

该入口使用 `wx.createCanvas()` 创建主画布，并监听 `wx.onTouchStart`、`wx.onTouchMove`、`wx.onTouchEnd` 与 `wx.onTouchCancel`。窗口发生变化时会重新计算布局和设备像素比，确保横竖尺寸变化后仍能正确命中格子。[1] [2]

## 关卡数据格式

```js
{
  id: "moss-grove-02",
  rows: 8,
  cols: 8,
  waypoints: [
    { number: 1, cell: { row: 0, col: 0 } },
    { number: 2, cell: { row: 2, col: 3 } }
  ],
  walls: ["H_0_2", "V_3_1"],
  solution: [{ row: 0, col: 0 }]
}
```

墙体 `H_0_2` 表示第 0 行与第 1 行之间、第 2 列处的横向倒木；`V_3_1` 表示第 3 行、第 1 列与第 2 列之间的纵向倒木。`solution` 仅供提示与开发测试使用，线上发布时不应将它直接渲染到界面。

## 本地校验

在此目录执行以下命令，可验证示例解法走满 6×6 棋盘、完成状态正确，并确认撤回行为：

```bash
node test-engine.cjs
```

## 扩展建议

接入本次导出的题目数据时，将 JSON 中的 `path` 字符串（例如 `"2-5"`）转换为 `{ row: 2, col: 5 }`，把 `numberPositions` 对象转为 `waypoints` 数组即可。保存进度时建议仅写入关卡 ID、当前路径、步数与开始时间；可通过微信本地缓存 API 在 `wx.onHide` 时持久化，并在 `wx.onShow` 时恢复。[3]

## 参考资料

[1] [微信小游戏开发指南](https://developers.weixin.qq.com/minigame/dev/guide/)

[2] [微信小游戏 API：触摸事件](https://developers.weixin.qq.com/minigame/dev/api/base/app/app-event/wx.onTouchStart.html)

[3] [微信小游戏 API：本地缓存](https://developers.weixin.qq.com/minigame/dev/api/storage/wx.setStorageSync.html)

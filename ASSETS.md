# Assets

**Art direction:** 雨林墨绿的野外手册纸面承载树皮、苔藓和蕨叶的自然纹理；象牙米白负责文字与细线可读性；林径琥珀只用于玩家已经确认的脚印与关键动作。整体接近当代自然观察图鉴，不使用星图、赛博霓虹、紫色渐变或幼态卡通森林。

## Backgrounds

| Name | Description | Size | Image |
|---|---|---|---|
| forestpath-background | 雨林墨绿的林下手册底页；边缘有蕨叶、雾影与纸纤维，中央低对比留空 | 1920×1080px，全视口覆盖 | `/manus-storage/forestpath-background_666bf595.png` |
| forestpath-visual-target | 6×6 林区路线图的实现基准图 | 1280×720px，帮助面板底图 | `/manus-storage/forestpath-visual-target_547d763c.png` |

## Sprites

| Name | Description | Size | Image |
|---|---|---|---|
| forestpath-logo | 无文字的年轮罗盘、树叶与琥珀林径图标 | 52×52px | `/manus-storage/forestpath-logo_ee30ae93.png` |
| forestpath-completion-leaves | 琥珀萤光、孢子、叶片与蕨叶组成的通关弧线，透明背景 | 620×350px | `/manus-storage/forestpath-completion-leaves_5dc72282.png` |

## 代码绘制元素

| Name | Description | 尺寸 |
|---|---|---|
| forest-grid | 6×6 象牙林区网格，基底为低对比苔藓绿 | 随棋盘自适应 |
| trail-marker | 带树轮边缘和编号的圆形林间路标 | 34–52px |
| fallen-log | 倒木和灌木形成的不可穿越边界 | 单元格边长的 72% |
| forest-trail | 使用林径琥珀绘制的连续正交脚印路线 | 8–14px |

# r22 时间挑战云函数更新记录

目标环境：`forest-trail-d2g9yvxci3e68e058`

## 当前控制台状态

- `submitGameResult` 已由管理员在云开发控制台上传 r22 代码包并选择“保存并安装依赖”。
- `getGlobalLeaderboard` 已上传 r22 代码包并选择“保存并安装依赖”。
- 控制台函数列表显示 `submitGameResult` 与 `getGlobalLeaderboard` 均为“正常”；最后更新时间分别为 2026-08-20 15:52:00 和 15:56:33。

## 后续真机验收

1. 导入 r22-flat，并以真实微信账号扫码进入真机调试。
2. 完成至少一局时间挑战，确认剩余时间增加 8 秒。
3. 等待倒计时结束，确认结束面板显示完成局数与“时间挑战总榜第 N 名 / M 人”。
4. 在 `forest_trail_results` 中核对新增 `scopeKey: "clock:<tier>"`、`solved`、`remainingMs` 和派生 `score` 字段。

更新时间：2026-08-20

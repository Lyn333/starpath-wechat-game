# 微信小游戏真机调试连接要点

更新时间：2026-08-20

## 标准扫码流程

1. 在微信开发者工具中打开已导入的小游戏项目，并确认 AppID 为 `wx42d447652d8a5d07`。
2. 点击顶部工具栏的“真机调试”。工具会处理并上传本地代码，随后显示二维码。
3. 使用已加入该小游戏开发者名单的真实微信账号扫描二维码，在手机端进入调试版小游戏。
4. 在手机上完成一局游戏；开发者工具的 Console 可观察真机日志。排行榜验收时还应在云开发控制台确认 `forest_trail_results` 出现真实记录。

## 预览作为替代

若仅需验证玩法和云函数调用，可点击顶部“预览”生成二维码，再用同一具备测试资格的微信号扫描。预览不提供完整远程调试面板，但适合确认通关弹窗和排行榜同步。

## 官方参考

- [微信小游戏真机调试能力升级说明](https://developers.weixin.qq.com/minigame/dev/devtools/remote-debug-v2.html)
- [微信开发者工具真机远程调试流程](https://developers.weixin.qq.com/miniprogram/dev/devtools/remote-debug.html)

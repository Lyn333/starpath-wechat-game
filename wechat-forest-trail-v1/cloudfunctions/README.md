# 森林寻径微信云开发排行榜部署

本目录对应云环境 `forest-trail-d2g9yvxci3e68e058` 的排行榜部署材料。主域只提交关卡标识、用时、步数和派生分数；玩家身份由云函数中的微信上下文获取，客户端不会传入或保存 OpenID。

## 在微信开发者工具中部署

导入 r20 或更新后的发布包后，确认项目详情中的云函数根目录为 `cloudfunctions/`。在左侧云函数目录中，依次右键 `submitGameResult` 与 `getGlobalLeaderboard`，选择“上传并部署：云端安装依赖”。部署前请在云开发控制台切换到环境 `forest-trail-d2g9yvxci3e68e058`。

## 数据库集合和索引

在云开发数据库创建集合 `forest_trail_results`。不要为客户端开放直接写入权限；成绩只允许通过 `submitGameResult` 写入。创建以下复合索引：

| 集合 | 索引字段 | 用途 |
|---|---|---|
| `forest_trail_results` | `scopeKey` 升序、`score` 降序 | 查询总榜前列与计算领先人数。 |
| `forest_trail_results` | `openid` 升序、`scopeKey` 升序 | 查找并更新玩家在某榜单范围内的最佳成绩。 |

`submitGameResult` 只保留同一玩家在同一范围内的最佳分数；`getGlobalLeaderboard` 不返回 OpenID。好友榜不经过云函数读取关系链，而是由开放数据域通过微信托管数据读取。

## 好友榜配置

通关时主域会写入键 `forest_trail_rank_score_v1`，并向 `open-data/index.js` 发送消息。开放数据域使用 `wx.getFriendCloudStorage` 获取已经游玩该小游戏的好友成绩并绘制到 sharedCanvas。请在小游戏管理后台的“游戏能力地图 → 社交能力 → 微信排行榜配置”中，以相同键配置排行榜；该后台配置按微信审核生效。

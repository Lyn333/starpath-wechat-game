# 森林寻径：关卡管理接口

本项目通过 tRPC 在 `/api/trpc` 下提供关卡接口。管理端 procedure 仅允许 `users.role = 'admin'` 的已登录用户访问；游戏端列表仅返回 `published` 关卡，并且会从 `snapshot` 中移除 `solution`，防止答案下发至玩家客户端。

## 管理接口

| Procedure | 权限 | 输入 | 结果 |
|---|---|---|---|
| `levelAdmin.list` | 管理员 | 可选 `status`、`gridSize`、`difficulty` | 关卡目录，按最近更新排序。 |
| `levelAdmin.get` | 管理员 | `levelId` | 逻辑关卡、所有版本、发布审计记录。 |
| `levelAdmin.validate` | 管理员 | `gridSize`、`snapshot` | 即时完整性校验结果。 |
| `levelAdmin.create` | 管理员 | 标题、slug、尺寸、难度、snapshot | 创建逻辑关卡与 v1 草稿。 |
| `levelAdmin.saveDraft` | 管理员 | `levelId`、标题、尺寸、难度、snapshot | 创建下一份不可变版本。 |
| `levelAdmin.publish` | 管理员 | `levelId`、`versionId` | 将通过校验的版本设为当前发布版本。 |
| `levelAdmin.rollback` | 管理员 | `levelId`、`versionId` | 将指定历史版本重新设为发布版本。 |
| `levelAdmin.archive` | 管理员 | `levelId` | 归档关卡，停止对游戏端公开。 |

## 游戏读取接口

| Procedure | 权限 | 输入 | 结果 |
|---|---|---|---|
| `gameLevels.list` | 公开 | 可选 `gridSize`、`difficulty` | 所有已发布关卡的安全载荷，不含解法。 |

## 关卡载荷

```ts
{
  title: "苔影林地 · 01",
  slug: "moss-grove-01",
  gridSize: "6x6",
  difficulty: "medium",
  snapshot: {
    rows: 6,
    cols: 6,
    waypoints: [{ number: 1, cell: { row: 0, col: 0 } }],
    walls: ["H_0_2", "V_3_1"]
  }
}
```

管理端保存时必须提交 `solution`，供服务端验证路径是否覆盖整张棋盘、按正确顺序经过路标且不穿越倒木。发布后该字段不再出现在游戏读取接口内。

## 权限启用

项目所有者首次完成 Manus OAuth 登录后，会由模板的用户同步逻辑自动获得 `admin` 角色。需要新增内容编辑人员时，应在数据库或项目管理界面将其用户角色提升为 `admin`；不要仅依赖前端隐藏按钮来保护管理接口。

# 微信小游戏云开发授权排障

## 当前结论

真机调试中出现的 `cloud init error: invalid scope` 对应微信云开发错误码 `-601034`，表示小游戏 AppID 尚未开通微信云开发服务，或首次开通后的后台准备期尚未结束。该错误不会因普通 CloudBase 云函数和数据库资源存在而自动消失；环境还必须通过小游戏 AppID 的微信云开发流程开通或接入。

当前已确认，森林寻径的正式小游戏 AppID 为 `wx0b874c8cc868b032`。此前配置的 `wx42d447652d8a5d07` 不是本游戏应使用的 AppID，其关联环境 `forest-trail-d2g9yvxci3e68e058` 不再作为本游戏排行榜环境使用。

当前 CloudBase 控制台的“小程序认证 → 扫码授权”页面返回“该第三方账号尚未配置小程序权限或者指定了无效的权限”，因此不应继续使用这条第三方授权路径。

## 推荐路径

1. 使用拥有 `wx0b874c8cc868b032` 管理员权限的微信登录微信开发者工具，并确保导入 r25 项目后“项目详情”的 AppID 显示为该值。
2. 在工具栏左侧的“云开发”入口，或新建临时的同 AppID 云开发 QuickStart 项目中，选择“微信云开发”并同意服务条款，创建或开通该 AppID 的环境。
3. 创建独立的生产环境（建议名称 `forest-trail-prod`），记录系统生成的 Env ID（通常形如 `cloud1-...`）。不要复用旧 AppID 的 `forest-trail-d2g9yvxci3e68e058` 环境。
4. 开通后至少等待 10 分钟，再将新的 Env ID 提供给开发方；随后填入排行榜客户端、启用云排行榜、部署两个云函数和索引，再重新编译/真机调试。

## 参考

- 微信小游戏云开发快速开始：<https://developers.weixin.qq.com/minigame/dev/wxcloud/basis/quickstart.html>
- 微信小程序/小游戏快速开始：<https://developers.weixin.qq.com/minigame/dev/wxcloud/quick-start/miniprogram.html>
- 微信云开发账号与环境关联：<https://developers.weixin.qq.com/minigame/dev/wxcloud/basis/concepts/account.html>
- 微信小游戏云开发错误码：<https://developers.weixin.qq.com/minigame/dev/wxcloud/reference/errcode.html>

## 2026-08-22 控制台核对

用户提供的候选环境 ID 为 `forest-trail-d6grbvm3o2ab75f2b`。首次查询时控制台仍显示旧环境；在管理员完成登录并刷新后，腾讯云 CloudBase 控制台已确认该环境可见，地域为上海，类型为云开发，个人版有效期至 2026-09-22 23:59:59。环境总览进一步确认其名称为 `forest-trail`、创建时间为 2026-08-22 10:08:11。该环境可作为正式小游戏 `wx0b874c8cc868b032` 的排行榜部署目标；部署前仍须在云函数和数据库页面确认资源创建位置。

已进入该环境的“云函数”页面并确认函数列表为空，尚不存在 `submitGameResult` 或 `getGlobalLeaderboard`。因此，下一步需在该环境创建两个同名 Node.js 云函数，再上传已准备的 r26 函数包并安装依赖；不得假定旧环境的函数会自动迁移。

已在新建函数向导中为第一个函数填写 `submitGameResult`，并确认运行环境为 Node.js 18.15、内存为 256MB；该配置与已验证的 r26 函数包匹配。向导尚未最终提交，后续仍需选择代码上传方式、上传包并确认部署。

`submitGameResult` 已于 2026-08-22 10:21:17 在环境 `forest-trail-d6grbvm3o2ab75f2b` 中创建成功，控制台状态为“正常”，运行环境为 Node.js 18.15。创建向导生成的是默认 `helloworld` 代码，尚未具备排行榜能力；必须在函数详情中上传 `forest-trail-submitGameResult-r26-wx0b874c8cc868b032.zip` 并安装依赖后，才能启用客户端提交。

函数详情的“函数代码”页已确认提供“在线编辑”和“本地上传 ZIP 包”两种提交方法，并提供“保存”和“保存并安装依赖”操作。r26 函数包根目录已预先校验仅含 `index.js` 与 `package.json`，适用于该上传入口。

在用户通过本机文件选择器选中 r26 ZIP 后，直接执行“保存并安装依赖”时，控制台弹出“当前云函数根目录下并无 package.json 文件”的提示，未生成新版本、默认 `helloworld` 代码仍保持。该控制台流程需要先以“保存”提交选中的 ZIP 包，再从已保存版本执行依赖安装；后续必须复核代码版本与状态后才视为部署成功。

随后已执行“保存”，控制台返回“函数更新成功”；函数文件树已显示 `index.js` 与 `package.json`，证明 r26 ZIP 已写入 `submitGameResult` 的 `$LATEST` 工作副本。下一步需执行“保存并安装依赖”，并在控制台状态稳定后检查该函数的运行日志或测试响应。

已在该工作副本上提交“保存并安装依赖”请求；等待控制台响应时，浏览器扩展返回超时，随后新页面要求重新登录腾讯云，因此当前无法从自动化会话确认依赖安装最终状态。代码上传成功的证据仍有效，但必须在管理员重新进入同一环境的函数详情页后检查“函数配置”的状态、文件树和日志，才能确认运行依赖已完成安装。

管理员重新登录后，`submitGameResult` 的函数代码文件树已显示 `node_modules/`、`index.js` 与 `package.json`，代码编辑器也显示了 r26 的 `wx-server-sdk`、动态环境初始化及 `forest_trail_results` 写入逻辑。这证明“保存并安装依赖”已完成；下一步可创建并部署 `getGlobalLeaderboard`，再初始化数据库集合与索引。

当旧版控制台页面在函数列表加载时出现扩展超时，新版 CloudBase 开发平台 `tcb.cloud.tencent.com/dev` 已可通过同一环境 ID 打开 `forest-trail` 个人版的“云函数 / 托管 → 函数管理”。该平台仍在加载函数清单，但可作为完成第二个函数与数据库配置的备用入口。

已在新版平台通过代码包创建 `getGlobalLeaderboard`，并提交预先校验过的 r26 ZIP。函数列表当前显示其状态为“函数创建中”，类型为普通云函数、运行环境为 Node.js 20.19；自动安装依赖已由创建页启用。必须等待状态转为“正常”并检查代码文件后，才能进行数据库集合与索引创建。

截至连续两次状态查询，`getGlobalLeaderboard` 仍处于“函数创建中”；已确认 `submitGameResult` 保持“正常”。在 CloudBase 完成异步创建前，不应向客户端声称总榜已经可用。

已打开正式环境的文档型数据库，CloudBase 自带实例为 `tnt-1m4jbfw1c`，集合管理显示为空。旧环境的 `forest_trail_results` 不会自动迁移，必须在新环境创建同名集合并建立排行榜查询所需索引。

已创建 `forest_trail_results` 集合，并选择 `ADMINONLY` 权限。第一个复合索引已在创建表单中配置为非唯一 `scopeKey_score_desc`：`scopeKey` 升序、`score` 降序；该配置与总榜函数先按 `scopeKey` 过滤、再按 `score` 降序读取前 100 条的查询一致。控制台标注索引添加为高风险操作，当前集合为空，仍待用户确认后点击“确定”。

用户已确认后，`scopeKey_score_desc` 已成功创建并显示在索引列表中。第二个索引已配置为非唯一 `openid_scopeKey`：`openid` 升序、`scopeKey` 升序；该字段组合与提交函数查询“当前用户在当前榜单范围内既有记录”的条件一致。该索引尚未最终创建，待获得单独确认。

用户确认后，`openid_scopeKey` 已成功创建并显示在索引列表中；目前 `forest_trail_results` 的自定义排行榜索引完整为：`scopeKey_score_desc`（非唯一，`scopeKey` 升序、`score` 降序）和 `openid_scopeKey`（非唯一，`openid` 升序、`scopeKey` 升序）。权限页确认集合策略为 `ADMINONLY`。新版函数管理页随后确认 `submitGameResult`（Node.js 18.15）与 `getGlobalLeaderboard`（Node.js 20.19）均处于“正常”状态；后者由 r26 ZIP 代码包创建并启用自动依赖安装，前者代码树已验证包含 `node_modules/`、`index.js` 与 `package.json`。至此新环境的服务端资源部署完成，下一步应使用 r26 客户端在真实微信设备上验证云初始化、成绩写入和真实排名返回。

## 2026-08-22 真机调试日志初步核对

用户提供的宽幅控制台截图 `Bug1.jpg` 已按从左至右的图块读取。已确认其中包含运行库前缀 `[wxapplib]` 的 `ExterApp: load res []`、`baseOperateWXData success apiName=jsapi_reportuserbehavior`，以及 `reportUserBehavior` 的 `errMsg:"reportUserBehavior:ok"` 返回和游戏日志配额字段。尽管控制台行带有红色图标，已读返回值为 `ok`，且该片段未出现 `wx.cloud.init`、`callFunction`、`submitGameResult`、`getGlobalLeaderboard` 或 `cloud init error`；暂不能将其判定为森林寻径业务代码或排行榜失败。

`Bug1.jpg` 右侧图块进一步确认该行来源为 `WAGame.js:1`，返回仍为 `reportUserBehavior:ok`。`Bug2.jpg` 左侧图块显示另一条 `[wxapplib] backgroundfetch privacy fail` 运行库日志，`errno:101`，可见的错误文本为 `private_getBackgroundFetchData:fail:jsapi invalid request data`；其下方另有运行库 `baseOperateWXData success` 行，完整 API 名称与右侧上下文仍在继续读取中。

`Bug2.jpg` 中、右图块确认完整错误为 `private_getBackgroundFetchData:fail:jsapi invalid request data`，来源同为 `WAGame.js:1`。紧随其后的运行库成功行是 `baseOperateWXData success apiName=webapi_getwxauserprivacyauthinfo`。两张截图均未含本项目代码文件名、`wx.cloud.init`、`wx.cloud.callFunction`、`submitGameResult`、`getGlobalLeaderboard`、云函数返回体或 `cloud init error`。因此，这两条属于微信运行库的行为上报/后台抓取隐私接口日志，不是森林寻径的排行榜调用失败；不应据此修改游戏云开发代码。真机验收应继续关注实际通关时是否出现云初始化或云函数错误，并确认总榜返回真实名次。

随后用户在标准模式通关后报告 Beat the Clock 入口无响应，并提供包含 `webapi_getfrienduserstorage` 失败（`err_code:-12034`）与 `getFriendCloudStorage` 隐私检查失败（`errno=1026`）的新截图。该错误发生在开放数据域关系链好友榜，官方隐私合规说明将 1025/1026 归为后台隐私保护指引未披露相关用户信息使用的情形；其本身不应阻塞单机游戏或总榜流程。代码核查同时发现标准通关态会优先吞掉非弹窗按钮的触摸事件。r27 已让好友托管数据写入不再被 `await`，并允许玩家在标准完成遮罩显示时直接点时间挑战入口以关闭遮罩、打开档位选择；新增回归覆盖好友榜回调悬挂和通关态直达时间挑战。好友榜隐私声明仍应由管理员在微信小游戏后台完成披露，详见 <https://developers.weixin.qq.com/minigame/dev/guide/open-ability/privacy>。

r27 真机截图确认标准通关与时间挑战结束均已可用，但总榜文案仍停留“正在同步”。新云环境的 `submitGameResult` 监控曲线显示在真机验收窗口内已有 3 次调用，证明客户端已到达云函数；该函数配置为 `Node.js 18.15`、入口 `index.main`、状态“正常”，默认执行超时为 20 秒。当前环境未开启函数日志服务，无法直接读取失败栈或每次调用的返回体。后续须为客户端加入有限等待时间的降级并检查云函数数据库查询是否在20秒内返回；必要时经管理员确认开启日志服务以读取实际错误。

管理员已确认开启日志服务。`submitGameResult` 的“日志”页现可选择实时与时间窗口检索，但启用时暂显示“暂无数据”，因此此前 3 次调用不会回填。需要从当前 r27 真机再次完成一次标准通关或一次时间挑战结束，才能在该页获取新的运行记录、状态码及错误栈。日志服务已用于诊断，后续可由管理员按用量策略保留或关闭。

用户重测后，函数日志页仍无业务日志（函数代码未输出 `console`），但文档型数据库 `forest_trail_results` 已可见 2 条真机成绩：一条标准模式 `6x6/easy` 记录及一条 `clock-easy` 记录。该证据表明 `submitGameResult` 已完成身份识别、数据校验和写入；总榜“正在同步”的根因位于写入后的排名统计或响应传回链路，而非客户端没有调用云函数。应为客户端调用增加明确的有限等待和读榜回退，避免通关弹窗永久处于加载状态，同时保留日志以观察后续调用。

r28 将成绩提交调用限制为 8 秒；超时或失败后，客户端改为调用 `getGlobalLeaderboard`，并在返回的真实榜单项目中按同一 `scopeKey`、`levelId` 与 `score` 定位当前成绩，再根据更高分项数计算名次。该读榜调用亦限制为 4 秒；若仍不可用，弹窗显示“同步超时，稍后重试”。该策略不伪造成绩或名次：只有服务端查询返回包含对应的真实记录时才展示排名。

# 评审与回复协作工作台

在同一个网页阅读评审、分别编辑回复和添加批注。GitHub Pages 托管界面，Supabase 免费项目保存数据并验证合作者身份。编辑内容约每 10 秒同步一次。同一段发生并发修改时，页面保留草稿并要求手动合并。

## 部署准备

使用 Node.js 22 或更新版本和 Python 3。执行 `npm ci`、`npm test`。配置前执行 `npm run build` 只会生成配置提示页面。

项目源码可公开。评审、回复、历史、批注和数据导入文件必须保存在公开仓库之外。构建只使用 web 目录中的界面代码，不复制数据库或研究内容。

## 1. 创建 Supabase 免费项目

在 https://supabase.com/dashboard 创建 Free 项目。保存数据库密码到自己的密码管理器。到 SQL Editor 执行 `supabase/schema.sql`，只运行一次。它创建成员表、数据表和受限 RPC。

到 Authentication 的配置中关闭 Allow new users to sign up。登录界面采用邮箱和密码。成员由项目所有者在 Authentication > Users 中创建，设置初始密码并安全交给对应合作者。记录每个账号的 User UID。不要把密码发到 GitHub 或写入代码。

在 SQL Editor 授权每个成员，将下方 UUID 替换为真实 User UID。

```sql
insert into public.workspace_members(user_id)
values ('实际的用户UUID');
```

移除成员时删除对应行。访问权限每次请求都检查。仅创建 Auth 账号不会自动获得数据权限。

```sql
delete from public.workspace_members where user_id = '实际的用户UUID';
```

## 2. 导入原来的本地内容

正式切换前停止在本地网页继续编辑，等待所有编辑框保存成功。关闭其他正在编辑的窗口，然后执行下方命令。路径根据本机项目位置调整。

```sh
python3 scripts/export_workspace.py \
  --db ../private/workspace.sqlite3 \
  --document ../content/reviews.json \
  --output private/import.sql
```

导出使用 SQLite 的一致性快照，不修改原数据库。`private/import.sql` 包含全部评审、回复、历史和批注，仅在自己的 Supabase SQL Editor 执行。导入遇到非空目标会拒绝覆盖。不要提交该文件。导入完成后核对数量，保存原数据库作为备份。

```sql
select 'responses' as kind, count(*) from public.workspace_responses
union all select 'history', count(*) from public.workspace_history
union all select 'comments', count(*) from public.workspace_comments;
```

此后统一使用线上网址编辑。在线数据不会自动写回原来的本机数据库。

## 3. 配置 GitHub Pages

把本目录中的代码推送到一个独立的公开 GitHub 仓库。GitHub Free 的 Pages 使用公开仓库。不要发布上级本地网站目录。

到 Supabase Project Settings > API Keys 获取 publishable key，格式为 `sb_publishable_…`。从项目设置获取 `https://项目标识.supabase.co` 地址。它们是浏览器可见的公开客户端配置。不要使用 `sb_secret_…` 或 service_role key。

在 GitHub 仓库 Settings > Secrets and variables > Actions > Variables 添加以下两个变量。

| 变量 | 值 |
| --- | --- |
| SUPABASE_URL | Supabase 项目 HTTPS 地址，不带末尾斜杠 |
| SUPABASE_PUBLISHABLE_KEY | Supabase publishable key |

到 Settings > Pages 把 Source 设为 GitHub Actions。在 Actions 运行 Deploy workspace to GitHub Pages。成功后可使用 `https://用户名.github.io/仓库名/`。

到 Supabase Authentication > URL Configuration 把 Site URL 设置为该网址。现有登录采用密码，不依赖邮件跳转。部署不需要 SMTP 服务。

## 验收

1. 无痕窗口访问只显示登录页。
2. 用未授权 Auth 账号登录，确认无法读取评审。
3. 用两个成员账号分别登录，编辑不同条目，确认另一窗口约 10 秒后读取更新。
4. 两个窗口在同步前编辑同一条目，确认冲突时保留双方文字，合并后才能保存。
5. 添加批注、补充、刷新和删除，确认其他窗口可见。
6. 在有未提交草稿时退出并重新登录同一个账号，确认草稿可恢复。不同账号的草稿相互隔离。
7. 页面顶部可以导出当前回复。完整备份应另外通过 Supabase 数据库备份工具执行，包含 workspace 表和成员信息。

免费项目可能因一周低活跃而暂停，届时到 Supabase 控制台恢复。免费额度以平台当前政策为准。

## 数据访问与 Agent 操作

使用已授权成员的 Supabase Auth 会话调用 `workspace_api` RPC。参数为 `{method,path,payload,expected_user}`，其中 expected_user 为当前成员的 User UID，路径包括 `/api/document`、`/api/responses` 和 `/api/comments`。PUT 回复必须带当前 version，DELETE 批注必须带当前 expected_updated_at。PT409 表示需重读并合并。Agent 应遵守相同版本检查，不直接更新正式数据表。

本地回归测试使用隔离的 PGlite PostgreSQL 实例，不访问正式 Supabase。网页验收使用 Playwright 和虚构评审。运行 `npm run test:browser` 前执行 `npx playwright install chromium`，或设置 `PLAYWRIGHT_CHANNEL=chrome` 使用已安装的 Chrome。

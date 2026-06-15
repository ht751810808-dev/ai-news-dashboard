# AI 资讯站

个人用 AI 资讯聚合站，三个来源合一，本地跑，浏览器看。

## 数据来源

| 来源 | 内容 | Tab |
|------|------|-----|
| [AIHOT](https://aihot.virxact.com) | 中文 AI 资讯全量日报 | AI 资讯 |
| [follow-builders](https://github.com/zarazhangrui/follow-builders) | 顶级 AI builder 推文 + YouTube 播客 | Builder 动态 |
| [BuilderPulse](https://github.com/BuilderPulse/BuilderPulse) | 每日 GitHub 热点中文解读 | BuilderPulse |

## 快速启动

需要 Node.js（v18+）。

```bash
git clone https://github.com/ht751810808-dev/ai-news-dashboard.git
cd ai-news-dashboard
node server.js
```

浏览器打开 `http://localhost:4321`。

> 也可以直接双击 `start.command`（macOS）。

## 依赖

- 无需安装任何 npm 包，全用 Node.js 内置模块
- Builder 推文渲染依赖 Twitter widgets.js（需能访问 twitter.com）
- Markdown 渲染用 [marked.js](https://marked.js.org/)（CDN 加载）

## 缓存

每个数据源本地缓存 1 小时（`.cache-*.json`，已加入 `.gitignore`）。右上角「↻ 刷新」按钮强制清缓存重拉。

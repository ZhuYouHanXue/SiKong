# 司空 · 从此处生枝

> 写下你已知的一点，从它身旁去往未见之处。

「司空」是一个以卡片为核心的 AI 文字生成与发散应用。输入一个短句，它会生成多种「意外」变体卡片，并提供解说、收藏、浏览和诗文会 / 书会玩法。有 DeepSeek API Key 时内容由模型生成；**没有 Key 时自动进入离线降级模式，仍能使用完整流程**（见下文「离线模式」）。

## 功能

- 七种卡片：沙海、湮律、不守、盲诗、全书、尔反、空
- 生成过程流式展示与卡片解说
- 收藏抽屉（留印）：保存、浏览与删除
- 浏览模式、诗文会 / 书会等扩展玩法
- **离线降级模式**：无 API Key 时仍可用，搜索框锁定「人工智能」，七张固定卡片随机轮换

## 离线模式（无 API Key）

未配置有效的 DeepSeek API Key 时，司空自动进入**离线示例模式**：

- 首页搜索框**锁定为「人工智能」**，只能对这一词生枝
- 七张**固定卡片**（每引擎一张）可随机轮换探索
- 页面显示提示：「当前离线示例模式：未配置 API Key，仅可探索「人工智能」。配置 DeepSeek API Key 可解锁完整生成。」

七张离线固定卡：沙海「海边的旧书店」、湮律「人工置灵」、不守「知识经久不衰」、尔反「天然呆」、盲诗「数据教会机器梦见海」、全书「今天先别急着回应」、空「人工智能在夜里醒来」。

配置 Key 后即可解锁完整的模型生成。

## 技术栈

- 前端：Vite 5 + React 18
- 后端：Node.js（原生 HTTP 服务，无框架）
- 模型：DeepSeek（OpenAI 兼容的 chat/completions 接口）
- 包管理：pnpm（也兼容 npm）

## 目录结构

```
src/        前端 React 源码
server/     后端 API、模型适配与本地数据文件
scripts/    开发与一键启动脚本
public/     静态资源
```

## 快速开始

### 方式一：一键启动（推荐）

- Windows：双击 `start.bat`
- macOS / Linux：运行 `./start.sh`

脚本会自动完成：检查 Node 环境 → 安装依赖 → 检测是否已配置 DeepSeek API Key → 未配置时提示一键填写或跳过 → 启动前后端服务。

启动完成后打开 <http://localhost:5173>。

### 方式二：手动启动

```bash
pnpm install
pnpm dev
```

打开 <http://localhost:5173>。

> **无需 Key 也能跑**：不配 Key 直接启动会进入离线模式（见上文），仍可体验完整流程。想解锁模型生成，再配 Key 即可。

## 环境要求

- Node.js >= 18
- pnpm 或 npm

## API Key 配置

想要模型生成内容，需要自行到 [DeepSeek 开放平台](https://platform.deepseek.com/) 申请 API Key。

以下三种方式任选其一：

1. 运行一键启动脚本，按提示填写。
2. 打开应用后在「设置」中填写并保存。
3. 手动创建 `server/model-config.json`，格式如下：

```json
{
  "provider": "deepseek",
  "baseUrl": "https://api.deepseek.com/v1",
  "model": "deepseek-chat",
  "apiKey": "sk-你的密钥"
}
```

密钥与本地数据文件已被 git 忽略，不会提交到仓库：`server/model-config.json`、`server/.env`、`server/.env.local`、`server/saved-cards.json`。

## 运行与部署

- 开发模式：`pnpm dev`（前端 5173，后端 8787，`/api` 自动代理到后端）
- 生产预览：`pnpm preview`（构建前端到 `dist`，由后端在 8787 提供静态文件）
- 检查与测试：`pnpm check`（服务端测试 + 前端构建）；`pnpm test:server`

部署注意：后端会把用户收藏写入 `server/saved-cards.json`、把页面配置写入 `server/model-config.json`，因此建议部署到有持久磁盘的 Node 环境（VPS / 容器）。如果使用无状态的 Serverless 平台，需要先改造本地存储层。

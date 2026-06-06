<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# 项目开发与交互规范

## 1. 禁止使用 Emoji 图标
- 无论是项目代码、UI 页面布局、大纲与设定展示卡片，还是系统相关的示例文本，均严禁引入、使用或渲染任何 Emoji 图标。
- 智能助手在回答用户提问及编写任务交付报告时，也必须严格禁止使用任何 Emoji 图标。

## 2. 控制单文件体积
- 单个源文件原则上不超过 500 行；超过时应主动拆分，不要继续往大文件里堆代码。
- 拆分按职责归位：纯函数/解析逻辑放 `lib/`，有状态的逻辑（state、副作用、handler）放 `app/hooks/`，UI 视图拆成 `app/components/` 下的子组件。
- 一个组件只负责一类视图；当组件按条件渲染多个独立视图时，应拆成多个子组件，由父组件做编排路由。
- 严禁复制粘贴已有函数：先检查 `lib/` 与 `app/hooks/` 是否已有可复用实现，有则直接 import。

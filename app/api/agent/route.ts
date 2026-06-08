import { NextRequest } from 'next/server';
import { HumanMessage } from '@langchain/core/messages';
import { Command } from '@langchain/langgraph';
import { buildNovelAgentGraph } from '@/lib/agent/graph';
import { AGENT_LABELS } from '@/lib/agent/prompts';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 分钟超时

// 简易内存限流：每个项目最多 3 个并发 agent 请求
const activeRequests = new Map<string, number>();
const MAX_CONCURRENT_PER_PROJECT = 3;

export async function POST(request: NextRequest) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: '无效的请求体' }), { status: 400 });
  }

  const { projectId, message, apiKey, modelName, messageId, resume } = body;
  // resume：用户对锁定项确认弹窗的回传（'confirm'/'cancel' 等真值字符串），用于恢复被 interrupt 暂停的图
  // 'continue_limit'：recursion limit 达上限后用户点击"继续" → 当作新消息续跑
  const isResume = resume !== undefined && resume !== null && resume !== '';
  const isContinueLimit = resume === 'continue_limit';

  if (!projectId || (!message && !isResume)) {
    return new Response(JSON.stringify({ error: '缺少 projectId 或 message' }), { status: 400 });
  }

  // 校验项目存在，避免对不存在的项目空跑整个 Agent 图
  const project = await db.getProject(projectId);
  if (!project) {
    return new Response(JSON.stringify({ error: '项目不存在' }), { status: 404 });
  }

  // 限流检查：同一项目最多 MAX_CONCURRENT_PER_PROJECT 个并发 agent 请求
  const currentActive = activeRequests.get(projectId) || 0;
  if (currentActive >= MAX_CONCURRENT_PER_PROJECT) {
    return new Response(
      JSON.stringify({ error: '该项目当前并发请求数已达上限，请稍后再试' }),
      { status: 429 }
    );
  }
  activeRequests.set(projectId, currentActive + 1);

  // 打包 API 配置
  let packedApiKey = apiKey || '';
  const { apiProvider, apiBaseUrl, temperature, maxTokens, systemInstruction, reasoningEnabled } = body;
  if (apiKey && apiProvider && !(apiKey.trim().startsWith('{') && apiKey.trim().endsWith('}'))) {
    packedApiKey = JSON.stringify({
      apiKey,
      apiProvider: apiProvider || 'gemini',
      apiBaseUrl: apiBaseUrl || '',
      temperature: temperature !== undefined ? Number(temperature) : 0.7,
      maxTokens: maxTokens !== undefined ? Number(maxTokens) : 4000,
      systemInstruction: systemInstruction || '',
      reasoningEnabled: reasoningEnabled === true,
    });
  }

  // 构建 SSE 流
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // M1 修复：send 加 try/catch 兆底，避免 controller 已关闭时抛错
      const send = (eventType: string, data: Record<string, any>) => {
        try {
          const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        } catch {
          // controller 已关闭，忽略
        }
      };

      let heartbeat: ReturnType<typeof setInterval> | undefined;
      try {
        // 构建图
        const graph = buildNovelAgentGraph(packedApiKey, modelName || 'gemini-2.5-flash', projectId);

        // 心跳机制：每 15 秒发送一歡 SSE 注释行，防止代理/网关因长时间无数据而断开连接
        heartbeat = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(': keepalive\n\n'));
          } catch { /* controller 已关闭时忽略 */ }
        }, 15000);

        // 客户端断开连接时主动清理，避免继续执行无意义的 agent 任务
        // M1 修复：abort 回调只设置标志并清理心跳，由循环 break 后 finally 统一 close
        let clientAborted = false;
        request.signal.addEventListener('abort', () => {
          clientAborted = true;
          if (heartbeat) clearInterval(heartbeat);
        });

        // 初次请求才保存用户消息；resume（确认/取消/续跑）不是新的用户输入
        if (!isResume) {
          const userMsgId = messageId || `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
          await db.appendAgentMessage(projectId, {
            id: userMsgId,
            type: 'user',
            content: message,
          });
        }

        // continue_limit：recursion 达上限后继续 → 以新消息续跑，而非通过 Command.resume
        // isResume（interrupt 确认）：通过 Command.resume 恢复被中断的图
        // 正常消息：新的用户输入
        // S1 修复：续跑时重置 delegationCount，否则长篇任务无法继续委托专家
        const graphInput: any = isContinueLimit
          ? { messages: [new HumanMessage("请继续完成之前因执行轮次达上限而中断的任务，从上次中断处无缝衔接。")], projectId, delegationCount: 0 }
          : isResume
            ? new Command({ resume })
            : { messages: [new HumanMessage(message)], projectId };

        // 流式执行图，监听每个事件
        const eventStream = await graph.streamEvents(
          graphInput,
          {
            version: 'v2',
            recursionLimit: 200,
            configurable: {
              thread_id: projectId,
              apiConfig: packedApiKey,
              modelName: modelName || 'gemini-2.5-flash',
            }
          }
        );

        let lastAgent = 'orchestrator';
        let currentAnswerMsgId = '';
        // 流式阶段当前 thinking 消息的 db id 与累积的 reasoning 文本；
        // on_chat_model_end 时把累积值回写 db，避免历史里只看到 "正在思考..." 占位符
        let currentThinkingMsgId = '';
        let accumulatedReasoning = '';

        for await (const event of eventStream) {
          // M1 修复：使用 clientAborted 标志检查客户端断开
          if (clientAborted) break;

          const { event: eventType, name, data } = event;

          // Agent 开始执行
          if (eventType === 'on_chain_start' && isAgentNode(name)) {
            const agent = name as keyof typeof AGENT_LABELS;
            lastAgent = agent;
            currentAnswerMsgId = '';  // 切换 agent 时重置，防止消息错位
            currentThinkingMsgId = ''; // 切 agent 时也清空上一轮的 thinking 跟踪
            accumulatedReasoning = '';
            send('agent_start', {
              agent,
              label: AGENT_LABELS[agent as keyof typeof AGENT_LABELS] || agent,
            });
          }

          // LLM 开始生成（thinking 阶段）
          if (eventType === 'on_chat_model_start' && data?.input?.messages) {
            const thinkingMsgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
            await db.appendAgentMessage(projectId, {
              id: thinkingMsgId,
              type: 'thinking',
              agent: lastAgent,
              label: AGENT_LABELS[lastAgent as keyof typeof AGENT_LABELS] || lastAgent,
              content: '正在思考...',
            });
            // 记录到外层闭包，流式结束后回写真实 reasoning
            currentThinkingMsgId = thinkingMsgId;
            accumulatedReasoning = '';
            // 通知前端 agent 正在思考
            send('thinking', {
              id: thinkingMsgId,
              agent: lastAgent,
              label: AGENT_LABELS[lastAgent as keyof typeof AGENT_LABELS] || lastAgent,
            });
          }

          // LLM 流式 token 输出
          if (eventType === 'on_chat_model_stream' && data?.chunk) {
            const chunk = data.chunk;

            // ── 推理内容提取（兼容多种模型 / 协议）──────────────────────
            // 1) DeepSeek R1 / 标准 OpenAI reasoning_content
            let reasoning = chunk.additional_kwargs?.reasoning_content
              || chunk.reasoning_content;

            // 2) Gemini 2.5 thinking：content 可能是 [{ text, thought? }] 数组，
            //    thought=true 的 part 是思考过程
            if (!reasoning && Array.isArray(chunk.content)) {
              const thinkingParts = chunk.content
                .filter((p: any) => p.thought === true && typeof p.text === 'string')
                .map((p: any) => p.text);
              if (thinkingParts.length > 0) {
                reasoning = thinkingParts.join('');
              }
            }

            // 3) additional_kwargs 中嵌套的 thinking 字段（部分 provider 透传）
            if (!reasoning && chunk.additional_kwargs?.thinking) {
              const tk = chunk.additional_kwargs.thinking;
              if (typeof tk === 'string') reasoning = tk;
              else if (typeof tk?.text === 'string') reasoning = tk.text;
            }

            if (typeof reasoning === 'string' && reasoning) {
              // 后端累加 reasoning，流式结束后回写 db，避免历史里只看到 "正在思考..." 占位符
              accumulatedReasoning += reasoning;
              send('reasoning', { agent: lastAgent, content: reasoning });
            }
            // 正文 token（过滤掉 Gemini thinking parts，避免思考内容重复出现在正文）
            const rawContent = data.chunk.content;
            let content = '';
            if (typeof rawContent === 'string') {
              content = rawContent;
            } else if (Array.isArray(rawContent)) {
              content = rawContent
                .filter((c: any) => c.thought !== true) // 排除 Gemini thinking parts
                .map((c: any) => c.text || '')
                .join('');
            }
            if (content) {
              if (!currentAnswerMsgId) {
                currentAnswerMsgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
              }
              send('token', { id: currentAnswerMsgId, agent: lastAgent, content });
            }
          }

          // LLM 生成结束：补发流中可能遗漏的推理内容，并通知前端思考阶段结束
          if (eventType === 'on_chat_model_end' && data?.output) {
            const output = data.output;
            // 从完整输出中尝试提取流式阶段可能遗漏的推理内容
            const akReasoning = output.additional_kwargs?.reasoning_content;
            const rmThinking = output.response_metadata?.thinking_content
              || output.response_metadata?.thinkingContent;
            const missedReasoning = (typeof akReasoning === 'string' ? akReasoning : '')
              || (typeof rmThinking === 'string' ? rmThinking : '');
            if (missedReasoning) {
              accumulatedReasoning += missedReasoning;
              send('reasoning', { agent: lastAgent, content: missedReasoning });
            }
            // 把累积的 reasoning 回写 db 中对应 thinking 消息，覆盖占位符；
            // 已有真实内容时跳过，避免覆盖；累积为空时把占位符清空
            if (currentThinkingMsgId) {
              const finalContent = accumulatedReasoning || '';
              await db.updateAgentMessageContent(projectId, currentThinkingMsgId, finalContent);
              currentThinkingMsgId = '';
              accumulatedReasoning = '';
            }
          }

          // 工具调用（delegate_* 委托类工具不展示为普通工具调用，改由 delegate 事件呈现）
          if (eventType === 'on_tool_start' && !(typeof name === 'string' && name.startsWith('delegate_'))) {
            const toolMsgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
            await db.appendAgentMessage(projectId, {
              id: toolMsgId,
              type: 'tool_call',
              agent: lastAgent,
              toolName: name,
              toolInput: data?.input || {},
              content: `调用工具：${name}`,
            });
            send('tool_call', {
              id: toolMsgId,
              agent: lastAgent,
              toolName: name,
              toolInput: data?.input || {},
            });
          }

          // 工具返回结果
          if (eventType === 'on_tool_end') {
            const output = typeof data?.output === 'string'
              ? data.output
              : JSON.stringify(data?.output || '');
            // 跳过 delegate 信号（内部路由，不展示给用户）
            if (!output.startsWith('[DELEGATE:')) {
              const resultMsgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
              const shortResult = output.slice(0, 800) + (output.length > 800 ? '...' : '');
              await db.appendAgentMessage(projectId, {
                id: resultMsgId,
                type: 'tool_result',
                agent: lastAgent,
                toolName: name,
                content: shortResult,
              });
              send('tool_result', {
                id: resultMsgId,
                agent: lastAgent,
                toolName: name,
                result: shortResult,
              });

              // 数据修改类工具执行完毕后，发送 data_changed 通知前端实时刷新
              const PROJECT_TOOLS = new Set([
                'update_project_field', 'auto_plan_book', 'generate_kernel',
                'generate_outline', 'add_anti_ai_rule', 'request_user_style',
                'add_volume', 'delete_volume', 'update_volume',
                'add_chapter', 'delete_chapter', 'update_chapter', 'move_outline_item',
              ]);
              const CHAPTER_TOOLS = new Set(['create_chapter', 'update_chapter', 'delete_chapter']);
              const CHARACTER_TOOLS = new Set(['create_character', 'update_character', 'delete_character']);
              const RULE_TOOLS = new Set(['create_world_rule', 'update_world_rule', 'delete_world_rule']);
              const STATE_TOOLS = new Set(['create_world_state', 'update_world_state', 'delete_world_state']);

              if (PROJECT_TOOLS.has(name) || CHAPTER_TOOLS.has(name) || CHARACTER_TOOLS.has(name) || RULE_TOOLS.has(name) || STATE_TOOLS.has(name)) {
                const refreshTypes: string[] = [];
                if (PROJECT_TOOLS.has(name)) refreshTypes.push('project');
                if (CHAPTER_TOOLS.has(name)) refreshTypes.push('chapters');
                if (CHARACTER_TOOLS.has(name)) refreshTypes.push('characters');
                if (RULE_TOOLS.has(name)) refreshTypes.push('worldRules');
                if (STATE_TOOLS.has(name)) refreshTypes.push('worldStates');
                send('data_changed', { toolName: name, refreshTypes });
              }
            } else {
              // delegate 发送路由事件
              const delegateTo = output.match(/\[DELEGATE:(\w+)\]/)?.[1] || '';
              if (delegateTo) {
                const delegateMsgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
                await db.appendAgentMessage(projectId, {
                  id: delegateMsgId,
                  type: 'delegate',
                  from: lastAgent,
                  fromLabel: AGENT_LABELS[lastAgent as keyof typeof AGENT_LABELS] || lastAgent,
                  to: delegateTo,
                  toLabel: AGENT_LABELS[delegateTo as keyof typeof AGENT_LABELS] || delegateTo,
                  content: `编导将任务交给${AGENT_LABELS[delegateTo as keyof typeof AGENT_LABELS] || delegateTo}处理`,
                });
                send('delegate', {
                  id: delegateMsgId,
                  from: lastAgent,
                  to: delegateTo,
                  toLabel: AGENT_LABELS[delegateTo as keyof typeof AGENT_LABELS] || delegateTo,
                });
              }
            }
          }

          // Agent 完成，捕获最终 AI 消息
          if (eventType === 'on_chain_end' && isAgentNode(name)) {
            const output = data?.output;
            if (output?.messages) {
              const lastMsg = output.messages[output.messages.length - 1];
              if (lastMsg && lastMsg._getType() === 'ai' && lastMsg.content) {
                const content = typeof lastMsg.content === 'string'
                  ? lastMsg.content
                  : lastMsg.content?.[0]?.text || '';
                if (content && !lastMsg.tool_calls?.length) {
                  if (!currentAnswerMsgId) {
                    currentAnswerMsgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
                  }
                  await db.appendAgentMessage(projectId, {
                    id: currentAnswerMsgId,
                    type: 'final_answer',
                    agent: name,
                    label: AGENT_LABELS[name as keyof typeof AGENT_LABELS] || name,
                    content,
                  });
                  send('final_answer', {
                    id: currentAnswerMsgId,
                    agent: name,
                    label: AGENT_LABELS[name as keyof typeof AGENT_LABELS] || name,
                    content,
                  });
                  currentAnswerMsgId = '';
                }
              }
            }
          }
        }

        // 检测图是否在 interrupt 处暂停（如锁定项删除/修改需用户确认）
        const snapshot = await graph.getState({ configurable: { thread_id: projectId } });
        const pending = ((snapshot?.tasks as any[]) || []).flatMap((t: any) => t.interrupts || []);
        if (pending.length > 0) {
          const payload = pending[0]?.value || {};
          const confirmMsgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
          // 根据 interrupt 类型生成不同的确认文案
          const isStyleRequest = payload.type === 'request_style';
          const confirmContent = isStyleRequest
            ? '请选择小说的题材和文风基调'
            : `需要你确认：${payload.action || '操作'}「${payload.target || ''}」（该项已锁定），是否继续？`;
          await db.appendAgentMessage(projectId, {
            id: confirmMsgId,
            type: 'confirm',
            content: confirmContent,
            toolInput: payload,
          });
          send('confirm', { id: confirmMsgId, payload });
        }
        // 无论是否有 interrupt，都发送 done 事件，确保前端刷新数据
        send('done', { message: '任务完成' });
      } catch (err: any) {
        console.error('Agent error:', err);
        const errorMsgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

        // 如果是 recursion limit 达到上限，检查点状态已保存，发 confirm 让用户一键续跑
        const isRecursionLimit = err?.message?.includes('Recursion limit') || err?.name === 'GraphRecursionError';
        if (isRecursionLimit) {
          try {
            await db.appendAgentMessage(projectId, {
              id: errorMsgId,
              type: 'confirm',
              content: '执行轮次已达上限，已完成的部分已保存。是否继续？',
              toolInput: { action: 'continue_limit', target: '轮次上限续跑' },
            });
          } catch (dbErr) {
            console.error('Failed to save confirm to DB:', dbErr);
          }
          send('confirm', {
            id: errorMsgId,
            payload: { action: 'continue_limit', target: '轮次上限续跑' },
          });
        } else {
          try {
            await db.appendAgentMessage(projectId, {
              id: errorMsgId,
              type: 'error',
              content: err.message || 'Agent 执行失败',
            });
          } catch (dbErr) {
            console.error('Failed to save error to DB:', dbErr);
          }
          const clientMessage = sanitizeErrorMessage(err.message);
          send('error', { 
            id: errorMsgId,
            message: clientMessage,
            tip: '提示：如果由于接口超时中断，此前已保存的章节正文、角色卡或大纲等内容已安全写入数据库，您可以直接在侧边栏刷新查看，或发送"请继续刚才未完成的工作"来续跑。'
          });
        }
        // 错误发生后也发送 done 事件，确保前端刷新已写入数据库的部分数据
        send('done', { message: '任务结束' });
      } finally {
        if (heartbeat) clearInterval(heartbeat);
        controller.close();
        // 释放该项目的并发计数
        const count = activeRequests.get(projectId) || 0;
        if (count <= 1) {
          activeRequests.delete(projectId);
        } else {
          activeRequests.set(projectId, count - 1);
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

function sanitizeErrorMessage(raw: string): string {
  if (!raw) return 'Agent 执行失败';
  // 提取 API 错误类型，隐藏具体 URL 和参数
  if (raw.includes('API error')) {
    const statusMatch = raw.match(/\((\d{3})\)/);
    const status = statusMatch ? statusMatch[1] : '';
    if (status === '429') return 'API 配额不足或请求过于频繁，请稍后重试';
    if (status === '401' || status === '403') return 'API Key 无效或权限不足，请检查设置';
    if (status === '408' || status === '504') return 'API 请求超时，请稍后重试';
    if (status.startsWith('5')) return 'AI 服务暂时不可用，请稍后重试';
    return `API 请求失败 (${status || '未知错误'})`;
  }
  if (raw.includes('Empty response')) return 'AI 返回了空内容，请重试';
  if (raw.includes('ECONNREFUSED') || raw.includes('ENOTFOUND')) return '无法连接 AI 服务，请检查网络和 API 配置';
  if (raw.includes('timeout') || raw.includes('Timeout')) return '请求超时，请稍后重试';
  // 兜底：截取前100字符，避免长错误信息泄露过多细节
  return raw.length > 100 ? raw.slice(0, 100) + '...' : raw;
}

function isAgentNode(name: string): boolean {
  return ['orchestrator', 'planner', 'lore_builder', 'writer', 'editor', 'continuity_keeper'].includes(name);
}

import { NextRequest } from 'next/server';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { Command } from '@langchain/langgraph';
import { buildNovelAgentGraph } from '@/lib/agent/graph';
import { AGENT_LABELS } from '@/lib/agent/prompts';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 分钟超时

export async function POST(request: NextRequest) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: '无效的请求体' }), { status: 400 });
  }

  const { projectId, message, apiKey, modelName, messageId, resume } = body;
  // resume：用户对锁定项确认弹窗的回传（'confirm'/'cancel' 等真值字符串），用于恢复被 interrupt 暂停的图
  const isResume = resume !== undefined && resume !== null && resume !== '';

  if (!projectId || (!message && !isResume)) {
    return new Response(JSON.stringify({ error: '缺少 projectId 或 message' }), { status: 400 });
  }

  // 校验项目存在，避免对不存在的项目空跑整个 Agent 图
  const project = await db.getProject(projectId);
  if (!project) {
    return new Response(JSON.stringify({ error: '项目不存在' }), { status: 404 });
  }

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
      const send = (eventType: string, data: Record<string, any>) => {
        const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(payload));
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

        // 初次请求才保存用户消息；resume（确认/取消）不是新的用户输入
        if (!isResume) {
          const userMsgId = messageId || `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
          await db.appendAgentMessage(projectId, {
            id: userMsgId,
            type: 'user',
            content: message,
          });
        }

        send('start', { message: isResume ? '继续执行...' : '多 Agent 系统启动...' });

        // resume 时用 Command 注入用户决定，恢复被 interrupt 暂停的图；否则按新消息正常启动
        const graphInput: any = isResume
          ? new Command({ resume })
          : { messages: [new HumanMessage(message)], projectId };

        // 流式执行图，监听每个事件
        const eventStream = await graph.streamEvents(
          graphInput,
          {
            version: 'v2',
            recursionLimit: 50,
            configurable: {
              thread_id: projectId,
              apiConfig: packedApiKey,
              modelName: modelName || 'gemini-2.5-flash',
            }
          }
        );

        let lastAgent = 'orchestrator';
        let currentAnswerMsgId = '';

        for await (const event of eventStream) {
          const { event: eventType, name, data } = event;

          // Agent 开始执行
          if (eventType === 'on_chain_start' && isAgentNode(name)) {
            const agent = name as keyof typeof AGENT_LABELS;
            lastAgent = agent;
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
            // 通知前端 agent 正在思考
            send('thinking', {
              id: thinkingMsgId,
              agent: lastAgent,
              label: AGENT_LABELS[lastAgent as keyof typeof AGENT_LABELS] || lastAgent,
            });
          }

          // LLM 流式 token 输出
          if (eventType === 'on_chat_model_stream' && data?.chunk?.content) {
            const content = typeof data.chunk.content === 'string'
              ? data.chunk.content
              : data.chunk.content?.[0]?.text || '';
            if (content) {
              if (!currentAnswerMsgId) {
                currentAnswerMsgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
              }
              send('token', { id: currentAnswerMsgId, agent: lastAgent, content });
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
          await db.appendAgentMessage(projectId, {
            id: confirmMsgId,
            type: 'confirm',
            content: `需要你确认：${payload.action || '操作'}「${payload.target || ''}」（该项已锁定）`,
            toolInput: payload,
          });
          send('confirm', { id: confirmMsgId, payload });
        } else {
          send('done', { message: '任务完成' });
        }
      } catch (err: any) {
        console.error('Agent error:', err);
        const errorMsgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        try {
          await db.appendAgentMessage(projectId, {
            id: errorMsgId,
            type: 'error',
            content: err.message || 'Agent 执行失败',
          });
        } catch (dbErr) {
          console.error('Failed to save error to DB:', dbErr);
        }
        send('error', { 
          id: errorMsgId,
          message: err.message || 'Agent 执行失败',
          tip: '提示：如果由于接口超时中断，此前已保存的章节正文、角色卡或大纲等内容已安全写入数据库，您可以直接在侧边栏刷新查看，或发送“请继续刚才未完成的工作”来续跑。'
        });
      } finally {
        if (heartbeat) clearInterval(heartbeat);
        controller.close();
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

function isAgentNode(name: string): boolean {
  return ['orchestrator', 'planner', 'lore_builder', 'writer', 'editor'].includes(name);
}

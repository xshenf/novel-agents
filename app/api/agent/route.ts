import { NextRequest } from 'next/server';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
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

  const { projectId, message, apiKey, modelName, history } = body;

  if (!projectId || !message) {
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

      try {
        // 构建图
        const graph = buildNovelAgentGraph(packedApiKey, modelName || 'gemini-2.5-flash', projectId);

        send('start', { message: '多 Agent 系统启动...' });

        // 处理历史对话
        const inputMessages = [];
        if (history && Array.isArray(history)) {
          for (const msg of history) {
            if (msg.role === 'user') {
              inputMessages.push(new HumanMessage(msg.content));
            } else if (msg.role === 'assistant') {
              inputMessages.push(new AIMessage(msg.content));
            }
          }
        }
        inputMessages.push(new HumanMessage(message));

        // 流式执行图，监听每个事件
        const eventStream = await graph.streamEvents(
          {
            messages: inputMessages,
            projectId,
          },
          {
            version: 'v2',
            recursionLimit: 50,
            configurable: {
              apiConfig: packedApiKey,
              modelName: modelName || 'gemini-2.5-flash',
            }
          }
        );

        let lastAgent = 'orchestrator';

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
            // 通知前端 agent 正在思考
            send('thinking', {
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
              send('token', { agent: lastAgent, content });
            }
          }

          // 工具调用（delegate_* 委托类工具不展示为普通工具调用，改由 delegate 事件呈现）
          if (eventType === 'on_tool_start' && !(typeof name === 'string' && name.startsWith('delegate_'))) {
            send('tool_call', {
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
              send('tool_result', {
                agent: lastAgent,
                toolName: name,
                result: output.slice(0, 800) + (output.length > 800 ? '...' : ''),
              });
            } else {
              // delegate 发送路由事件
              const delegateTo = output.match(/\[DELEGATE:(\w+)\]/)?.[1] || '';
              if (delegateTo) {
                send('delegate', {
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
                  send('final_answer', {
                    agent: name,
                    label: AGENT_LABELS[name as keyof typeof AGENT_LABELS] || name,
                    content,
                  });
                }
              }
            }
          }
        }

        send('done', { message: '任务完成' });
      } catch (err: any) {
        console.error('Agent error:', err);
        send('error', { 
          message: err.message || 'Agent 执行失败',
          tip: '提示：如果由于接口超时中断，此前已保存的章节正文、角色卡或大纲等内容已安全写入数据库，您可以直接在侧边栏刷新查看，或发送“请继续刚才未完成的工作”来续跑。'
        });
      } finally {
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

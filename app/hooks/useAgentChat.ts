import { useCallback, useState, useEffect, useRef } from 'react';
import { normalizeAgentMessages } from '@/app/lib/agentMessages';
import type { NovelStore } from '@/lib/store';
import { useNovelStore } from '@/lib/store';

export type AgentMsgType =
  | 'user'
  | 'thinking'
  | 'tool_call'
  | 'tool_result'
  | 'final_answer'
  | 'delegate'
  | 'system'
  | 'confirm'
  | 'error';

export interface AgentMessage {
  id: string;
  type: AgentMsgType;
  agent?: string;
  label?: string;
  content: string;
  toolName?: string;
  toolInput?: any;
  from?: string;
  fromLabel?: string;
  to?: string;
  toLabel?: string;
  streaming?: boolean;
  // 工具调用归一化字段（route.ts 在 SSE / DB 中都附上，前端优先读这些字段，
  // 缺失时 fallback 到前端 inferrer；旧数据兼容）
  purpose?: string;
  verb?: 'write' | 'update' | 'delete' | null;
  writtenLength?: number | null;
  filteredInput?: Record<string, unknown> | null;
  resultText?: string;
  // tool_call 专用：true 表示已发出调用但尚未收到结果（执行中 / 超时 / 失败前的转圈态）
  pending?: boolean;
  // tool_result 专用：true 表示是后端兜底合成的"超时/失败/未完成"结果（非真实工具返回）
  synthetic?: boolean;
  // tool_result 专用：透传对应 tool_call 的 id（route.ts 在 SSE 透传），
  // 配对时优先用此 id 替代"相邻 + 工具名相等"的 fallback 规则
  callId?: string;
}

export interface PendingConfirm {
  id?: string;
  payload: { type?: string; action?: string; target?: string; genres?: string[]; tones?: string[];[k: string]: unknown };
}

export type AgentChatApi = ReturnType<typeof useAgentChat>;

export function useAgentChat(store: NovelStore) {
  const [chatInput, setChatInput] = useState('');
  const [agentMessages, setAgentMessages] = useState<AgentMessage[]>([]);
  const [isAgentLoading, setIsAgentLoading] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
  // 用户是否停留在对话底部：true 时新消息自动跟随滚动，false 时尊重用户当前位置并显示"回到底部"按钮
  const [isAtBottom, setIsAtBottomState] = useState(true);
  const isAtBottomRef = useRef(true);
  const chatHistoryElRef = useRef<HTMLDivElement | null>(null);
  const agentBottomRef = useRef<HTMLDivElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const cancelAgentRequest = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
  };

  const msgId = () => `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  // 流式 token 每条都触发 setAgentMessages，localStorage 全量序列化写入需 debounce，
  // 否则长对话流式输出时每 token 一次 JSON.stringify(全部消息) 会明显卡顿
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 根据容器的 scrollTop / scrollHeight / clientHeight 判定是否贴近底部（允许 32px 容差）
  const updateIsAtBottom = useCallback(() => {
    const el = chatHistoryElRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = distance < 32;
    isAtBottomRef.current = atBottom;
    setIsAtBottomState(atBottom);
  }, []);

  // callback ref：把 AgentPanel 的 history 容器绑进来，自动注册/解绑 scroll 监听
  const setChatHistoryRef = useCallback((el: HTMLDivElement | null) => {
    const prev = chatHistoryElRef.current;
    if (prev && prev !== el) {
      prev.removeEventListener('scroll', updateIsAtBottom);
    }
    chatHistoryElRef.current = el;
    if (el) {
      el.addEventListener('scroll', updateIsAtBottom, { passive: true });
      // 内容可能比容器短（例如加载历史时），初始需要算一次
      updateIsAtBottom();
    }
  }, [updateIsAtBottom]);

  useEffect(() => {
    return () => {
      chatHistoryElRef.current?.removeEventListener('scroll', updateIsAtBottom);
    };
  }, [updateIsAtBottom]);

  // 用户主动点击的"回到底部"按钮：忽略 isAtBottom 状态强制滚到底
  const forceScrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    agentBottomRef.current?.scrollIntoView({ behavior });
    // 滚到位后再校准一次 isAtBottom，避免按钮残留显示
    requestAnimationFrame(updateIsAtBottom);
  }, [updateIsAtBottom]);

  // 仅在用户停留在底部时自动跟随新消息；用户上滑后保持当前位置，由 forceScrollToBottom 接管
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth', delay = 50) => {
    setTimeout(() => {
      if (!isAtBottomRef.current) return;
      agentBottomRef.current?.scrollIntoView({ behavior });
    }, delay);
  };

  const saveAndSetAgentMessages = (val: AgentMessage[] | ((prev: AgentMessage[]) => AgentMessage[])) => {
    setAgentMessages(prev => {
      const next = typeof val === 'function' ? val(prev) : val;
      if (typeof window !== 'undefined' && store.currentProject) {
        const pid = store.currentProject.id;
        if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
        persistTimerRef.current = setTimeout(() => {
          try {
            localStorage.setItem(`agent_messages_${pid}`, JSON.stringify(next));
          } catch { /* 存储满/隐私模式下忽略 */ }
        }, 300);
      }
      return next;
    });
  };

  // 清理瞬态标记：streaming（打字机光标）与 pending（工具转圈）。
  // 用于用户主动中断（abort）或本地异常（stall 超时/网络断）后，避免 UI 永久转圈
  const clearTransientFlags = () => {
    saveAndSetAgentMessages(prev => prev.map(m =>
      (m.streaming || (m.type === 'tool_call' && m.pending))
        ? { ...m, streaming: false, pending: false }
        : m
    ));
  };

  // 切换项目或初始化时从后台数据库读取对话历史，若失败或无数据则降级使用 localStorage
  useEffect(() => {
    let active = true;
    if (store.currentProject) {
      fetch(`/api/agent/history?projectId=${store.currentProject.id}`)
        .then(res => {
          if (!res.ok) throw new Error('Network response error');
          return res.json();
        })
        .then(data => {
          if (!active) return;
          if (Array.isArray(data) && data.length > 0) {
            // 历史消息：清洗 thinking 占位符、统一中英文 label
            setAgentMessages(normalizeAgentMessages(data));
          } else {
            const saved = localStorage.getItem(`agent_messages_${store.currentProject!.id}`);
            if (saved) {
              try {
                setAgentMessages(normalizeAgentMessages(JSON.parse(saved)));
              } catch {
                setAgentMessages([]);
              }
            } else {
              setAgentMessages([]);
            }
          }
          setTimeout(() => {
            if (agentBottomRef.current) {
              agentBottomRef.current.scrollIntoView({ behavior: 'auto' });
            }
          }, 100);
        })
        .catch(() => {
          if (!active) return;
          const saved = localStorage.getItem(`agent_messages_${store.currentProject!.id}`);
          if (saved) {
            try {
              setAgentMessages(normalizeAgentMessages(JSON.parse(saved)));
            } catch {
              setAgentMessages([]);
            }
          } else {
            setAgentMessages([]);
          }
        });
    } else {
      setAgentMessages([]);
    }
    return () => {
      active = false;
    };
  }, [store.currentProject?.id]); // M5 修复：只依赖 projectId，避免对象引用变化导致重复 fetch

  // 消费 agent SSE 流：初次发送与确认 resume 共用同一套解析逻辑，避免重复实现
  const processAgentStream = async (response: Response) => {
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let streamingMsgId: string | null = null;
    let lastThinkingMsgId: string | null = null;

    // 有推理内容的思考消息保留供用户展开查看，空的（模型未产出 reasoning）直接移除
    const finalizeThinking = () => {
      if (lastThinkingMsgId) {
        const tid = lastThinkingMsgId;
        saveAndSetAgentMessages(prev => {
          const msg = prev.find(m => m.id === tid);
          // 内容为空说明模型没有产出 reasoning，删掉占位消息避免永远显示"思考中..."
          if (!msg || !(msg.content || '').trim()) {
            return prev.filter(m => m.id !== tid);
          }
          return prev;
        });
        lastThinkingMsgId = null;
      }
    };

    const stopStreaming = () => {
      if (streamingMsgId) {
        const sid = streamingMsgId;
        saveAndSetAgentMessages(prev => prev.map(m => m.id === sid ? { ...m, streaming: false } : m));
        streamingMsgId = null;
      }
    };

    // 兜底：扫描仍处于 pending 的 tool_call，要么"停转"（pending=false）、
    // 要么追加"未收到结果"标记。后端 60s 超时会推 synthetic tool_result，所以这里
    // 只需给前端停转；不重复插入 result，避免出现双配对。
    // 后端 timeout / closeAllPendingToolCalls 没补上的极端情况（SSE 丢包/异常中断）才走
    // appendFallback 路径补一个 synthetic tool_result。
    const finalizePendingToolCalls = (reason: string) => {
      saveAndSetAgentMessages(prev => {
        const pendingCalls = prev.filter(m => m.type === 'tool_call' && m.pending);
        if (pendingCalls.length === 0) return prev;
        const next = prev.map(m => (m.type === 'tool_call' && m.pending) ? { ...m, pending: false } : m);
        // 仅当 lastAgent 流真的中断（无 done / 无后续 tool_result）时补一个 fallback
        // —— callId 精确匹配优先，旧数据/丢 callId 时退化为"存在同名真实结果"即视为已配对
        const stillUnpaired = pendingCalls.filter(c =>
          !next.some(m => m.type === 'tool_result' && (
            (m as any).callId === c.id ||
            (!m.synthetic && m.toolName === c.toolName)
          ))
        );
        if (stillUnpaired.length === 0) return next;
        return [
          ...next,
          ...stillUnpaired.map(c => ({
            id: msgId(),
            type: 'tool_result' as const,
            agent: c.agent,
            toolName: c.toolName,
            content: `工具「${c.toolName}」执行未完成：${reason}`,
            purpose: c.purpose,
            verb: c.verb,
            writtenLength: c.writtenLength,
            filteredInput: c.filteredInput,
            resultText: `工具「${c.toolName}」执行未完成：${reason}`,
            synthetic: true,
            callId: c.id,  // 透传 callId 让 messagePairing 也能配上
          })),
        ];
      });
    };

    while (true) {
      // 防止 LLM API 不通时无限挂起：若 180 秒内未收到任何数据（含心跳），主动中断
      let stallTimer: ReturnType<typeof setTimeout> | null = null;
      const stallTimeout = new Promise<never>((_, reject) => {
        stallTimer = setTimeout(() => reject(new Error('连接超时：长时间未收到服务端响应')), 180_000);
      });
      try {
        const { done, value } = await Promise.race([reader.read(), stallTimeout]);
        if (stallTimer) clearTimeout(stallTimer);
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
      } catch (e: any) {
        if (stallTimer) clearTimeout(stallTimer);
        throw e; // 向上层抛出，由 handleSendAgentMessage 的 catch 处理
      }

      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';

      for (const chunk of lines) {
        const eIdx = chunk.indexOf('\n');
        if (eIdx === -1 || !chunk.startsWith('event: ')) continue;
        const eventType = chunk.slice(7, eIdx);
        const dataLine = chunk.slice(eIdx + 1);
        const dataStr = dataLine.startsWith('data:') ? dataLine.slice(5).trimStart() : '';
        if (!eventType || !dataStr) continue;
        let data: any = {};
        try { data = JSON.parse(dataStr); } catch { continue; }

        switch (eventType) {
          case 'thinking':
            stopStreaming();
            const thinkingId = data.id || msgId();
            lastThinkingMsgId = thinkingId;
            saveAndSetAgentMessages(prev => [...prev, {
              id: thinkingId,
              type: 'thinking',
              agent: data.agent,
              label: data.label,
              content: '',
            }]);
            scrollToBottom('smooth');
            break;

          case 'reasoning':
            // 模型的推理/思考过程流式追加到最近一条 thinking 消息
            if (lastThinkingMsgId) {
              const tid = lastThinkingMsgId;
              saveAndSetAgentMessages(prev => prev.map(m =>
                m.id === tid ? { ...m, content: (m.content || '') + (data.content || '') } : m
              ));
            }
            scrollToBottom('auto', 20);
            break;

          case 'token':
            finalizeThinking();
            if (!streamingMsgId) {
              const newId = data.id || msgId();
              streamingMsgId = newId;
              saveAndSetAgentMessages(prev => [...prev, {
                id: newId,
                type: 'final_answer',
                agent: data.agent,
                label: data.label || data.agent,
                content: data.content,
                streaming: true,
              }]);
            } else {
              const sid = streamingMsgId;
              saveAndSetAgentMessages(prev => prev.map(m =>
                m.id === sid ? { ...m, content: m.content + data.content } : m
              ));
            }
            scrollToBottom('auto', 20);
            break;

          case 'tool_call':
            stopStreaming();
            finalizeThinking();
            saveAndSetAgentMessages(prev => [...prev, {
              id: data.id || msgId(),
              type: 'tool_call',
              agent: data.agent,
              label: data.label,
              toolName: data.toolName,
              toolInput: data.toolInput,
              content: `调用工具：${data.toolName}`,
              // 归一化字段：route.ts 已算好，渲染端优先读这些
              purpose: data.purpose,
              verb: data.verb,
              writtenLength: data.writtenLength,
              filteredInput: data.filteredInput,
              // 标记为 pending：执行中（转圈）。后端 60 秒未返回 on_tool_end 会自动补
              // 合成 tool_result 配对；如果前端意外断连则在 done / abort 时本地合成。
              pending: true,
            }]);
            scrollToBottom('smooth');
            break;

          case 'tool_result': {
            // 用 callId 精确配对（route.ts 在 on_tool_end / closePendingToolCall 都把
            // 对应 tool_call 的 id 透传）；callId 缺失（旧版本/丢包）时回退为
            // "最早一条同名且 pending 的 tool_call"，确保转圈态总能被清除
            const resultId = data.id || msgId();
            saveAndSetAgentMessages(prev => {
              let matchedId: string | undefined =
                data.callId && prev.some(m => m.id === data.callId) ? data.callId : undefined;
              if (!matchedId) {
                const fallback = prev.find(m => m.type === 'tool_call' && m.pending && m.toolName === data.toolName);
                if (fallback) matchedId = fallback.id;
              }
              const next = prev.map(m => (matchedId && m.id === matchedId) ? { ...m, pending: false } : m);
              return [...next, {
                id: resultId,
                type: 'tool_result',
                agent: data.agent,
                toolName: data.toolName,
                content: data.result,
                // 归一化字段：route.ts 已算好
                purpose: data.purpose,
                verb: data.verb,
                writtenLength: data.writtenLength,
                filteredInput: data.filteredInput,
                resultText: data.resultText,
                synthetic: !!data.synthetic,
                // 透传配对到的 callId：AgentPanel / messagePairing 配对时优先用此 id
                callId: matchedId,
              }];
            });
            scrollToBottom('smooth');
            break;
          }

          case 'delegate':
            stopStreaming();
            finalizeThinking();
            saveAndSetAgentMessages(prev => [...prev, {
              id: data.id || msgId(),
              type: 'delegate',
              from: data.from,
              fromLabel: data.fromLabel,
              to: data.to,
              toLabel: data.toLabel,
              content: `编导将任务交给${data.toLabel}处理`,
            }]);
            scrollToBottom('smooth');
            break;

          case 'final_answer':
            finalizeThinking();
            if (streamingMsgId) {
              // Content was already streamed via token events — just stop streaming
              const sid = streamingMsgId;
              streamingMsgId = null;
              saveAndSetAgentMessages(prev => prev.map(m =>
                m.id === sid ? { ...m, streaming: false } : m
              ));
            } else {
              saveAndSetAgentMessages(prev => [...prev, {
                id: data.id || msgId(),
                type: 'final_answer',
                agent: data.agent,
                label: data.label,
                content: data.content,
                streaming: false,
              }]);
            }
            scrollToBottom('smooth');
            break;

          case 'confirm': {
            stopStreaming();
            finalizeThinking();
            const p = data.payload || {};
            const isStyleRequest = p.type === 'request_style';
            saveAndSetAgentMessages(prev => [...prev, {
              id: data.id || msgId(),
              type: 'confirm',
              content: isStyleRequest
                ? '请选择小说的题材和文风基调'
                : `需要你确认：${p.action || '操作'}「${p.target || ''}」（该项已锁定），是否继续？`,
              toolInput: p,
            }]);
            setPendingConfirm({ id: data.id, payload: p });
            scrollToBottom('smooth');
            break;
          }

          case 'data_changed': {
            // 专家工具写入数据后实时刷新对应的前端数据
            const refreshTypes: string[] = data.refreshTypes || [];
            const changedProject = useNovelStore.getState().currentProject;
            if (changedProject && refreshTypes.length > 0) {
              const pid = changedProject.id;
              const tasks: Promise<void>[] = [];
              if (refreshTypes.includes('project')) tasks.push(store.refreshProject(pid));
              if (refreshTypes.includes('chapters')) tasks.push(store.fetchChapters(pid));
              if (refreshTypes.includes('characters')) tasks.push(store.fetchCharacters(pid));
              if (refreshTypes.includes('worldRules')) tasks.push(store.fetchWorldRules(pid));
              if (refreshTypes.includes('worldStates')) tasks.push(store.fetchWorldStates(pid));
              Promise.all(tasks).catch(() => {});
            }
            break;
          }

          case 'done':
            stopStreaming();
            finalizeThinking();
            // 兜底：扫描是否有"pending=true"还没收到结果的 tool_call（后端 60s 超时
            // 兜底会推 synthetic tool_result；这里只在 SSE 真的丢了结果时补一条。
            // 不重复造轮子，只标记 pending=false 让它停转）。
            finalizePendingToolCalls('agent 流已结束');
            // 数据刷新统一在 handleSendAgentMessage / resolveConfirm 的 finally 做，
            // 此处不再重复全量刷新（data_changed 事件已覆盖流中的实时刷新）
            break;

          case 'error':
            stopStreaming();
            finalizeThinking();
            finalizePendingToolCalls(data.message || 'agent 异常');
            saveAndSetAgentMessages(prev => [...prev, {
              id: data.id || msgId(),
              type: 'error',
              content: data.message || 'Agent 执行出错',
            }]);
            scrollToBottom('smooth');
            break;
        }
      }
    }
  };

  // 组装当前模型配置请求体的公共部分
  // 多模型模式下 systemInstruction 必须打入 JSON 内，否则 route.ts 检测到 apiKey 已是 JSON 后不再重新打包，
  // 导致外部独立传入的 systemInstruction 被丢弃
  const buildRequestBase = () => ({
    apiKey: JSON.stringify({
      models: store.models,
      agentModelBindings: store.agentModelBindings,
      agentOverrides: store.agentOverrides,
      systemInstruction: store.systemInstruction,
    }),
    modelName: store.modelName,
  });

  const handleSendAgentMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !store.currentProject) return;

    const userMsg = chatInput;
    const userMsgId = msgId();
    saveAndSetAgentMessages(prev => [...prev, {
      id: userMsgId,
      type: 'user',
      content: userMsg,
    }]);
    setChatInput('');
    setPendingConfirm(null);
    setIsAgentLoading(true);

    try {
      const controller = new AbortController();
      abortControllerRef.current = controller;
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          projectId: store.currentProject.id,
          message: userMsg,
          messageId: userMsgId,
          ...buildRequestBase(),
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error('Agent 接口连接失败');
      }
      await processAgentStream(response);
    } catch (err: any) {
      // 中断（用户主动停止）或本地异常（stall 超时/网络断）：清理 streaming 光标与
      // pending 转圈，避免残留状态被 localStorage 持久化后永久转圈
      clearTransientFlags();
      if (err.name === 'AbortError') return;
      saveAndSetAgentMessages(prev => [...prev, {
        id: `err_${Date.now()}`,
        type: 'error',
        content: err.message || '连接 Agent 失败，请检查网络和 API Key',
      }]);
    } finally {
      abortControllerRef.current = null;
      setIsAgentLoading(false);
      scrollToBottom('smooth', 100);
      // Agent 执行完毕后刷新项目数据，确保 DB 写入已在前端体现
      // 使用 getState() 获取最新 currentProject，避免闭包引用过期
      const latestProject = useNovelStore.getState().currentProject;
      if (latestProject) {
        const pid = latestProject.id;
        await Promise.all([
          store.refreshProject(pid),
          store.fetchChapters(pid),
          store.fetchCharacters(pid),
          store.fetchWorldRules(pid),
          store.fetchWorldStates(pid),
        ]).catch(() => {});
      }
    }
  };

  // 用户对锁定项确认弹窗的回传：'confirm' 继续 / 'cancel' 取消，经 resume 恢复被 interrupt 暂停的图
  // 'continue_limit'：recursion limit 达上限后，以新消息续跑
  // { genre, tone }：风格基调选择，通过 resume 传递回 agent
  const resolveConfirm = async (decision: 'confirm' | 'cancel' | 'continue_limit' | { genre: string; tone: string }) => {
    if (!store.currentProject || !pendingConfirm) return;
    setPendingConfirm(null);
    setIsAgentLoading(true);
    try {
      const controller = new AbortController();
      abortControllerRef.current = controller;
      let resumeValue: any = decision;
      if (decision === 'continue_limit') {
        resumeValue = 'continue_limit';
      } else if (typeof decision === 'object') {
        resumeValue = decision;
      }
      const body = JSON.stringify({
        projectId: store.currentProject.id,
        resume: resumeValue,
        ...buildRequestBase(),
      });
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body,
      });
      if (!response.ok || !response.body) {
        throw new Error('Agent 接口连接失败');
      }
      await processAgentStream(response);
    } catch (err: any) {
      clearTransientFlags();
      if (err.name === 'AbortError') return;
      saveAndSetAgentMessages(prev => [...prev, {
        id: `err_${Date.now()}`,
        type: 'error',
        content: err.message || '恢复执行失败',
      }]);
    } finally {
      abortControllerRef.current = null;
      setIsAgentLoading(false);
      scrollToBottom('smooth', 100);
      if (store.currentProject) {
        const pid = store.currentProject.id;
        Promise.all([
          store.refreshProject(pid),
          store.fetchChapters(pid),
          store.fetchCharacters(pid),
          store.fetchWorldRules(pid),
          store.fetchWorldStates(pid),
        ]).catch(() => {});
      }
    }
  };

  return {
    chatInput,
    setChatInput,
    agentMessages,
    setAgentMessages,
    saveAndSetAgentMessages,
    isAgentLoading,
    agentBottomRef,
    setChatHistoryRef,
    isAtBottom,
    forceScrollToBottom,
    handleSendAgentMessage,
    pendingConfirm,
    resolveConfirm,
    cancelAgentRequest,
  };
}

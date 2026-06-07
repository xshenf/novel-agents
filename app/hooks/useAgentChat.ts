import { useState, useEffect, useRef } from 'react';
import type { NovelStore } from '@/lib/store';

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
  const agentBottomRef = useRef<HTMLDivElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const cancelAgentRequest = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
  };

  const msgId = () => `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth', delay = 50) => {
    setTimeout(() => agentBottomRef.current?.scrollIntoView({ behavior }), delay);
  };

  const saveAndSetAgentMessages = (val: AgentMessage[] | ((prev: AgentMessage[]) => AgentMessage[])) => {
    setAgentMessages(prev => {
      const next = typeof val === 'function' ? val(prev) : val;
      if (typeof window !== 'undefined' && store.currentProject) {
        localStorage.setItem(`agent_messages_${store.currentProject.id}`, JSON.stringify(next));
      }
      return next;
    });
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
            setAgentMessages(data);
          } else {
            const saved = localStorage.getItem(`agent_messages_${store.currentProject!.id}`);
            if (saved) {
              try {
                setAgentMessages(JSON.parse(saved));
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
              setAgentMessages(JSON.parse(saved));
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
  }, [store.currentProject?.id, store.currentProject]);

  // 消费 agent SSE 流：初次发送与确认 resume 共用同一套解析逻辑，避免重复实现
  const processAgentStream = async (response: Response) => {
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let streamingMsgId: string | null = null;
    let lastThinkingMsgId: string | null = null;

    const removeLastThinking = () => {
      if (lastThinkingMsgId) {
        const tid = lastThinkingMsgId;
        saveAndSetAgentMessages(prev => prev.filter(m => m.id !== tid));
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

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

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
            removeLastThinking();
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
            removeLastThinking();
            saveAndSetAgentMessages(prev => [...prev, {
              id: data.id || msgId(),
              type: 'tool_call',
              agent: data.agent,
              label: data.label,
              toolName: data.toolName,
              toolInput: data.toolInput,
              content: `调用工具：${data.toolName}`,
            }]);
            scrollToBottom('smooth');
            break;

          case 'tool_result':
            saveAndSetAgentMessages(prev => [...prev, {
              id: data.id || msgId(),
              type: 'tool_result',
              agent: data.agent,
              toolName: data.toolName,
              content: data.result,
            }]);
            scrollToBottom('smooth');
            break;

          case 'delegate':
            stopStreaming();
            removeLastThinking();
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
            removeLastThinking();
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
            removeLastThinking();
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

          case 'done':
            stopStreaming();
            removeLastThinking();
            if (store.currentProject) {
              store.refreshProject(store.currentProject.id);
              store.fetchCharacters(store.currentProject.id);
              store.fetchWorldRules(store.currentProject.id);
              store.fetchWorldStates(store.currentProject.id);
              store.fetchChapters(store.currentProject.id);
            }
            break;

          case 'error':
            stopStreaming();
            removeLastThinking();
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
    handleSendAgentMessage,
    pendingConfirm,
    resolveConfirm,
    cancelAgentRequest,
  };
}

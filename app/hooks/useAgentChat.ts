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

export type AgentChatApi = ReturnType<typeof useAgentChat>;

export function useAgentChat(store: NovelStore) {
  const [chatInput, setChatInput] = useState('');
  const [agentMessages, setAgentMessages] = useState<AgentMessage[]>([]);
  const [isAgentLoading, setIsAgentLoading] = useState(false);
  const agentBottomRef = useRef<HTMLDivElement | null>(null);

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
              } catch (_) {
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
            } catch (_) {
              setAgentMessages([]);
            }
          } else {
            setAgentMessages([]);
          }
          setTimeout(() => {
            if (agentBottomRef.current) {
              agentBottomRef.current.scrollIntoView({ behavior: 'auto' });
            }
          }, 100);
        });
    } else {
      setAgentMessages([]);
    }
    return () => {
      active = false;
    };
  }, [store.currentProject?.id]);

  // 智能体消息直接由后端即时持久化到数据库，因此前端无需定时同步对话历史。

  const handleSendAgentMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !store.currentProject) return;

    const userMsg = chatInput;
    const msgId = () => `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const userMsgId = msgId();
    saveAndSetAgentMessages(prev => [...prev, {
      id: userMsgId,
      type: 'user',
      content: userMsg,
    }]);
    setChatInput('');
    setIsAgentLoading(true);

    try {
      const multiModelConfig = JSON.stringify({
        models: store.models,
        agentModelBindings: store.agentModelBindings,
        agentOverrides: store.agentOverrides,
      });

      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: store.currentProject.id,
          message: userMsg,
          messageId: userMsgId,
          apiKey: multiModelConfig,
          modelName: store.modelName,
          systemInstruction: store.systemInstruction,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error('Agent 接口连接失败');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      // streaming token accumulator
      let streamingMsgId: string | null = null;

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
          // 取 event 行之后的内容并剥离 "data:" 前缀（兼容有无空格，修正原先 +6 的偏移）
          const dataLine = chunk.slice(eIdx + 1);
          const dataStr = dataLine.startsWith('data:') ? dataLine.slice(5).trimStart() : '';
          if (!eventType || !dataStr) continue;
          let data: any = {};
          try { data = JSON.parse(dataStr); } catch { continue; }

          switch (eventType) {
            case 'thinking':
              if (streamingMsgId) {
                const sid = streamingMsgId;
                saveAndSetAgentMessages(prev => prev.map(m =>
                  m.id === sid ? { ...m, streaming: false } : m
                ));
                streamingMsgId = null;
              }
              saveAndSetAgentMessages(prev => [...prev, {
                id: data.id || msgId(),
                type: 'thinking',
                agent: data.agent,
                label: data.label,
                content: '正在思考...',
              }]);
              setTimeout(() => {
                if (agentBottomRef.current) {
                  agentBottomRef.current.scrollIntoView({ behavior: 'smooth' });
                }
              }, 50);
              break;

            case 'token':
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
              setTimeout(() => {
                if (agentBottomRef.current) {
                  agentBottomRef.current.scrollIntoView({ behavior: 'auto' });
                }
              }, 20);
              break;

            case 'tool_call':
              if (streamingMsgId) {
                const sid = streamingMsgId;
                saveAndSetAgentMessages(prev => prev.map(m =>
                  m.id === sid ? { ...m, streaming: false } : m
                ));
                streamingMsgId = null;
              }
              saveAndSetAgentMessages(prev => [...prev, {
                id: data.id || msgId(),
                type: 'tool_call',
                agent: data.agent,
                label: data.label,
                toolName: data.toolName,
                toolInput: data.toolInput,
                content: `调用工具：${data.toolName}`,
              }]);
              setTimeout(() => {
                if (agentBottomRef.current) {
                  agentBottomRef.current.scrollIntoView({ behavior: 'smooth' });
                }
              }, 50);
              break;

            case 'tool_result':
              saveAndSetAgentMessages(prev => [...prev, {
                id: data.id || msgId(),
                type: 'tool_result',
                agent: data.agent,
                toolName: data.toolName,
                content: data.result,
              }]);
              setTimeout(() => {
                if (agentBottomRef.current) {
                  agentBottomRef.current.scrollIntoView({ behavior: 'smooth' });
                }
              }, 50);
              break;

            case 'delegate':
              if (streamingMsgId) {
                const sid = streamingMsgId;
                saveAndSetAgentMessages(prev => prev.map(m =>
                  m.id === sid ? { ...m, streaming: false } : m
                ));
                streamingMsgId = null;
              }
              saveAndSetAgentMessages(prev => [...prev, {
                id: data.id || msgId(),
                type: 'delegate',
                from: data.from,
                fromLabel: data.fromLabel,
                to: data.to,
                toLabel: data.toLabel,
                content: `编导将任务交给${data.toLabel}处理`,
              }]);
              setTimeout(() => {
                if (agentBottomRef.current) {
                  agentBottomRef.current.scrollIntoView({ behavior: 'smooth' });
                }
              }, 50);
              break;

            case 'final_answer':
              if (streamingMsgId) {
                const sid = streamingMsgId;
                streamingMsgId = null;
                saveAndSetAgentMessages(prev => prev.map(m =>
                  m.id === sid ? { ...m, content: data.content, streaming: false } : m
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
              if (store.currentProject) {
                store.fetchCharacters(store.currentProject.id);
                store.fetchWorldRules(store.currentProject.id);
                store.fetchChapters(store.currentProject.id);
              }
              setTimeout(() => {
                if (agentBottomRef.current) {
                  agentBottomRef.current.scrollIntoView({ behavior: 'smooth' });
                }
              }, 50);
              break;

            case 'done':
              if (streamingMsgId) {
                const sid = streamingMsgId;
                saveAndSetAgentMessages(prev => prev.map(m =>
                  m.id === sid ? { ...m, streaming: false } : m
                ));
                streamingMsgId = null;
              }
              if (store.currentProject) {
                store.fetchCharacters(store.currentProject.id);
                store.fetchWorldRules(store.currentProject.id);
                store.fetchChapters(store.currentProject.id);
              }
              break;

            case 'error':
              if (streamingMsgId) {
                const sid = streamingMsgId;
                saveAndSetAgentMessages(prev => prev.map(m =>
                  m.id === sid ? { ...m, streaming: false } : m
                ));
                streamingMsgId = null;
              }
              saveAndSetAgentMessages(prev => [...prev, {
                id: data.id || msgId(),
                type: 'error',
                content: data.message || 'Agent 执行出错',
              }]);
              setTimeout(() => {
                if (agentBottomRef.current) {
                  agentBottomRef.current.scrollIntoView({ behavior: 'smooth' });
                }
              }, 50);
              break;
          }
        }
      }
    } catch (err: any) {
      saveAndSetAgentMessages(prev => [...prev, {
        id: `err_${Date.now()}`,
        type: 'error',
        content: err.message || '连接 Agent 失败，请检查网络和 API Key',
      }]);
    } finally {
      setIsAgentLoading(false);
      // scroll to bottom
      setTimeout(() => agentBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
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
  };
}

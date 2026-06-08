'use client';

// 工具调用 + 结果 合并卡：把相邻的 tool_call 与 tool_result 渲染为同一张气泡。
// 折叠态单行 header：左"用途" + 右"已写入/更新/删除 N 字"摘要胶囊；展开态才显示参数与完整结果。
// 内部 toolName 不暴露在 header 上，避免重复/泄露实现细节。

import { ChevronDown, ChevronRight, Loader2, AlertTriangle } from 'lucide-react';
import { getToolPurpose } from '../lib/toolPurpose';
import { getWrittenLength, formatWrittenLength, getActionVerb } from '../lib/toolSummary';
import { coerceToolInput, extractToolMessageContent } from '../lib/toolInputShape';

// 在 params 块里需要过滤掉的"内部字段"（langchain / 工具调用链路上自动注入，对用户无意义）
const INTERNAL_PARAM_KEYS = new Set([
  'projectId', 'id', 'type', 'field', 'numChapters', 'volumeId', 'characterId', 'chapterId',
]);

// 候选"内容字段"在前排，方便快速看到本次调用的关键内容
const CONTENT_PARAM_KEYS = ['content', 'value', 'text', 'summary', 'description', 'bio', 'name', 'title', 'task'];

// 顶层已归一化字段（route.ts 在 SSE / DB 中都附上）—— 渲染端只读这个，缺失时再走 inferrer
interface NormalizedToolFields {
  purpose?: string | null;
  writtenLength?: number | null;
  verb?: 'write' | 'update' | 'delete' | null;
  filteredInput?: Record<string, unknown> | null;
  resultText?: string | null;
}

export function ToolPairBubble({
  toolName, toolInput, toolResult, isExpanded, onToggle,
  normalized, pending, synthetic,
}: {
  toolName: string;
  toolInput: unknown;
  toolResult: string;
  isExpanded: boolean;
  onToggle: () => void;
  // 顶层已算好的归一化字段，optional —— 存在时优先用，缺失时走 inferrer 兜底（兼容旧数据）
  normalized?: NormalizedToolFields | null;
  // pending=true：call 收到但 result 还没到（执行中）。显示转圈 + "执行中"提示
  // synthetic=true：result 是后端兜底合成的"超时/失败"文案（非真实工具返回）
  pending?: boolean;
  synthetic?: boolean;
}) {
  // ── 优先用顶层归一化字段 ──
  const purpose = normalized?.purpose || getToolPurpose(toolName, toolInput);
  const verb = (normalized?.verb ?? null) as ReturnType<typeof getActionVerb> | null;
  const writtenLength = normalized?.writtenLength != null
    ? normalized.writtenLength
    : getWrittenLength(toolName, toolInput, toolResult);
  const writtenLabel = formatWrittenLength(writtenLength, verb);
  const resultText = normalized?.resultText || extractToolMessageContent(toolResult);
  // 优先用 filteredInput（已过滤内部字段）；缺失时回退到 coerceToolInput
  const inputObj: Record<string, unknown> | null = normalized?.filteredInput
    ? normalized.filteredInput
    : (() => {
        const norm = coerceToolInput(toolInput);
        if (!norm || typeof norm !== 'object') return null;
        return norm as Record<string, unknown>;
      })();
  const visibleEntries: [string, unknown][] = inputObj
    ? Object.entries(inputObj).filter(([k]) => !INTERNAL_PARAM_KEYS.has(k))
    : [];
  const hasParams = visibleEntries.length > 0;
  return (
    <div className={`agent-bubble agent-bubble-tool-pair${pending ? ' is-pending' : ''}${synthetic ? ' is-synthetic' : ''}`}>
      <div
        className="agent-tool-pair-header"
        onClick={onToggle}
      >
        {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <span
          className="agent-tool-pair-purpose"
          title={purpose}
        >
          {purpose}
        </span>
        {pending ? (
          // 还没收到结果：转圈 + "执行中"
          <span className="agent-tool-pair-pending" title="工具调用执行中">
            <Loader2 size={12} className="agent-tool-spin" />
            <span>执行中</span>
          </span>
        ) : writtenLabel ? (
          <span className="agent-tool-pair-written" title="本次写入内容的字符数">
            {writtenLabel}
          </span>
        ) : null}
        {synthetic && (
          // 兜底合成（超时 / 失败 / 异常中断）的结果：加角标提示非真实返回
          <span className="agent-tool-pair-synthetic" title="此结果为系统自动补全（超时/失败/中断）">
            <AlertTriangle size={11} />
          </span>
        )}
      </div>
      {isExpanded && (
        <>
          {hasParams && (
            <div className="agent-tool-params" style={{ marginTop: '6px' }}>
              {/* 关键内容字段优先：content/value/name/title 等排在最上 */}
              {[...visibleEntries].sort((a, b) => {
                const ai = CONTENT_PARAM_KEYS.indexOf(a[0]);
                const bi = CONTENT_PARAM_KEYS.indexOf(b[0]);
                if (ai === -1 && bi === -1) return 0;
                if (ai === -1) return 1;
                if (bi === -1) return -1;
                return ai - bi;
              }).map(([k, v]) => {
                const vStr: string = typeof v === 'object' && v !== null
                  ? JSON.stringify(v as Record<string, unknown>)
                  : String(v as string | number | boolean | bigint | symbol | null | undefined);
                return (
                  <div key={k} className="agent-tool-param">
                    <em>{k}:</em> {vStr}
                  </div>
                );
              })}
            </div>
          )}
          <pre style={{
            margin: '6px 0 0',
            padding: '8px 10px',
            background: 'rgba(0,0,0,0.25)',
            borderRadius: '6px',
            whiteSpace: 'pre-wrap',
            maxHeight: '200px',
            overflowY: 'auto',
            fontSize: '11px',
            fontFamily: 'monospace',
            color: pending ? 'var(--text-mid, #888)' : 'var(--text-dark)',
          }}>
            {pending ? '（工具调用执行中...）' : (resultText || '（无返回内容）')}
          </pre>
        </>
      )}
    </div>
  );
}

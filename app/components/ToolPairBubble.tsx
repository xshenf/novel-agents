'use client';

import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { getToolPurpose } from '../lib/toolPurpose';
import { getWrittenLength, formatWrittenLength, getActionVerb } from '../lib/toolSummary';
import { coerceToolInput, extractToolMessageContent } from '../lib/toolInputShape';

interface ToolPairBubbleProps {
  toolName: string;
  toolInput: unknown;
  toolResult: string;
  isExpanded: boolean;
  onToggle: () => void;
  /** 归一化后的字段（由 normalizeToolPayload 产出，优先使用） */
  normalized?: {
    purpose?: string;
    writtenLength?: number | null;
    verb?: string | null;
    filteredInput?: Record<string, unknown> | null;
    resultText?: string;
  };
  /** 是否仍在等待 tool_result 返回 */
  pending?: boolean;
  /** 是否为合成的占位 tool_result（SSE 链路补齐配对） */
  synthetic?: boolean;
}

/** 工具调用 + 结果合并卡：把 tool_call 和 tool_result 渲染为同一张气泡 */
export function ToolPairBubble({
  toolName, toolInput, toolResult, isExpanded, onToggle,
  normalized, pending, synthetic,
}: ToolPairBubbleProps) {
  const normInput = coerceToolInput(toolInput);
  const hasParams = normInput && typeof normInput === 'object' && Object.keys(normInput).length > 0;

  // 优先使用归一化字段，否则实时推断
  const purpose = normalized?.purpose || getToolPurpose(toolName, normInput);
  const verb = normalized?.verb ?? getActionVerb(toolName);
  const writtenLength = normalized?.writtenLength != null
    ? normalized.writtenLength
    : getWrittenLength(toolName, normInput, toolResult);
  const writtenLabel = formatWrittenLength(writtenLength, verb as 'write' | 'update' | 'delete' | null);
  const displayInput = normalized?.filteredInput || normInput;
  const resultText = normalized?.resultText || extractToolMessageContent(toolResult);

  return (
    <div className="agent-bubble agent-bubble-tool-pair">
      <div
        className="agent-tool-pair-header"
        onClick={onToggle}
      >
        {pending ? (
          <Loader2 size={12} className="animate-spin" style={{ color: '#a5b4fc' }} />
        ) : isExpanded ? (
          <ChevronDown size={12} />
        ) : (
          <ChevronRight size={12} />
        )}
        <span
          className="agent-tool-pair-purpose"
          title={purpose}
        >
          {purpose}
        </span>
        {writtenLabel && (
          <span className="agent-tool-pair-written" title="本次写入内容的字符数">
            {writtenLabel}
          </span>
        )}
        {synthetic && (
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: '4px' }}>
            (超时)
          </span>
        )}
      </div>
      {isExpanded && (
        <>
          {hasParams && displayInput && typeof displayInput === 'object' && (
            <div className="agent-tool-params" style={{ marginTop: '6px' }}>
              {Object.entries(displayInput as Record<string, unknown>).map(([k, v]) => (
                <div key={k} className="agent-tool-param">
                  <em>{k}:</em> {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                </div>
              ))}
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
            color: 'var(--text-dark)',
          }}>
            {resultText || toolResult}
          </pre>
        </>
      )}
    </div>
  );
}

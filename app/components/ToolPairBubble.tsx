'use client';

// 工具调用 + 结果 合并卡：把相邻的 tool_call 与 tool_result 渲染为同一张气泡。
// 折叠态单行 header：左"用途" + 右"已写入/更新/删除 N 字"摘要胶囊；展开态才显示参数与完整结果。
// 内部 toolName 不暴露在 header 上，避免重复/泄露实现细节。

import { ChevronDown, ChevronRight } from 'lucide-react';
import { getToolPurpose } from '../lib/toolPurpose';
import { getWrittenLength, formatWrittenLength, getActionVerb } from '../lib/toolSummary';
import { coerceToolInput, extractToolMessageContent } from '../lib/toolInputShape';

export function ToolPairBubble({
  toolName, toolInput, toolResult, isExpanded, onToggle,
}: {
  toolName: string;
  toolInput: unknown;
  toolResult: string;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  // 把 langchain 包装（{ input: '<json>' }）/ 字符串形态 标准化成平铺对象
  const normInput = coerceToolInput(toolInput);
  const hasParams = normInput && typeof normInput === 'object' && Object.keys(normInput as object).length > 0;
  // 折叠态只显示"已写入/更新/删除 N 字"（不显示结果预览）；展开态才显示完整结果
  // 同时从 toolResult 提取 content（处理 langchain ToolMessage 完整 JSON dump）
  const normResult = extractToolMessageContent(toolResult);
  const verb = getActionVerb(toolName);
  const writtenLength = getWrittenLength(toolName, toolInput, toolResult);
  const writtenLabel = formatWrittenLength(writtenLength, verb);
  return (
    <div className="agent-bubble agent-bubble-tool-pair">
      <div
        className="agent-tool-pair-header"
        onClick={onToggle}
      >
        {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <span
          className="agent-tool-pair-purpose"
          title={getToolPurpose(toolName, toolInput)}
        >
          {getToolPurpose(toolName, toolInput)}
        </span>
        {writtenLabel && (
          <span className="agent-tool-pair-written" title="本次写入内容的字符数">
            {writtenLabel}
          </span>
        )}
      </div>
      {isExpanded && (
        <>
          {hasParams && (
            <div className="agent-tool-params" style={{ marginTop: '6px' }}>
              {Object.entries(normInput as Record<string, unknown>).map(([k, v]) => (
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
            {normResult}
          </pre>
        </>
      )}
    </div>
  );
}

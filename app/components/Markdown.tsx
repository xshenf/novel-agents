'use client';

import React from 'react';

// 解析内联代码
function parseInlineCode(text: string): React.ReactNode[] {
  if (!text) return [];
  const codeParts = text.split(/(`.*?`)/g);
  return codeParts.map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={i} style={{ background: 'rgba(255,255,255,0.08)', padding: '2px 4px', borderRadius: '3px', fontFamily: 'monospace', fontSize: '11px', color: '#fca5a5', margin: '0 2px' }}>
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

// 解析内联粗体
function parseInlineMarkdown(text: string): React.ReactNode[] {
  if (!text) return [];
  const boldParts = text.split(/(\*\*.*?\*\*)/g);
  return boldParts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      const boldText = part.slice(2, -2);
      return (
        <strong key={i} style={{ color: '#fff', fontWeight: '600' }}>
          {parseInlineCode(boldText)}
        </strong>
      );
    }
    return <span key={i}>{parseInlineCode(part)}</span>;
  });
}

// 极简高性能 Markdown 语法渲染器，用于解析智能体输出内容
export const Markdown = ({ content }: { content: string }) => {
  if (!content) return null;
  
  // 按代码块和普通文本分割
  const parts = content.split(/(```[\s\S]*?```)/g);
  
  return (
    <div className="markdown-content" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {parts.map((part, index) => {
        if (part.startsWith('```') && part.endsWith('```')) {
          const codeContent = part.slice(3, -3);
          const firstLineBreak = codeContent.indexOf('\n');
          let lang = '';
          let code = codeContent;
          if (firstLineBreak !== -1) {
            lang = codeContent.slice(0, firstLineBreak).trim();
            code = codeContent.slice(firstLineBreak + 1);
          }
          return (
            <pre key={index} style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border-light)', borderRadius: '6px', padding: '10px', overflowX: 'auto', fontSize: '11.5px', fontFamily: 'monospace', margin: '4px 0', color: '#e2e8f0' }}>
              {lang && <div style={{ fontSize: '9px', color: 'var(--text-muted)', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '4px', marginBottom: '6px', textTransform: 'uppercase', fontFamily: 'sans-serif', fontWeight: 'bold' }}>{lang}</div>}
              <code>{code}</code>
            </pre>
          );
        }
        
        // 普通文本解析
        const lines = part.split('\n');
        return (
          <div key={index} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {lines.map((line, lineIdx) => {
              const trimmed = line.trim();
              
              // 多级标题
              if (trimmed.startsWith('### ')) {
                return <h5 key={lineIdx} style={{ fontSize: '13px', fontWeight: 'bold', margin: '6px 0 2px', color: '#fff' }}>{trimmed.slice(4)}</h5>;
              }
              if (trimmed.startsWith('## ')) {
                return <h4 key={lineIdx} style={{ fontSize: '14px', fontWeight: 'bold', margin: '8px 0 4px', color: '#fff' }}>{trimmed.slice(3)}</h4>;
              }
              if (trimmed.startsWith('# ')) {
                return <h3 key={lineIdx} style={{ fontSize: '15px', fontWeight: 'bold', margin: '10px 0 6px', color: '#fff' }}>{trimmed.slice(2)}</h3>;
              }
              
              // 无序列表
              if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                return (
                  <div key={lineIdx} style={{ display: 'flex', gap: '6px', paddingLeft: '8px', fontSize: '12.5px', color: 'var(--text-muted)' }}>
                    <span>•</span>
                    <span>{parseInlineMarkdown(trimmed.slice(2))}</span>
                  </div>
                );
              }
              
              // 空行
              if (!trimmed) {
                return <div key={lineIdx} style={{ height: '4px' }} />;
              }
              
              // 普通段落
              return (
                <p key={lineIdx} style={{ margin: 0, fontSize: '12.5px', lineHeight: '1.6' }}>
                  {parseInlineMarkdown(line)}
                </p>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

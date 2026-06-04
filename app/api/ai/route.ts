import { NextResponse } from 'next/server';
import { ai } from '@/lib/ai';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, projectId, currentText, instruction, query, projectTitle, projectDesc, numChapters, apiKey, modelName } = body;

    if (!action) {
      return NextResponse.json({ error: '缺少 action 参数' }, { status: 400 });
    }

    switch (action) {
      case 'autoPlanBook': {
        const { genre, tone, tags } = body;
        if (!genre || !tone) {
          return NextResponse.json({ error: '缺少 genre 或 tone' }, { status: 400 });
        }
        const result = await ai.autoPlanBook(genre, tone, tags || [], apiKey, modelName);
        return NextResponse.json(result);
      }

      case 'generateInspirations': {
        if (!projectId) {
          return NextResponse.json({ error: '缺少 projectId' }, { status: 400 });
        }
        const result = await ai.generateInspirations(projectId, apiKey, modelName);
        return NextResponse.json(result);
      }

      case 'chat': {
        if (!projectId || !query) {
          return NextResponse.json({ error: '缺少 projectId 或 query' }, { status: 400 });
        }
        const reply = await ai.chat(projectId, query, apiKey, modelName);
        return NextResponse.json({ reply });
      }

      case 'autoWrite': {
        const { chapterTitle } = body;
        if (!projectId || !chapterTitle) {
          return NextResponse.json({ error: '缺少 projectId 或 chapterTitle' }, { status: 400 });
        }
        const text = await ai.autoWriteChapter(projectId, chapterTitle, apiKey, modelName, instruction);
        return NextResponse.json({ text });
      }

      case 'continue': {
        if (!projectId || currentText === undefined) {
          return NextResponse.json({ error: '缺少 projectId 或 currentText' }, { status: 400 });
        }
        const text = await ai.continueWriting(projectId, currentText, instruction, apiKey, modelName);
        return NextResponse.json({ text });
      }

      case 'polish': {
        if (currentText === undefined) {
          return NextResponse.json({ error: '缺少 currentText' }, { status: 400 });
        }
        const text = await ai.polish(currentText, instruction, apiKey, modelName);
        return NextResponse.json({ text });
      }

      case 'outline': {
        if (!projectId || !projectTitle) {
          return NextResponse.json({ error: '缺少 projectId 或 projectTitle' }, { status: 400 });
        }
        const outline = await ai.generateOutline(projectId, projectTitle, projectDesc || '', numChapters || 3, apiKey, modelName);
        return NextResponse.json({ outline });
      }

      case 'selfCheck': {
        if (!projectId || currentText === undefined) {
          return NextResponse.json({ error: '缺少 projectId 或 currentText' }, { status: 400 });
        }
        const result = await ai.checkConsistency(projectId, currentText, apiKey, modelName);
        return NextResponse.json(result);
      }

      case 'summarize': {
        if (currentText === undefined) {
          return NextResponse.json({ error: '缺少 currentText' }, { status: 400 });
        }
        const result = await ai.summarizeChapter(currentText, apiKey, modelName);
        return NextResponse.json(result);
      }

      case 'generateKernel': {
        const { genre, tone } = body;
        if (!projectTitle || !genre || !tone) {
          return NextResponse.json({ error: '缺少 projectTitle, genre 或 tone' }, { status: 400 });
        }
        const result = await ai.generateKernelSettings(projectTitle, genre, tone, apiKey, modelName);
        return NextResponse.json(result);
      }

      default:
        return NextResponse.json({ error: `未知的 action: ${action}` }, { status: 400 });
    }
  } catch (error: any) {
    console.error('AI route error:', error);
    return NextResponse.json({ error: error.message || 'AI 操作执行失败' }, { status: 500 });
  }
}

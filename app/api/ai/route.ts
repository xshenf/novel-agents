import { NextResponse } from 'next/server';
import { ai } from '@/lib/ai';
import { db } from '@/lib/db';
import { searchMemory } from '@/lib/memory';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    let { 
      action, projectId, currentText, instruction, query, projectTitle, projectDesc, numChapters, 
      apiKey, modelName, apiProvider, apiBaseUrl, temperature, maxTokens, systemInstruction, reasoningEnabled 
    } = body;

    if (!action) {
      return NextResponse.json({ error: '缺少 action 参数' }, { status: 400 });
    }

    // 如果单独提供了大模型参数并且 apiKey 不是已打包的 JSON，则在这里打包
    if (apiKey && apiProvider && !(apiKey.trim().startsWith('{') && apiKey.trim().endsWith('}'))) {
      apiKey = JSON.stringify({
        apiKey: apiKey,
        apiProvider: apiProvider || 'gemini',
        apiBaseUrl: apiBaseUrl || '',
        temperature: temperature !== undefined ? Number(temperature) : 0.7,
        maxTokens: maxTokens !== undefined ? Number(maxTokens) : 3000,
        systemInstruction: systemInstruction || '',
        reasoningEnabled: reasoningEnabled === true
      });
    }

    switch (action) {
      case 'fetchModels': {
        let realApiKey = apiKey;
        let realProvider = apiProvider || 'gemini';
        let realBaseUrl = apiBaseUrl;

        if (apiKey && apiKey.trim().startsWith('{') && apiKey.trim().endsWith('}')) {
          try {
            const parsed = JSON.parse(apiKey);
            realApiKey = parsed.apiKey || realApiKey;
            realProvider = parsed.apiProvider || realProvider;
            realBaseUrl = parsed.apiBaseUrl || realBaseUrl;
          } catch (e) {
            console.warn('[ai] apiKey JSON 解析失败:', e);
          }
        }

        if (!realApiKey) {
          return NextResponse.json({ error: '缺少 API Key 密钥' }, { status: 400 });
        }

        const models = await ai.fetchModels(realApiKey, realProvider, realBaseUrl);
        return NextResponse.json({ models });
      }
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
        const { chapterTitle } = body;
        if (!projectId || currentText === undefined) {
          return NextResponse.json({ error: '缺少 projectId 或 currentText' }, { status: 400 });
        }
        const text = await ai.continueWriting(projectId, currentText, instruction, apiKey, modelName, chapterTitle);
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

      case 'memoryPreview': {
        // 纯检索：忠实返回 AI 写作时实际会检索到的记忆上下文（无需调用模型）。
        if (!projectId) {
          return NextResponse.json({ error: '缺少 projectId' }, { status: 400 });
        }
        const result = await searchMemory(projectId, query || '');
        return NextResponse.json({
          contextText: result.contextText,
          chapterCount: result.chapters.length,
          characterCount: result.characters.length,
          worldRuleCount: result.worldRules.length,
        });
      }

      case 'foldSynopsis': {
        // 章节完成后更新全书滚动概要并落库（供长篇有界注入）。
        if (!projectId) {
          return NextResponse.json({ error: '缺少 projectId' }, { status: 400 });
        }
        const rollingSynopsis = await ai.updateRollingSynopsis(projectId, apiKey, modelName);
        await db.updateProject(projectId, { rollingSynopsis });
        return NextResponse.json({ rollingSynopsis });
      }

      case 'foldWorldState': {
        // 章节完成后更新世界状态台账并落库。
        if (!projectId) {
          return NextResponse.json({ error: '缺少 projectId' }, { status: 400 });
        }
        const items = await ai.updateWorldState(projectId, apiKey, modelName);
        await db.replaceAutoWorldStates(projectId, items);
        return NextResponse.json({ worldStates: items });
      }

      case 'generateKernel': {
        const { genre, tone, concurrency, projectId, forbiddenSetting } = body;
        if (!projectTitle || !genre || !tone) {
          return NextResponse.json({ error: '缺少 projectTitle, genre 或 tone' }, { status: 400 });
        }
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          async start(controller) {
            const send = (event: string, data: unknown) => {
              controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
            };
            try {
              const result = await ai.generateKernelSettings(
                projectTitle, genre, tone, apiKey, modelName,
                async (dimKey, dimLabel, index, total, dimOptions) => {
                  // 每个维度完成后立即保存到数据库并通知前端
                  if (projectId && dimOptions && dimOptions.length > 0 && dimOptions[0].description) {
                    try {
                      await db.updateProject(projectId, { [dimKey]: dimOptions[0].description });
                    } catch (e) {
                      console.error('Failed to save dimension result', e);
                    }
                  }
                  send('dimension_done', { dimKey, dimLabel, index, total, firstOption: dimOptions?.[0]?.description || '' });
                },
                concurrency || 3,
                forbiddenSetting || ''
              );
              send('done', result);
            } catch (err: any) {
              send('error', { error: err.message || 'AI 操作执行失败' });
            } finally {
              controller.close();
            }
          }
        });
        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        });
      }

      default:
        return NextResponse.json({ error: `未知的 action: ${action}` }, { status: 400 });
    }
  } catch (error: any) {
    console.error('AI route error:', error);
    return NextResponse.json({ error: error.message || 'AI 操作执行失败' }, { status: 500 });
  }
}

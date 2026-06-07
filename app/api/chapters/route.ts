import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    
    if (!projectId) {
      return NextResponse.json({ error: '缺少 projectId 参数' }, { status: 400 });
    }

    const chapters = await db.getChapters(projectId);
    return NextResponse.json(chapters, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : '获取章节列表失败';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { projectId, title, content, summary, characterChanges, newForeshadowing, resolvedForeshadowing, timelineEvents } = body;

    if (!projectId) {
      return NextResponse.json({ error: '缺少 projectId' }, { status: 400 });
    }
    if (!title) {
      return NextResponse.json({ error: '章节标题不能为空' }, { status: 400 });
    }

    const newChapter = await db.createChapter({
      projectId,
      title,
      content: content || '',
      summary: summary || '',
      characterChanges: characterChanges || [],
      newForeshadowing: newForeshadowing || [],
      resolvedForeshadowing: resolvedForeshadowing || [],
      timelineEvents: timelineEvents || [],
    });

    return NextResponse.json(newChapter, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : '创建章节失败';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

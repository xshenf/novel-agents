import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    
    if (!projectId) {
      return NextResponse.json({ error: '缺少 projectId 参数' }, { status: 400 });
    }

    const chapters = db.getChapters(projectId);
    return NextResponse.json(chapters);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '获取章节列表失败' }, { status: 500 });
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

    const newChapter = db.createChapter({
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
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '创建章节失败' }, { status: 500 });
  }
}

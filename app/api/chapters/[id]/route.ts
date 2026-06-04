import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const chapter = db.getChapter(id);
    if (!chapter) {
      return NextResponse.json({ error: '章节未找到' }, { status: 404 });
    }
    return NextResponse.json(chapter);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '获取章节失败' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    const updated = db.updateChapter(id, body);
    if (!updated) {
      return NextResponse.json({ error: '章节未找到' }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '更新章节失败' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const success = db.deleteChapter(id);
    if (!success) {
      return NextResponse.json({ error: '章节未找到或删除失败' }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: '章节已删除' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '删除章节失败' }, { status: 500 });
  }
}

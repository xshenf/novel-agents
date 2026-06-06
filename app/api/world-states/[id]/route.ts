import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updated = await db.updateWorldState(id, body);
    if (!updated) {
      return NextResponse.json({ error: '世界状态未找到' }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : '更新世界状态失败';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const success = await db.deleteWorldState(id);
    if (!success) {
      return NextResponse.json({ error: '世界状态未找到或删除失败' }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: '世界状态已删除' });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : '删除世界状态失败';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

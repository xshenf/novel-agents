import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const ALLOWED = new Set(['type','name','description']);
    const sanitized = Object.fromEntries(Object.entries(body).filter(([k]) => ALLOWED.has(k)));
    
    const updated = await db.updateWorldRule(id, sanitized);
    if (!updated) {
      return NextResponse.json({ error: '设定卡未找到' }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : '更新设定失败';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const success = await db.deleteWorldRule(id);
    if (!success) {
      return NextResponse.json({ error: '设定卡未找到或删除失败' }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: '设定卡已删除' });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : '删除设定失败';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const ALLOWED = new Set(['name','role','age','identity','personality','goals','relationships','currentState','forbidden']);
    const sanitized = Object.fromEntries(Object.entries(body).filter(([k]) => ALLOWED.has(k)));
    
    const updated = await db.updateCharacter(id, sanitized);
    if (!updated) {
      return NextResponse.json({ error: '角色未找到' }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : '更新角色失败';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const success = await db.deleteCharacter(id);
    if (!success) {
      return NextResponse.json({ error: '角色未找到或删除失败' }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: '角色已删除' });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : '删除角色失败';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

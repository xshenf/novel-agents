import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const project = await db.getProject(id);
    if (!project) {
      return NextResponse.json({ error: '项目未找到' }, { status: 404 });
    }
    return NextResponse.json(project);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : '获取项目失败';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const ALLOWED = new Set(['title','description','styleSetting','worldSetting','powerSystem','goldFinger','coreConflict','factionsMap','sellingPoints','outlineFull','antiAiStyleRules','forbiddenSetting','modelsConfig','agentBindings','agentOverrides','rollingSynopsis']);
    const sanitized = Object.fromEntries(Object.entries(body).filter(([k]) => ALLOWED.has(k)));
    
    const updated = await db.updateProject(id, sanitized);
    if (!updated) {
      return NextResponse.json({ error: '项目未找到' }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (error: unknown) {
    console.error('API Error updating project:', error);
    const msg = error instanceof Error ? error.message : '更新项目失败';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const success = await db.deleteProject(id);
    if (!success) {
      return NextResponse.json({ error: '项目未找到或删除失败' }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: '项目已删除' });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : '删除项目失败';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

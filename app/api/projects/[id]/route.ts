import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const project = db.getProject(id);
    if (!project) {
      return NextResponse.json({ error: '项目未找到' }, { status: 404 });
    }
    return NextResponse.json(project);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '获取项目失败' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    const updated = db.updateProject(id, body);
    if (!updated) {
      return NextResponse.json({ error: '项目未找到' }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '更新项目失败' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const success = db.deleteProject(id);
    if (!success) {
      return NextResponse.json({ error: '项目未找到或删除失败' }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: '项目已删除' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '删除项目失败' }, { status: 500 });
  }
}

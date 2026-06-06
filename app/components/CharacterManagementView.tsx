'use client';

import type { WorkspaceContextValue } from '../workspace-context';
import { CharacterCard, AddCharacterCard } from './AssetCards';

interface CharacterManagementViewProps {
  store: WorkspaceContextValue['store'];
  isAddingChar: boolean;
  setIsAddingChar: (v: boolean) => void;
  createVersionSnapshot: any;
}

export function CharacterManagementView({
  store,
  isAddingChar,
  setIsAddingChar,
  createVersionSnapshot,
}: CharacterManagementViewProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '30px', minHeight: 0, overflowY: 'auto', flexGrow: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div>
          <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#fff', margin: 0 }}>
            角色管理 ({store.characters ? store.characters.length : 0})
          </h4>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>管理本小说的登场角色，设定其身份、性格及修行状态</span>
        </div>

        {!isAddingChar && store.currentProject && (
          <button
            className="btn btn-primary"
            onClick={() => setIsAddingChar(true)}
            style={{ fontSize: '11px', padding: '6px 12px', background: 'var(--accent)', border: 'none' }}
          >
            添加角色
          </button>
        )}
      </div>

      {isAddingChar && store.currentProject && (
        <AddCharacterCard
          projectId={store.currentProject.id}
          onAdd={async (char) => {
            await store.createCharacter(char);
            setIsAddingChar(false);
          }}
          onCancel={() => setIsAddingChar(false)}
        />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flexGrow: 1 }}>
        {!store.characters || (store.characters.length === 0 && !isAddingChar) ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-dark)', background: 'rgba(0,0,0,0.15)', borderRadius: '10px', fontSize: '12px' }}>
            当前尚未添加角色卡资产，点击右上角按钮创建！
          </div>
        ) : (
          store.characters.map((char) => (
            <CharacterCard
              key={char.id}
              character={char}
              onSave={async (id, updates) => {
                await store.updateCharacter(id, updates);
                createVersionSnapshot({
                  projectId: store.currentProject!.id,
                  type: 'character',
                  key: id,
                  label: `${updates.name || char.name}`,
                  data: updates,
                  source: 'auto',
                });
              }}
              onDelete={async (id) => {
                await store.deleteCharacter(id);
              }}
            />
          ))
        )}
      </div>
    </div>
  );
}

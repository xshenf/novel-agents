import { useState, useCallback, useReducer, useMemo, type FormEvent } from 'react';
import type { NovelStore } from '@/lib/store';

type RuleType = 'location' | 'faction' | 'rule' | 'item' | 'other';

// ── 表单状态聚合：useReducer 替代散落的 useState ──────────────────────────

type ModalFormState = {
  newCharName: string;
  newCharRole: string;
  newCharAge: string;
  newCharIdentity: string;
  newCharPersonality: string;
  newCharGoals: string;
  newCharState: string;
  newCharForbidden: string;
  newRuleName: string;
  newRuleType: RuleType;
  newRuleDesc: string;
  newChapTitle: string;
};

type ModalAction =
  | { type: 'SET_FIELD'; field: keyof ModalFormState; value: string }
  | { type: 'RESET_CHAR' }
  | { type: 'RESET_RULE' }
  | { type: 'RESET_CHAP' };

const INITIAL_FORM_STATE: ModalFormState = {
  newCharName: '',
  newCharRole: '配角',
  newCharAge: '',
  newCharIdentity: '',
  newCharPersonality: '',
  newCharGoals: '',
  newCharState: '',
  newCharForbidden: '',
  newRuleName: '',
  newRuleType: 'location',
  newRuleDesc: '',
  newChapTitle: '',
};

function modalReducer(state: ModalFormState, action: ModalAction): ModalFormState {
  switch (action.type) {
    case 'SET_FIELD':
      return { ...state, [action.field]: action.value };
    case 'RESET_CHAR':
      return {
        ...state,
        newCharName: '',
        newCharRole: '配角',
        newCharAge: '',
        newCharIdentity: '',
        newCharPersonality: '',
        newCharGoals: '',
        newCharState: '',
        newCharForbidden: '',
      };
    case 'RESET_RULE':
      return { ...state, newRuleName: '', newRuleType: 'location', newRuleDesc: '' };
    case 'RESET_CHAP':
      return { ...state, newChapTitle: '' };
    default:
      return state;
  }
}

export type CreationModalsApi = ReturnType<typeof useCreationModals>;

export function useCreationModals(store: NovelStore) {
  const [showNewCharModal, setShowNewCharModal] = useState(false);
  const [showNewRuleModal, setShowNewRuleModal] = useState(false);
  const [showNewChapModal, setShowNewChapModal] = useState(false);

  const [form, dispatch] = useReducer(modalReducer, INITIAL_FORM_STATE);

  // 稳定的 setter 函数（供 UI 组件绑定 onChange）
  const fieldSetters = useMemo(() => ({
    setNewCharName: (v: string) => dispatch({ type: 'SET_FIELD', field: 'newCharName', value: v }),
    setNewCharRole: (v: string) => dispatch({ type: 'SET_FIELD', field: 'newCharRole', value: v }),
    setNewCharAge: (v: string) => dispatch({ type: 'SET_FIELD', field: 'newCharAge', value: v }),
    setNewCharIdentity: (v: string) => dispatch({ type: 'SET_FIELD', field: 'newCharIdentity', value: v }),
    setNewCharPersonality: (v: string) => dispatch({ type: 'SET_FIELD', field: 'newCharPersonality', value: v }),
    setNewCharGoals: (v: string) => dispatch({ type: 'SET_FIELD', field: 'newCharGoals', value: v }),
    setNewCharState: (v: string) => dispatch({ type: 'SET_FIELD', field: 'newCharState', value: v }),
    setNewCharForbidden: (v: string) => dispatch({ type: 'SET_FIELD', field: 'newCharForbidden', value: v }),
    setNewRuleName: (v: string) => dispatch({ type: 'SET_FIELD', field: 'newRuleName', value: v }),
    setNewRuleType: (v: string) => dispatch({ type: 'SET_FIELD', field: 'newRuleType', value: v }),
    setNewRuleDesc: (v: string) => dispatch({ type: 'SET_FIELD', field: 'newRuleDesc', value: v }),
    setNewChapTitle: (v: string) => dispatch({ type: 'SET_FIELD', field: 'newChapTitle', value: v }),
  }), []);

  const handleCreateChapter = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    if (!store.currentProject || !form.newChapTitle.trim()) return;
    try {
      await store.createChapter(store.currentProject.id, form.newChapTitle);
      setShowNewChapModal(false);
      dispatch({ type: 'RESET_CHAP' });
    } catch (err) { console.error('创建失败:', err); }
  }, [store, form.newChapTitle]);

  const handleCreateCharacter = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    if (!store.currentProject || !form.newCharName.trim()) return;
    try {
      await store.createCharacter({
        projectId: store.currentProject.id,
        name: form.newCharName,
        role: form.newCharRole,
        age: form.newCharAge,
        identity: form.newCharIdentity,
        personality: form.newCharPersonality.split(/[,，]/).map(p => p.trim()).filter(Boolean),
        goals: form.newCharGoals.split(/[,，]/).map(g => g.trim()).filter(Boolean),
        relationships: [],
        currentState: form.newCharState,
        forbidden: form.newCharForbidden.split(/[,，]/).map(f => f.trim()).filter(Boolean)
      });
      setShowNewCharModal(false);
      dispatch({ type: 'RESET_CHAR' });
    } catch (err) { console.error('创建失败:', err); }
  }, [store, form.newCharName, form.newCharRole, form.newCharAge, form.newCharIdentity, form.newCharPersonality, form.newCharGoals, form.newCharState, form.newCharForbidden]);

  const handleCreateRule = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    if (!store.currentProject || !form.newRuleName.trim()) return;
    try {
      await store.createWorldRule({
        projectId: store.currentProject.id,
        name: form.newRuleName,
        type: form.newRuleType,
        description: form.newRuleDesc
      });
      setShowNewRuleModal(false);
      dispatch({ type: 'RESET_RULE' });
    } catch (err) { console.error('创建失败:', err); }
  }, [store, form.newRuleName, form.newRuleType, form.newRuleDesc]);

  return {
    showNewCharModal,
    setShowNewCharModal,
    showNewRuleModal,
    setShowNewRuleModal,
    showNewChapModal,
    setShowNewChapModal,
    newCharName: form.newCharName,
    setNewCharName: fieldSetters.setNewCharName,
    newCharRole: form.newCharRole,
    setNewCharRole: fieldSetters.setNewCharRole,
    newCharAge: form.newCharAge,
    setNewCharAge: fieldSetters.setNewCharAge,
    newCharIdentity: form.newCharIdentity,
    setNewCharIdentity: fieldSetters.setNewCharIdentity,
    newCharPersonality: form.newCharPersonality,
    setNewCharPersonality: fieldSetters.setNewCharPersonality,
    newCharGoals: form.newCharGoals,
    setNewCharGoals: fieldSetters.setNewCharGoals,
    newCharState: form.newCharState,
    setNewCharState: fieldSetters.setNewCharState,
    newCharForbidden: form.newCharForbidden,
    setNewCharForbidden: fieldSetters.setNewCharForbidden,
    newRuleName: form.newRuleName,
    setNewRuleName: fieldSetters.setNewRuleName,
    newRuleType: form.newRuleType,
    setNewRuleType: fieldSetters.setNewRuleType as (v: RuleType) => void,
    newRuleDesc: form.newRuleDesc,
    setNewRuleDesc: fieldSetters.setNewRuleDesc,
    newChapTitle: form.newChapTitle,
    setNewChapTitle: fieldSetters.setNewChapTitle,
    handleCreateChapter,
    handleCreateCharacter,
    handleCreateRule,
  };
}

import { useState, useCallback, type FormEvent } from 'react';
import type { NovelStore } from '@/lib/store';

type RuleType = 'location' | 'faction' | 'rule' | 'item' | 'other';

export type CreationModalsApi = ReturnType<typeof useCreationModals>;

export function useCreationModals(store: NovelStore) {
  const [showNewCharModal, setShowNewCharModal] = useState(false);
  const [showNewRuleModal, setShowNewRuleModal] = useState(false);
  const [showNewChapModal, setShowNewChapModal] = useState(false);

  const [newCharName, setNewCharName] = useState('');
  const [newCharRole, setNewCharRole] = useState('配角');
  const [newCharAge, setNewCharAge] = useState('');
  const [newCharIdentity, setNewCharIdentity] = useState('');
  const [newCharPersonality, setNewCharPersonality] = useState('');
  const [newCharGoals, setNewCharGoals] = useState('');
  const [newCharState, setNewCharState] = useState('');
  const [newCharForbidden, setNewCharForbidden] = useState('');

  const [newRuleName, setNewRuleName] = useState('');
  const [newRuleType, setNewRuleType] = useState<RuleType>('location');
  const [newRuleDesc, setNewRuleDesc] = useState('');

  const [newChapTitle, setNewChapTitle] = useState('');

  const handleCreateChapter = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    if (!store.currentProject || !newChapTitle.trim()) return;
    try {
      await store.createChapter(store.currentProject.id, newChapTitle);
      setShowNewChapModal(false);
      setNewChapTitle('');
    } catch (err) { console.error('创建失败:', err); }
  }, [store, newChapTitle]);

  const handleCreateCharacter = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    if (!store.currentProject || !newCharName.trim()) return;
    try {
      await store.createCharacter({
        projectId: store.currentProject.id,
        name: newCharName,
        role: newCharRole,
        age: newCharAge,
        identity: newCharIdentity,
        personality: newCharPersonality.split(/[,，]/).map(p => p.trim()).filter(Boolean),
        goals: newCharGoals.split(/[,，]/).map(g => g.trim()).filter(Boolean),
        relationships: [],
        currentState: newCharState,
        forbidden: newCharForbidden.split(/[,，]/).map(f => f.trim()).filter(Boolean)
      });
      setShowNewCharModal(false);
      setNewCharName('');
      setNewCharRole('配角');
      setNewCharAge('');
      setNewCharIdentity('');
      setNewCharPersonality('');
      setNewCharGoals('');
      setNewCharState('');
      setNewCharForbidden('');
    } catch (err) { console.error('创建失败:', err); }
  }, [store, newCharName, newCharRole, newCharAge, newCharIdentity, newCharPersonality, newCharGoals, newCharState, newCharForbidden]);

  const handleCreateRule = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    if (!store.currentProject || !newRuleName.trim()) return;
    try {
      await store.createWorldRule({
        projectId: store.currentProject.id,
        name: newRuleName,
        type: newRuleType,
        description: newRuleDesc
      });
      setShowNewRuleModal(false);
      setNewRuleName('');
      setNewRuleType('location');
      setNewRuleDesc('');
    } catch (err) { console.error('创建失败:', err); }
  }, [store, newRuleName, newRuleType, newRuleDesc]);

  return {
    showNewCharModal,
    setShowNewCharModal,
    showNewRuleModal,
    setShowNewRuleModal,
    showNewChapModal,
    setShowNewChapModal,
    newCharName,
    setNewCharName,
    newCharRole,
    setNewCharRole,
    newCharAge,
    setNewCharAge,
    newCharIdentity,
    setNewCharIdentity,
    newCharPersonality,
    setNewCharPersonality,
    newCharGoals,
    setNewCharGoals,
    newCharState,
    setNewCharState,
    newCharForbidden,
    setNewCharForbidden,
    newRuleName,
    setNewRuleName,
    newRuleType,
    setNewRuleType,
    newRuleDesc,
    setNewRuleDesc,
    newChapTitle,
    setNewChapTitle,
    handleCreateChapter,
    handleCreateCharacter,
    handleCreateRule,
  };
}

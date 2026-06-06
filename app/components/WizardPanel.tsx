'use client';

import {
  BookOpen, ChevronLeft, Sparkles, Loader2,
} from 'lucide-react';
import { GENRE_CATEGORIES, TONES, PRESET_TAG_GROUPS } from '@/lib/constants';
import { useWorkspace } from '../workspace-context';

export function WizardPanel() {
  const { ui, wizard } = useWorkspace();
  const { isAiLoading } = ui;
  const {
    isWizardMode, setIsWizardMode, existingProjectId, selectedGenreCategory, setSelectedGenreCategory,
    customGenreInput, setCustomGenreInput, customToneInput, setCustomToneInput,
    wizardStep, setWizardStep, selectedGenre, setSelectedGenre, selectedTone, setSelectedTone,
    selectedTags, setSelectedTags, wizardLoading,
    customTagInput, setCustomTagInput, loadingTip,
    handleSkipWizard, handleToggleTag, handleWizardGenerate,
  } = wizard;

  const stepTitles = ['题材分类', '文风调性', '故事看点'];

  return (
    <div style={{ maxWidth: '1200px', margin: '40px auto', padding: '0 24px', display: 'flex', flexDirection: 'column', gap: '20px', minHeight: 'calc(100vh - 140px)' }}>

      {/* 顶部标题栏 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: '16px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: '700', marginBottom: '6px', background: 'linear-gradient(135deg, #ffffff 0%, #a5b4fc 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            {wizardLoading ? 'AI 智能新书推演中...' : `智能新书向导: ${stepTitles[wizardStep - 1]}`}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
            {wizardLoading ? '融合题材世界观与文风法则，推演主线与大纲...' : '通过多维度可视化推演，免去构思烦恼，一键生成您的专属小说企划。'}
          </p>
        </div>
        {!wizardLoading && (
          <div style={{ display: 'flex', gap: '10px' }}>
            {!existingProjectId && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleSkipWizard}
                disabled={isAiLoading}
                style={{
                  display: 'flex',
                  gap: '6px',
                  alignItems: 'center',
                  borderColor: 'rgba(16, 185, 129, 0.4)',
                  background: 'rgba(16, 185, 129, 0.05)',
                  color: '#34d399',
                }}
              >
                直接开书 (跳过向导)
              </button>
            )}
            <button className="btn btn-secondary" onClick={() => setIsWizardMode(false)} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <ChevronLeft size={16} /> {existingProjectId ? '取消' : '返回项目大厅'}
            </button>
          </div>
        )}
      </div>

      {/* 双栏布局 */}
      <div style={{ display: 'grid', gridTemplateColumns: '7fr 5fr', gap: '30px', alignItems: 'stretch' }}>

        {/* 左栏：配置区 */}
        <div className="glass-card" style={{ padding: '30px', display: 'flex', flexDirection: 'column', gap: '24px', minHeight: '520px' }}>

          {/* 步骤指示器 */}
          {!wizardLoading && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', padding: '0 10px' }}>
              <div style={{ position: 'absolute', top: '50%', left: '24px', right: '24px', height: '2px', background: 'var(--border-light)', zIndex: 1, transform: 'translateY(-50%)' }}></div>
              <div style={{ position: 'absolute', top: '50%', left: '24px', width: `${((wizardStep - 1) / 2) * 91}%`, height: '2px', background: 'var(--accent)', zIndex: 1, transform: 'translateY(-50%)', transition: 'width 0.3s' }}></div>
              {[1, 2, 3].map(step => (
                <div key={step} style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: wizardStep >= step ? 'var(--accent)' : 'var(--bg-input)',
                  border: `2px solid ${wizardStep >= step ? 'var(--accent)' : 'var(--border-light)'}`,
                  color: wizardStep >= step ? '#fff' : 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  fontWeight: '600',
                  zIndex: 2,
                  transition: 'all 0.3s',
                  boxShadow: wizardStep === step ? '0 0 15px rgba(99, 102, 241, 0.4)' : 'none',
                }}>
                  {step}
                </div>
              ))}
            </div>
          )}

          {/* 核心选项区 */}
          {wizardLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: '20px', flexGrow: 1 }}>
              <Loader2 className="animate-spin" style={{ width: '48px', height: '48px', color: 'var(--accent)' }} />
              <div style={{ fontSize: '18px', color: 'var(--text-main)', fontWeight: '600', letterSpacing: '0.05em' }}>{loadingTip}</div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', maxWidth: '400px', lineHeight: '1.6' }}>
                AI 正在融合题材、文风与核心看点，演算世界的物理法则、灵气浓度以及前三章命途走向...
              </div>
            </div>
          ) : (
            <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                {/* 第 1 步：题材选择 */}
                {wizardStep === 1 && (
                  <div>
                    <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '14px', color: '#fff' }}>请选择您小说的核心题材（九门主流大类，共计43个细分品类）</h3>

                    {/* 横向滚动大类 Tab */}
                    <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '10px', marginBottom: '16px', borderBottom: '1px solid var(--border-light)' }}>
                      {GENRE_CATEGORIES.map(category => {
                        const isCatSelected = selectedGenreCategory === category.id;
                        return (
                          <button
                            key={category.id}
                            type="button"
                            className={`btn ${isCatSelected ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setSelectedGenreCategory(category.id)}
                            style={{
                              padding: '6px 12px',
                              fontSize: '12px',
                              borderRadius: '20px',
                              border: isCatSelected ? 'none' : '1px solid var(--border-light)',
                              background: isCatSelected ? 'var(--accent)' : 'var(--bg-input)',
                              color: isCatSelected ? '#fff' : 'var(--text-muted)',
                              boxShadow: isCatSelected ? '0 0 10px rgba(99, 102, 241, 0.3)' : 'none',
                            }}
                          >
                            <span style={{ marginRight: '4px' }}>{category.icon}</span>
                            {category.title}
                          </button>
                        );
                      })}
                    </div>

                    {/* 细分卡片网格 */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', maxHeight: '320px', overflowY: 'auto', paddingRight: '4px' }}>
                      {GENRE_CATEGORIES.find(c => c.id === selectedGenreCategory)?.genres.map(genre => {
                        const isSelected = selectedGenre === genre.name;
                        return (
                          <div
                            key={genre.name}
                            onClick={() => { setSelectedGenre(genre.name); }}
                            style={{
                              padding: '12px 14px',
                              borderRadius: '10px',
                              background: isSelected ? 'rgba(99, 102, 241, 0.08)' : 'var(--bg-input)',
                              border: `2px solid ${isSelected ? 'var(--accent)' : 'var(--border-light)'}`,
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '10px',
                              boxShadow: isSelected ? '0 0 12px rgba(99, 102, 241, 0.15)' : 'none',
                            }}
                          >
                            <span style={{ fontSize: '20px' }}>{genre.icon}</span>
                            <div>
                              <div style={{ fontWeight: '600', fontSize: '13px', color: isSelected ? '#fff' : 'var(--text-main)', marginBottom: '2px' }}>{genre.name}</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.4' }}>{genre.desc}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* 自定义题材选择 */}
                    <div style={{ marginTop: '16px', borderTop: '1px solid var(--border-light)', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>独创自定义题材（例如：赛博仙侠、中式蒸汽朋克）</div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                          type="text"
                          className="input"
                          placeholder="输入您的独创题材..."
                          value={customGenreInput}
                          onChange={e => setCustomGenreInput(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const trimmed = customGenreInput.trim();
                              if (trimmed) { setSelectedGenre(trimmed); }
                            }
                          }}
                          style={{ flexGrow: 1 }}
                        />
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => {
                            const trimmed = customGenreInput.trim();
                            if (trimmed) { setSelectedGenre(trimmed); }
                          }}
                        >
                          确定题材
                        </button>
                      </div>
                      {selectedGenre && !GENRE_CATEGORIES.some(c => c.genres.some(g => g.name === selectedGenre)) && (
                        <div style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: '500' }}>
                          当前已选中自定义题材：【{selectedGenre}】
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 第 2 步：文风选择 */}
                {wizardStep === 2 && (
                  <div>
                    <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '14px', color: '#fff' }}>请确定小说的整体文风与行文节奏</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                      {TONES.map(tone => {
                        const isSelected = selectedTone === tone.name;
                        return (
                          <div
                            key={tone.name}
                            onClick={() => setSelectedTone(tone.name)}
                            style={{
                              padding: '14px 16px',
                              borderRadius: '10px',
                              background: isSelected ? 'rgba(99, 102, 241, 0.08)' : 'var(--bg-input)',
                              border: `2px solid ${isSelected ? 'var(--accent)' : 'var(--border-light)'}`,
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '12px',
                              boxShadow: isSelected ? '0 0 15px rgba(99, 102, 241, 0.15)' : 'none',
                            }}
                          >
                            <span style={{ fontSize: '24px' }}>{tone.icon}</span>
                            <div>
                              <div style={{ fontWeight: '600', fontSize: '14px', color: isSelected ? '#fff' : 'var(--text-main)', marginBottom: '4px' }}>{tone.name}</div>
                              <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.4' }}>{tone.desc}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* 自定义文风选择 */}
                    <div style={{ marginTop: '16px', borderTop: '1px solid var(--border-light)', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>自定义独特文风（例如：暗黑克苏鲁、赛博怪诞）</div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                          type="text"
                          className="input"
                          placeholder="输入您的自定义文风偏好..."
                          value={customToneInput}
                          onChange={e => setCustomToneInput(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const trimmed = customToneInput.trim();
                              if (trimmed) { setSelectedTone(trimmed); }
                            }
                          }}
                          style={{ flexGrow: 1 }}
                        />
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => {
                            const trimmed = customToneInput.trim();
                            if (trimmed) { setSelectedTone(trimmed); }
                          }}
                        >
                          确定文风
                        </button>
                      </div>
                      {selectedTone && !TONES.some(t => t.name === selectedTone) && (
                        <div style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: '500' }}>
                          当前已选中自定义文风：【{selectedTone}】
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 第 3 步：故事看点 */}
                {wizardStep === 3 && (
                  <div>
                    <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '14px', color: '#fff' }}>请选择故事核心看点（可跨维度多选）</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                      {PRESET_TAG_GROUPS.map(group => (
                        <div key={group.title} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>{group.title}</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {group.tags.map(tag => {
                              const isSelected = selectedTags.includes(tag);
                              return (
                                <div
                                  key={tag}
                                  onClick={() => handleToggleTag(tag)}
                                  style={{
                                    padding: '6px 12px',
                                    borderRadius: '16px',
                                    background: isSelected ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-input)',
                                    border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border-light)'}`,
                                    color: isSelected ? '#fff' : 'var(--text-muted)',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    fontWeight: isSelected ? '600' : '400',
                                    transition: 'all 0.15s',
                                  }}
                                >
                                  {tag}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}

                      {/* 自定义看点 */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--border-light)', paddingTop: '14px', marginTop: '6px' }}>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>独创脑洞自定义标签</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '6px' }}>
                          {selectedTags.filter(tag => !PRESET_TAG_GROUPS.some(g => g.tags.includes(tag))).map(tag => (
                            <div
                              key={tag}
                              onClick={() => handleToggleTag(tag)}
                              style={{
                                padding: '6px 12px',
                                borderRadius: '16px',
                                background: 'rgba(99, 102, 241, 0.15)',
                                border: '1px solid var(--accent)',
                                color: '#fff',
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: '600',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                              }}
                            >
                              {tag}
                            </div>
                          ))}
                        </div>

                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <input
                            type="text"
                            className="input"
                            placeholder="输入您的独创灵感标签，按回车添加..."
                            value={customTagInput}
                            onChange={e => setCustomTagInput(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const trimmed = customTagInput.trim();
                                if (trimmed && !selectedTags.includes(trimmed)) {
                                  setSelectedTags(prev => [...prev, trimmed]);
                                  setCustomTagInput('');
                                }
                              }
                            }}
                            style={{ flexGrow: 1 }}
                          />
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => {
                              const trimmed = customTagInput.trim();
                              if (trimmed && !selectedTags.includes(trimmed)) {
                                setSelectedTags(prev => [...prev, trimmed]);
                                setCustomTagInput('');
                              }
                            }}
                          >
                            添加
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 底部导航 */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--border-light)', paddingTop: '20px', marginTop: '20px' }}>
                {wizardStep === 1 && (
                  <>
                    <button type="button" className="btn btn-secondary" onClick={() => setIsWizardMode(false)}>取消</button>
                    <button type="button" className="btn btn-primary" onClick={() => setWizardStep(2)} disabled={!selectedGenre} style={selectedGenre ? {} : { opacity: 0.4, cursor: 'not-allowed' }}>
                      下一步：确定文风
                    </button>
                  </>
                )}
                {wizardStep === 2 && (
                  <>
                    <button type="button" className="btn btn-secondary" onClick={() => setWizardStep(1)}>上一步</button>
                    <button type="button" className="btn btn-primary" onClick={() => setWizardStep(3)} disabled={!selectedTone} style={selectedTone ? {} : { opacity: 0.4, cursor: 'not-allowed' }}>
                      下一步：故事看点
                    </button>
                  </>
                )}
                {wizardStep === 3 && (
                  <>
                    <button type="button" className="btn btn-secondary" onClick={() => setWizardStep(2)}>上一步</button>
                    <button type="button" className="btn btn-primary" onClick={handleWizardGenerate} disabled={selectedTags.length === 0 || isAiLoading} style={selectedTags.length > 0 ? {} : { opacity: 0.4, cursor: 'not-allowed' }}>
                      {isAiLoading ? '正在创建...' : '完成设定'}
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 右栏：风格卡片 */}
        <div className="glass-card" style={{ padding: '30px', display: 'flex', flexDirection: 'column', gap: '20px', minHeight: '520px', background: 'rgba(17, 19, 34, 0.4)' }}>

          {/* 3D 拟真书脊卡片 */}
          <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}>
            <div style={{
              width: '180px',
              height: '250px',
              borderRadius: '8px 16px 16px 8px',
              background: 'linear-gradient(135deg, #1e1b4b 0%, #311042 100%)',
              boxShadow: '0 15px 35px rgba(0,0,0,0.5), inset -3px 0 10px rgba(0,0,0,0.4), 0 0 30px var(--accent-glow)',
              border: '1px solid rgba(255,255,255,0.05)',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              padding: '24px 16px',
              overflow: 'hidden',
            }}>
              {/* 装饰条纹 */}
              <div style={{ position: 'absolute', left: '0', top: '0', bottom: '0', width: '8px', background: 'rgba(255,255,255,0.03)', borderRight: '1px solid rgba(255,255,255,0.05)' }}></div>

              {/* 顶部小标 */}
              <div style={{ fontSize: '10px', color: 'var(--accent)', fontWeight: '600', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Sparkles size={10} />
                AI AUTO SYSTEM
              </div>

              {/* 书名 */}
              <div style={{ textAlign: 'center', margin: '20px 0' }}>
                <div style={{
                  fontSize: '18px',
                  fontWeight: '700',
                  color: '#fff',
                  lineHeight: '1.4',
                  maxHeight: '80px',
                  overflow: 'hidden',
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                }}>
                  灵感之卷
                </div>
                <div style={{ fontSize: '9px', color: 'var(--text-dark)', marginTop: '8px' }}>
                  完成设定后将自动推演
                </div>
              </div>

              {/* 底部题材标签点亮 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center' }}>
                <div style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(99, 102, 241, 0.2)', border: '1px solid var(--accent)', color: '#a5b4fc', fontWeight: '500' }}>
                  {selectedGenre || '...'}
                </div>
                <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                  {selectedTone || '...'}
                </div>
              </div>
            </div>
          </div>

          {/* 当前选择摘要 */}
          <div style={{ background: 'var(--bg-input)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <BookOpen size={14} />
              当前设定预览
            </div>

            {/* 题材 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>题材</div>
              {selectedGenre ? (
                <div style={{ padding: '6px 12px', borderRadius: '8px', background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.3)', color: '#a5b4fc', fontSize: '13px', fontWeight: '500' }}>
                  {selectedGenre}
                </div>
              ) : (
                <div style={{ fontSize: '12px', color: 'var(--text-dark)', fontStyle: 'italic' }}>尚未选择题材</div>
              )}
            </div>

            {/* 文风 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>文风</div>
              {selectedTone ? (
                <div style={{ padding: '6px 12px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#6ee7b7', fontSize: '13px', fontWeight: '500' }}>
                  {selectedTone}
                </div>
              ) : (
                <div style={{ fontSize: '12px', color: 'var(--text-dark)', fontStyle: 'italic' }}>尚未选择文风</div>
              )}
            </div>

            {/* 看点标签 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>故事看点</div>
              {selectedTags.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {selectedTags.map(tag => (
                    <div key={tag} style={{ padding: '4px 10px', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#fbbf24', fontSize: '11px', fontWeight: '500' }}>
                      {tag}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: '12px', color: 'var(--text-dark)', fontStyle: 'italic' }}>尚未选择看点</div>
              )}
            </div>

            {/* 灵感公式 */}
            {selectedGenre && selectedTone && selectedTags.length > 0 && (
              <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '12px', fontSize: '12px', color: 'var(--text-main)', lineHeight: '1.6' }}>
                这将是一部以<span style={{ color: '#a5b4fc', fontWeight: '600' }}>{selectedGenre}</span>为画布的<span style={{ color: '#6ee7b7', fontWeight: '600' }}>{selectedTone}</span>故事，深度融入<span style={{ color: '#fbbf24', fontWeight: '600' }}>{selectedTags.slice(0, 4).join('、')}</span>等核心看点。完成设定后将自动推演完整世界观。
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

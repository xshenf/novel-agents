'use client';

import {
  BookOpen, Plus, ChevronLeft, Sparkles, Loader2, RefreshCw,
} from 'lucide-react';
import { GENRE_CATEGORIES, TONES, PRESET_TAG_GROUPS } from '@/lib/constants';
import { useWorkspace } from '../workspace-context';

export function WizardPanel() {
  const { ui, wizard } = useWorkspace();
  const { isAiLoading } = ui;
  const {
    isWizardMode, setIsWizardMode, selectedGenreCategory, setSelectedGenreCategory,
    customGenreInput, setCustomGenreInput, customToneInput, setCustomToneInput,
    wizardStep, setWizardStep, selectedGenre, setSelectedGenre, selectedTone, setSelectedTone,
    selectedTags, setSelectedTags, wizardLoading, wizardResult, setWizardResult,
    customTagInput, setCustomTagInput, loadingTip,
    handleSkipWizard, handleToggleTag, handleWizardGenerate, handleWizardCreateProject,
  } = wizard;

  const stepTitles = ['题材分类', '文风调性', '故事看点', '新书企划'];

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
            <button className="btn btn-secondary" onClick={() => setIsWizardMode(false)} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <ChevronLeft size={16} /> 返回项目大厅
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
              <div style={{ position: 'absolute', top: '50%', left: '24px', width: `${((wizardStep - 1) / 3) * 91}%`, height: '2px', background: 'var(--accent)', zIndex: 1, transform: 'translateY(-50%)', transition: 'width 0.3s' }}></div>
              {[1, 2, 3, 4].map(step => (
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

                {/* 第 4 步：最终预览编辑 */}
                {wizardStep === 4 && wizardResult && (
                  <div>
                    <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '14px', color: '#fff' }}>AI 推演企划书（您可以在框内直接进行微调与二次润色）</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '420px', overflowY: 'auto', paddingRight: '6px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>独创书名</label>
                        <input
                          type="text"
                          className="input"
                          value={wizardResult.title}
                          onChange={e => setWizardResult(prev => prev ? { ...prev, title: e.target.value } : null)}
                          style={{ fontSize: '16px', fontWeight: '600', color: '#fff' }}
                          required
                        />
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>故事简介</label>
                        <textarea
                          className="textarea"
                          value={wizardResult.description}
                          onChange={e => setWizardResult(prev => prev ? { ...prev, description: e.target.value } : null)}
                          style={{ minHeight: '80px', lineHeight: '1.6' }}
                          required
                        />
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>创作风格</label>
                        <input
                          type="text"
                          className="input"
                          value={wizardResult.styleSetting}
                          onChange={e => setWizardResult(prev => prev ? { ...prev, styleSetting: e.target.value } : null)}
                          required
                        />
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>世界观设定与境界划分</label>
                        <textarea
                          className="textarea"
                          value={wizardResult.worldSetting}
                          onChange={e => setWizardResult(prev => prev ? { ...prev, worldSetting: e.target.value } : null)}
                          style={{ minHeight: '110px', lineHeight: '1.6' }}
                          required
                        />
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
                    <button type="button" className="btn btn-primary" onClick={() => setWizardStep(2)}>
                      下一步：确定文风
                    </button>
                  </>
                )}
                {wizardStep === 2 && (
                  <>
                    <button type="button" className="btn btn-secondary" onClick={() => setWizardStep(1)}>上一步</button>
                    <button type="button" className="btn btn-primary" onClick={() => setWizardStep(3)}>
                      下一步：故事看点
                    </button>
                  </>
                )}
                {wizardStep === 3 && (
                  <>
                    <button type="button" className="btn btn-secondary" onClick={() => setWizardStep(2)}>上一步</button>
                    <button type="button" className="btn btn-primary" onClick={handleWizardGenerate}>
                      一键推演新书企划
                    </button>
                  </>
                )}
                {wizardStep === 4 && (
                  <>
                    <button type="button" className="btn btn-secondary" onClick={() => setWizardStep(3)}>上一步</button>
                    <button type="button" className="btn btn-secondary" onClick={handleWizardGenerate} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <RefreshCw style={{ width: '14px', height: '14px' }} />
                      重新推演
                    </button>
                    <button type="button" className="btn btn-primary" onClick={handleWizardCreateProject} disabled={isAiLoading}>
                      {isAiLoading ? '创建中...' : '确认创建并连载'}
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 右栏：实时企划封面看板 */}
        <div className="glass-card" style={{ padding: '30px', display: 'flex', flexDirection: 'column', gap: '20px', minHeight: '520px', background: 'rgba(17, 19, 34, 0.4)', justifyContent: 'space-between' }}>

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
                  fontSize: wizardStep === 4 && wizardResult ? '14px' : '18px',
                  fontWeight: '700',
                  color: '#fff',
                  lineHeight: '1.4',
                  maxHeight: '80px',
                  overflow: 'hidden',
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                }}>
                  {wizardStep === 4 && wizardResult ? wizardResult.title : '灵感之卷 '}
                </div>
                <div style={{ fontSize: '9px', color: 'var(--text-dark)', marginTop: '8px' }}>
                  {wizardStep === 4 && wizardResult ? '新书大纲已锁定' : '等待 AI 推演灵感...'}
                </div>
              </div>

              {/* 底部题材标签点亮 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center' }}>
                <div style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(99, 102, 241, 0.2)', border: '1px solid var(--accent)', color: '#a5b4fc', fontWeight: '500' }}>
                  {selectedGenre}
                </div>
                <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                  {selectedTone}
                </div>
              </div>
            </div>
          </div>

          {/* 灵感公式摘要或前三章预告 */}
          {wizardStep === 4 && wizardResult ? (
            <div style={{ background: 'var(--bg-input)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-light)' }}>
              <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--accent)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <BookOpen size={14} />
                前三章连载预告目录已锁定：
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', color: 'var(--text-main)' }}>
                {selectedGenre === '悬疑惊悚' ? (
                  <>
                    <div>第一章：雨夜里的失魂人 <span style={{ color: 'var(--text-dark)' }}>(空细纲)</span></div>
                    <div>第二章：死档阁的红漆印 <span style={{ color: 'var(--text-dark)' }}>(空细纲)</span></div>
                    <div>第三章：步步追命的规则 <span style={{ color: 'var(--text-dark)' }}>(空细纲)</span></div>
                  </>
                ) : selectedGenre === '科幻未来' ? (
                  <>
                    <div>第一章：深空舱室的冷苏醒 <span style={{ color: 'var(--text-dark)' }}>(空细纲)</span></div>
                    <div>第二章：指令异常与逃逸 <span style={{ color: 'var(--text-dark)' }}>(空细纲)</span></div>
                    <div>第三章：宇宙边缘的未知警告 <span style={{ color: 'var(--text-dark)' }}>(空细纲)</span></div>
                  </>
                ) : (selectedGenre === '现代言情' || selectedGenre === '古代言情') ? (
                  <>
                    <div>第一章：死局重生的契机 <span style={{ color: 'var(--text-dark)' }}>(空细纲)</span></div>
                    <div>第二章：豪门门阀的刁难 <span style={{ color: 'var(--text-dark)' }}>(空细纲)</span></div>
                    <div>第三章：针锋相对的交手 <span style={{ color: 'var(--text-dark)' }}>(空细纲)</span></div>
                  </>
                ) : selectedGenre === '历史架空' ? (
                  <>
                    <div>第一章：没落世子的破局策 <span style={{ color: 'var(--text-dark)' }}>(空细纲)</span></div>
                    <div>第二章：朝堂对赌与杀机 <span style={{ color: 'var(--text-dark)' }}>(空细纲)</span></div>
                    <div>第三章：收服旧部定乾坤 <span style={{ color: 'var(--text-dark)' }}>(空细纲)</span></div>
                  </>
                ) : selectedGenre === '游戏竞技' ? (
                  <>
                    <div>第一章：老将退役后的登录 <span style={{ color: 'var(--text-dark)' }}>(空细纲)</span></div>
                    <div>第二章：神魔首测的越级杀 <span style={{ color: 'var(--text-dark)' }}>(空细纲)</span></div>
                    <div>第三章：全服震动的首通记录 <span style={{ color: 'var(--text-dark)' }}>(空细纲)</span></div>
                  </>
                ) : selectedGenre === '二次元幻想' ? (
                  <>
                    <div>第一章：转生成为吐槽店长 <span style={{ color: 'var(--text-dark)' }}>(空细纲)</span></div>
                    <div>第二章：美少女眷族的上门拜访 <span style={{ color: 'var(--text-dark)' }}>(空细纲)</span></div>
                    <div>第三章：日常小店的鸡飞狗跳 <span style={{ color: 'var(--text-dark)' }}>(空细纲)</span></div>
                  </>
                ) : (
                  <>
                    <div>第一章：深夜古卷的惊变 <span style={{ color: 'var(--text-dark)' }}>(空细纲)</span></div>
                    <div>第二章：试探与杀机 <span style={{ color: 'var(--text-dark)' }}>(空细纲)</span></div>
                    <div>第三章：因果暗局 <span style={{ color: 'var(--text-dark)' }}>(空细纲)</span></div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '10px', border: '1px dashed rgba(255,255,255,0.05)', flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--accent)', fontWeight: '600', letterSpacing: '0.05em', marginBottom: '6px' }}>当前灵感构想公式</div>
              <div style={{ fontSize: '13px', color: 'var(--text-main)', lineHeight: '1.6' }}>
                这将会是一部以<span style={{ color: 'var(--accent)', fontWeight: '600', margin: '0 2px' }}>{selectedGenre}</span>为画布的<span style={{ color: '#fff', fontWeight: '600', margin: '0 2px' }}>{selectedTone}</span>故事。
                {selectedTags.length > 0 && (
                  <>
                    它深度融入了包括
                    <span style={{ color: 'var(--accent-success)', fontWeight: '600', margin: '0 2px' }}>
                      {selectedTags.slice(0, 4).join('、')}
                    </span>等吸睛神级看点。
                  </>
                )}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-dark)', marginTop: '12px' }}>
                请点击「一键推演新书企划」，看 AI 如何将这一行公式编织成气吞长虹的惊世之卷！
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

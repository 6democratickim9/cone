import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  Beaker,
  Bookmark,
  Check,
  ChevronDown,
  FlaskConical,
  History,
  Home,
  Library,
  Menu,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
  Trash2,
  X,
} from 'lucide-react'

type IngredientKind = 'base' | 'additive'
type Ingredient = { id: number; name: string; amount: number; kind: IngredientKind }
type SavedCalculation = {
  id: string
  date: string
  title: string
  target: number
  ingredients: Ingredient[]
  favorite: boolean
  saved: boolean
}

const catalog = ['부여 장석', '규석', '석회석', '고령토', '백운석', '산화아연', '벤토나이트', '코발트']
const initialIngredients: Ingredient[] = [
  { id: 1, name: '부여 장석', amount: 45, kind: 'base' },
  { id: 2, name: '규석', amount: 30, kind: 'base' },
  { id: 3, name: '석회석', amount: 25, kind: 'base' },
  { id: 4, name: '산화아연', amount: 7, kind: 'additive' },
]

const formatGram = (value: number) => `${value.toFixed(2)}g`
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8080'

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...options?.headers } })
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: '서버 요청에 실패했습니다.' })) as { error?: string }
    throw new Error(body.error ?? '서버 요청에 실패했습니다.')
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>
}

function App() {
  const [active, setActive] = useState('계산기')
  const [ingredients, setIngredients] = useState(initialIngredients)
  const [target, setTarget] = useState(500)
  const [history, setHistory] = useState<SavedCalculation[]>([])
  const [resultVisible, setResultVisible] = useState(true)
  const [catalogOpen, setCatalogOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [apiOnline, setApiOnline] = useState(false)
  const [saving, setSaving] = useState(false)
  const [lastCalculationId, setLastCalculationId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([api<{ status: string }>('/api/health'), api<SavedCalculation[]>('/api/calculations')])
      .then(([, items]) => {
        if (!cancelled) { setHistory(items); setApiOnline(true) }
      })
      .catch(() => { if (!cancelled) setApiOnline(false) })
    return () => { cancelled = true }
  }, [])

  const calculation = useMemo(() => {
    const bases = ingredients.filter((item) => item.kind === 'base')
    const additives = ingredients.filter((item) => item.kind === 'additive')
    const baseTotal = bases.reduce((sum, item) => sum + item.amount, 0)
    const additiveWeights = new Map(additives.map((item) => [item.id, baseTotal * item.amount / 100]))
    const originalTotal = baseTotal + [...additiveWeights.values()].reduce((sum, value) => sum + value, 0)
    const scale = originalTotal > 0 ? target / originalTotal : 0
    const rows = ingredients.map((item) => ({
      ...item,
      originalGrams: item.kind === 'base' ? item.amount : (additiveWeights.get(item.id) ?? 0),
      scaledGrams: (item.kind === 'base' ? item.amount : (additiveWeights.get(item.id) ?? 0)) * scale,
    }))
    return { baseTotal, originalTotal, scale, rows }
  }, [ingredients, target])

  const updateIngredient = (id: number, field: 'name' | 'amount', value: string) => {
    setIngredients((items) => items.map((item) => item.id === id
      ? { ...item, [field]: field === 'amount' ? Math.max(0, Number(value)) : value }
      : item))
  }

  const addIngredient = (kind: IngredientKind, name?: string) => {
    setIngredients((items) => [...items, { id: Date.now(), name: name ?? (kind === 'base' ? '새 기본 재료' : '새 추가 재료'), amount: kind === 'base' ? 10 : 1, kind }])
    setCatalogOpen(false)
  }

  const calculate = async () => {
    if (calculation.baseTotal <= 0 || target <= 0) return
    setSaving(true)
    try {
      const record = await api<SavedCalculation>('/api/calculations', { method: 'POST', body: JSON.stringify({ target, ingredients }) })
      setResultVisible(true)
      setHistory((items) => [record, ...items])
      setLastCalculationId(record.id)
      setApiOnline(true)
      setToast('계산 결과가 서버에 기록됐어요')
    } catch (error) {
      setApiOnline(false)
      setToast(error instanceof Error ? error.message : '계산 저장에 실패했습니다')
    } finally {
      setSaving(false)
      window.setTimeout(() => setToast(''), 2400)
    }
  }

  const toggleHistory = async (id: string, field: 'favorite' | 'saved') => {
    const current = history.find((item) => item.id === id)
    if (!current) return
    try {
      const updated = await api<SavedCalculation>(`/api/calculations/${id}`, { method: 'PATCH', body: JSON.stringify({ [field]: !current[field] }) })
      setHistory((items) => items.map((item) => item.id === id ? updated : item))
      setToast(field === 'saved' ? '레시피 저장 상태를 변경했어요' : '즐겨찾기를 변경했어요')
    } catch (error) {
      setToast(error instanceof Error ? error.message : '변경에 실패했습니다')
    }
    window.setTimeout(() => setToast(''), 2400)
  }

  const navItems = [
    { label: '계산기', icon: Home },
    { label: '히스토리', icon: History },
    { label: '레시피', icon: Bookmark },
    { label: '재료', icon: Library },
  ]

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="mobile-menu" onClick={() => setMenuOpen(true)} aria-label="메뉴 열기"><Menu /></button>
        <button className="brand" onClick={() => setActive('계산기')}><span className="brand-mark"><FlaskConical size={19} /></span><span>CONE</span></button>
        <nav className="desktop-nav">
          {navItems.map(({ label }) => <button key={label} className={active === label ? 'active' : ''} onClick={() => setActive(label)}>{label}</button>)}
        </nav>
        <div className="header-actions"><span className={`api-status ${apiOnline ? 'online' : ''}`}><i></i>{apiOnline ? 'API 연결됨' : 'API 오프라인'}</span><button className="icon-button"><Search size={19} /></button><button className="avatar">M</button></div>
      </header>

      {menuOpen && <div className="drawer-backdrop" onClick={() => setMenuOpen(false)}><aside className="drawer" onClick={(event) => event.stopPropagation()}><div className="drawer-head"><div className="brand"><span className="brand-mark"><FlaskConical size={19} /></span>CONE</div><button className="icon-button" onClick={() => setMenuOpen(false)}><X /></button></div>{navItems.map(({ label, icon: Icon }) => <button className={active === label ? 'active drawer-link' : 'drawer-link'} key={label} onClick={() => { setActive(label); setMenuOpen(false) }}><Icon size={19}/>{label}</button>)}</aside></div>}

      <main>
        {active === '계산기' && <>
          <section className="hero">
            <div><p className="eyebrow"><Sparkles size={14}/> MAKE WITH PRECISION</p><h1>오늘의 유약을<br/><em>계산해 보세요.</em></h1><p>기본 재료와 첨가물을 입력하면 원하는 양으로 정확하게 환산해 드려요.</p></div>
            <div className="hero-orbit" aria-hidden="true"><div className="orbit orbit-one"></div><div className="orbit orbit-two"></div><Beaker /></div>
          </section>

          <div className="workspace-grid">
            <section className="card calculator-card">
              <div className="card-heading"><div><span className="step">01</span><h2>배합 구성</h2><p>기본 재료는 g, 첨가물은 %로 입력하세요.</p></div><button className="subtle-button"><SlidersHorizontal size={16}/> 정밀도 0.01g</button></div>
              <div className="ingredient-section">
                <div className="section-label"><div><span className="dot clay"></span><b>기본 재료</b><small>BASE · {formatGram(calculation.baseTotal)}</small></div><button onClick={() => setCatalogOpen(true)}><Plus size={16}/> 재료 추가</button></div>
                <div className="ingredient-list">
                  {ingredients.filter((item) => item.kind === 'base').map((item) => <IngredientRow key={item.id} item={item} update={updateIngredient} remove={() => setIngredients((items) => items.filter((entry) => entry.id !== item.id))} />)}
                </div>
              </div>
              <div className="ingredient-section">
                <div className="section-label"><div><span className="dot ink"></span><b>추가 재료</b><small>ADDITIVE · Base 기준</small></div><button onClick={() => addIngredient('additive')}><Plus size={16}/> 첨가물 추가</button></div>
                <div className="ingredient-list">
                  {ingredients.filter((item) => item.kind === 'additive').map((item) => <IngredientRow key={item.id} item={item} update={updateIngredient} remove={() => setIngredients((items) => items.filter((entry) => entry.id !== item.id))} />)}
                </div>
              </div>
              <div className="target-box"><div><label htmlFor="target">목표 최종 가루 중량</label><p>Base와 Additive를 모두 포함한 양이에요.</p></div><div className="target-input"><input id="target" type="number" min="1" value={target} onChange={(event) => setTarget(Number(event.target.value))}/><span>g</span></div></div>
              <button className="primary-button" disabled={calculation.baseTotal <= 0 || target <= 0 || saving} onClick={calculate}>{saving ? '서버에 저장 중…' : '배합 계산하기'} {!saving && <ArrowRight size={19}/>}</button>
            </section>

            <aside className={`card result-card ${resultVisible ? '' : 'muted'}`}>
              <div className="result-top"><div><span className="step light">02</span><h2>계량 결과</h2></div><span className="status"><Check size={13}/> 계산 완료</span></div>
              <div className="total-result"><span>목표 총량</span><strong>{target.toLocaleString()}<small>g</small></strong><p>원본 {calculation.originalTotal.toFixed(2)}g × {calculation.scale.toFixed(3)}</p></div>
              <div className="result-list">
                {calculation.rows.map((item, index) => <div className="result-row" key={item.id}><span className="result-index">{String(index + 1).padStart(2, '0')}</span><div><b>{item.name}</b><small>{item.kind === 'base' ? `${item.amount}g 입력` : `Base의 ${item.amount}%`}</small></div><strong>{formatGram(item.scaledGrams)}</strong></div>)}
              </div>
              <div className="result-footer"><span>내부 계산 합계</span><strong>{formatGram(calculation.rows.reduce((sum, item) => sum + item.scaledGrams, 0))}</strong></div>
              <p className="round-note">표시값은 0.01g 단위로 반올림됩니다. 내부 계산값의 합계는 목표량과 정확히 일치합니다.</p>
              <div className="result-actions"><button disabled={!lastCalculationId} onClick={() => lastCalculationId && toggleHistory(lastCalculationId, 'favorite')}><Star size={17}/> 즐겨찾기</button><button disabled={!lastCalculationId} onClick={() => lastCalculationId && toggleHistory(lastCalculationId, 'saved')}><Bookmark size={17}/> 레시피 저장</button></div>
            </aside>
          </div>
        </>}

        {active !== '계산기' && <CollectionView active={active} history={history} setActive={setActive} toggle={toggleHistory} />}
      </main>

      <nav className="mobile-nav">{navItems.map(({ label, icon: Icon }) => <button key={label} className={active === label ? 'active' : ''} onClick={() => setActive(label)}><Icon size={20}/><span>{label}</span></button>)}</nav>

      {catalogOpen && <div className="modal-backdrop" onClick={() => setCatalogOpen(false)}><div className="modal" onClick={(event) => event.stopPropagation()}><div className="modal-head"><div><p className="eyebrow">MATERIAL LIBRARY</p><h2>재료 선택</h2></div><button className="icon-button" onClick={() => setCatalogOpen(false)}><X/></button></div><div className="search-box"><Search size={18}/><input autoFocus placeholder="재료명, 제조사, 지역 검색"/></div><div className="catalog-list">{catalog.map((name, index) => <button key={name} onClick={() => addIngredient('base', name)}><span className="material-symbol">{name.slice(0, 1)}</span><div><b>{name}</b><small>{index < 3 ? '공용 재료 · 출처 확인됨' : '공용 재료 · 대표값'}</small></div><Plus size={18}/></button>)}</div><button className="outline-button" onClick={() => addIngredient('base', '내 재료')}>공용 DB에 없나요? 내 재료 추가</button></div></div>}
      {toast && <div className="toast"><Check size={16}/>{toast}</div>}
    </div>
  )
}

function IngredientRow({ item, update, remove }: { item: Ingredient; update: (id: number, field: 'name' | 'amount', value: string) => void; remove: () => void }) {
  return <div className="ingredient-row"><button className="select-field"><span className="material-symbol">{item.name.slice(0, 1)}</span><input value={item.name} onChange={(event) => update(item.id, 'name', event.target.value)}/><ChevronDown size={16}/></button><div className="amount-field"><input aria-label={`${item.name} 양`} type="number" min="0" step={item.kind === 'base' ? 1 : 0.1} value={item.amount} onChange={(event) => update(item.id, 'amount', event.target.value)}/><span>{item.kind === 'base' ? 'g' : '%'}</span></div><button className="remove-button" onClick={remove} aria-label={`${item.name} 삭제`}><Trash2 size={17}/></button></div>
}

function CollectionView({ active, history, setActive, toggle }: { active: string; history: SavedCalculation[]; setActive: (value: string) => void; toggle: (id: string, field: 'favorite' | 'saved') => void }) {
  const filtered = active === '레시피' ? history.filter((item) => item.saved) : history
  if (active === '재료') return <section className="page-section"><p className="eyebrow">MATERIAL LIBRARY</p><h1>재료를 더 정확하게.</h1><p className="page-intro">일반 재료와 실제 판매 제품, 지역과 성분 버전을 분리해 관리합니다.</p><div className="material-grid">{catalog.map((name, index) => <article className="material-card" key={name}><span className="material-symbol large">{name[0]}</span><div><small>{index < 5 ? '기본 재료' : '첨가물'}</small><h3>{name}</h3><p>{index % 2 ? '대표 조성 데이터' : '국내 공급 제품 · 검증됨'}</p></div><ArrowRight size={18}/></article>)}</div></section>
  return <section className="page-section"><p className="eyebrow">{active === '레시피' ? 'SAVED RECIPES' : 'CALCULATION LOG'}</p><h1>{active === '레시피' ? '다시 만들고 싶은 배합.' : '모든 계산을 잊지 않도록.'}</h1><p className="page-intro">{active === '레시피' ? '소성 테스트와 결과 사진을 쌓아가는 나만의 레시피입니다.' : '계산을 실행한 순간 자동으로 기록되며 언제든 다른 양으로 재계산할 수 있어요.'}</p><div className="history-list">{filtered.map((item) => <article className="history-card" key={item.id}><div className="history-main"><span className="history-flask"><FlaskConical/></span><div><small>{item.date}</small><h3>{item.title}</h3><p>{item.ingredients.map((entry) => entry.name).slice(0, 3).join(' · ')}{item.ingredients.length > 3 ? ` 외 ${item.ingredients.length - 3}종` : ''}</p></div></div><div className="history-meta"><strong>{item.target}<small>g</small></strong><button className={item.favorite ? 'selected' : ''} onClick={() => toggle(item.id, 'favorite')}><Star size={18}/></button><button className={item.saved ? 'selected' : ''} onClick={() => toggle(item.id, 'saved')}><Bookmark size={18}/></button><button onClick={() => setActive('계산기')}><ArrowRight size={18}/></button></div></article>)}</div>{filtered.length === 0 && <div className="empty-state"><Bookmark/><h3>저장한 레시피가 아직 없어요</h3><button className="primary-button" onClick={() => setActive('계산기')}>첫 배합 계산하기</button></div>}</section>
}

export default App

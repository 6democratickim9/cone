import { useEffect, useMemo, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import {
  ArrowRight, Beaker, Bookmark, Check, ChevronDown, Download, Flame, FlaskConical,
  History, Home, Library, Menu, Plus, RotateCcw, Search, SlidersHorizontal, Sparkles,
  Star, Trash2, Upload, WifiOff, X,
} from 'lucide-react'
import { calculateRecipe, createCalculation, matchesCalculation, validateCalculation } from './domain'
import { coneDB } from './db'
import type { Calculation, ConeBackup, FiringTest, Ingredient, IngredientKind, Material } from './types'

const publicMaterials: Material[] = [
  { id: 'feldspar-buyeo', genericName: '장석', productName: '부여 장석', manufacturer: '국내 공급', region: '한국', version: '대표값 2026', verification: '대표값', kind: 'base', custom: false },
  { id: 'silica', genericName: '규석', formula: 'SiO₂', version: '대표값 2026', verification: '확인됨', kind: 'base', custom: false },
  { id: 'limestone', genericName: '석회석', formula: 'CaCO₃', version: '대표값 2026', verification: '확인됨', kind: 'base', custom: false },
  { id: 'kaolin', genericName: '카올린', region: '미확인', verification: '대표값', kind: 'base', custom: false },
  { id: 'dolomite', genericName: '백운석', formula: 'CaMg(CO₃)₂', verification: '대표값', kind: 'base', custom: false },
  { id: 'zinc-oxide', genericName: '산화아연', formula: 'ZnO', verification: '확인됨', kind: 'additive', custom: false },
  { id: 'bentonite', genericName: '벤토나이트', verification: '대표값', kind: 'additive', custom: false },
  { id: 'cobalt', genericName: '코발트', verification: '미확인', kind: 'additive', custom: false },
]

const initialIngredients: Ingredient[] = [
  ingredientFromMaterial(publicMaterials[0], 45), ingredientFromMaterial(publicMaterials[1], 30),
  ingredientFromMaterial(publicMaterials[2], 25), ingredientFromMaterial(publicMaterials[5], 7),
]

function ingredientFromMaterial(material: Material, amount?: number): Ingredient {
  return {
    id: Date.now() + Math.floor(Math.random() * 10000), name: material.productName ?? material.genericName,
    amount: amount ?? (material.kind === 'base' ? 10 : 1), kind: material.kind,
    snapshot: { materialId: material.id, version: material.version, genericName: material.genericName, productName: material.productName, manufacturer: material.manufacturer, supplier: material.supplier, region: material.region, formula: material.formula, source: material.source, verification: material.verification },
  }
}

const formatGram = (value: number) => `${value.toFixed(2)}g`

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export default function App() {
  const [active, setActive] = useState('계산기')
  const [ingredients, setIngredients] = useState<Ingredient[]>(initialIngredients)
  const [target, setTarget] = useState(500)
  const [history, setHistory] = useState<Calculation[]>([])
  const [customMaterials, setCustomMaterials] = useState<Material[]>([])
  const [firingTests, setFiringTests] = useState<FiringTest[]>([])
  const [catalogOpen, setCatalogOpen] = useState(false)
  const [materialFormOpen, setMaterialFormOpen] = useState(false)
  const [firingRecipe, setFiringRecipe] = useState<Calculation | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [query, setQuery] = useState('')
  const [favoriteOnly, setFavoriteOnly] = useState(false)
  const [ready, setReady] = useState(false)
  const importRef = useRef<HTMLInputElement>(null)

  const refresh = async () => {
    const [calculations, materials, tests] = await Promise.all([coneDB.calculations.all(), coneDB.materials.all(), coneDB.firingTests.all()])
    setHistory(calculations.sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
    setCustomMaterials(materials)
    setFiringTests(tests)
    setReady(true)
  }

  useEffect(() => {
    void Promise.all([coneDB.calculations.all(), coneDB.materials.all(), coneDB.firingTests.all()])
      .then(([calculations, materials, tests]) => {
        setHistory(calculations.sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
        setCustomMaterials(materials)
        setFiringTests(tests)
        setReady(true)
      })
      .catch(() => setToast('기기 저장소를 열지 못했습니다.'))
  }, [])

  const calculation = useMemo(() => calculateRecipe(target, ingredients), [ingredients, target])
  const validationError = validateCalculation(target, ingredients)
  const allMaterials = [...publicMaterials, ...customMaterials]

  function showToast(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(''), 2600)
  }

  const updateIngredient = (id: number, field: 'name' | 'amount', value: string) => {
    setIngredients((items) => items.map((item) => item.id === id ? { ...item, [field]: field === 'amount' ? Math.max(0, Number(value)) : value } : item))
  }

  const addIngredient = (kind: IngredientKind, material?: Material) => {
    setIngredients((items) => [...items, material ? ingredientFromMaterial(material) : { id: Date.now(), name: kind === 'base' ? '새 기본 재료' : '새 추가 재료', amount: kind === 'base' ? 10 : 1, kind, snapshot: { genericName: '사용자 입력', verification: '미확인' } }])
    setCatalogOpen(false)
  }

  const runCalculation = async () => {
    if (validationError) { showToast(validationError); return }
    try {
      const record = createCalculation(target, ingredients)
      await coneDB.calculations.put(record)
      setHistory((items) => [record, ...items])
      showToast('계산 결과를 이 기기에 저장했습니다')
    } catch (error) { showToast(error instanceof Error ? error.message : '계산을 저장하지 못했습니다.') }
  }

  const updateCalculation = async (id: string, changes: Partial<Pick<Calculation, 'favorite' | 'saved'>>) => {
    const current = history.find((item) => item.id === id)
    if (!current) return
    const updated = { ...current, ...changes }
    await coneDB.calculations.put(updated)
    setHistory((items) => items.map((item) => item.id === id ? updated : item))
  }

  const deleteCalculation = async (item: Calculation) => {
    if (item.favorite) { showToast('즐겨찾기한 기록은 별표를 해제한 뒤 삭제할 수 있습니다.'); return }
    await coneDB.calculations.delete(item.id)
    setHistory((items) => items.filter((entry) => entry.id !== item.id))
    showToast('기록을 삭제했습니다')
  }

  const reuseCalculation = (item: Calculation) => {
    setIngredients(structuredClone(item.ingredients)); setTarget(item.target); setActive('계산기')
    showToast('입력값을 계산기로 불러왔습니다')
  }

  const exportBackup = async () => {
    try {
      const backup = await coneDB.export()
      const filename = `cone-backup-${new Date().toISOString().slice(0, 10)}.json`
      const data = JSON.stringify(backup, null, 2)
      if (Capacitor.isNativePlatform()) {
        const file = await Filesystem.writeFile({ path: filename, data, directory: Directory.Cache, encoding: Encoding.UTF8 })
        await Share.share({ title: 'CONE 전체 백업', text: '레시피, 재료, 소성 기록과 사진이 포함된 백업입니다.', url: file.uri, dialogTitle: '백업 파일 저장 또는 공유' })
      } else {
        const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }))
        const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click()
        URL.revokeObjectURL(url)
      }
      showToast('전체 백업 파일을 만들었습니다')
    } catch (error) {
      showToast(error instanceof Error ? error.message : '백업 파일을 만들지 못했습니다.')
    }
  }

  const importBackup = async (file?: File) => {
    if (!file) return
    try {
      const backup = JSON.parse(await file.text()) as ConeBackup
      await coneDB.import(backup); await refresh(); showToast('백업 데이터를 복원했습니다')
    } catch (error) { showToast(error instanceof Error ? error.message : '백업 파일을 읽지 못했습니다.') }
  }

  const navItems = [{ label: '계산기', icon: Home }, { label: '히스토리', icon: History }, { label: '레시피', icon: Bookmark }, { label: '재료', icon: Library }]

  return <div className="app-shell">
    <header className="topbar">
      <button className="mobile-menu" onClick={() => setMenuOpen(true)} aria-label="메뉴 열기"><Menu /></button>
      <button className="brand" onClick={() => setActive('계산기')}><span className="brand-mark"><FlaskConical size={19}/></span><span>CONE</span></button>
      <nav className="desktop-nav">{navItems.map(({ label }) => <button key={label} className={active === label ? 'active' : ''} onClick={() => setActive(label)}>{label}</button>)}</nav>
      <div className="header-actions"><span className={`api-status ${ready ? 'online' : ''}`}><i></i>{ready ? '기기 저장됨' : '저장소 준비 중'}</span><button className="icon-button" onClick={exportBackup} aria-label="JSON 백업"><Download size={18}/></button><button className="avatar">M</button></div>
    </header>

    {menuOpen && <div className="drawer-backdrop" onClick={() => setMenuOpen(false)}><aside className="drawer" onClick={(event) => event.stopPropagation()}><div className="drawer-head"><div className="brand"><span className="brand-mark"><FlaskConical size={19}/></span>CONE</div><button className="icon-button" onClick={() => setMenuOpen(false)}><X/></button></div>{navItems.map(({ label, icon: Icon }) => <button className={active === label ? 'active drawer-link' : 'drawer-link'} key={label} onClick={() => { setActive(label); setMenuOpen(false) }}><Icon size={19}/>{label}</button>)}</aside></div>}

    <main>
      {active === '계산기' ? <Calculator ingredients={ingredients} target={target} calculation={calculation} validationError={validationError} updateIngredient={updateIngredient} setIngredients={setIngredients} setTarget={setTarget} addIngredient={addIngredient} openCatalog={() => setCatalogOpen(true)} calculate={runCalculation}/> :
        <CollectionView active={active} history={history} materials={allMaterials} firingTests={firingTests} query={query} favoriteOnly={favoriteOnly} setQuery={setQuery} setFavoriteOnly={setFavoriteOnly} toggle={updateCalculation} remove={deleteCalculation} reuse={reuseCalculation} addFiring={setFiringRecipe} openMaterialForm={() => setMaterialFormOpen(true)} exportBackup={exportBackup} importClick={() => importRef.current?.click()}/>
      }
    </main>

    <nav className="mobile-nav">{navItems.map(({ label, icon: Icon }) => <button key={label} className={active === label ? 'active' : ''} onClick={() => setActive(label)}><Icon size={20}/><span>{label}</span></button>)}</nav>
    <input ref={importRef} hidden type="file" accept="application/json,.json" onChange={(event) => importBackup(event.target.files?.[0])}/>
    {catalogOpen && <MaterialPicker
      materials={allMaterials}
      close={() => setCatalogOpen(false)}
      select={(material) => addIngredient(material.kind, material)}
      create={() => { setCatalogOpen(false); setMaterialFormOpen(true) }}
    />}
    {materialFormOpen && <MaterialForm
      close={() => setMaterialFormOpen(false)}
      save={async (material) => {
        await coneDB.materials.put(material)
        setCustomMaterials((items) => [...items, material])
        setMaterialFormOpen(false)
        showToast('내 재료를 저장했습니다')
      }}
    />}
    {firingRecipe && <FiringForm
      recipe={firingRecipe}
      close={() => setFiringRecipe(null)}
      save={async (test) => {
        await coneDB.firingTests.put(test)
        setFiringTests((items) => [...items, test])
        setFiringRecipe(null)
        showToast('소성 기록을 이 기기에 저장했습니다')
      }}
    />}
    {toast && <div className="toast"><Check size={16}/>{toast}</div>}
  </div>
}

type CalculatorProps = {
  ingredients: Ingredient[]; target: number; calculation: ReturnType<typeof calculateRecipe>; validationError: string | null
  updateIngredient: (id: number, field: 'name' | 'amount', value: string) => void; setIngredients: React.Dispatch<React.SetStateAction<Ingredient[]>>
  setTarget: (value: number) => void; addIngredient: (kind: IngredientKind) => void; openCatalog: () => void; calculate: () => void
}

function Calculator({ ingredients, target, calculation, validationError, updateIngredient, setIngredients, setTarget, addIngredient, openCatalog, calculate }: CalculatorProps) {
  return <><section className="hero"><div><p className="eyebrow"><Sparkles size={14}/> LOCAL-FIRST POTTERY LOG</p><h1>오늘의 유약을<br/><em>계산해 보세요.</em></h1><p><WifiOff size={14}/> 로그인 없이, 인터넷 없이, 이 기기 안에서 안전하게.</p></div><div className="hero-orbit" aria-hidden="true"><div className="orbit orbit-one"></div><div className="orbit orbit-two"></div><Beaker/></div></section>
    <div className="workspace-grid"><section className="card calculator-card"><div className="card-heading"><div><span className="step">01</span><h2>배합 구성</h2><p>기본 재료는 g, 첨가물은 %로 입력하세요.</p></div><button className="subtle-button"><SlidersHorizontal size={16}/> 정밀도 0.01g</button></div>
      {(['base', 'additive'] as IngredientKind[]).map((kind) => <div className="ingredient-section" key={kind}><div className="section-label"><div><span className={`dot ${kind === 'base' ? 'clay' : 'ink'}`}></span><b>{kind === 'base' ? '기본 재료' : '추가 재료'}</b><small>{kind === 'base' ? `BASE · ${formatGram(calculation.baseTotal)}` : 'ADDITIVE · Base 기준'}</small></div><button onClick={kind === 'base' ? openCatalog : () => addIngredient('additive')}><Plus size={16}/>{kind === 'base' ? '재료 추가' : '첨가물 추가'}</button></div><div className="ingredient-list">{ingredients.filter((item) => item.kind === kind).map((item) => <IngredientRow key={item.id} item={item} update={updateIngredient} remove={() => setIngredients((items) => items.filter((entry) => entry.id !== item.id))}/>)}</div></div>)}
      <div className="target-box"><div><label htmlFor="target">목표 최종 가루 중량</label><p>Base와 Additive를 모두 포함한 양이에요.</p></div><div className="target-input"><input id="target" type="number" min="1" value={target} onChange={(event) => setTarget(Number(event.target.value))}/><span>g</span></div></div>
      {validationError && <p className="validation-message">{validationError}</p>}<button className="primary-button" disabled={!!validationError} onClick={calculate}>계산하고 기기에 저장 <ArrowRight size={19}/></button>
    </section><aside className="card result-card"><div className="result-top"><div><span className="step light">02</span><h2>계량 결과</h2></div><span className="status"><Check size={13}/> 즉시 계산</span></div><div className="total-result"><span>목표 총량</span><strong>{target.toLocaleString()}<small>g</small></strong><p>원본 {calculation.originalTotal.toFixed(2)}g × {calculation.scale.toFixed(3)}</p></div><div className="result-list">{calculation.rows.map((item, index) => <div className="result-row" key={item.id}><span className="result-index">{String(index + 1).padStart(2, '0')}</span><div><b>{item.name}</b><small>{item.kind === 'base' ? `${item.amount}g 입력` : `Base의 ${item.amount}%`} · {item.snapshot?.verification ?? '미확인'}</small></div><strong>{formatGram(item.scaledGrams)}</strong></div>)}</div><div className="result-footer"><span>내부 계산 합계</span><strong>{formatGram(calculation.rows.reduce((sum, item) => sum + item.scaledGrams, 0))}</strong></div><p className="round-note">표시값은 0.01g 단위로 반올림됩니다. 내부 계산값의 합계는 목표량과 정확히 일치합니다.</p></aside></div></>
}

function IngredientRow({ item, update, remove }: { item: Ingredient; update: (id: number, field: 'name' | 'amount', value: string) => void; remove: () => void }) {
  return <div className="ingredient-row"><button className="select-field"><span className="material-symbol">{item.name[0]}</span><input value={item.name} onChange={(event) => update(item.id, 'name', event.target.value)}/><ChevronDown size={16}/></button><div className="amount-field"><input aria-label={`${item.name} 양`} type="number" min="0" step={item.kind === 'base' ? 1 : 0.1} value={item.amount} onChange={(event) => update(item.id, 'amount', event.target.value)}/><span>{item.kind === 'base' ? 'g' : '%'}</span></div><button className="remove-button" onClick={remove} aria-label={`${item.name} 삭제`}><Trash2 size={17}/></button></div>
}

type CollectionProps = { active: string; history: Calculation[]; materials: Material[]; firingTests: FiringTest[]; query: string; favoriteOnly: boolean; setQuery: (v: string) => void; setFavoriteOnly: (v: boolean) => void; toggle: (id: string, changes: Partial<Pick<Calculation, 'favorite' | 'saved'>>) => void; remove: (item: Calculation) => void; reuse: (item: Calculation) => void; addFiring: (item: Calculation) => void; openMaterialForm: () => void; exportBackup: () => void; importClick: () => void }

function CollectionView(props: CollectionProps) {
  if (props.active === '재료') return <section className="page-section"><div className="page-actions"><div><p className="eyebrow">MATERIAL LIBRARY</p><h1>재료를 더 정확하게.</h1></div><button className="primary-compact" onClick={props.openMaterialForm}><Plus size={16}/> 내 재료</button></div><p className="page-intro">일반 재료와 실제 제품, 지역과 성분 버전을 구분해 계산 시점의 정보로 보존합니다.</p><div className="backup-panel"><div><b>내 데이터는 이 기기에 저장됩니다</b><p>정기적으로 JSON 파일을 내려받아 별도로 보관해 주세요.</p></div><button onClick={props.exportBackup}><Download size={16}/> 백업</button><button onClick={props.importClick}><Upload size={16}/> 복원</button></div><div className="material-grid">{props.materials.map((material) => <article className="material-card" key={material.id}><span className="material-symbol large">{material.genericName[0]}</span><div><small>{material.custom ? '내 재료' : material.kind === 'base' ? '기본 재료' : '첨가물'} · {material.verification}</small><h3>{material.productName ?? material.genericName}</h3><p>{[material.manufacturer, material.region, material.formula].filter(Boolean).join(' · ') || '자료 없음'}</p></div></article>)}</div></section>

  let items = props.active === '레시피' ? props.history.filter((item) => item.saved) : props.history
  items = items.filter((item) => matchesCalculation(item, props.query) && (!props.favoriteOnly || item.favorite))
  return <section className="page-section"><p className="eyebrow">{props.active === '레시피' ? 'SAVED RECIPES' : 'CALCULATION LOG'}</p><h1>{props.active === '레시피' ? '다시 만들고 싶은 배합.' : '모든 계산을 잊지 않도록.'}</h1><p className="page-intro">{props.active === '레시피' ? '소성 테스트와 결과 사진을 기기에 쌓아가는 나만의 레시피입니다.' : '계산 실행 단위로 자동 기록되며 날짜와 재료명으로 찾을 수 있어요.'}</p><div className="collection-tools"><div className="search-box"><Search size={17}/><input value={props.query} onChange={(event) => props.setQuery(event.target.value)} placeholder="날짜 또는 재료명 검색"/></div><button className={props.favoriteOnly ? 'selected' : ''} onClick={() => props.setFavoriteOnly(!props.favoriteOnly)}><Star size={17}/> 즐겨찾기만</button></div><div className="history-list">{items.map((item) => <article className="history-card" key={item.id}><div className="history-main"><span className="history-flask"><FlaskConical/></span><div><small>{new Date(item.createdAt).toLocaleString('ko-KR')}</small><h3>{item.title}</h3><p>{item.ingredients.map((entry) => entry.name).slice(0, 3).join(' · ')}{item.ingredients.length > 3 ? ` 외 ${item.ingredients.length - 3}종` : ''}{props.active === '레시피' ? ` · 소성 ${props.firingTests.filter((test) => test.recipeId === item.id).length}건` : ''}</p></div></div><div className="history-meta"><strong>{item.target}<small>g</small></strong><button className={item.favorite ? 'selected' : ''} onClick={() => props.toggle(item.id, { favorite: !item.favorite })} aria-label="즐겨찾기"><Star size={17}/></button><button className={item.saved ? 'selected' : ''} onClick={() => props.toggle(item.id, { saved: !item.saved })} aria-label="레시피 저장"><Bookmark size={17}/></button><button onClick={() => props.reuse(item)} aria-label="다시 계산"><RotateCcw size={17}/></button>{props.active === '레시피' && <button onClick={() => props.addFiring(item)} aria-label="소성 기록"><Flame size={17}/></button>}<button onClick={() => props.remove(item)} aria-label="삭제"><Trash2 size={17}/></button></div></article>)}</div>{items.length === 0 && <div className="empty-state"><Bookmark/><h3>{props.query ? '검색 결과가 없어요' : '아직 기록이 없어요'}</h3><p>계산을 실행하면 이 기기에 자동으로 기록됩니다.</p></div>}</section>
}

function Modal({ children, close }: { children: React.ReactNode; close: () => void }) { return <div className="modal-backdrop" onClick={close}><div className="modal" onClick={(event) => event.stopPropagation()}>{children}</div></div> }

function MaterialPicker({ materials, close, select, create }: { materials: Material[]; close: () => void; select: (m: Material) => void; create: () => void }) {
  const [search, setSearch] = useState('')
  const filtered = materials.filter((item) => `${item.genericName} ${item.productName ?? ''} ${item.manufacturer ?? ''} ${item.region ?? ''}`.toLocaleLowerCase('ko').includes(search.toLocaleLowerCase('ko')))
  return <Modal close={close}><div className="modal-head"><div><p className="eyebrow">MATERIAL LIBRARY</p><h2>재료 선택</h2></div><button className="icon-button" onClick={close}><X/></button></div><div className="search-box"><Search size={18}/><input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="재료명, 제조사, 지역 검색"/></div><div className="catalog-list">{filtered.map((material) => <button key={material.id} onClick={() => select(material)}><span className="material-symbol">{material.genericName[0]}</span><div><b>{material.productName ?? material.genericName}</b><small>{material.verification} · {material.region ?? '지역 미확인'}</small></div><Plus size={18}/></button>)}</div><button className="outline-button" onClick={create}>공용 DB에 없나요? 내 재료 추가</button></Modal>
}

function MaterialForm({ close, save }: { close: () => void; save: (m: Material) => void }) {
  const [name, setName] = useState(''); const [manufacturer, setManufacturer] = useState(''); const [region, setRegion] = useState(''); const [formula, setFormula] = useState(''); const [kind, setKind] = useState<IngredientKind>('base')
  return <Modal close={close}><div className="modal-head"><div><p className="eyebrow">MY MATERIAL</p><h2>내 재료 추가</h2></div><button className="icon-button" onClick={close}><X/></button></div><div className="form-grid"><label>재료명<input value={name} onChange={(e) => setName(e.target.value)}/></label><label>구분<select value={kind} onChange={(e) => setKind(e.target.value as IngredientKind)}><option value="base">기본 재료</option><option value="additive">추가 재료</option></select></label><label>제조사·브랜드<input value={manufacturer} onChange={(e) => setManufacturer(e.target.value)}/></label><label>국가·지역<input value={region} onChange={(e) => setRegion(e.target.value)}/></label><label className="full">화학식 또는 메모<input value={formula} onChange={(e) => setFormula(e.target.value)}/></label></div><button className="primary-button" disabled={!name.trim()} onClick={() => save({ id: crypto.randomUUID(), genericName: name.trim(), manufacturer, region, formula, verification: '사용자 입력', kind, custom: true })}>내 재료 저장</button></Modal>
}

function FiringForm({ recipe, close, save }: { recipe: Calculation; close: () => void; save: (t: FiringTest) => void }) {
  const [name, setName] = useState('1차 테스트'); const [clay, setClay] = useState(''); const [temperature, setTemperature] = useState(1250); const [atmosphere, setAtmosphere] = useState<FiringTest['atmosphere']>('산화'); const [kiln, setKiln] = useState(''); const [hours, setHours] = useState(0); const [notes, setNotes] = useState(''); const [photos, setPhotos] = useState<File[]>([])
  return <Modal close={close}><div className="modal-head"><div><p className="eyebrow">FIRING TEST · {recipe.title}</p><h2>소성 기록</h2></div><button className="icon-button" onClick={close}><X/></button></div><div className="form-grid"><label>테스트명<input value={name} onChange={(e) => setName(e.target.value)}/></label><label>사용한 흙·소지<input value={clay} onChange={(e) => setClay(e.target.value)}/></label><label>최고 온도 ℃<input type="number" value={temperature} onChange={(e) => setTemperature(Number(e.target.value))}/></label><label>분위기<select value={atmosphere} onChange={(e) => setAtmosphere(e.target.value as FiringTest['atmosphere'])}><option>산화</option><option>환원</option><option>기타</option></select></label><label>가마<input value={kiln} onChange={(e) => setKiln(e.target.value)}/></label><label>총 소성 시간<input type="number" value={hours} onChange={(e) => setHours(Number(e.target.value))}/></label><label className="full">사진<input type="file" accept="image/*" multiple onChange={(e) => setPhotos(Array.from(e.target.files ?? []))}/></label><label className="full">결과 메모<textarea value={notes} onChange={(e) => setNotes(e.target.value)}/></label></div><p className="local-note"><WifiOff size={14}/> 사진 원본도 기기에 저장되며 전체 백업 파일에 함께 포함됩니다.</p><button className="primary-button" disabled={!name.trim()} onClick={async () => save({ id: crypto.randomUUID(), recipeId: recipe.id, name, date: new Date().toISOString(), clay, thickness: '', peakTemperature: temperature, atmosphere, kiln, durationHours: hours, notes, photos: await Promise.all(photos.map(async (photo) => ({ id: crypto.randomUUID(), name: photo.name, type: photo.type, size: photo.size, data: await fileToDataUrl(photo) }))) })}>소성 기록 저장</button></Modal>
}

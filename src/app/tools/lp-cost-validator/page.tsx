'use client'
import { useState, useMemo, useEffect } from 'react'

// ============================================================
// TYPES
// ============================================================
type CostType = 'fixed' | 'per_client'

type CostItem = {
  id: string
  name: string
  category: string
  monthlyJpy: number
  type: CostType
}

type Scenario = {
  id: string
  name: string
  monthlyFeePerClient: number
  initialBuildCost: number
  contractMonths: number
  costs: CostItem[]
  notes?: string
  createdAt: number
  updatedAt: number
}

// ============================================================
// CATEGORIES & TOOL LIBRARY
// ============================================================
const CATS = {
  hosting: 'ホスティング',
  cms: 'CMS',
  db: 'データベース',
  domain: 'ドメイン',
  legacy: '従来型ホスティング',
  ops: '保守・運用',
} as const

const LIB: Omit<CostItem, 'id'>[] = [
  // Hosting
  { name: 'Vercel Hobby (個人用のみ)', category: CATS.hosting, monthlyJpy: 0, type: 'fixed' },
  { name: 'Vercel Pro (月払い)', category: CATS.hosting, monthlyJpy: 3000, type: 'fixed' },
  { name: 'Vercel Pro (年契約)', category: CATS.hosting, monthlyJpy: 2500, type: 'fixed' },
  { name: 'Cloudflare Pages', category: CATS.hosting, monthlyJpy: 0, type: 'fixed' },
  { name: 'Netlify Starter', category: CATS.hosting, monthlyJpy: 0, type: 'fixed' },
  // CMS
  { name: 'Sanity Free', category: CATS.cms, monthlyJpy: 0, type: 'fixed' },
  { name: 'Sanity Growth (1 seat)', category: CATS.cms, monthlyJpy: 2250, type: 'fixed' },
  { name: 'Storyblok Starter', category: CATS.cms, monthlyJpy: 0, type: 'fixed' },
  { name: 'Storyblok Entry', category: CATS.cms, monthlyJpy: 14850, type: 'fixed' },
  { name: 'Payload (セルフホスト)', category: CATS.cms, monthlyJpy: 0, type: 'fixed' },
  { name: 'Strapi Community', category: CATS.cms, monthlyJpy: 0, type: 'fixed' },
  { name: 'Contentful Free', category: CATS.cms, monthlyJpy: 0, type: 'fixed' },
  // DB
  { name: 'Supabase Free', category: CATS.db, monthlyJpy: 0, type: 'fixed' },
  { name: 'Supabase Pro', category: CATS.db, monthlyJpy: 3750, type: 'fixed' },
  { name: 'Neon Free', category: CATS.db, monthlyJpy: 0, type: 'fixed' },
  { name: 'Neon Launch', category: CATS.db, monthlyJpy: 2850, type: 'fixed' },
  // Domain
  { name: '.com ドメイン', category: CATS.domain, monthlyJpy: 150, type: 'per_client' },
  { name: '.jp ドメイン', category: CATS.domain, monthlyJpy: 350, type: 'per_client' },
  // Legacy
  { name: 'Xserver スタンダード', category: CATS.legacy, monthlyJpy: 990, type: 'per_client' },
  { name: 'ConoHa WING ベーシック', category: CATS.legacy, monthlyJpy: 1210, type: 'per_client' },
  // Ops
  { name: 'WordPress 保守工数', category: CATS.ops, monthlyJpy: 2000, type: 'per_client' },
  { name: 'WordPress セキュリティ', category: CATS.ops, monthlyJpy: 1000, type: 'per_client' },
  { name: 'バックアップサービス', category: CATS.ops, monthlyJpy: 500, type: 'per_client' },
]

// ============================================================
// UTILS
// ============================================================
const uid = () => Math.random().toString(36).slice(2, 10)
const yen = (n: number) => '¥' + Math.round(n).toLocaleString()
const pct = (n: number) => (Math.round(n * 10) / 10).toFixed(1) + '%'
const months = (n: number) => n === Infinity ? '回収不可' : `${(Math.round(n * 10) / 10).toFixed(1)}ヶ月`

// ============================================================
// DEFAULT SCENARIOS
// ============================================================
function makeDefaults(): Scenario[] {
  const now = Date.now()
  return [
    {
      id: 'default-claude',
      name: 'Claude Build (Vercel + Sanity)',
      monthlyFeePerClient: 8000,
      initialBuildCost: 20000,
      contractMonths: 24,
      costs: [
        { id: uid(), name: 'Vercel Pro (月払い)', category: CATS.hosting, monthlyJpy: 3000, type: 'fixed' },
        { id: uid(), name: 'Sanity Free', category: CATS.cms, monthlyJpy: 0, type: 'fixed' },
        { id: uid(), name: '.com ドメイン', category: CATS.domain, monthlyJpy: 150, type: 'per_client' },
      ],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'default-wp',
      name: 'WordPress Build (一般制作会社)',
      monthlyFeePerClient: 10000,
      initialBuildCost: 150000,
      contractMonths: 24,
      costs: [
        { id: uid(), name: 'Xserver スタンダード', category: CATS.legacy, monthlyJpy: 990, type: 'per_client' },
        { id: uid(), name: '.jp ドメイン', category: CATS.domain, monthlyJpy: 350, type: 'per_client' },
        { id: uid(), name: 'WordPress 保守工数', category: CATS.ops, monthlyJpy: 2000, type: 'per_client' },
        { id: uid(), name: 'WordPress セキュリティ', category: CATS.ops, monthlyJpy: 1000, type: 'per_client' },
      ],
      createdAt: now,
      updatedAt: now,
    },
  ]
}

// ============================================================
// STORAGE
// ============================================================
const STORAGE_KEY = 'lp-cost-validator-v1'

function loadScenarios(): Scenario[] {
  if (typeof window === 'undefined') return makeDefaults()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return makeDefaults()
    const parsed = JSON.parse(raw) as Scenario[]
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : makeDefaults()
  } catch {
    return makeDefaults()
  }
}

function persistScenarios(s: Scenario[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  } catch {}
}

// ============================================================
// CALCULATIONS
// ============================================================
type CalcResult = {
  fixedTotal: number
  perClientTotal: number
  monthlyRevenue: number
  monthlyCost: number
  monthlyProfit: number
  profitPerClient: number
  costPerClient: number
  margin: number
  recoupMonths: number
  ltvRevenue: number
  ltvCostPerClient: number
  ltvProfitPerClient: number
  totalLtvProfit: number
}

function calc(s: Scenario, n: number): CalcResult {
  const fixedTotal = s.costs.filter(c => c.type === 'fixed').reduce((a, c) => a + c.monthlyJpy, 0)
  const perClientTotal = s.costs.filter(c => c.type === 'per_client').reduce((a, c) => a + c.monthlyJpy, 0)
  const monthlyRevenue = s.monthlyFeePerClient * n
  const monthlyCost = fixedTotal + perClientTotal * n
  const monthlyProfit = monthlyRevenue - monthlyCost
  const profitPerClient = n > 0 ? monthlyProfit / n : 0
  const costPerClient = n > 0 ? monthlyCost / n : 0
  const margin = monthlyRevenue > 0 ? (monthlyProfit / monthlyRevenue) * 100 : 0
  const recoupMonths = profitPerClient > 0 ? s.initialBuildCost / profitPerClient : Infinity
  const ltvRevenue = s.monthlyFeePerClient * s.contractMonths
  const ltvCostPerClient = costPerClient * s.contractMonths + s.initialBuildCost
  const ltvProfitPerClient = ltvRevenue - ltvCostPerClient
  const totalLtvProfit = ltvProfitPerClient * n
  return {
    fixedTotal, perClientTotal,
    monthlyRevenue, monthlyCost, monthlyProfit,
    profitPerClient, costPerClient, margin, recoupMonths,
    ltvRevenue, ltvCostPerClient, ltvProfitPerClient, totalLtvProfit,
  }
}

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function Page() {
  const [hydrated, setHydrated] = useState(false)
  const [tab, setTab] = useState<'scenario' | 'compare'>('scenario')
  const [advanced, setAdvanced] = useState(false)
  const [scenarios, setScenarios] = useState<Scenario[]>(makeDefaults)
  const [currentId, setCurrentId] = useState<string>('default-claude')
  const [numClients, setNumClients] = useState(10)
  const [editMode, setEditMode] = useState(false)
  const [showLib, setShowLib] = useState(false)
  const [compareLeftId, setCompareLeftId] = useState<string>('default-claude')
  const [compareRightId, setCompareRightId] = useState<string>('default-wp')

  // Hydrate from localStorage on mount
  useEffect(() => {
    const loaded = loadScenarios()
    setScenarios(loaded)
    if (loaded.length > 0) {
      setCurrentId(loaded[0].id)
      setCompareLeftId(loaded[0].id)
      setCompareRightId(loaded[Math.min(1, loaded.length - 1)].id)
    }
    setHydrated(true)
  }, [])

  // Persist on changes (only after hydration to avoid stomping localStorage with defaults)
  useEffect(() => {
    if (hydrated) persistScenarios(scenarios)
  }, [scenarios, hydrated])

  const current = scenarios.find(s => s.id === currentId) || scenarios[0]
  const result = useMemo(() => current ? calc(current, numClients) : null, [current, numClients])

  const updateCurrent = (patch: Partial<Scenario>) => {
    setScenarios(scenarios.map(s => s.id === currentId ? { ...s, ...patch, updatedAt: Date.now() } : s))
  }

  const addCost = (item: Omit<CostItem, 'id'>) => {
    if (!current) return
    updateCurrent({ costs: [...current.costs, { ...item, id: uid() }] })
  }

  const updateCost = (i: number, patch: Partial<CostItem>) => {
    if (!current) return
    const newCosts = [...current.costs]
    newCosts[i] = { ...newCosts[i], ...patch }
    updateCurrent({ costs: newCosts })
  }

  const deleteCost = (i: number) => {
    if (!current) return
    const newCosts = [...current.costs]
    newCosts.splice(i, 1)
    updateCurrent({ costs: newCosts })
  }

  const newScenario = () => {
    const s: Scenario = {
      id: uid(),
      name: '新しいシナリオ',
      monthlyFeePerClient: 8000,
      initialBuildCost: 20000,
      contractMonths: 24,
      costs: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    setScenarios([...scenarios, s])
    setCurrentId(s.id)
    setEditMode(true)
  }

  const duplicateScenario = () => {
    if (!current) return
    const s: Scenario = {
      ...current,
      id: uid(),
      name: current.name + ' (コピー)',
      costs: current.costs.map(c => ({ ...c, id: uid() })),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    setScenarios([...scenarios, s])
    setCurrentId(s.id)
  }

  const deleteScenario = () => {
    if (!current || scenarios.length <= 1) return
    if (!window.confirm(`「${current.name}」を削除しますか？`)) return
    const remaining = scenarios.filter(s => s.id !== currentId)
    setScenarios(remaining)
    setCurrentId(remaining[0].id)
  }

  const resetDefaults = () => {
    if (!window.confirm('全シナリオを初期状態にリセットしますか？保存されたデータは消えます。')) return
    const d = makeDefaults()
    setScenarios(d)
    setCurrentId(d[0].id)
    setCompareLeftId(d[0].id)
    setCompareRightId(d[1].id)
  }

  if (!current || !result) return null

  const leftScenario = scenarios.find(s => s.id === compareLeftId) || current
  const rightScenario = scenarios.find(s => s.id === compareRightId) || current
  const leftResult = calc(leftScenario, numClients)
  const rightResult = calc(rightScenario, numClients)

  // Group library by category for the picker
  const libByCategory: Record<string, Omit<CostItem, 'id'>[]> = {}
  for (const item of LIB) {
    if (!libByCategory[item.category]) libByCategory[item.category] = []
    libByCategory[item.category].push(item)
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <h1 className="text-2xl font-bold mb-1">LP コスト検証ツール</h1>
        <p className="text-sm text-muted-foreground mb-6">
          月額制LP事業の実コスト・利益を試算。シナリオを保存して「比較」タブで2つを並べて検証。
        </p>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 border-b">
          <button
            onClick={() => setTab('scenario')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === 'scenario'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            シナリオ作成
          </button>
          <button
            onClick={() => setTab('compare')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === 'compare'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            比較
          </button>
        </div>

        {/* Advanced toggle (always visible) */}
        <div className="flex items-center justify-between mb-4 px-1">
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={advanced}
              onChange={e => setAdvanced(e.target.checked)}
              className="rounded"
            />
            詳細モード（初期費用・LTV・回収月数を表示）
          </label>
          {tab === 'scenario' && (
            <button onClick={resetDefaults} className="text-[10px] text-muted-foreground hover:text-destructive">
              初期状態にリセット
            </button>
          )}
        </div>

        {/* ============================================================ */}
        {/* SCENARIO TAB */}
        {/* ============================================================ */}
        {tab === 'scenario' && (
          <>
            {/* Scenario selector */}
            <div className="bg-card rounded-xl border p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  保存済みシナリオ
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={newScenario}
                    className="px-2 py-1 rounded-md text-xs border hover:bg-secondary"
                  >
                    + 新規
                  </button>
                  <button
                    onClick={duplicateScenario}
                    className="px-2 py-1 rounded-md text-xs border hover:bg-secondary"
                  >
                    複製
                  </button>
                  {scenarios.length > 1 && (
                    <button
                      onClick={deleteScenario}
                      className="px-2 py-1 rounded-md text-xs border text-destructive hover:bg-destructive/10"
                    >
                      削除
                    </button>
                  )}
                </div>
              </div>
              <select
                value={currentId}
                onChange={e => setCurrentId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {scenarios.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <input
                value={current.name}
                onChange={e => updateCurrent({ name: e.target.value })}
                placeholder="シナリオ名"
                className="w-full mt-2 px-3 py-2 rounded-lg border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="text-[10px] text-muted-foreground mt-1.5">
                変更は自動的にブラウザに保存されます（localStorage）
              </p>
            </div>

            {/* Inputs */}
            <div className="bg-card rounded-xl border p-4 mb-4">
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">
                    月額料金（クライアント1件あたり）
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">¥</span>
                    <input
                      type="number"
                      value={current.monthlyFeePerClient}
                      onChange={e => updateCurrent({ monthlyFeePerClient: parseInt(e.target.value) || 0 })}
                      className="flex-1 px-3 py-2 rounded-lg border text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <span className="text-xs text-muted-foreground">/ 月</span>
                  </div>
                </div>
                {advanced && (
                  <>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">
                        初期構築コスト（労務）
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">¥</span>
                        <input
                          type="number"
                          value={current.initialBuildCost}
                          onChange={e => updateCurrent({ initialBuildCost: parseInt(e.target.value) || 0 })}
                          className="flex-1 px-3 py-2 rounded-lg border text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                        <span className="text-xs text-muted-foreground">/ 件</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        0円初期費用モデルで自社が負担する構築労務コスト
                      </p>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">契約期間</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={current.contractMonths}
                          onChange={e => updateCurrent({ contractMonths: parseInt(e.target.value) || 1 })}
                          className="flex-1 px-3 py-2 rounded-lg border text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                        <span className="text-xs text-muted-foreground">ヶ月</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Cost items section header */}
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                コスト項目
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => setShowLib(!showLib)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    showLib ? 'bg-primary text-primary-foreground' : 'border hover:bg-secondary'
                  }`}
                >
                  {showLib ? '閉じる' : 'ライブラリから追加'}
                </button>
                <button
                  onClick={() => setEditMode(!editMode)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    editMode ? 'bg-primary text-primary-foreground' : 'border hover:bg-secondary'
                  }`}
                >
                  {editMode ? '完了' : '編集'}
                </button>
              </div>
            </div>

            {/* Library picker */}
            {showLib && (
              <div className="bg-card rounded-xl border p-3 mb-3 max-h-96 overflow-y-auto">
                {Object.entries(libByCategory).map(([cat, items]) => (
                  <div key={cat} className="mb-3 last:mb-0">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                      {cat}
                    </p>
                    <div className="space-y-1">
                      {items.map((item, i) => (
                        <button
                          key={i}
                          onClick={() => addCost(item)}
                          className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-xs hover:bg-secondary text-left"
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            <span className="font-medium truncate">{item.name}</span>
                            <span
                              className={`text-[9px] px-1.5 py-0.5 rounded flex-shrink-0 ${
                                item.type === 'fixed'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-amber-100 text-amber-700'
                              }`}
                            >
                              {item.type === 'fixed' ? '固定' : '従量'}
                            </span>
                          </span>
                          <span className="text-muted-foreground flex-shrink-0">
                            {yen(item.monthlyJpy)}/月
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <button
                  onClick={() =>
                    addCost({ name: '新しい項目', category: 'カスタム', monthlyJpy: 0, type: 'fixed' })
                  }
                  className="w-full mt-2 py-2 rounded-lg border border-dashed text-xs text-muted-foreground hover:border-primary hover:text-primary"
                >
                  + カスタム項目を追加
                </button>
              </div>
            )}

            {/* Cost items list */}
            <div className="space-y-2 mb-6">
              {current.costs.length === 0 && (
                <div className="text-center py-6 text-xs text-muted-foreground bg-card rounded-xl border border-dashed">
                  コスト項目がありません。「ライブラリから追加」ボタンから追加してください。
                </div>
              )}
              {current.costs.map((c, i) => (
                <div key={c.id} className="bg-card rounded-xl border p-3">
                  {editMode ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <input
                        value={c.name}
                        onChange={e => updateCost(i, { name: e.target.value })}
                        className="flex-1 min-w-[120px] px-2 py-1.5 rounded-lg border text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                      <select
                        value={c.type}
                        onChange={e => updateCost(i, { type: e.target.value as CostType })}
                        className="px-2 py-1.5 rounded-lg border text-xs bg-card focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="fixed">固定</option>
                        <option value="per_client">従量</option>
                      </select>
                      <span className="text-xs">¥</span>
                      <input
                        type="number"
                        value={c.monthlyJpy}
                        onChange={e => updateCost(i, { monthlyJpy: parseInt(e.target.value) || 0 })}
                        className="w-24 px-2 py-1.5 rounded-lg border text-sm text-right bg-card focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                      <button
                        onClick={() => deleteCost(i)}
                        className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        aria-label="削除"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold">{c.name}</span>
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded ${
                              c.type === 'fixed'
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-amber-100 text-amber-700'
                            }`}
                          >
                            {c.type === 'fixed' ? '固定' : '従量'}
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">{c.category}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">{yen(c.monthlyJpy)}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {c.type === 'fixed' ? '/ 月（合計固定）' : '/ 月 / 件'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Slider */}
            <div className="mb-6">
              <div className="flex justify-between items-baseline mb-1">
                <span className="text-sm text-muted-foreground">クライアント数</span>
                <span className="text-lg font-semibold">{numClients} 件</span>
              </div>
              <input
                type="range"
                min={1}
                max={100}
                step={1}
                value={numClients}
                onChange={e => setNumClients(parseInt(e.target.value))}
                className="w-full accent-primary"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>1件</span>
                <span>25件</span>
                <span>50件</span>
                <span>75件</span>
                <span>100件</span>
              </div>
            </div>

            {/* Result cards */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-emerald-50 dark:bg-emerald-950 rounded-xl p-3 text-center">
                <p className="text-[10px] text-emerald-700 dark:text-emerald-300 mb-1">月額売上</p>
                <p className="text-lg font-semibold text-emerald-800 dark:text-emerald-200">
                  {yen(result.monthlyRevenue)}
                </p>
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {numClients}件 × {yen(current.monthlyFeePerClient)}
                </p>
              </div>
              <div className="bg-amber-50 dark:bg-amber-950 rounded-xl p-3 text-center">
                <p className="text-[10px] text-amber-700 dark:text-amber-300 mb-1">月額コスト</p>
                <p className="text-lg font-semibold text-amber-800 dark:text-amber-200">
                  {yen(result.monthlyCost)}
                </p>
                <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">
                  固定 + 従量 × {numClients}
                </p>
              </div>
              <div className="bg-violet-50 dark:bg-violet-950 rounded-xl p-3 text-center">
                <p className="text-[10px] text-violet-700 dark:text-violet-300 mb-1">月額利益</p>
                <p
                  className={`text-lg font-semibold ${
                    result.monthlyProfit >= 0
                      ? 'text-violet-800 dark:text-violet-200'
                      : 'text-destructive'
                  }`}
                >
                  {yen(result.monthlyProfit)}
                </p>
                <p className="text-[10px] text-violet-600 dark:text-violet-400 mt-0.5">
                  利益率 {pct(result.margin)}
                </p>
              </div>
            </div>

            {/* Revenue split bar */}
            <div className="mb-4">
              <p className="text-xs text-muted-foreground mb-2">売上の内訳</p>
              <div className="h-7 rounded-lg bg-secondary/50 flex overflow-hidden">
                {result.monthlyRevenue > 0 && result.monthlyCost > 0 && (
                  <div
                    className="bg-amber-300 dark:bg-amber-700 flex items-center justify-center text-[10px] font-medium text-amber-900 dark:text-amber-100 transition-all"
                    style={{
                      width: `${Math.max(
                        Math.min((result.monthlyCost / result.monthlyRevenue) * 100, 100),
                        0
                      )}%`,
                    }}
                  >
                    コスト {pct((result.monthlyCost / Math.max(result.monthlyRevenue, 1)) * 100)}
                  </div>
                )}
                {result.monthlyProfit > 0 && (
                  <div className="bg-violet-300 dark:bg-violet-700 flex items-center justify-center text-[10px] font-medium text-violet-900 dark:text-violet-100 transition-all flex-1">
                    利益 {pct(result.margin)}
                  </div>
                )}
              </div>
            </div>

            {/* Per-client breakdown (advanced) */}
            {advanced && (
              <div className="bg-card rounded-xl border overflow-hidden mb-4">
                <div className="px-3 py-2 bg-secondary/50 text-xs font-semibold">
                  クライアント1件あたりの経済性
                </div>
                <div className="grid grid-cols-2 gap-px bg-border">
                  <div className="bg-card p-3">
                    <p className="text-[10px] text-muted-foreground mb-0.5">月額コスト/件</p>
                    <p className="text-sm font-semibold">{yen(result.costPerClient)}</p>
                    <p className="text-[9px] text-muted-foreground">固定費を{numClients}件で按分</p>
                  </div>
                  <div className="bg-card p-3">
                    <p className="text-[10px] text-muted-foreground mb-0.5">月額利益/件</p>
                    <p
                      className={`text-sm font-semibold ${
                        result.profitPerClient >= 0 ? '' : 'text-destructive'
                      }`}
                    >
                      {yen(result.profitPerClient)}
                    </p>
                    <p className="text-[9px] text-muted-foreground">利益率 {pct(result.margin)}</p>
                  </div>
                  <div className="bg-card p-3">
                    <p className="text-[10px] text-muted-foreground mb-0.5">初期費用回収月数</p>
                    <p
                      className={`text-sm font-semibold ${
                        result.recoupMonths < current.contractMonths ? '' : 'text-destructive'
                      }`}
                    >
                      {months(result.recoupMonths)}
                    </p>
                    <p className="text-[9px] text-muted-foreground">
                      {yen(current.initialBuildCost)} ÷ 月利益
                    </p>
                  </div>
                  <div className="bg-card p-3">
                    <p className="text-[10px] text-muted-foreground mb-0.5">LTV売上/件</p>
                    <p className="text-sm font-semibold">{yen(result.ltvRevenue)}</p>
                    <p className="text-[9px] text-muted-foreground">
                      {current.contractMonths}ヶ月契約想定
                    </p>
                  </div>
                  <div className="bg-card p-3 col-span-2">
                    <p className="text-[10px] text-muted-foreground mb-0.5">
                      契約期間中の純利益/件
                    </p>
                    <p
                      className={`text-base font-bold ${
                        result.ltvProfitPerClient >= 0 ? 'text-violet-700' : 'text-destructive'
                      }`}
                    >
                      {yen(result.ltvProfitPerClient)}
                    </p>
                    <p className="text-[9px] text-muted-foreground">
                      {numClients}件の合計利益:{' '}
                      <span className="font-semibold text-foreground">
                        {yen(result.totalLtvProfit)}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Cost breakdown table */}
            <div className="bg-card rounded-xl border overflow-hidden mb-4">
              <div className="grid grid-cols-12 gap-0 px-3 py-2 bg-secondary/50 text-[10px] font-medium text-muted-foreground">
                <span className="col-span-5">項目</span>
                <span className="col-span-2">種別</span>
                <span className="col-span-2 text-right">単価</span>
                <span className="col-span-3 text-right">月額合計</span>
              </div>
              {current.costs.map(c => {
                const total = c.type === 'fixed' ? c.monthlyJpy : c.monthlyJpy * numClients
                return (
                  <div
                    key={c.id}
                    className="grid grid-cols-12 gap-0 px-3 py-2 text-xs border-t items-center"
                  >
                    <span className="col-span-5 truncate">{c.name}</span>
                    <span className="col-span-2 text-muted-foreground">
                      {c.type === 'fixed' ? '固定' : '従量'}
                    </span>
                    <span className="col-span-2 text-right">{yen(c.monthlyJpy)}</span>
                    <span className="col-span-3 text-right font-medium">{yen(total)}</span>
                  </div>
                )
              })}
              <div className="grid grid-cols-12 gap-0 px-3 py-2.5 text-xs border-t font-semibold bg-amber-50/50 dark:bg-amber-950/50">
                <span className="col-span-7">月額コスト合計</span>
                <span className="col-span-2"></span>
                <span className="col-span-3 text-right">{yen(result.monthlyCost)}</span>
              </div>
              <div className="grid grid-cols-12 gap-0 px-3 py-2.5 text-xs border-t font-semibold bg-emerald-50/50 dark:bg-emerald-950/50">
                <span className="col-span-7">月額売上合計</span>
                <span className="col-span-2"></span>
                <span className="col-span-3 text-right">{yen(result.monthlyRevenue)}</span>
              </div>
              <div className="grid grid-cols-12 gap-0 px-3 py-2.5 text-xs border-t font-bold bg-violet-50/50 dark:bg-violet-950/50">
                <span className="col-span-7">月額利益（粗利）</span>
                <span className="col-span-2"></span>
                <span
                  className={`col-span-3 text-right ${
                    result.monthlyProfit >= 0 ? 'text-violet-800' : 'text-destructive'
                  }`}
                >
                  {yen(result.monthlyProfit)}
                </span>
              </div>
            </div>

            <div className="px-4 py-3 rounded-xl bg-secondary/50 text-xs text-muted-foreground leading-relaxed mb-4">
              <span className="font-semibold text-foreground">💡 ポイント:</span>{' '}
              「固定」コスト（Vercel Proなど）はクライアント数で按分されるため、件数が増えるほど1件あたりの実コストが下がります。スライダーで件数を動かして利益率の変化を確認してください。
            </div>
          </>
        )}

        {/* ============================================================ */}
        {/* COMPARE TAB */}
        {/* ============================================================ */}
        {tab === 'compare' && (
          <>
            {/* Shared client count slider */}
            <div className="mb-6">
              <div className="flex justify-between items-baseline mb-1">
                <span className="text-sm text-muted-foreground">比較時のクライアント数</span>
                <span className="text-lg font-semibold">{numClients} 件</span>
              </div>
              <input
                type="range"
                min={1}
                max={100}
                step={1}
                value={numClients}
                onChange={e => setNumClients(parseInt(e.target.value))}
                className="w-full accent-primary"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>1件</span>
                <span>25件</span>
                <span>50件</span>
                <span>75件</span>
                <span>100件</span>
              </div>
            </div>

            {/* Two scenario selectors */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider font-semibold">
                  シナリオ A
                </p>
                <select
                  value={compareLeftId}
                  onChange={e => setCompareLeftId(e.target.value)}
                  className="w-full px-2 py-2 rounded-lg border bg-card text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {scenarios.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider font-semibold">
                  シナリオ B
                </p>
                <select
                  value={compareRightId}
                  onChange={e => setCompareRightId(e.target.value)}
                  className="w-full px-2 py-2 rounded-lg border bg-card text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {scenarios.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Result cards (mini) for both */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <CompareMiniCard scenario={leftScenario} result={leftResult} />
              <CompareMiniCard scenario={rightScenario} result={rightResult} />
            </div>

            {/* Comparison table */}
            <CompareTable
              left={leftScenario}
              right={rightScenario}
              leftResult={leftResult}
              rightResult={rightResult}
              advanced={advanced}
            />

            <div className="px-4 py-3 rounded-xl bg-secondary/50 text-xs text-muted-foreground leading-relaxed mt-4">
              <span className="font-semibold text-foreground">💡 ポイント:</span>{' '}
              同じクライアント数で2つのビジネスモデルを並べて比較できます。緑色の数値が「より良い」側を示します。シナリオは「シナリオ作成」タブで編集・追加してください。
            </div>
          </>
        )}

        <p className="text-center text-[10px] text-muted-foreground mt-8">
          LP Cost Validator · MGC Inc.
        </p>
      </div>
    </div>
  )
}

// ============================================================
// COMPARE TAB COMPONENTS
// ============================================================
function CompareMiniCard({ scenario, result }: { scenario: Scenario; result: CalcResult }) {
  return (
    <div className="bg-card rounded-xl border p-3">
      <p className="text-xs font-semibold truncate mb-2">{scenario.name}</p>
      <div className="space-y-1 text-[11px]">
        <div className="flex justify-between">
          <span className="text-muted-foreground">売上</span>
          <span className="font-medium">{yen(result.monthlyRevenue)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">コスト</span>
          <span className="font-medium text-amber-700">{yen(result.monthlyCost)}</span>
        </div>
        <div className="flex justify-between border-t pt-1">
          <span className="text-muted-foreground">利益</span>
          <span
            className={`font-bold ${
              result.monthlyProfit >= 0 ? 'text-violet-700' : 'text-destructive'
            }`}
          >
            {yen(result.monthlyProfit)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">利益率</span>
          <span className="font-medium">{pct(result.margin)}</span>
        </div>
      </div>
    </div>
  )
}

function CompareTable({
  left,
  right,
  leftResult,
  rightResult,
  advanced,
}: {
  left: Scenario
  right: Scenario
  leftResult: CalcResult
  rightResult: CalcResult
  advanced: boolean
}) {
  const Row = ({
    label,
    l,
    r,
    highlight,
    format = yen,
    betterIs = 'higher',
  }: {
    label: string
    l: number | string
    r: number | string
    highlight?: boolean
    format?: (n: number) => string
    betterIs?: 'higher' | 'lower' | 'none'
  }) => {
    const lStr = typeof l === 'number' ? format(l) : l
    const rStr = typeof r === 'number' ? format(r) : r
    let lWin = false
    let rWin = false
    if (typeof l === 'number' && typeof r === 'number' && betterIs !== 'none') {
      if (betterIs === 'higher') {
        lWin = l > r
        rWin = r > l
      } else {
        lWin = l < r
        rWin = r < l
      }
    }
    return (
      <div
        className={`grid grid-cols-12 gap-0 px-3 py-2 text-xs border-t items-center ${
          highlight ? 'bg-secondary/50 font-semibold' : ''
        }`}
      >
        <span className="col-span-4 text-muted-foreground">{label}</span>
        <span className={`col-span-4 text-right ${lWin ? 'text-emerald-700 font-semibold' : ''}`}>
          {lStr}
        </span>
        <span className={`col-span-4 text-right ${rWin ? 'text-emerald-700 font-semibold' : ''}`}>
          {rStr}
        </span>
      </div>
    )
  }

  return (
    <div className="bg-card rounded-xl border overflow-hidden">
      <div className="grid grid-cols-12 gap-0 px-3 py-2 bg-primary text-primary-foreground text-[10px] font-semibold">
        <span className="col-span-4">指標</span>
        <span className="col-span-4 text-right truncate">{left.name}</span>
        <span className="col-span-4 text-right truncate">{right.name}</span>
      </div>
      <Row
        label="月額料金/件"
        l={left.monthlyFeePerClient}
        r={right.monthlyFeePerClient}
        betterIs="none"
      />
      <Row
        label="月額売上"
        l={leftResult.monthlyRevenue}
        r={rightResult.monthlyRevenue}
        betterIs="higher"
      />
      <Row
        label="月額コスト"
        l={leftResult.monthlyCost}
        r={rightResult.monthlyCost}
        betterIs="lower"
      />
      <Row
        label="月額利益"
        l={leftResult.monthlyProfit}
        r={rightResult.monthlyProfit}
        betterIs="higher"
        highlight
      />
      <Row
        label="利益率"
        l={pct(leftResult.margin)}
        r={pct(rightResult.margin)}
        betterIs="none"
      />
      <Row
        label="月額コスト/件"
        l={leftResult.costPerClient}
        r={rightResult.costPerClient}
        betterIs="lower"
      />
      <Row
        label="月額利益/件"
        l={leftResult.profitPerClient}
        r={rightResult.profitPerClient}
        betterIs="higher"
      />
      {advanced && (
        <>
          <Row
            label="初期費用/件"
            l={left.initialBuildCost}
            r={right.initialBuildCost}
            betterIs="lower"
          />
          <Row
            label="契約期間"
            l={`${left.contractMonths}ヶ月`}
            r={`${right.contractMonths}ヶ月`}
            betterIs="none"
          />
          <Row
            label="回収月数"
            l={months(leftResult.recoupMonths)}
            r={months(rightResult.recoupMonths)}
            betterIs="none"
          />
          <Row
            label="LTV売上/件"
            l={leftResult.ltvRevenue}
            r={rightResult.ltvRevenue}
            betterIs="higher"
          />
          <Row
            label="LTV純利益/件"
            l={leftResult.ltvProfitPerClient}
            r={rightResult.ltvProfitPerClient}
            betterIs="higher"
            highlight
          />
          <Row
            label="総LTV利益"
            l={leftResult.totalLtvProfit}
            r={rightResult.totalLtvProfit}
            betterIs="higher"
            highlight
          />
        </>
      )}
    </div>
  )
}

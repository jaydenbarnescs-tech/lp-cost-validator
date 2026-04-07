'use client'
import { useState, useMemo, useEffect } from 'react'

// ============================================================
// TYPES
// ============================================================
type Billing = 'one_time' | 'monthly' | 'yearly'
type CostType = 'fixed' | 'per_client'

type CostItem = {
  id: string
  name: string
  category: string
  amountJpy: number
  billing: Billing
  type: CostType
}

type Scenario = {
  id: string
  name: string
  monthlyFeePerClient: number
  initialFeeFromClient: number
  contractMonths: number
  costs: CostItem[]
  notes?: string
  createdAt: number
  updatedAt: number
}

// ============================================================
// CONSTANTS
// ============================================================
// 固定コストを按分する想定クライアント数（MGCの目標運用規模）
const ASSUMED_CLIENT_SHARE = 50

// ============================================================
// CATEGORIES & TOOL LIBRARY
// ============================================================
const CATS = {
  labor: '人件費・労務',
  hosting: 'ホスティング',
  cms: 'CMS',
  db: 'データベース',
  domain: 'ドメイン',
  legacy: '従来型ホスティング',
  ops: '保守・運用',
} as const

const LIB: Omit<CostItem, 'id'>[] = [
  // Labor (one-time)
  { name: '人件費 - 小規模LP（AI支援）', category: CATS.labor, amountJpy: 40000, billing: 'one_time', type: 'per_client' },
  { name: '人件費 - 中規模LP（AI支援）', category: CATS.labor, amountJpy: 80000, billing: 'one_time', type: 'per_client' },
  { name: '人件費 - 小規模LP（従来開発）', category: CATS.labor, amountJpy: 100000, billing: 'one_time', type: 'per_client' },
  { name: '人件費 - 中規模LP（従来開発）', category: CATS.labor, amountJpy: 200000, billing: 'one_time', type: 'per_client' },
  { name: '運用工数（月次サポート）', category: CATS.labor, amountJpy: 1500, billing: 'monthly', type: 'per_client' },
  // Hosting
  { name: 'Vercel Hobby (個人用のみ)', category: CATS.hosting, amountJpy: 0, billing: 'monthly', type: 'fixed' },
  { name: 'Vercel Pro (月払い)', category: CATS.hosting, amountJpy: 3000, billing: 'monthly', type: 'fixed' },
  { name: 'Vercel Pro (年契約)', category: CATS.hosting, amountJpy: 30000, billing: 'yearly', type: 'fixed' },
  { name: 'Cloudflare Pages', category: CATS.hosting, amountJpy: 0, billing: 'monthly', type: 'fixed' },
  { name: 'Netlify Starter', category: CATS.hosting, amountJpy: 0, billing: 'monthly', type: 'fixed' },
  // CMS
  { name: 'Sanity Free', category: CATS.cms, amountJpy: 0, billing: 'monthly', type: 'fixed' },
  { name: 'Sanity Growth (1 seat)', category: CATS.cms, amountJpy: 2250, billing: 'monthly', type: 'fixed' },
  { name: 'Storyblok Starter', category: CATS.cms, amountJpy: 0, billing: 'monthly', type: 'fixed' },
  { name: 'Storyblok Entry', category: CATS.cms, amountJpy: 14850, billing: 'monthly', type: 'fixed' },
  { name: 'Payload (セルフホスト)', category: CATS.cms, amountJpy: 0, billing: 'monthly', type: 'fixed' },
  { name: 'Strapi Community', category: CATS.cms, amountJpy: 0, billing: 'monthly', type: 'fixed' },
  // DB
  { name: 'Supabase Free', category: CATS.db, amountJpy: 0, billing: 'monthly', type: 'fixed' },
  { name: 'Supabase Pro', category: CATS.db, amountJpy: 3750, billing: 'monthly', type: 'fixed' },
  { name: 'Neon Free', category: CATS.db, amountJpy: 0, billing: 'monthly', type: 'fixed' },
  { name: 'Neon Launch', category: CATS.db, amountJpy: 2850, billing: 'monthly', type: 'fixed' },
  // Domain (corrected to yearly billing — domains are billed yearly, not monthly)
  { name: '.com ドメイン', category: CATS.domain, amountJpy: 1500, billing: 'yearly', type: 'per_client' },
  { name: '.jp ドメイン', category: CATS.domain, amountJpy: 3500, billing: 'yearly', type: 'per_client' },
  { name: '.co.jp ドメイン', category: CATS.domain, amountJpy: 4500, billing: 'yearly', type: 'per_client' },
  // Legacy hosting
  { name: 'Xserver スタンダード (月払)', category: CATS.legacy, amountJpy: 1100, billing: 'monthly', type: 'per_client' },
  { name: 'Xserver スタンダード (年払)', category: CATS.legacy, amountJpy: 11880, billing: 'yearly', type: 'per_client' },
  { name: 'ConoHa WING ベーシック', category: CATS.legacy, amountJpy: 1210, billing: 'monthly', type: 'per_client' },
  // Ops
  { name: 'WordPress 保守工数', category: CATS.ops, amountJpy: 2000, billing: 'monthly', type: 'per_client' },
  { name: 'WordPress セキュリティ更新', category: CATS.ops, amountJpy: 1000, billing: 'monthly', type: 'per_client' },
  { name: 'バックアップサービス', category: CATS.ops, amountJpy: 500, billing: 'monthly', type: 'per_client' },
]

// ============================================================
// UTILS
// ============================================================
const uid = () => Math.random().toString(36).slice(2, 10)
const yen = (n: number) => '¥' + Math.round(n).toLocaleString()
const pct = (n: number) => (Math.round(n * 10) / 10).toFixed(1) + '%'

const billingLabel = (b: Billing) => b === 'one_time' ? '一括' : b === 'monthly' ? '月額' : '年額'
const billingSuffix = (b: Billing) => b === 'one_time' ? '/ 一括' : b === 'monthly' ? '/ 月' : '/ 年'

// ============================================================
// DEFAULT SCENARIOS
// ============================================================
function makeDefaults(): Scenario[] {
  const now = Date.now()
  return [
    {
      id: 'default-claude',
      name: 'MGCプラン (Claude + Vercel + Sanity)',
      monthlyFeePerClient: 8000,
      initialFeeFromClient: 0,
      contractMonths: 6,
      costs: [
        { id: uid(), name: '人件費 - 小規模LP（AI支援）', category: CATS.labor, amountJpy: 40000, billing: 'one_time', type: 'per_client' },
        { id: uid(), name: 'Vercel Pro (月払い)', category: CATS.hosting, amountJpy: 3000, billing: 'monthly', type: 'fixed' },
        { id: uid(), name: 'Sanity Free', category: CATS.cms, amountJpy: 0, billing: 'monthly', type: 'fixed' },
        { id: uid(), name: '.com ドメイン', category: CATS.domain, amountJpy: 1500, billing: 'yearly', type: 'per_client' },
      ],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'default-wp',
      name: 'WordPress制作会社プラン (一般相場)',
      monthlyFeePerClient: 10000,
      initialFeeFromClient: 80000,
      contractMonths: 24,
      costs: [
        { id: uid(), name: '人件費 - 小規模LP（従来開発）', category: CATS.labor, amountJpy: 100000, billing: 'one_time', type: 'per_client' },
        { id: uid(), name: 'Xserver スタンダード (月払)', category: CATS.legacy, amountJpy: 1100, billing: 'monthly', type: 'per_client' },
        { id: uid(), name: '.jp ドメイン', category: CATS.domain, amountJpy: 3500, billing: 'yearly', type: 'per_client' },
        { id: uid(), name: 'WordPress 保守工数', category: CATS.ops, amountJpy: 2000, billing: 'monthly', type: 'per_client' },
        { id: uid(), name: 'WordPress セキュリティ更新', category: CATS.ops, amountJpy: 1000, billing: 'monthly', type: 'per_client' },
      ],
      createdAt: now,
      updatedAt: now,
    },
  ]
}

// ============================================================
// STORAGE (v3 — bumped because data model changed)
// ============================================================
const STORAGE_KEY = 'lp-cost-validator-v3'

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
// CALCULATIONS — contract-total perspective, per client
// ============================================================
type CostBreakdownRow = {
  item: CostItem
  contractTotal: number  // total cost over the entire contract for ONE client
}

type CalcResult = {
  // Revenue (what the client pays)
  initialFee: number               // upfront
  monthlyFee: number               // per month
  contractRevenue: number          // initialFee + monthlyFee * months
  // Cost (what the provider actually spends per client)
  costRows: CostBreakdownRow[]
  contractCost: number             // sum of all contractTotal
  // Profit
  contractProfit: number           // contractRevenue - contractCost
  margin: number                   // contractProfit / contractRevenue * 100
  // Monthly equivalents (for secondary display)
  monthlyRevenueEq: number         // contractRevenue / months
  monthlyCostEq: number            // contractCost / months
  monthlyProfitEq: number          // contractProfit / months
}

function costContractTotal(c: CostItem, contractMonths: number): number {
  // Step 1: how much money flows out over the contract for ONE share
  let totalForShare = 0
  if (c.billing === 'one_time') {
    totalForShare = c.amountJpy
  } else if (c.billing === 'monthly') {
    totalForShare = c.amountJpy * contractMonths
  } else {
    // yearly
    totalForShare = c.amountJpy * (contractMonths / 12)
  }
  // Step 2: divide by ASSUMED_CLIENT_SHARE if it's a fixed (shared) cost
  if (c.type === 'fixed') {
    return totalForShare / ASSUMED_CLIENT_SHARE
  }
  return totalForShare
}

function calc(s: Scenario): CalcResult {
  const months = Math.max(s.contractMonths, 1)
  const costRows: CostBreakdownRow[] = s.costs.map(item => ({
    item,
    contractTotal: costContractTotal(item, months),
  }))
  const contractCost = costRows.reduce((a, r) => a + r.contractTotal, 0)
  const contractRevenue = s.initialFeeFromClient + s.monthlyFeePerClient * months
  const contractProfit = contractRevenue - contractCost
  const margin = contractRevenue > 0 ? (contractProfit / contractRevenue) * 100 : 0
  return {
    initialFee: s.initialFeeFromClient,
    monthlyFee: s.monthlyFeePerClient,
    contractRevenue,
    costRows,
    contractCost,
    contractProfit,
    margin,
    monthlyRevenueEq: contractRevenue / months,
    monthlyCostEq: contractCost / months,
    monthlyProfitEq: contractProfit / months,
  }
}

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function Page() {
  const [hydrated, setHydrated] = useState(false)
  const [tab, setTab] = useState<'compare' | 'scenario'>('compare')
  const [scenarios, setScenarios] = useState<Scenario[]>(makeDefaults)
  const [currentId, setCurrentId] = useState<string>('default-claude')
  const [editMode, setEditMode] = useState(false)
  const [showLib, setShowLib] = useState(false)
  const [compareLeftId, setCompareLeftId] = useState<string>('default-claude')
  const [compareRightId, setCompareRightId] = useState<string>('default-wp')

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

  useEffect(() => {
    if (hydrated) persistScenarios(scenarios)
  }, [scenarios, hydrated])

  const current = scenarios.find(s => s.id === currentId) || scenarios[0]
  const result = useMemo(() => current ? calc(current) : null, [current])

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
      name: '新しいプラン',
      monthlyFeePerClient: 8000,
      initialFeeFromClient: 80000,
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
    if (!window.confirm('全プランを初期状態にリセットしますか？保存されたデータは消えます。')) return
    const d = makeDefaults()
    setScenarios(d)
    setCurrentId(d[0].id)
    setCompareLeftId(d[0].id)
    setCompareRightId(d[1].id)
  }

  if (!current || !result) return null

  const leftScenario = scenarios.find(s => s.id === compareLeftId) || current
  const rightScenario = scenarios.find(s => s.id === compareRightId) || current
  const leftResult = calc(leftScenario)
  const rightResult = calc(rightScenario)

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
        <h1 className="text-2xl font-bold mb-1">透明な料金プラン</h1>
        <p className="text-sm text-muted-foreground mb-6">
          月額料金がどこに使われているか、当社の利益はいくらか、WordPress制作会社と比べてどれだけ安いか — すべて公開します。
        </p>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 border-b">
          <button
            onClick={() => setTab('compare')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === 'compare'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            比較する
          </button>
          <button
            onClick={() => setTab('scenario')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === 'scenario'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            プランを編集
          </button>
        </div>

        {/* ============================================================ */}
        {/* COMPARE TAB */}
        {/* ============================================================ */}
        {tab === 'compare' && (
          <>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider font-semibold">プラン A</p>
                <select
                  value={compareLeftId}
                  onChange={e => setCompareLeftId(e.target.value)}
                  className="w-full px-2 py-2 rounded-lg border bg-card text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {scenarios.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider font-semibold">プラン B</p>
                <select
                  value={compareRightId}
                  onChange={e => setCompareRightId(e.target.value)}
                  className="w-full px-2 py-2 rounded-lg border bg-card text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {scenarios.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <ScenarioCard scenario={leftScenario} result={leftResult} accent="emerald" />
              <ScenarioCard scenario={rightScenario} result={rightResult} accent="amber" />
            </div>

            <SavingsCallout left={leftScenario} right={rightScenario} leftResult={leftResult} rightResult={rightResult} />

            <div className="mt-4">
              <CompareTable
                left={leftScenario}
                right={rightScenario}
                leftResult={leftResult}
                rightResult={rightResult}
              />
            </div>

            <div className="px-4 py-3 rounded-xl bg-secondary/50 text-xs text-muted-foreground leading-relaxed mt-4">
              <span className="font-semibold text-foreground">💡 透明性について:</span>{' '}
              すべての金額はクライアント1社あたりの実コストです。固定インフラ（Vercel Proなど）は当社の{ASSUMED_CLIENT_SHARE}社運用想定で按分しています。年額コスト（ドメインなど）は契約期間に応じて計算しています。
            </div>
          </>
        )}

        {/* ============================================================ */}
        {/* SCENARIO EDIT TAB */}
        {/* ============================================================ */}
        {tab === 'scenario' && (
          <>
            <div className="bg-card rounded-xl border p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">保存済みプラン</span>
                <div className="flex gap-1">
                  <button onClick={newScenario} className="px-2 py-1 rounded-md text-xs border hover:bg-secondary">+ 新規</button>
                  <button onClick={duplicateScenario} className="px-2 py-1 rounded-md text-xs border hover:bg-secondary">複製</button>
                  {scenarios.length > 1 && (
                    <button onClick={deleteScenario} className="px-2 py-1 rounded-md text-xs border text-destructive hover:bg-destructive/10">削除</button>
                  )}
                </div>
              </div>
              <select
                value={currentId}
                onChange={e => setCurrentId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {scenarios.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <input
                value={current.name}
                onChange={e => updateCurrent({ name: e.target.value })}
                placeholder="プラン名"
                className="w-full mt-2 px-3 py-2 rounded-lg border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="text-[10px] text-muted-foreground mt-1.5">変更は自動的にブラウザに保存されます（localStorage）</p>
            </div>

            {/* Customer-paid fees */}
            <div className="bg-card rounded-xl border p-4 mb-4">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">お客様の支払い</p>
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">初期費用（一括）</label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">¥</span>
                    <input
                      type="number"
                      value={current.initialFeeFromClient}
                      onChange={e => updateCurrent({ initialFeeFromClient: parseInt(e.target.value) || 0 })}
                      className="flex-1 px-3 py-2 rounded-lg border text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <span className="text-xs text-muted-foreground">/ 一括</span>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">月額料金</label>
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
              </div>
            </div>

            {/* Cost items section header */}
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">事業者側のコスト</span>
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
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">{cat}</p>
                    <div className="space-y-1">
                      {items.map((item, i) => (
                        <button
                          key={i}
                          onClick={() => addCost(item)}
                          className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-xs hover:bg-secondary text-left"
                        >
                          <span className="flex items-center gap-2 min-w-0 flex-1">
                            <span className="font-medium truncate">{item.name}</span>
                            <BillingBadge billing={item.billing} />
                            <TypeBadge type={item.type} />
                          </span>
                          <span className="text-muted-foreground flex-shrink-0">
                            {yen(item.amountJpy)}{billingSuffix(item.billing)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <button
                  onClick={() =>
                    addCost({ name: '新しい項目', category: 'カスタム', amountJpy: 0, billing: 'monthly', type: 'fixed' })
                  }
                  className="w-full mt-2 py-2 rounded-lg border border-dashed text-xs text-muted-foreground hover:border-primary hover:text-primary"
                >
                  + カスタム項目を追加
                </button>
              </div>
            )}

            {/* Cost items list */}
            <div className="space-y-2 mb-4">
              {current.costs.length === 0 && (
                <div className="text-center py-6 text-xs text-muted-foreground bg-card rounded-xl border border-dashed">
                  コスト項目がありません。「ライブラリから追加」ボタンから追加してください。
                </div>
              )}
              {current.costs.map((c, i) => (
                <div key={c.id} className="bg-card rounded-xl border p-3">
                  {editMode ? (
                    <div className="space-y-2">
                      <input
                        value={c.name}
                        onChange={e => updateCost(i, { name: e.target.value })}
                        className="w-full px-2 py-1.5 rounded-lg border text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                      <div className="flex items-center gap-2 flex-wrap">
                        <select
                          value={c.billing}
                          onChange={e => updateCost(i, { billing: e.target.value as Billing })}
                          className="px-2 py-1.5 rounded-lg border text-xs bg-card focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                          <option value="one_time">一括</option>
                          <option value="monthly">月額</option>
                          <option value="yearly">年額</option>
                        </select>
                        <select
                          value={c.type}
                          onChange={e => updateCost(i, { type: e.target.value as CostType })}
                          className="px-2 py-1.5 rounded-lg border text-xs bg-card focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                          <option value="fixed">固定（按分）</option>
                          <option value="per_client">従量（1社毎）</option>
                        </select>
                        <span className="text-xs">¥</span>
                        <input
                          type="number"
                          value={c.amountJpy}
                          onChange={e => updateCost(i, { amountJpy: parseInt(e.target.value) || 0 })}
                          className="w-24 px-2 py-1.5 rounded-lg border text-sm text-right bg-card focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                        <button
                          onClick={() => deleteCost(i)}
                          className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 ml-auto"
                          aria-label="削除"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-semibold">{c.name}</span>
                          <BillingBadge billing={c.billing} />
                          <TypeBadge type={c.type} />
                        </div>
                        <p className="text-[10px] text-muted-foreground">{c.category}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-semibold">{yen(c.amountJpy)}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {billingSuffix(c.billing)}{c.type === 'fixed' ? ` ÷${ASSUMED_CLIENT_SHARE}社` : ''}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-end mb-4">
              <button onClick={resetDefaults} className="text-[10px] text-muted-foreground hover:text-destructive">
                初期状態にリセット
              </button>
            </div>

            <BreakdownCard scenario={current} result={result} />

            <div className="px-4 py-3 rounded-xl bg-secondary/50 text-xs text-muted-foreground leading-relaxed mt-4">
              <span className="font-semibold text-foreground">💡 計算方法:</span>{' '}
              一括 = そのまま、月額 = 契約期間で乗算、年額 = 契約年数で乗算。固定コストは{ASSUMED_CLIENT_SHARE}社で按分。各項目を「一括／月額／年額」と「固定／従量」で分類できます。
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
// SMALL UI HELPERS
// ============================================================
function BillingBadge({ billing }: { billing: Billing }) {
  const cls = billing === 'one_time'
    ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
    : billing === 'yearly'
      ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
      : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
  return <span className={`text-[9px] px-1.5 py-0.5 rounded flex-shrink-0 ${cls}`}>{billingLabel(billing)}</span>
}

function TypeBadge({ type }: { type: CostType }) {
  const cls = type === 'fixed'
    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
    : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
  return <span className={`text-[9px] px-1.5 py-0.5 rounded flex-shrink-0 ${cls}`}>{type === 'fixed' ? '固定' : '従量'}</span>
}

// ============================================================
// SCENARIO CARD (compare tab, side-by-side)
// ============================================================
function ScenarioCard({ scenario, result, accent }: { scenario: Scenario; result: CalcResult; accent: 'emerald' | 'amber' }) {
  const accentBg = accent === 'emerald' ? 'bg-emerald-50 dark:bg-emerald-950' : 'bg-amber-50 dark:bg-amber-950'
  const accentText = accent === 'emerald' ? 'text-emerald-800 dark:text-emerald-200' : 'text-amber-800 dark:text-amber-200'
  const accentSub = accent === 'emerald' ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'
  return (
    <div className={`rounded-xl border p-3 ${accentBg}`}>
      <p className={`text-[11px] font-semibold mb-2 truncate ${accentSub}`}>{scenario.name}</p>
      <div className="space-y-0.5 mb-2">
        <div className="flex items-baseline justify-between gap-2">
          <span className={`text-[10px] ${accentSub}`}>初期</span>
          <span className={`text-sm font-semibold ${accentText}`}>{yen(result.initialFee)}</span>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <span className={`text-[10px] ${accentSub}`}>月額</span>
          <span className={`text-sm font-semibold ${accentText}`}>{yen(result.monthlyFee)}</span>
        </div>
      </div>
      <div className="border-t pt-2 space-y-0.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className={`text-[10px] ${accentSub}`}>{scenario.contractMonths}ヶ月総額</span>
          <span className={`text-base font-bold ${accentText}`}>{yen(result.contractRevenue)}</span>
        </div>
        <div className="flex items-baseline justify-between gap-2 text-[10px]">
          <span className={accentSub}>事業者の利益</span>
          <span className={result.contractProfit >= 0 ? 'font-semibold' : 'text-destructive font-semibold'}>
            {yen(result.contractProfit)} ({pct(result.margin)})
          </span>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// SAVINGS CALLOUT
// ============================================================
function SavingsCallout({ left, right, leftResult, rightResult }: { left: Scenario; right: Scenario; leftResult: CalcResult; rightResult: CalcResult }) {
  // 異なる契約期間でも公平に比較できるよう月額換算で計算
  const leftMonthlyEq = leftResult.contractRevenue / left.contractMonths
  const rightMonthlyEq = rightResult.contractRevenue / right.contractMonths
  const monthlyDiff = rightMonthlyEq - leftMonthlyEq

  if (Math.abs(monthlyDiff) < 1) {
    return (
      <div className="rounded-xl border-2 border-dashed p-4 text-center text-xs text-muted-foreground">
        2つのプランの月額換算は同じです
      </div>
    )
  }

  const cheaper = monthlyDiff > 0 ? left : right
  const expensive = monthlyDiff > 0 ? right : left
  const monthlySavings = Math.abs(monthlyDiff)
  const annualSavings = monthlySavings * 12

  // 1年目の実支出差（0円初期費用モデルの強み）
  const firstYearLeft = leftResult.initialFee + leftResult.monthlyFee * Math.min(12, left.contractMonths)
  const firstYearRight = rightResult.initialFee + rightResult.monthlyFee * Math.min(12, right.contractMonths)
  const firstYearSavings = Math.abs(firstYearRight - firstYearLeft)

  return (
    <div className="rounded-xl border-2 border-violet-300 dark:border-violet-700 bg-gradient-to-br from-violet-50 to-emerald-50 dark:from-violet-950 dark:to-emerald-950 p-4">
      <p className="text-[10px] text-violet-700 dark:text-violet-300 uppercase tracking-wider font-semibold mb-1 text-center">
        お客様のメリット
      </p>
      <p className="text-center text-xs text-muted-foreground mb-2">
        <span className="font-semibold">{cheaper.name}</span> なら
      </p>
      <div className="text-center mb-3">
        <p className="text-3xl font-bold text-violet-800 dark:text-violet-200">
          月々 {yen(monthlySavings)} お得
        </p>
        <p className="text-[10px] text-muted-foreground mt-0.5">月額換算 / {expensive.name}比</p>
      </div>
      <div className="grid grid-cols-2 gap-2 pt-3 border-t border-violet-200 dark:border-violet-800">
        <div className="text-center">
          <p className="text-[10px] uppercase tracking-wider text-violet-700 dark:text-violet-300">年間で</p>
          <p className="text-base font-bold text-violet-800 dark:text-violet-200">{yen(annualSavings)} お得</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] uppercase tracking-wider text-violet-700 dark:text-violet-300">1年目の出費</p>
          <p className="text-base font-bold text-violet-800 dark:text-violet-200">{yen(firstYearSavings)} 少ない</p>
        </div>
      </div>
      <p className="text-[9px] text-muted-foreground mt-3 text-center leading-relaxed">
        ※ 契約期間が異なるため月額換算で比較<br/>
        ({left.name}: {left.contractMonths}ヶ月 ／ {right.name}: {right.contractMonths}ヶ月)
      </p>
    </div>
  )
}

// ============================================================
// COMPARE TABLE (detailed side-by-side)
// ============================================================
function CompareTable({ left, right, leftResult, rightResult }: { left: Scenario; right: Scenario; leftResult: CalcResult; rightResult: CalcResult }) {
  const Row = ({ label, l, r, highlight, format = yen, betterIs = 'lower' }: {
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
      if (betterIs === 'higher') { lWin = l > r; rWin = r > l }
      else { lWin = l < r; rWin = r < l }
    }
    return (
      <div className={`grid grid-cols-12 gap-0 px-3 py-2 text-xs border-t items-center ${highlight ? 'bg-secondary/50 font-semibold' : ''}`}>
        <span className="col-span-4 text-muted-foreground">{label}</span>
        <span className={`col-span-4 text-right ${lWin ? 'text-emerald-700 font-semibold' : ''}`}>{lStr}</span>
        <span className={`col-span-4 text-right ${rWin ? 'text-emerald-700 font-semibold' : ''}`}>{rStr}</span>
      </div>
    )
  }
  return (
    <div className="bg-card rounded-xl border overflow-hidden">
      <div className="grid grid-cols-12 gap-0 px-3 py-2 bg-primary text-primary-foreground text-[10px] font-semibold">
        <span className="col-span-4">詳細</span>
        <span className="col-span-4 text-right truncate">{left.name}</span>
        <span className="col-span-4 text-right truncate">{right.name}</span>
      </div>

      <div className="px-3 py-1.5 bg-secondary/30 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-t">
        お客様の支払い
      </div>
      <Row label="初期費用" l={leftResult.initialFee} r={rightResult.initialFee} betterIs="lower" />
      <Row label="月額料金" l={leftResult.monthlyFee} r={rightResult.monthlyFee} betterIs="lower" />
      <Row label="契約期間" l={`${left.contractMonths}ヶ月`} r={`${right.contractMonths}ヶ月`} betterIs="none" />
      <Row label="月額換算" l={leftResult.monthlyRevenueEq} r={rightResult.monthlyRevenueEq} betterIs="lower" highlight />
      <Row label="年間換算" l={leftResult.monthlyRevenueEq * 12} r={rightResult.monthlyRevenueEq * 12} betterIs="lower" />
      <Row label="契約期間総額" l={leftResult.contractRevenue} r={rightResult.contractRevenue} betterIs="none" />

      <div className="px-3 py-1.5 bg-secondary/30 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-t">
        事業者の実コスト（契約期間総額）
      </div>
      <Row label="コスト総額" l={leftResult.contractCost} r={rightResult.contractCost} betterIs="none" />
      <Row label="事業者の利益" l={leftResult.contractProfit} r={rightResult.contractProfit} betterIs="none" />
      <Row label="利益率" l={pct(leftResult.margin)} r={pct(rightResult.margin)} betterIs="none" />
    </div>
  )
}

// ============================================================
// BREAKDOWN CARD (scenario edit tab — full transparent breakdown)
// ============================================================
function BreakdownCard({ scenario, result }: { scenario: Scenario; result: CalcResult }) {
  // Group cost rows by billing for display
  const oneTimeRows = result.costRows.filter(r => r.item.billing === 'one_time')
  const monthlyRows = result.costRows.filter(r => r.item.billing === 'monthly')
  const yearlyRows = result.costRows.filter(r => r.item.billing === 'yearly')

  return (
    <div className="bg-card rounded-xl border overflow-hidden">
      <div className="px-3 py-2 bg-secondary/50 text-xs font-semibold">
        透明な内訳（お客様1社あたり / {scenario.contractMonths}ヶ月契約総額）
      </div>

      {/* Customer payment breakdown */}
      <div className="p-3 space-y-1.5 border-b">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
          お客様の支払い
        </p>
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">初期費用（一括）</span>
          <span>{yen(result.initialFee)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">月額料金 {yen(result.monthlyFee)} × {scenario.contractMonths}ヶ月</span>
          <span>{yen(result.monthlyFee * scenario.contractMonths)}</span>
        </div>
        <div className="flex justify-between text-xs font-semibold border-t pt-1.5 mt-1">
          <span>支払総額</span>
          <span className="text-emerald-700 dark:text-emerald-300">{yen(result.contractRevenue)}</span>
        </div>
      </div>

      {/* Provider cost breakdown */}
      <div className="p-3 space-y-2 border-b">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          事業者の実コスト
        </p>

        {oneTimeRows.length > 0 && (
          <div className="space-y-1">
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">一括コスト</p>
            {oneTimeRows.map((row, i) => (
              <CostRow key={i} row={row} contractMonths={scenario.contractMonths} />
            ))}
          </div>
        )}

        {monthlyRows.length > 0 && (
          <div className="space-y-1">
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">月額コスト</p>
            {monthlyRows.map((row, i) => (
              <CostRow key={i} row={row} contractMonths={scenario.contractMonths} />
            ))}
          </div>
        )}

        {yearlyRows.length > 0 && (
          <div className="space-y-1">
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">年額コスト</p>
            {yearlyRows.map((row, i) => (
              <CostRow key={i} row={row} contractMonths={scenario.contractMonths} />
            ))}
          </div>
        )}

        <div className="flex justify-between text-xs font-semibold border-t pt-1.5 mt-1">
          <span>コスト総額</span>
          <span className="text-amber-700 dark:text-amber-300">{yen(result.contractCost)}</span>
        </div>
      </div>

      {/* Profit reveal */}
      <div className="p-3 flex justify-between items-baseline">
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">事業者の利益（{scenario.contractMonths}ヶ月総額）</p>
          <p className="text-[10px] text-muted-foreground">利益率 {pct(result.margin)} ・ 月平均 {yen(result.monthlyProfitEq)}</p>
        </div>
        <span className={`text-2xl font-bold ${result.contractProfit >= 0 ? 'text-violet-700 dark:text-violet-300' : 'text-destructive'}`}>
          {yen(result.contractProfit)}
        </span>
      </div>
    </div>
  )
}

function CostRow({ row, contractMonths }: { row: CostBreakdownRow; contractMonths: number }) {
  const c = row.item
  let detail = ''
  if (c.billing === 'one_time') {
    detail = c.type === 'fixed' ? `${yen(c.amountJpy)} ÷${ASSUMED_CLIENT_SHARE}社` : `${yen(c.amountJpy)} 一括`
  } else if (c.billing === 'monthly') {
    detail = c.type === 'fixed'
      ? `${yen(c.amountJpy)}/月 × ${contractMonths}ヶ月 ÷${ASSUMED_CLIENT_SHARE}社`
      : `${yen(c.amountJpy)}/月 × ${contractMonths}ヶ月`
  } else {
    const years = (contractMonths / 12).toFixed(1).replace(/\.0$/, '')
    detail = c.type === 'fixed'
      ? `${yen(c.amountJpy)}/年 × ${years}年 ÷${ASSUMED_CLIENT_SHARE}社`
      : `${yen(c.amountJpy)}/年 × ${years}年`
  }
  return (
    <div className="flex justify-between items-baseline text-xs gap-2">
      <div className="min-w-0 flex-1">
        <p className="truncate">{c.name}</p>
        <p className="text-[9px] text-muted-foreground truncate">{detail}</p>
      </div>
      <span className="flex-shrink-0">{yen(row.contractTotal)}</span>
    </div>
  )
}

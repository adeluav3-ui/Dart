'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatMoney, areaDisplayName } from '@/lib/format'
import type { Area, ZoneFare, FareLevel } from '@/types/database'

interface LevelEdit {
  okada_price: string
  rider_pay: string
  delivery_fee: string
}

interface Toast {
  id: string
  message: string
  undoFn: () => void
}

interface Props {
  initialAreas: Area[]
  initialZoneFares: ZoneFare[]
  initialFareLevels: FareLevel[]
}

export function DeliveryPricesClient({ initialAreas, initialZoneFares, initialFareLevels }: Props) {
  const supabase = createClient()
  const toastTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const activeAreas = initialAreas.filter(a => a.status === 'active')

  const [zoneFares, setZoneFares] = useState(initialZoneFares)
  const [fareLevels, setFareLevels] = useState(initialFareLevels)
  const [selectedAreaId, setSelectedAreaId] = useState(activeAreas[0]?.id ?? '')
  const [toasts, setToasts] = useState<Toast[]>([])
  const [editLevelsOpen, setEditLevelsOpen] = useState(false)
  const [levelEdits, setLevelEdits] = useState<Record<string, LevelEdit>>({})
  const [savingLevels, setSavingLevels] = useState(false)
  const [levelErrors, setLevelErrors] = useState<string[]>([])
  const [checkFrom, setCheckFrom] = useState(activeAreas[0]?.id ?? '')
  const [checkTo, setCheckTo] = useState(activeAreas[1]?.id ?? '')

  useEffect(() => () => {
    Object.values(toastTimers.current).forEach(clearTimeout)
  }, [])

  // ── Fare helpers ──────────────────────────────────────────────────────────

  function getZoneFare(areaA: Area, areaB: Area): ZoneFare | undefined {
    if (!areaA.zone_id || !areaB.zone_id) return undefined
    const [za, zb] = [areaA.zone_id, areaB.zone_id].sort()
    return zoneFares.find(f => f.zone_a === za && f.zone_b === zb)
  }

  function getFareLevel(fare: ZoneFare | undefined): FareLevel | undefined {
    if (!fare?.fare_level_id) return undefined
    return fareLevels.find(l => l.id === fare.fare_level_id)
  }

  function routeCountForLevel(levelId: string): number {
    return zoneFares.filter(f => f.fare_level_id === levelId).length
  }

  // ── Toasts ────────────────────────────────────────────────────────────────

  function addToast(message: string, undoFn: () => void): string {
    const id = Math.random().toString(36).slice(2)
    setToasts(p => [...p, { id, message, undoFn }])
    toastTimers.current[id] = setTimeout(() => {
      setToasts(p => p.filter(t => t.id !== id))
      delete toastTimers.current[id]
    }, 5000)
    return id
  }

  function dismissToast(id: string) {
    clearTimeout(toastTimers.current[id])
    delete toastTimers.current[id]
    setToasts(p => p.filter(t => t.id !== id))
  }

  // ── Set fare level for area pair ──────────────────────────────────────────

  async function setFareLevelForPair(fromArea: Area, toArea: Area, levelId: string) {
    if (!fromArea.zone_id || !toArea.zone_id) return
    const [zone_a, zone_b] = [fromArea.zone_id, toArea.zone_id].sort()
    const existing = getZoneFare(fromArea, toArea)
    const prevLevelId = existing?.fare_level_id ?? null
    const tempId = `__temp_${Date.now()}`

    // Optimistic update
    if (existing) {
      setZoneFares(p => p.map(f => f.id === existing.id ? { ...f, fare_level_id: levelId } : f))
    } else {
      setZoneFares(p => [...p, { id: tempId, zone_a, zone_b, fare_level_id: levelId, is_serviceable: true }])
    }

    const levelName = fareLevels.find(l => l.id === levelId)?.name ?? levelId
    const isSelf = fromArea.id === toArea.id
    const label = isSelf ? `Within ${fromArea.name}` : `${fromArea.name} ↔ ${toArea.name}`

    addToast(`${label} is now ${levelName}`, async () => {
      if (existing) {
        setZoneFares(p => p.map(f => f.id === existing.id ? { ...f, fare_level_id: prevLevelId } : f))
        await supabase.from('zone_fares').update({ fare_level_id: prevLevelId }).eq('id', existing.id)
      } else {
        setZoneFares(p => p.filter(f => f.id !== tempId && !(f.zone_a === zone_a && f.zone_b === zone_b)))
        await supabase.from('zone_fares').delete().eq('zone_a', zone_a).eq('zone_b', zone_b)
      }
    })

    // Persist
    if (existing) {
      await supabase.from('zone_fares').update({ fare_level_id: levelId }).eq('id', existing.id)
    } else {
      const { data } = await supabase
        .from('zone_fares')
        .insert({ zone_a, zone_b, fare_level_id: levelId, is_serviceable: true })
        .select()
        .single()
      if (data) {
        setZoneFares(p => p.map(f => f.id === tempId ? (data as ZoneFare) : f))
      }
    }
  }

  // ── Fare level edit ───────────────────────────────────────────────────────

  function getLevelEdit(level: FareLevel): LevelEdit {
    return levelEdits[level.id] ?? {
      okada_price: String(level.okada_price / 100),
      rider_pay: String(level.rider_pay / 100),
      delivery_fee: String(level.delivery_fee / 100),
    }
  }

  function setLevelEditField(id: string, field: keyof LevelEdit, val: string) {
    const base = levelEdits[id] ?? getLevelEdit(fareLevels.find(l => l.id === id)!)
    setLevelEdits(p => ({ ...p, [id]: { ...base, [field]: val } }))
  }

  function validateLevelEdits(): string[] {
    const errors: string[] = []
    for (const level of fareLevels) {
      const edit = getLevelEdit(level)
      const okada = parseFloat(edit.okada_price || '0')
      const rider = parseFloat(edit.rider_pay || '0')
      const customer = parseFloat(edit.delivery_fee || '0')
      if (customer <= rider) errors.push(`${level.name}: Customer pays must be greater than Rider gets`)
      if (rider < okada) errors.push(`${level.name}: Rider gets must be at least the Okada price`)
    }
    return errors
  }

  async function saveLevelEdits() {
    const errors = validateLevelEdits()
    if (errors.length > 0) { setLevelErrors(errors); return }
    setLevelErrors([])
    setSavingLevels(true)
    for (const level of fareLevels) {
      if (!levelEdits[level.id]) continue
      const edit = getLevelEdit(level)
      const okada_price = Math.round(parseFloat(edit.okada_price) * 100)
      const rider_pay = Math.round(parseFloat(edit.rider_pay) * 100)
      const delivery_fee = Math.round(parseFloat(edit.delivery_fee) * 100)
      await supabase.from('fare_levels').update({ okada_price, rider_pay, delivery_fee }).eq('id', level.id)
      setFareLevels(p => p.map(l => l.id === level.id ? { ...l, okada_price, rider_pay, delivery_fee } : l))
    }
    setLevelEdits({})
    setSavingLevels(false)
    setEditLevelsOpen(false)
  }

  const totalLevelEdits = Object.keys(levelEdits).length
  const affectedRouteCount = Object.keys(levelEdits).reduce(
    (sum, id) => sum + routeCountForLevel(id), 0
  )

  // ── Derived ───────────────────────────────────────────────────────────────

  const selectedArea = initialAreas.find(a => a.id === selectedAreaId)


  const checkFromArea = initialAreas.find(a => a.id === checkFrom)
  const checkToArea = initialAreas.find(a => a.id === checkTo)
  const checkFare = checkFromArea && checkToArea ? getZoneFare(checkFromArea, checkToArea) : undefined
  const checkLevel = getFareLevel(checkFare)

  const exampleOtherArea = activeAreas.find(a => a.id !== selectedAreaId)

  return (
    <div className="max-w-[1200px] mx-auto flex flex-col gap-5 pb-10">

      {/* Breadcrumb */}
      <p className="text-[12px] text-ink-2">Admin · Zones and areas</p>

      {/* Header */}
      <div>
        <h1 className="font-heading font-bold text-[26px] leading-tight">Delivery prices</h1>
        <p className="text-[14px] text-ink-2 mt-1 max-w-xl">
          Pick the area a vendor is in. Each row shows what a delivery from there to another area costs
          the customer, what the rider earns, and what Dart keeps. Prices are the same in both directions.
        </p>
      </div>


      {/* Main layout */}
      <div className="flex gap-5 items-start flex-col xl:flex-row">

        {/* ── Routes table ──────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 bg-white rounded-2xl p-5 flex flex-col gap-4">

          {/* "Delivering from" pills */}
          <div className="flex flex-col gap-2">
            <p className="text-[11px] font-bold text-ink-2 uppercase tracking-wide">Delivering from</p>
            <div className="flex gap-2 flex-wrap">
              {activeAreas.map(area => (
                <button
                  key={area.id}
                  type="button"
                  onClick={() => setSelectedAreaId(area.id)}
                  className={`h-9 px-4 rounded-full text-[13px] font-semibold border-0 cursor-pointer transition-colors ${
                    selectedAreaId === area.id
                      ? 'bg-ink text-white'
                      : 'bg-surface text-ink hover:bg-line'
                  }`}
                >
                  {areaDisplayName(area)}
                </button>
              ))}
            </div>
          </div>

          {selectedArea && (
            <>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <h2 className="font-heading font-bold text-[18px]">From {selectedArea.name} to…</h2>
                <span className="text-[12px] text-ink-2">Tap a level to change a route&apos;s price</span>
              </div>

              {/* Scrollable table wrapper */}
              <div className="overflow-x-auto -mx-5 px-5">
                <table className="w-full text-[13px]" style={{ minWidth: 580 }}>
                  <thead>
                    <tr className="border-b border-line">
                      <th className="text-left pb-2.5 pr-4 font-semibold text-[11px] text-ink-2 uppercase tracking-wide">To area</th>
                      <th className="text-left pb-2.5 pr-4 font-semibold text-[11px] text-ink-2 uppercase tracking-wide">Price level</th>
                      <th className="text-right pb-2.5 px-3 font-semibold text-[11px] text-ink-2 uppercase tracking-wide whitespace-nowrap">Okada</th>
                      <th className="text-right pb-2.5 px-3 font-semibold text-[11px] text-ink-2 uppercase tracking-wide whitespace-nowrap">Rider gets</th>
                      <th className="text-right pb-2.5 px-3 font-semibold text-[11px] text-ink-2 uppercase tracking-wide whitespace-nowrap">Customer pays</th>
                      <th className="text-right pb-2.5 pl-3 font-semibold text-[11px] text-brand uppercase tracking-wide whitespace-nowrap">Dart keeps</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeAreas.map(toArea => {
                      const isSelf = toArea.id === selectedArea.id
                      const noZone = !selectedArea.zone_id || !toArea.zone_id
                      const fare = noZone ? undefined : getZoneFare(selectedArea, toArea)
                      const level = getFareLevel(fare)

                      return (
                        <tr key={toArea.id} className="border-b border-line last:border-0">
                          {/* Destination */}
                          <td className="py-3 pr-4 align-middle min-w-[140px]">
                            <p className="font-semibold text-[14px] leading-tight">
                              {isSelf ? `Within ${selectedArea.name}` : toArea.name}
                            </p>
                            {(isSelf || toArea.gate_pickup) && (
                              <p className="text-[11px] text-ink-2 mt-0.5 leading-snug">
                                {isSelf ? 'Vendor and customer in the same area' : 'Customer collects at the gate'}
                              </p>
                            )}
                          </td>

                          {/* Level buttons */}
                          <td className="py-3 pr-4 align-middle">
                            {noZone ? (
                              <span className="text-[12px] text-ink-2 italic">No zone assigned</span>
                            ) : (
                              <div className="flex items-center gap-1 flex-wrap">
                                {fareLevels.map(l => (
                                  <button
                                    key={l.id}
                                    type="button"
                                    onClick={() => setFareLevelForPair(selectedArea, toArea, l.id)}
                                    className={`h-8 px-3 rounded-lg text-[12px] font-semibold border-0 cursor-pointer transition-colors whitespace-nowrap ${
                                      fare?.fare_level_id === l.id
                                        ? 'bg-brand text-white'
                                        : 'bg-surface text-ink hover:bg-line'
                                    }`}
                                  >
                                    {l.name}
                                  </button>
                                ))}
                                {!fare?.fare_level_id && (
                                  <span className="text-[11px] font-semibold text-warn bg-warn-tint px-2 py-0.5 rounded-md">
                                    Not set
                                  </span>
                                )}
                              </div>
                            )}
                          </td>

                          {/* Amounts */}
                          <td className="py-3 px-3 align-middle text-right tabular-nums text-ink-2 whitespace-nowrap">
                            {level ? formatMoney(level.okada_price) : '—'}
                          </td>
                          <td className="py-3 px-3 align-middle text-right tabular-nums text-ink-2 whitespace-nowrap">
                            {level ? formatMoney(level.rider_pay) : '—'}
                          </td>
                          <td className="py-3 px-3 align-middle text-right tabular-nums font-semibold whitespace-nowrap">
                            {level ? formatMoney(level.delivery_fee) : '—'}
                          </td>
                          <td className="py-3 pl-3 align-middle text-right tabular-nums font-bold text-brand whitespace-nowrap">
                            {level ? formatMoney(level.delivery_fee - level.rider_pay) : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Bidirectional note */}
              <div className="flex items-start gap-2 text-[12px] text-ink-2 border-t border-line pt-3">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 mt-0.5">
                  <path d="M7 16H3l4-4-4-4h4"/><path d="M17 8h4l-4 4 4 4h-4"/>
                </svg>
                <span>
                  Changing a route here also changes the same route back to <strong>{selectedArea.name}</strong>;
                  {exampleOtherArea && (
                    <> for example, {selectedArea.name} &rarr; {exampleOtherArea.name} and {exampleOtherArea.name} &rarr; {selectedArea.name} always cost the same.</>
                  )}{' '}
                  New prices apply to new orders only; orders already placed keep the price they were charged.
                </span>
              </div>
            </>
          )}
        </div>

        {/* ── Sidebar ───────────────────────────────────────────────────── */}
        <div className="w-full xl:w-[300px] shrink-0 flex flex-col gap-4">

          {/* Check a price */}
          <div className="bg-white rounded-2xl p-4 flex flex-col gap-3">
            <h3 className="font-heading font-bold text-[16px]">Check a price</h3>

            <label className="flex flex-col gap-1 text-[12px] font-semibold text-ink-2">
              Vendor is in
              <select
                value={checkFrom}
                onChange={e => setCheckFrom(e.target.value)}
                className="h-10 px-3 rounded-xl border border-line bg-white font-body text-[14px] text-ink font-normal"
              >
                <option value="">Select area</option>
                {activeAreas.map(a => (
                  <option key={a.id} value={a.id}>{areaDisplayName(a)}</option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-[12px] font-semibold text-ink-2">
              Customer is in
              <select
                value={checkTo}
                onChange={e => setCheckTo(e.target.value)}
                className="h-10 px-3 rounded-xl border border-line bg-white font-body text-[14px] text-ink font-normal"
              >
                <option value="">Select area</option>
                {activeAreas.map(a => (
                  <option key={a.id} value={a.id}>{areaDisplayName(a)}</option>
                ))}
              </select>
            </label>

            {checkFromArea && checkToArea && (
              checkLevel ? (
                <div className="bg-brand-tint rounded-xl p-3 flex flex-col gap-1.5">
                  <p className="text-[13px] font-bold text-brand-ink capitalize">{checkLevel.name} trip</p>
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-ink-2">Customer pays</span>
                    <span className="font-bold text-ink">{formatMoney(checkLevel.delivery_fee)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-ink-2">Rider gets</span>
                    <span className="font-bold text-ink">{formatMoney(checkLevel.rider_pay)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-ink-2">Dart keeps</span>
                    <span className="font-bold text-brand">{formatMoney(checkLevel.delivery_fee - checkLevel.rider_pay)}</span>
                  </div>
                </div>
              ) : (
                <div className="bg-warn-tint rounded-xl p-3">
                  <p className="text-[13px] text-warn font-semibold">No price set for this route</p>
                </div>
              )
            )}
          </div>

          {/* Price levels */}
          <div className="bg-white rounded-2xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="font-heading font-bold text-[16px]">Price levels</h3>
              <button
                type="button"
                onClick={() => { setEditLevelsOpen(p => !p); setLevelErrors([]) }}
                className="text-[12px] font-semibold text-brand border-0 bg-transparent cursor-pointer"
              >
                {editLevelsOpen ? 'Cancel' : 'Edit amounts'}
              </button>
            </div>
            <p className="text-[12px] text-ink-2 -mt-1">
              Change an amount here and every route on that level updates at once. Use this when fuel or okada prices change.
            </p>

            {editLevelsOpen ? (
              <>
                {levelErrors.length > 0 && (
                  <div className="bg-danger/10 rounded-xl p-3 flex flex-col gap-1">
                    {levelErrors.map((e, i) => (
                      <p key={i} className="text-[12px] text-danger">{e}</p>
                    ))}
                  </div>
                )}

                {totalLevelEdits > 0 && (
                  <p className="text-[12px] text-ink-2 bg-surface rounded-lg px-3 py-2">
                    This changes <strong>{affectedRouteCount}</strong> route{affectedRouteCount !== 1 ? 's' : ''}.
                  </p>
                )}

                <div className="flex flex-col gap-4">
                  {fareLevels.map(level => {
                    const edit = getLevelEdit(level)
                    return (
                      <div key={level.id} className="flex flex-col gap-2">
                        <p className="text-[13px] font-bold text-ink">{level.name}</p>
                        <div className="grid grid-cols-3 gap-2">
                          {(['okada_price', 'rider_pay', 'delivery_fee'] as const).map((field, fi) => (
                            <label key={field} className="flex flex-col gap-0.5 text-[11px] font-semibold text-ink-2">
                              {fi === 0 ? 'Okada' : fi === 1 ? 'Rider' : 'Customer'}
                              <div className="relative">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-2 text-[12px] pointer-events-none">₦</span>
                                <input
                                  type="number"
                                  step="50"
                                  min="0"
                                  value={edit[field]}
                                  onChange={e => setLevelEditField(level.id, field, e.target.value)}
                                  className="w-full h-9 pl-6 pr-2 rounded-lg border border-line text-[13px] font-body font-semibold text-ink"
                                />
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>

                <button
                  type="button"
                  onClick={saveLevelEdits}
                  disabled={savingLevels || totalLevelEdits === 0}
                  className="h-10 rounded-xl bg-brand text-white text-[13px] font-bold border-0 cursor-pointer disabled:opacity-50 mt-1"
                >
                  {savingLevels ? 'Saving…' : 'Save all changes'}
                </button>
              </>
            ) : (
              <div className="flex flex-col gap-3">
                {fareLevels.map(level => (
                  <div key={level.id} className="rounded-xl border border-line p-3 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[14px] font-bold text-ink">{level.name}</span>
                      <span className="text-[11px] text-ink-2">{routeCountForLevel(level.id)} routes</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1 text-[12px]">
                      {[
                        ['Okada', level.okada_price],
                        ['Rider', level.rider_pay],
                        ['Customer', level.delivery_fee],
                      ].map(([label, amount]) => (
                        <div key={String(label)}>
                          <p className="text-ink-2 text-[11px]">{label}</p>
                          <p className="font-semibold text-ink">{formatMoney(Number(amount))}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Toast stack */}
      {toasts.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center pointer-events-none">
          {toasts.map(toast => (
            <div
              key={toast.id}
              className="flex items-center gap-3 bg-ink text-white rounded-2xl px-4 py-3 shadow-xl pointer-events-auto text-[13px] max-w-sm"
            >
              <span className="flex-1">{toast.message}</span>
              <button
                type="button"
                onClick={() => { toast.undoFn(); dismissToast(toast.id) }}
                className="font-bold text-brand-tint border-0 bg-transparent cursor-pointer shrink-0"
              >
                Undo
              </button>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                className="font-bold text-white/50 border-0 bg-transparent cursor-pointer shrink-0 text-[16px] leading-none"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

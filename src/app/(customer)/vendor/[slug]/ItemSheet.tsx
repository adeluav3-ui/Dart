'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { X } from 'lucide-react'
import { formatMoney } from '@/lib/format'
import { useCart } from '@/store/cart'
import type { Vendor, MenuItem, OptionGroup, Option } from '@/types/database'

interface Props {
  item: MenuItem
  vendor: Vendor
  optionGroups: OptionGroup[]
  options: Option[]
  onClose: () => void
}

interface Selection {
  group: OptionGroup
  chosen: Option[]
}

export function ItemSheet({ item, vendor, optionGroups, options, onClose }: Props) {
  const [qty, setQty] = useState(1)
  const [selections, setSelections] = useState<Selection[]>(() =>
    optionGroups.map(g => ({ group: g, chosen: [] }))
  )
  const [clearConfirm, setClearConfirm] = useState(false)
  const { addItem, confirmClearAndAdd } = useCart()

  const groupOptions = (groupId: string) =>
    options.filter(o => o.group_id === groupId && o.is_available)

  function toggleOption(group: OptionGroup, option: Option) {
    setSelections(prev =>
      prev.map(s => {
        if (s.group.id !== group.id) return s
        const has = s.chosen.some(c => c.id === option.id)
        if (group.max_select === 1) {
          return { ...s, chosen: has ? [] : [option] }
        }
        if (has) {
          return { ...s, chosen: s.chosen.filter(c => c.id !== option.id) }
        }
        if (s.chosen.length >= group.max_select) return s
        return { ...s, chosen: [...s.chosen, option] }
      })
    )
  }

  const isRequiredFilled = optionGroups
    .filter(g => g.min_select > 0)
    .every(g => {
      const sel = selections.find(s => s.group.id === g.id)
      return (sel?.chosen.length ?? 0) >= g.min_select
    })

  const optionsDelta = selections
    .flatMap(s => s.chosen)
    .reduce((sum, o) => sum + o.price_delta, 0)

  const total = (item.base_price + optionsDelta) * qty

  function handleAdd() {
    const result = addItem(
      vendor.id,
      vendor.name,
      vendor.zone_id,
      item,
      qty,
      selections.map(s => ({ group: s.group, options: s.chosen }))
    )
    if (result === 'conflict') {
      setClearConfirm(true)
    } else {
      onClose()
    }
  }

  function handleConfirmClear() {
    confirmClearAndAdd(
      vendor.id,
      vendor.name,
      vendor.zone_id,
      item,
      qty,
      selections.map(s => ({ group: s.group, options: s.chosen }))
    )
    onClose()
  }

  // Close on backdrop click
  function onBackdrop(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose()
  }

  // Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 bg-[#5E6166]/80 flex items-end"
      onClick={onBackdrop}
    >
      <div className="w-full max-h-[90vh] bg-white rounded-t-3xl flex flex-col overflow-hidden">
        {/* Drag handle */}
        <div className="flex justify-center pt-2.5">
          <span className="w-10 h-1 rounded-full bg-[#D5D8DC]" />
        </div>

        {/* Close */}
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute right-4 top-3.5 w-10 h-10 rounded-full bg-surface flex items-center justify-center"
        >
          <X size={18} strokeWidth={2.2} />
        </button>

        <div className="overflow-y-auto flex-1 px-5 pt-4">
          {/* Item photo */}
          <div className="h-[150px] rounded-2xl bg-photo flex items-center justify-center overflow-hidden">
            {item.photo_url ? (
              <Image src={item.photo_url} alt={item.name} width={400} height={150} className="object-cover w-full h-full" />
            ) : (
              <span className="text-xs text-[#6B5E4B]">Photo</span>
            )}
          </div>

          <h1 className="font-heading font-extrabold text-2xl mt-3">{item.name}</h1>
          {item.description && (
            <p className="text-sm text-ink-2 leading-snug mt-1">{item.description}</p>
          )}
          <p className="text-base font-bold mt-1">From {formatMoney(item.base_price)}</p>

          {/* Option groups */}
          {optionGroups.map(group => {
            const sel = selections.find(s => s.group.id === group.id)!
            const required = group.min_select > 0
            return (
              <section key={group.id} className="mt-4.5">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold">{group.name}</h2>
                  {required ? (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-lg bg-warn-tint text-warn">
                      Required · pick {group.min_select}
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-ink-2">Optional</span>
                  )}
                </div>
                <div role={group.max_select === 1 ? 'radiogroup' : 'group'} aria-label={group.name} className="flex flex-col mt-1.5">
                  {groupOptions(group.id).map(opt => {
                    const checked = sel.chosen.some(c => c.id === opt.id)
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        role={group.max_select === 1 ? 'radio' : 'checkbox'}
                        aria-checked={checked}
                        onClick={() => toggleOption(group, opt)}
                        className="flex items-center gap-3 min-h-[48px] border-0 border-b border-[#EEF0F2] bg-transparent text-left cursor-pointer"
                      >
                        <span
                          className={`w-[22px] h-[22px] flex-none rounded-full transition-all ${
                            group.max_select === 1
                              ? checked
                                ? 'border-[7px] border-brand'
                                : 'border-2 border-[#C3C8CD]'
                              : checked
                                ? 'bg-brand border-2 border-brand'
                                : 'border-2 border-[#C3C8CD]'
                          }`}
                        />
                        <span className="flex-1 text-[15px]">{opt.name}</span>
                        <span className="text-sm text-ink-2">
                          {opt.price_delta > 0 ? `+${formatMoney(opt.price_delta)}` :
                           opt.price_delta < 0 ? formatMoney(opt.price_delta) : 'Included'}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </section>
            )
          })}
          <div className="h-6" />
        </div>

        {/* Footer */}
        <div className="px-4 pt-3 pb-5 border-t border-line flex gap-3 items-center">
          <div className="flex items-center gap-1 h-btn px-1.5 rounded-2xl bg-surface">
            <button
              type="button"
              aria-label="Decrease"
              onClick={() => setQty(q => Math.max(1, q - 1))}
              className="w-10 h-11 border-0 bg-transparent font-body text-xl text-ink cursor-pointer"
            >
              −
            </button>
            <span className="w-5 text-center text-base font-bold">{qty}</span>
            <button
              type="button"
              aria-label="Increase"
              onClick={() => setQty(q => Math.min(10, q + 1))}
              className="w-10 h-11 border-0 bg-transparent font-body text-xl text-ink cursor-pointer"
            >
              +
            </button>
          </div>
          <button
            type="button"
            disabled={!isRequiredFilled}
            onClick={handleAdd}
            className="flex-1 h-btn rounded-2xl bg-brand text-white font-bold text-base disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Add to cart · {formatMoney(total)}
          </button>
        </div>
      </div>

      {/* Clear cart confirmation */}
      {clearConfirm && (
        <div className="fixed inset-0 z-60 bg-black/50 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl p-6 flex flex-col gap-4 max-w-sm w-full">
            <h2 className="font-heading font-bold text-lg">Start a new cart?</h2>
            <p className="text-sm text-ink-2">
              Your cart has items from a different vendor. Starting a new cart will clear those items.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setClearConfirm(false)}
                className="flex-1 h-btn-sm rounded-xl border border-line text-sm font-semibold"
              >
                Keep cart
              </button>
              <button
                type="button"
                onClick={handleConfirmClear}
                className="flex-1 h-btn-sm rounded-xl bg-brand text-white text-sm font-semibold"
              >
                Clear &amp; add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

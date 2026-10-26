'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Cart, CartItem, MenuItem, OptionGroup, Option } from '@/types/database'

interface CartStore {
  cart: Cart | null
  addItem: (
    vendorId: string,
    vendorName: string,
    vendorZoneId: string | null,
    item: MenuItem,
    qty: number,
    selectedOptions: { group: OptionGroup; options: Option[] }[]
  ) => 'added' | 'conflict'
  updateQty: (itemIndex: number, qty: number) => void
  removeItem: (itemIndex: number) => void
  clearCart: () => void
  confirmClearAndAdd: (
    vendorId: string,
    vendorName: string,
    vendorZoneId: string | null,
    item: MenuItem,
    qty: number,
    selectedOptions: { group: OptionGroup; options: Option[] }[]
  ) => void
}

function computeLineTotal(
  item: MenuItem,
  qty: number,
  selectedOptions: { group: OptionGroup; options: Option[] }[]
): number {
  const optionsTotal = selectedOptions
    .flatMap(s => s.options)
    .reduce((sum, o) => sum + o.price_delta, 0)
  return (item.base_price + optionsTotal) * qty
}

export const useCart = create<CartStore>()(
  persist(
    (set, get) => ({
      cart: null,

      addItem(vendorId, vendorName, vendorZoneId, item, qty, selectedOptions) {
        const { cart } = get()
        if (cart && cart.vendorId !== vendorId) return 'conflict'

        const lineTotal = computeLineTotal(item, qty, selectedOptions)
        const newItem: CartItem = { item, qty, selectedOptions, lineTotal }

        set(state => ({
          cart: {
            vendorId,
            vendorName,
            vendorZoneId,
            items: [...(state.cart?.items ?? []), newItem],
          },
        }))
        return 'added'
      },

      updateQty(itemIndex, qty) {
        set(state => {
          if (!state.cart) return state
          const items = [...state.cart.items]
          if (qty <= 0) {
            items.splice(itemIndex, 1)
          } else {
            const ci = items[itemIndex]
            items[itemIndex] = {
              ...ci,
              qty,
              lineTotal: computeLineTotal(ci.item, qty, ci.selectedOptions),
            }
          }
          if (items.length === 0) return { cart: null }
          return { cart: { ...state.cart, items } }
        })
      },

      removeItem(itemIndex) {
        set(state => {
          if (!state.cart) return state
          const items = state.cart.items.filter((_, i) => i !== itemIndex)
          if (items.length === 0) return { cart: null }
          return { cart: { ...state.cart, items } }
        })
      },

      clearCart() {
        set({ cart: null })
      },

      confirmClearAndAdd(vendorId, vendorName, vendorZoneId, item, qty, selectedOptions) {
        set({ cart: null })
        get().addItem(vendorId, vendorName, vendorZoneId, item, qty, selectedOptions)
      },
    }),
    { name: 'dart-cart' }
  )
)

export function cartSubtotal(cart: Cart): number {
  return cart.items.reduce((sum, i) => sum + i.lineTotal, 0)
}

export function cartItemCount(cart: Cart): number {
  return cart.items.reduce((sum, i) => sum + i.qty, 0)
}

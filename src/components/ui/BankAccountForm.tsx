'use client'

import { useState, useEffect, useRef } from 'react'

interface Bank { name: string; code: string }

export interface BankAccountValues {
  bankCode: string
  bankName: string
  accountNo: string
  accountName: string
}

interface Props {
  defaultBankCode?: string
  defaultBankName?: string
  defaultAccountNo?: string
  defaultAccountName?: string
  onChange: (values: BankAccountValues) => void
}

export function BankAccountForm({
  defaultBankCode = '',
  defaultBankName = '',
  defaultAccountNo = '',
  defaultAccountName = '',
  onChange,
}: Props) {
  const [banks, setBanks] = useState<Bank[]>([])
  const [search, setSearch] = useState(defaultBankName)
  const [bankCode, setBankCode] = useState(defaultBankCode)
  const [bankName, setBankName] = useState(defaultBankName)
  const [accountNo, setAccountNo] = useState(defaultAccountNo)
  const [accountName, setAccountName] = useState(defaultAccountName)
  const [showList, setShowList] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/banks')
      .then(r => r.json())
      .then(d => Array.isArray(d) ? setBanks(d) : null)
      .catch(() => null)
  }, [])

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setShowList(false)
        setSearch(bankName)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [bankName])

  const filtered = banks
    .filter(b => b.name.toLowerCase().includes(search.toLowerCase()))
    .slice(0, 10)

  function selectBank(b: Bank) {
    setBankCode(b.code)
    setBankName(b.name)
    setSearch(b.name)
    setShowList(false)
    onChange({ bankCode: b.code, bankName: b.name, accountNo, accountName })
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Bank search */}
      <label className="flex flex-col gap-1 text-[12px] font-semibold text-ink-2">
        Bank
        <div className="relative" ref={wrapRef}>
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setShowList(true) }}
            onFocus={() => setShowList(true)}
            placeholder="Search bank…"
            autoComplete="off"
            className="w-full h-btn-sm px-3 rounded-xl border border-line font-body text-[15px] text-ink"
          />
          {showList && filtered.length > 0 && (
            <ul className="absolute z-20 left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-line overflow-auto max-h-52">
              {filtered.map(b => (
                <li key={b.code} className="border-b border-line last:border-0">
                  <button
                    type="button"
                    onMouseDown={() => selectBank(b)}
                    className="w-full text-left px-3 py-2.5 text-[14px] hover:bg-surface active:bg-surface"
                  >
                    {b.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {banks.length === 0 && (
            <p className="absolute top-full mt-1 left-0 text-[12px] text-ink-2 px-1">Loading banks…</p>
          )}
        </div>
      </label>

      {/* Account number */}
      <label className="flex flex-col gap-1 text-[12px] font-semibold text-ink-2">
        Account number
        <input
          type="tel"
          inputMode="numeric"
          maxLength={10}
          value={accountNo}
          onChange={e => {
            const v = e.target.value.replace(/\D/g, '').slice(0, 10)
            setAccountNo(v)
            onChange({ bankCode, bankName, accountNo: v, accountName })
          }}
          placeholder="10 digits"
          className="h-btn-sm px-3 rounded-xl border border-line font-body text-[15px] text-ink"
        />
      </label>

      {/* Account name */}
      <label className="flex flex-col gap-1 text-[12px] font-semibold text-ink-2">
        Account name
        <input
          type="text"
          value={accountName}
          onChange={e => {
            setAccountName(e.target.value)
            onChange({ bankCode, bankName, accountNo, accountName: e.target.value })
          }}
          placeholder="Full name on account"
          className="h-btn-sm px-3 rounded-xl border border-line font-body text-[15px] text-ink"
        />
      </label>
    </div>
  )
}

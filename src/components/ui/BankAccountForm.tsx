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
  onVerifyError?: (msg: string) => void
}

export function BankAccountForm({
  defaultBankCode = '',
  defaultBankName = '',
  defaultAccountNo = '',
  defaultAccountName = '',
  onChange,
  onVerifyError,
}: Props) {
  const [banks, setBanks] = useState<Bank[]>([])
  const [search, setSearch] = useState(defaultBankName)
  const [bankCode, setBankCode] = useState(defaultBankCode)
  const [bankName, setBankName] = useState(defaultBankName)
  const [accountNo, setAccountNo] = useState(defaultAccountNo)
  const [accountName, setAccountName] = useState(defaultAccountName)
  const [showList, setShowList] = useState(false)
  const [verifying, setVerifying] = useState(false)
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
        // If user typed but didn't select, restore the last committed bank name
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
    // Reset account name when bank changes — requires re-verification
    setAccountName('')
    onChange({ bankCode: b.code, bankName: b.name, accountNo, accountName: '' })
  }

  function handleAccountNoChange(value: string) {
    setAccountNo(value)
    setAccountName('')
    onChange({ bankCode, bankName, accountNo: value, accountName: '' })
  }

  async function verify() {
    if (!bankCode || accountNo.length < 10) return
    setVerifying(true)
    try {
      const res = await fetch(`/api/verify-account?bankCode=${encodeURIComponent(bankCode)}&accountNumber=${accountNo}`)
      const json = await res.json()
      if (json.name) {
        setAccountName(json.name)
        onChange({ bankCode, bankName, accountNo, accountName: json.name })
      } else {
        onVerifyError?.('Could not look up account. Enter the account name manually.')
      }
    } catch {
      onVerifyError?.('Could not look up account. Enter the account name manually.')
    } finally {
      setVerifying(false)
    }
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

      {/* Account number + verify */}
      <label className="flex flex-col gap-1 text-[12px] font-semibold text-ink-2">
        Account number
        <div className="flex gap-2">
          <input
            type="tel"
            inputMode="numeric"
            maxLength={10}
            value={accountNo}
            onChange={e => handleAccountNoChange(e.target.value.replace(/\D/g, '').slice(0, 10))}
            placeholder="10 digits"
            className="flex-1 h-btn-sm px-3 rounded-xl border border-line font-body text-[15px] text-ink"
          />
          <button
            type="button"
            onClick={verify}
            disabled={verifying || accountNo.length < 10 || !bankCode}
            className="h-btn-sm px-4 rounded-xl bg-surface border border-line text-[13px] font-bold text-ink-2 shrink-0 disabled:opacity-40"
          >
            {verifying ? '…' : 'Verify'}
          </button>
        </div>
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
          placeholder="Filled automatically after verification"
          className="h-btn-sm px-3 rounded-xl border border-line font-body text-[15px] text-ink"
        />
      </label>
    </div>
  )
}

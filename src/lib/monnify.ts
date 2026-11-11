const BASE_URL    = process.env.MONNIFY_BASE_URL!
const API_KEY     = process.env.MONNIFY_API_KEY!
const SECRET_KEY  = process.env.MONNIFY_SECRET_KEY!
const CONTRACT    = process.env.MONNIFY_CONTRACT_CODE!
const SOURCE_ACCT = process.env.MONNIFY_SOURCE_ACCOUNT!

// Module-level token cache (lives as long as the Node process).
let _token = ''
let _tokenExpiry = 0

async function getToken(): Promise<string> {
  if (_token && Date.now() < _tokenExpiry) return _token
  const creds = Buffer.from(`${API_KEY}:${SECRET_KEY}`).toString('base64')
  const res = await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { Authorization: `Basic ${creds}` },
  })
  const json = await res.json()
  if (!json.requestSuccessful) throw new Error('Monnify auth failed')
  _token = json.responseBody.accessToken
  _tokenExpiry = Date.now() + 50 * 60 * 1000
  return _token
}

export interface MonnifyBank {
  name: string
  code: string
}

export async function getBanks(): Promise<MonnifyBank[]> {
  const token = await getToken()
  const res = await fetch(`${BASE_URL}/api/v1/banks`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const json = await res.json()
  if (!json.requestSuccessful) throw new Error('Failed to fetch banks')
  return (json.responseBody as { name: string; code: string }[]).map(b => ({
    name: b.name,
    code: b.code,
  }))
}

export async function verifyAccount(bankCode: string, accountNumber: string): Promise<string | null> {
  const token = await getToken()
  const url = `${BASE_URL}/api/v1/disbursements/account/validate?accountNumber=${accountNumber}&bankCode=${bankCode}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  const json = await res.json()
  if (!json.requestSuccessful) return null
  return (json.responseBody?.accountName as string) ?? null
}

export interface TransferParams {
  amountKobo: number
  reference: string
  narration: string
  destinationBankCode: string
  destinationAccountNumber: string
  destinationAccountName: string
}

export interface TransferResult {
  status: 'SUCCESS' | 'PENDING' | 'FAILED'
  reference: string
}

export async function singleTransfer(params: TransferParams): Promise<TransferResult> {
  const token = await getToken()
  const res = await fetch(`${BASE_URL}/api/v2/disbursements/single`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount:                    params.amountKobo / 100,
      reference:                 params.reference,
      narration:                 params.narration,
      destinationBankCode:       params.destinationBankCode,
      destinationAccountNumber:  params.destinationAccountNumber,
      currency:                  'NGN',
      sourceAccountNumber:       SOURCE_ACCT,
      contractCode:              CONTRACT,
    }),
  })
  const json = await res.json()
  if (!json.requestSuccessful) {
    return { status: 'FAILED', reference: params.reference }
  }
  const status = json.responseBody?.status ?? 'PENDING'
  return {
    status: status === 'SUCCESS' ? 'SUCCESS' : status === 'FAILED' ? 'FAILED' : 'PENDING',
    reference: params.reference,
  }
}

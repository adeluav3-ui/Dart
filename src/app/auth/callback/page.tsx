import { CallbackClient } from './CallbackClient'

interface Props {
  searchParams: { code?: string; next?: string }
}

// This page handles both PKCE (?code=…) and implicit (#access_token=…) auth flows.
// It renders client-side so the browser can exchange the code / read the hash,
// then does a full window.location.href reload so the server sees the session cookies.
export default function AuthCallbackPage({ searchParams }: Props) {
  const next = searchParams.next ?? '/home'
  return <CallbackClient code={searchParams.code} next={next} />
}

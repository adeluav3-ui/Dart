import { redirect } from 'next/navigation'
import { ConfirmClient } from './ConfirmClient'

interface Props {
  searchParams: { code?: string; next?: string }
}

export default function AuthConfirmPage({ searchParams }: Props) {
  const { code, next } = searchParams

  if (!code) redirect('/login')

  return <ConfirmClient code={code} next={next ?? '/home'} />
}

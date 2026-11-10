'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'

export default function RatePage({ params }: { params: { orderId: string } }) {
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function submit() {
    if (rating === 0) return
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: order } = await supabase
      .from('orders')
      .select('vendor_id, customer_id')
      .eq('id', params.orderId)
      .eq('customer_id', user.id)
      .eq('status', 'delivered')
      .single()

    if (!order) { setLoading(false); return }

    await supabase.from('reviews').upsert({
      order_id: params.orderId,
      customer_id: user.id,
      vendor_id: order.vendor_id,
      rating,
      comment: comment.trim() || null,
    })

    // Update vendor rating_avg and rating_count
    await supabase.rpc('update_vendor_rating', { p_vendor_id: order.vendor_id })

    setLoading(false)
    setDone(true)
  }

  if (done) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-6">
        <svg width="64" height="64" viewBox="0 0 24 24">
          <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" fill="#F5A524" />
        </svg>
        <h1 className="font-heading font-extrabold text-2xl text-center">Thanks for rating!</h1>
        <Link href="/home" className="text-brand font-semibold">Back to home</Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-canvas flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white rounded-2xl p-6 flex flex-col gap-6">
        <h1 className="font-heading font-extrabold text-2xl">Rate your order</h1>

        {/* Stars */}
        <div className="flex gap-2 justify-center">
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              className="w-12 h-12"
            >
              <svg width="44" height="44" viewBox="0 0 24 24">
                <path
                  d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"
                  fill={n <= (hover || rating) ? '#F5A524' : '#E6E8EB'}
                />
              </svg>
            </button>
          ))}
        </div>

        {/* Comment */}
        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder="Tell them what you liked (optional)"
          rows={3}
          className="w-full px-3 py-2.5 rounded-xl border border-line font-body text-sm text-ink resize-none outline-none focus:border-brand"
        />

        <Button onClick={submit} loading={loading} disabled={rating === 0} fullWidth size="lg">
          Submit
        </Button>
        <Link href="/home" className="text-sm text-ink-2 underline self-center">Skip</Link>
      </div>
    </div>
  )
}

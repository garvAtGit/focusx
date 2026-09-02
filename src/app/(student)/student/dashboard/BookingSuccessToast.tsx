'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'

export default function BookingSuccessToast() {
  const searchParams = useSearchParams()

  useEffect(() => {
    if (searchParams.get('booking') === 'success') {
      toast.success('Booking confirmed! Your seat is reserved.', { duration: 5000 })
      // Remove the query param without triggering a Next.js router cycle
      const url = new URL(window.location.href)
      url.searchParams.delete('booking')
      url.searchParams.delete('library')
      window.history.replaceState(null, '', url.pathname + url.search)
    }
  }, [searchParams])

  return null
}

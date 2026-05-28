import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Protocol } from '@/types/database'

export function useProtocols() {
  const [protocols, setProtocols] = useState<Protocol[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('protocols')
      .select('*')
      .eq('available', true)
      .order('order_index')
      .then(({ data }) => {
        setProtocols(data ?? [])
        setLoading(false)
      })
  }, [])

  return { protocols, loading }
}
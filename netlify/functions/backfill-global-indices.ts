import type { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

// 글로벌 지수 과거 데이터 백필 함수
// Yahoo Finance에서 최대 20년치 주간 데이터 수집

const SUPABASE_URL = process.env.SUPABASE_URL || ''
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

interface YahooChartResult {
  chart: {
    result: Array<{
      timestamp: number[]
      indicators: {
        quote: Array<{
          open: (number | null)[]
          high: (number | null)[]
          low: (number | null)[]
          close: (number | null)[]
          volume: (number | null)[]
        }>
      }
    }>
    error: null | { code: string; description: string }
  }
}

const GLOBAL_INDICES = [
  // 미국
  { symbol: '^DJI', name: '다우존스', region: '미국' },
  { symbol: '^GSPC', name: 'S&P 500', region: '미국' },
  { symbol: '^IXIC', name: '나스닥', region: '미국' },
  { symbol: '^RUT', name: '러셀 2000', region: '미국' },
  // 유럽
  { symbol: '^FTSE', name: 'FTSE 100', region: '유럽' },
  { symbol: '^GDAXI', name: 'DAX', region: '유럽' },
  { symbol: '^FCHI', name: 'CAC 40', region: '유럽' },
  // 아시아
  { symbol: '^N225', name: '니케이 225', region: '아시아' },
  { symbol: '^HSI', name: '항셍', region: '아시아' },
  { symbol: '000001.SS', name: '상해종합', region: '아시아' },
  { symbol: '^KS11', name: 'KOSPI', region: '아시아' },
  // 기타
  { symbol: '^BVSP', name: '보베스파', region: '기타' },
  { symbol: '^AXJO', name: 'ASX 200', region: '기타' },
]

async function fetchYahooHistory(symbol: string): Promise<YahooChartResult | null> {
  try {
    // 20년치 주간 데이터 요청
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1wk&range=20y`
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    })
    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  }
}

export const handler: Handler = async (event) => {
  // 특정 심볼만 처리하거나 전체 처리
  const targetSymbol = event.queryStringParameters?.symbol

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Missing Supabase credentials' }),
    }
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  const indicesToProcess = targetSymbol
    ? GLOBAL_INDICES.filter(i => i.symbol === targetSymbol)
    : GLOBAL_INDICES

  const results: { symbol: string; count: number; error?: string }[] = []

  for (const index of indicesToProcess) {
    console.log(`Processing ${index.symbol}...`)

    const data = await fetchYahooHistory(index.symbol)
    if (!data?.chart?.result?.[0]) {
      results.push({ symbol: index.symbol, count: 0, error: 'No data from Yahoo' })
      continue
    }

    const result = data.chart.result[0]
    const timestamps = result.timestamp || []
    const quotes = result.indicators.quote[0]

    const records: {
      date: string
      symbol: string
      name: string
      region: string
      open_price: number | null
      high_price: number | null
      low_price: number | null
      close_price: number | null
      volume: number | null
    }[] = []

    for (let i = 0; i < timestamps.length; i++) {
      const date = new Date(timestamps[i] * 1000).toISOString().split('T')[0]
      records.push({
        date,
        symbol: index.symbol,
        name: index.name,
        region: index.region,
        open_price: quotes.open[i],
        high_price: quotes.high[i],
        low_price: quotes.low[i],
        close_price: quotes.close[i],
        volume: quotes.volume[i],
      })
    }

    // upsert로 중복 방지
    const { error } = await supabase
      .from('global_indices_history')
      .upsert(records, { onConflict: 'date,symbol' })

    if (error) {
      results.push({ symbol: index.symbol, count: 0, error: error.message })
    } else {
      results.push({ symbol: index.symbol, count: records.length })
    }

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 500))
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Backfill completed',
      results,
    }),
  }
}

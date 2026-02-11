import type { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

// Netlify Scheduled Function - 매일 오후 10시(UTC) 실행
// 미국 장 마감 후 데이터 수집 (한국시간 오전 7시)

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

async function fetchYahooLatest(symbol: string): Promise<YahooChartResult | null> {
  try {
    // 최근 5일 일간 데이터 요청 (주말/휴일 대비)
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`
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

export const handler: Handler = async () => {
  console.log('Starting global indices data collection...')

  const SUPABASE_URL = process.env.SUPABASE_URL
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Missing Supabase credentials')
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Missing Supabase credentials' }),
    }
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  const results: { symbol: string; date?: string; error?: string }[] = []

  for (const index of GLOBAL_INDICES) {
    console.log(`Fetching ${index.symbol}...`)

    const data = await fetchYahooLatest(index.symbol)
    if (!data?.chart?.result?.[0]) {
      results.push({ symbol: index.symbol, error: 'No data from Yahoo' })
      continue
    }

    const result = data.chart.result[0]
    const timestamps = result.timestamp || []
    const quotes = result.indicators.quote[0]

    if (timestamps.length === 0) {
      results.push({ symbol: index.symbol, error: 'Empty timestamps' })
      continue
    }

    // 가장 최근 유효한 데이터 찾기
    let latestIdx = timestamps.length - 1
    while (latestIdx >= 0 && quotes.close[latestIdx] === null) {
      latestIdx--
    }

    if (latestIdx < 0) {
      results.push({ symbol: index.symbol, error: 'No valid close price' })
      continue
    }

    const date = new Date(timestamps[latestIdx] * 1000).toISOString().split('T')[0]

    const record = {
      date,
      symbol: index.symbol,
      name: index.name,
      region: index.region,
      open_price: quotes.open[latestIdx],
      high_price: quotes.high[latestIdx],
      low_price: quotes.low[latestIdx],
      close_price: quotes.close[latestIdx],
      volume: quotes.volume[latestIdx],
    }

    const { error } = await supabase
      .from('global_indices_history')
      .upsert(record, { onConflict: 'date,symbol' })

    if (error) {
      results.push({ symbol: index.symbol, error: error.message })
    } else {
      results.push({ symbol: index.symbol, date })
    }

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 300))
  }

  const successCount = results.filter(r => !r.error).length
  console.log(`Collected ${successCount}/${GLOBAL_INDICES.length} indices`)

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Global indices collection completed',
      success: successCount,
      total: GLOBAL_INDICES.length,
      results,
    }),
  }
}

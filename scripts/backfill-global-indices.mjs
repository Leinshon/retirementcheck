import { createClient } from '@supabase/supabase-js'

// 글로벌 지수 과거 데이터 백필 스크립트
// Yahoo Finance에서 연도별로 데이터 수집 (주간 간격)

const SUPABASE_URL = 'https://xikizeymdabgwmwfifff.supabase.co'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhpa2l6ZXltZGFiZ3dtd2ZpZmZmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzE0OTkwNSwiZXhwIjoyMDgyNzI1OTA1fQ.arGutIYFRUhTJXR-BEEOsdkEzEq31CXx_BVSLmPlsk4'

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

// 특정 기간의 데이터를 가져오는 함수
async function fetchYahooHistoryByPeriod(symbol, period1, period2) {
  try {
    // period1, period2는 Unix timestamp (초 단위)
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1wk&period1=${period1}&period2=${period2}`
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    })
    if (!response.ok) {
      return null
    }
    return await response.json()
  } catch (e) {
    return null
  }
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  // 1990년부터 현재까지 5년 단위로 나눠서 가져오기
  const currentYear = new Date().getFullYear()
  const startYear = 1990
  const chunkYears = 5

  for (const index of GLOBAL_INDICES) {
    console.log(`\nProcessing ${index.symbol} (${index.name})...`)

    const allRecords = []

    // 5년 단위로 데이터 수집
    for (let year = startYear; year <= currentYear; year += chunkYears) {
      const endYear = Math.min(year + chunkYears, currentYear + 1)
      const period1 = Math.floor(new Date(`${year}-01-01`).getTime() / 1000)
      const period2 = Math.floor(new Date(`${endYear}-01-01`).getTime() / 1000)

      console.log(`  Fetching ${year}-${endYear}...`)

      const data = await fetchYahooHistoryByPeriod(index.symbol, period1, period2)
      if (!data?.chart?.result?.[0]) {
        console.log(`    No data for this period`)
        continue
      }

      const result = data.chart.result[0]
      const timestamps = result.timestamp || []
      const quotes = result.indicators.quote[0]

      for (let i = 0; i < timestamps.length; i++) {
        if (quotes.close[i] === null) continue

        const date = new Date(timestamps[i] * 1000).toISOString().split('T')[0]
        allRecords.push({
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

      console.log(`    Found ${timestamps.length} data points`)

      // Rate limiting between chunks
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    // 중복 제거 (같은 날짜)
    const uniqueRecords = []
    const seenDates = new Set()
    for (const record of allRecords) {
      if (!seenDates.has(record.date)) {
        seenDates.add(record.date)
        uniqueRecords.push(record)
      }
    }

    console.log(`  Total unique records: ${uniqueRecords.length}`)

    // 배치로 나눠서 upsert (500개씩)
    const batchSize = 500
    let inserted = 0

    for (let i = 0; i < uniqueRecords.length; i += batchSize) {
      const batch = uniqueRecords.slice(i, i + batchSize)
      const { error } = await supabase
        .from('global_indices_history')
        .upsert(batch, { onConflict: 'date,symbol' })

      if (error) {
        console.error(`  Error inserting batch: ${error.message}`)
      } else {
        inserted += batch.length
      }
    }

    console.log(`  Inserted: ${inserted} records`)

    // Rate limiting between symbols
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  console.log('\nBackfill completed!')
}

main().catch(console.error)

import type { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

// Fear & Greed 컬럼만 업데이트하는 경량 백필 함수
// GET /.netlify/functions/backfill-fear-greed

interface FearGreedData {
  date: Date
  value: number
}

interface CNNFearGreedHistoricalItem {
  x: number
  y: number
  rating: string
}

interface CNNFearGreedResponse {
  fear_and_greed: {
    score: number
    rating: string
    timestamp: string
  }
  fear_and_greed_historical: {
    data: CNNFearGreedHistoricalItem[]
  }
}

// GitHub CSV에서 2011-2023 과거 데이터 가져오기
async function fetchFearGreedFromGitHub(): Promise<FearGreedData[]> {
  try {
    const response = await fetch(
      'https://raw.githubusercontent.com/whit3rabbit/fear-greed-data/main/fear-greed-2011-2023.csv'
    )
    if (!response.ok) {
      console.warn(`GitHub CSV warning: ${response.status}`)
      return []
    }
    const csvText = await response.text()
    const lines = csvText.trim().split('\n')
    const data: FearGreedData[] = []

    for (let i = 1; i < lines.length; i++) {
      const [dateStr, valueStr] = lines[i].split(',')
      if (dateStr && valueStr) {
        const parts = dateStr.split('/')
        const month = parseInt(parts[0]) - 1
        const day = parseInt(parts[1])
        const year = parseInt(parts[2])
        const date = new Date(year, month, day)
        const value = parseInt(valueStr)
        if (!isNaN(value)) {
          data.push({ date, value })
        }
      }
    }
    console.log(`GitHub CSV: loaded ${data.length} records (2011-2023)`)
    return data
  } catch (error) {
    console.warn('GitHub CSV error:', error)
    return []
  }
}

// CNN Fear & Greed API에서 최근 1년 데이터 가져오기
async function fetchFearGreedFromCNN(): Promise<FearGreedData[]> {
  try {
    const response = await fetch(
      'https://production.dataviz.cnn.io/index/fearandgreed/graphdata',
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'application/json',
          Referer: 'https://edition.cnn.com/markets/fear-and-greed',
        },
      }
    )
    if (!response.ok) {
      console.warn(`CNN Fear & Greed API warning: ${response.status}`)
      return []
    }
    const json: CNNFearGreedResponse = await response.json()
    const historicalData = json.fear_and_greed_historical?.data || []

    const data: FearGreedData[] = historicalData.map((item) => ({
      date: new Date(item.x),
      value: Math.round(item.y),
    }))
    console.log(`CNN API: loaded ${data.length} records (recent 1 year)`)
    return data
  } catch (error) {
    console.warn('CNN Fear & Greed API error:', error)
    return []
  }
}

// Fear & Greed 값 찾기
function findFearGreedValue(data: FearGreedData[], targetDate: Date): number | null {
  const targetTime = targetDate.getTime()
  const dayMs = 24 * 60 * 60 * 1000

  for (const item of data) {
    const itemTime = item.date.getTime()
    const diff = Math.abs(itemTime - targetTime)
    if (diff < 2 * dayMs) {
      return item.value
    }
  }
  return null
}

const handler: Handler = async () => {
  const headers = {
    'Content-Type': 'application/json',
  }

  const SUPABASE_URL = process.env.SUPABASE_URL
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Missing Supabase environment variables' }),
    }
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  try {
    // 1. Fear & Greed 데이터 가져오기 (GitHub CSV + CNN API)
    const [githubData, cnnData] = await Promise.all([
      fetchFearGreedFromGitHub(),
      fetchFearGreedFromCNN(),
    ])

    const cutoffDate = new Date('2024-01-01')
    const recentCnnData = cnnData.filter((d) => d.date >= cutoffDate)
    const fearGreedData = [...githubData, ...recentCnnData]

    console.log(`Combined Fear & Greed data: ${fearGreedData.length} records`)

    // 2. DB에서 기존 레코드 날짜 목록 가져오기
    const { data: existingRecords, error: fetchError } = await supabase
      .from('market_indicators_history')
      .select('date, fear_greed')
      .order('date', { ascending: true })

    if (fetchError) {
      throw new Error(`Failed to fetch existing records: ${fetchError.message}`)
    }

    console.log(`Found ${existingRecords?.length || 0} existing records in DB`)

    // 3. 각 레코드의 fear_greed 값 업데이트
    let updatedCount = 0
    let skippedCount = 0
    const updates: Array<{ date: string; fear_greed: number }> = []

    for (const record of existingRecords || []) {
      const targetDate = new Date(record.date)
      const newValue = findFearGreedValue(fearGreedData, targetDate)

      if (newValue !== null && newValue !== record.fear_greed) {
        updates.push({
          date: record.date,
          fear_greed: newValue,
        })
        updatedCount++
      } else {
        skippedCount++
      }
    }

    console.log(`Updates needed: ${updatedCount}, Skipped: ${skippedCount}`)

    // 4. 배치 업데이트 실행
    if (updates.length > 0) {
      // Supabase는 upsert로 배치 업데이트 가능
      const { error: updateError } = await supabase
        .from('market_indicators_history')
        .upsert(updates, { onConflict: 'date' })

      if (updateError) {
        throw new Error(`Failed to update records: ${updateError.message}`)
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        totalRecords: existingRecords?.length || 0,
        updated: updatedCount,
        skipped: skippedCount,
        dataSource: {
          github: `${githubData.length} records (2011-2023)`,
          cnn: `${recentCnnData.length} records (2024~present)`,
        },
      }),
    }
  } catch (error) {
    console.error('Backfill Fear & Greed error:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Backfill failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
    }
  }
}

export { handler }

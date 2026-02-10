import type { Handler, HandlerEvent } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

// Netlify Scheduled Function - 매일 오전 9시(UTC) 실행
// netlify.toml에 스케줄 설정 필요:
// [functions."collect-market-data"]
// schedule = "0 9 * * *"

interface FREDObservation {
  date: string
  value: string
}

interface FREDResponse {
  observations: FREDObservation[]
}

interface YahooQuoteResult {
  chart: {
    result: Array<{
      meta: {
        regularMarketPrice: number
        previousClose: number
      }
      timestamp: number[]
      indicators: {
        adjclose: Array<{
          adjclose: number[]
        }>
      }
    }>
    error: null | { code: string; description: string }
  }
}

// FRED API Helper
async function fetchFRED(seriesId: string, apiKey: string, limit = 10): Promise<FREDObservation[]> {
  try {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=${limit}`
    const response = await fetch(url)
    if (!response.ok) {
      console.warn(`FRED API warning for ${seriesId}: ${response.status}`)
      return []
    }
    const data: FREDResponse = await response.json()
    return data.observations.filter(obs => obs.value !== '.')
  } catch (error) {
    console.warn(`FRED API error for ${seriesId}:`, error)
    return []
  }
}

// Yahoo Finance Helper
async function fetchYahooQuote(symbol: string): Promise<YahooQuoteResult | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1y`
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

// CNN Fear & Greed Helper
async function fetchFearGreed(): Promise<number | null> {
  try {
    const url = 'https://production.dataviz.cnn.io/index/fearandgreed/graphdata'
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    })
    if (!response.ok) return null
    const data = await response.json()
    return Math.round(data.fear_and_greed.score)
  } catch {
    return null
  }
}

// Calculate 200-day MA
function calculate200MA(prices: number[]): number {
  if (prices.length < 200) {
    return prices.reduce((a, b) => a + b, 0) / prices.length
  }
  const last200 = prices.slice(-200)
  return last200.reduce((a, b) => a + b, 0) / 200
}

// Calculate YoY change
function calculateYoYChange(current: number, yearAgo: number): number {
  return ((current - yearAgo) / yearAgo) * 100
}

// 점수 정규화 함수
function normalizeScore(value: number, min: number, max: number, invert = false): number {
  const clamped = Math.max(min, Math.min(max, value))
  const normalized = ((clamped - min) / (max - min)) * 100
  return invert ? 100 - normalized : normalized
}

// 종합 점수 계산 (카테고리별 동일 가중치)
function calculateCompositeScore(data: {
  fearGreed: number | null
  vix: number | null
  spyVs200MA: number | null
  buffettIndicator: number | null
  fedBalanceSheetYoY: number | null
  m2GrowthYoY: number | null
  hySpread: number | null
  yieldCurve10Y2Y: number | null
  yieldCurve10Y3M: number | null
  initialClaims: number | null
}): number {
  const categories: { [key: string]: number[] } = {
    sentiment: [],
    valuation: [],
    liquidity: [],
    credit: [],
    macro: [],
  }

  // Sentiment
  if (data.fearGreed !== null) categories.sentiment.push(100 - data.fearGreed)
  if (data.vix !== null) categories.sentiment.push(normalizeScore(data.vix, 12, 40, true))
  if (data.spyVs200MA !== null) categories.sentiment.push(normalizeScore(data.spyVs200MA, -10, 10, true))

  // Valuation
  if (data.buffettIndicator !== null) categories.valuation.push(normalizeScore(data.buffettIndicator, 80, 250, true))

  // Liquidity
  if (data.fedBalanceSheetYoY !== null) categories.liquidity.push(normalizeScore(data.fedBalanceSheetYoY, -5, 15))
  if (data.m2GrowthYoY !== null) categories.liquidity.push(normalizeScore(data.m2GrowthYoY, -5, 10))

  // Credit
  if (data.hySpread !== null) categories.credit.push(normalizeScore(data.hySpread, 2.5, 8, true))

  // Macro
  if (data.yieldCurve10Y2Y !== null) categories.macro.push(normalizeScore(data.yieldCurve10Y2Y, -1, 2))
  if (data.yieldCurve10Y3M !== null) categories.macro.push(normalizeScore(data.yieldCurve10Y3M, -1, 2))
  if (data.initialClaims !== null) categories.macro.push(normalizeScore(data.initialClaims, 200000, 400000, true))

  // 카테고리별 평균 계산
  const categoryAverages: number[] = []
  for (const scores of Object.values(categories)) {
    if (scores.length > 0) {
      categoryAverages.push(scores.reduce((a, b) => a + b, 0) / scores.length)
    }
  }

  if (categoryAverages.length === 0) return 0
  return Math.round((categoryAverages.reduce((a, b) => a + b, 0) / categoryAverages.length) * 100) / 100
}

const handler: Handler = async (event: HandlerEvent) => {
  console.log('Starting market data collection...')

  const FRED_API_KEY = process.env.FRED_API_KEY
  const SUPABASE_URL = process.env.SUPABASE_URL
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

  if (!FRED_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Missing required environment variables')
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Missing required environment variables' }),
    }
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  try {
    // Parallel fetch all data
    const [
      fearGreedValue,
      vixData,
      spyData,
      gdpData,
      marketCapData,
      walclData,
      m2Data,
      hySpreadData,
      dgs10Data,
      dgs2Data,
      dgs3moData,
      icsaData,
    ] = await Promise.all([
      fetchFearGreed(),
      fetchYahooQuote('^VIX'),
      fetchYahooQuote('SPY'),
      fetchFRED('GDP', FRED_API_KEY, 5),
      fetchFRED('NCBCEL', FRED_API_KEY, 5),
      fetchFRED('WALCL', FRED_API_KEY, 60),
      fetchFRED('M2SL', FRED_API_KEY, 15),
      fetchFRED('BAMLH0A0HYM2', FRED_API_KEY, 5),
      fetchFRED('DGS10', FRED_API_KEY, 5),
      fetchFRED('DGS2', FRED_API_KEY, 5),
      fetchFRED('DGS3MO', FRED_API_KEY, 5),
      fetchFRED('ICSA', FRED_API_KEY, 5),
    ])

    // Process data
    const today = new Date().toISOString().split('T')[0]

    let vix: number | null = null
    if (vixData?.chart?.result?.[0]) {
      vix = Math.round(vixData.chart.result[0].meta.regularMarketPrice * 100) / 100
    }

    let spyVs200MA: number | null = null
    if (spyData?.chart?.result?.[0]) {
      const result = spyData.chart.result[0]
      const prices = result.indicators.adjclose[0].adjclose.filter(p => p != null)
      const currentPrice = result.meta.regularMarketPrice
      const ma200 = calculate200MA(prices)
      spyVs200MA = Math.round(((currentPrice - ma200) / ma200) * 10000) / 100
    }

    let buffettIndicator: number | null = null
    if (gdpData.length > 0 && marketCapData.length > 0) {
      const gdp = parseFloat(gdpData[0].value) * 1000000000
      const marketCap = parseFloat(marketCapData[0].value) * 1000000
      buffettIndicator = Math.round((marketCap / gdp) * 10000) / 100
    }

    let fedBalanceSheetYoY: number | null = null
    if (walclData.length >= 52) {
      const current = parseFloat(walclData[0].value)
      const yearAgo = parseFloat(walclData[51].value)
      fedBalanceSheetYoY = Math.round(calculateYoYChange(current, yearAgo) * 100) / 100
    }

    let m2GrowthYoY: number | null = null
    if (m2Data.length >= 13) {
      const current = parseFloat(m2Data[0].value)
      const yearAgo = parseFloat(m2Data[12].value)
      m2GrowthYoY = Math.round(calculateYoYChange(current, yearAgo) * 100) / 100
    }

    let hySpread: number | null = null
    if (hySpreadData.length > 0) {
      hySpread = Math.round(parseFloat(hySpreadData[0].value) * 1000) / 1000
    }

    let yieldCurve10Y2Y: number | null = null
    if (dgs10Data.length > 0 && dgs2Data.length > 0) {
      yieldCurve10Y2Y = Math.round((parseFloat(dgs10Data[0].value) - parseFloat(dgs2Data[0].value)) * 1000) / 1000
    }

    let yieldCurve10Y3M: number | null = null
    if (dgs10Data.length > 0 && dgs3moData.length > 0) {
      yieldCurve10Y3M = Math.round((parseFloat(dgs10Data[0].value) - parseFloat(dgs3moData[0].value)) * 1000) / 1000
    }

    let initialClaims: number | null = null
    if (icsaData.length > 0) {
      initialClaims = parseInt(icsaData[0].value)
    }

    // Calculate composite score
    const compositeScore = calculateCompositeScore({
      fearGreed: fearGreedValue,
      vix,
      spyVs200MA,
      buffettIndicator,
      fedBalanceSheetYoY,
      m2GrowthYoY,
      hySpread,
      yieldCurve10Y2Y,
      yieldCurve10Y3M,
      initialClaims,
    })

    // Save to Supabase
    const record = {
      date: today,
      fear_greed: fearGreedValue,
      vix,
      spy_vs_200ma: spyVs200MA,
      buffett_indicator: buffettIndicator,
      fed_balance_sheet_yoy: fedBalanceSheetYoY,
      m2_growth_yoy: m2GrowthYoY,
      hy_spread: hySpread,
      yield_curve_10y2y: yieldCurve10Y2Y,
      yield_curve_10y3m: yieldCurve10Y3M,
      initial_claims: initialClaims,
      composite_score: compositeScore,
      raw_data: {
        fearGreed: fearGreedValue,
        vix,
        spyVs200MA,
        buffettIndicator,
        fedBalanceSheetYoY,
        m2GrowthYoY,
        hySpread,
        yieldCurve10Y2Y,
        yieldCurve10Y3M,
        initialClaims,
      },
    }

    // Upsert (insert or update if date exists)
    const { error } = await supabase
      .from('market_indicators_history')
      .upsert(record, { onConflict: 'date' })

    if (error) {
      console.error('Supabase error:', error)
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to save data', details: error.message }),
      }
    }

    console.log(`Successfully saved market data for ${today}`)
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        date: today,
        compositeScore,
        message: 'Market data collected and saved successfully',
      }),
    }
  } catch (error) {
    console.error('Error collecting market data:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to collect market data',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
    }
  }
}

export { handler }

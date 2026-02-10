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

// Z-score 기반 5개 핵심 지표 통계 (10년 상관분석 기반)
// Calculator.tsx와 동일한 방식
const INDICATOR_STATS = {
  'HY Spread': { mean: 4.5, std: 1.8, weight: 28.1, invert: true },
  'VIX': { mean: 18.5, std: 7.5, weight: 25.7, invert: true },
  'Initial Claims': { mean: 300000, std: 80000, weight: 23.5, invert: true },
  'S&P vs 200MA': { mean: 5, std: 8, weight: 16.3, invert: true },
  'Yield Curve 10Y-2Y': { mean: 0.5, std: 0.8, weight: 6.3, invert: false },
}

// Z-score 기반 종합 점수 계산 (Calculator와 동일)
function calculateCompositeScore(data: {
  vix: number | null
  spyVs200MA: number | null
  hySpread: number | null
  yieldCurve10Y2Y: number | null
  initialClaims: number | null
}): number {
  let weightedZScore = 0
  let totalWeight = 0

  // HY Spread
  if (data.hySpread !== null) {
    const stat = INDICATOR_STATS['HY Spread']
    const value = stat.invert ? -data.hySpread : data.hySpread
    const zscore = (value - (stat.invert ? -stat.mean : stat.mean)) / stat.std
    weightedZScore += zscore * stat.weight
    totalWeight += stat.weight
  }

  // VIX
  if (data.vix !== null) {
    const stat = INDICATOR_STATS['VIX']
    const value = stat.invert ? -data.vix : data.vix
    const zscore = (value - (stat.invert ? -stat.mean : stat.mean)) / stat.std
    weightedZScore += zscore * stat.weight
    totalWeight += stat.weight
  }

  // Initial Claims
  if (data.initialClaims !== null) {
    const stat = INDICATOR_STATS['Initial Claims']
    const value = stat.invert ? -data.initialClaims : data.initialClaims
    const zscore = (value - (stat.invert ? -stat.mean : stat.mean)) / stat.std
    weightedZScore += zscore * stat.weight
    totalWeight += stat.weight
  }

  // S&P vs 200MA
  if (data.spyVs200MA !== null) {
    const stat = INDICATOR_STATS['S&P vs 200MA']
    const value = stat.invert ? -data.spyVs200MA : data.spyVs200MA
    const zscore = (value - (stat.invert ? -stat.mean : stat.mean)) / stat.std
    weightedZScore += zscore * stat.weight
    totalWeight += stat.weight
  }

  // Yield Curve 10Y-2Y
  if (data.yieldCurve10Y2Y !== null) {
    const stat = INDICATOR_STATS['Yield Curve 10Y-2Y']
    const value = stat.invert ? -data.yieldCurve10Y2Y : data.yieldCurve10Y2Y
    const zscore = (value - (stat.invert ? -stat.mean : stat.mean)) / stat.std
    weightedZScore += zscore * stat.weight
    totalWeight += stat.weight
  }

  if (totalWeight === 0) return 50

  // 가중 평균 Z-score를 0-100 스케일로 변환
  const avgZScore = weightedZScore / totalWeight
  const score = avgZScore * 10 + 50
  return Math.round(Math.max(0, Math.min(100, score)) * 100) / 100
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

    // Calculate composite score (Z-score 기반 5개 핵심 지표)
    const compositeScore = calculateCompositeScore({
      vix,
      spyVs200MA,
      hySpread,
      yieldCurve10Y2Y,
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

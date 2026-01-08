import type { Handler } from '@netlify/functions'

interface YahooChartResult {
  chart: {
    result: Array<{
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

// 쿠키를 얻기 위한 함수
async function getYahooCrumb(): Promise<{ cookie: string; crumb: string } | null> {
  try {
    // 먼저 쿠키를 얻기 위해 Yahoo Finance 페이지 방문
    const initResponse = await fetch('https://fc.yahoo.com', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    })

    const cookies = initResponse.headers.get('set-cookie')
    if (!cookies) return null

    // 쿠키에서 필요한 부분 추출
    const cookie = cookies.split(';')[0]

    // crumb 얻기
    const crumbResponse = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Cookie': cookie,
      },
    })

    if (!crumbResponse.ok) return null

    const crumb = await crumbResponse.text()
    return { cookie, crumb }
  } catch {
    return null
  }
}

const handler: Handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' }
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    }
  }

  const symbol = event.queryStringParameters?.symbol
  const years = parseInt(event.queryStringParameters?.years || '5', 10)

  if (!symbol) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Symbol is required' }),
    }
  }

  // 허용된 심볼만 처리
  const allowedSymbols = ['SPY', 'QQQ', '069500.KS', '238720.KS']
  if (!allowedSymbols.includes(symbol)) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Invalid symbol' }),
    }
  }

  try {
    const now = Math.floor(Date.now() / 1000)
    const startDate = now - years * 365 * 24 * 60 * 60

    // 쿠키와 crumb 얻기 시도
    const auth = await getYahooCrumb()

    // Yahoo Finance API - 월간 데이터
    let url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${startDate}&period2=${now}&interval=1mo&includePrePost=false`

    if (auth?.crumb) {
      url += `&crumb=${encodeURIComponent(auth.crumb)}`
    }

    const fetchHeaders: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json',
      'Accept-Language': 'en-US,en;q=0.9',
    }

    if (auth?.cookie) {
      fetchHeaders['Cookie'] = auth.cookie
    }

    const response = await fetch(url, { headers: fetchHeaders })

    const responseText = await response.text()

    // HTML 응답 체크
    if (responseText.startsWith('<!') || responseText.startsWith('<html')) {
      console.error('Received HTML instead of JSON')
      return {
        statusCode: 503,
        headers,
        body: JSON.stringify({ error: 'Yahoo Finance API temporarily unavailable' }),
      }
    }

    if (!response.ok) {
      console.error('Yahoo Finance API error:', response.status, responseText.substring(0, 500))
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ error: `Yahoo Finance API error: ${response.status}` }),
      }
    }

    const data: YahooChartResult = JSON.parse(responseText)

    if (data.chart.error) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: data.chart.error.description }),
      }
    }

    const result = data.chart.result?.[0]
    if (!result) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'No data found' }),
      }
    }

    const timestamps = result.timestamp
    const prices = result.indicators.adjclose[0].adjclose

    // 월별 데이터로 변환
    const monthlyData = timestamps.map((ts, i) => ({
      date: new Date(ts * 1000).toISOString().slice(0, 7), // YYYY-MM
      price: prices[i],
    })).filter(d => d.price != null)

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        symbol,
        data: monthlyData,
        currentPrice: monthlyData[monthlyData.length - 1]?.price,
      }),
    }
  } catch (error) {
    console.error('Error:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' }),
    }
  }
}

export { handler }

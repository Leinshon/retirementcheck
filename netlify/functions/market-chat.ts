import type { Handler } from '@netlify/functions'

const handler: Handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' }
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    }
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'API key not configured' }),
    }
  }

  try {
    const { question, marketContext } = JSON.parse(event.body || '{}')

    if (!question) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Question is required' }),
      }
    }

    const systemPrompt = `당신은 미국 주식시장 분석 전문가입니다.
제공된 시장 지표 데이터를 기반으로 투자자에게 인사이트를 제공합니다.

주요 지표 해석 가이드:
- VIX: 변동성 지수. 높을수록 공포, 역발상 매수 기회
- Fear & Greed: 0-100. 낮을수록 공포, 매수 기회
- HY Spread: 하이일드 스프레드. 높을수록 신용 스트레스, 역발상 매수 기회
- Initial Claims: 신규실업수당청구. 높을수록 고용 악화, 연준 완화 기대
- S&P vs 200MA: 200일선 대비. 음수면 기술적 저점
- Yield Curve: 장단기금리차. 역전(-)이면 침체 우려
- Buffett Indicator: 시총/GDP. 낮을수록 저평가
- ERP: 주식위험프리미엄. 높을수록 주식 매력적
- Fed Balance Sheet YoY: 연준 대차대조표 증감. 긴축 중이면 향후 완화 여력
- M2 Growth YoY: 통화량 증감. 감소 중이면 향후 확대 여력

역발상 투자 관점에서 공포/저평가 구간이 매수 기회임을 설명하세요.
답변은 500자 이내로 해주세요.
의례적인 인사, 감사 표현, 마무리 멘트 없이 바로 핵심 답변만 제공하세요.`

    const userMessage = `[현재 시장 지표 - ${marketContext.date}]
${marketContext.indicators}

[질문]
${question}`

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: `${systemPrompt}\n\n${userMessage}` }],
            },
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 600,
          },
        }),
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Gemini API error:', errorText)
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ error: 'Gemini API error' }),
      }
    }

    const data = await response.json()
    const answer = data.candidates?.[0]?.content?.parts?.[0]?.text || '답변을 생성할 수 없습니다.'

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ answer }),
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

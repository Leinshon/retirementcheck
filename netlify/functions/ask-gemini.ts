import type { Handler } from '@netlify/functions'

const handler: Handler = async (event) => {
  // CORS 헤더
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  }

  // OPTIONS 요청 처리
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
    const { question, context } = JSON.parse(event.body || '{}')

    if (!question) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Question is required' }),
      }
    }

    const systemPrompt = `당신은 은퇴 설계 및 재무 상담 전문가입니다.
사용자의 재무 데이터를 기반으로 친절하고 이해하기 쉽게 답변해주세요.
한국의 세금 제도, 연금 제도, 투자 상품에 대해 잘 알고 있습니다.
답변은 간결하고 실용적으로 해주세요.`

    const userMessage = context
      ? `[사용자 재무 상황]\n${context}\n\n[질문]\n${question}`
      : question

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
            maxOutputTokens: 1024,
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

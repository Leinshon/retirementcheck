import './LifecycleDemo.css'

const LifecycleDemo = () => {
  // 샘플 데이터
  const events = [
    { age: 48, event: '자녀 대학 등록금', cost: 4000, type: 'education' },
    { age: 52, event: '주택 리모델링', cost: 3000, type: 'housing' },
    { age: 55, event: '은퇴', cost: 0, type: 'retirement' },
    { age: 58, event: '자녀 결혼 자금', cost: 5000, type: 'wedding' },
    { age: 70, event: '의료비 증가', cost: 2000, type: 'health' },
    { age: 80, event: '요양/간병 비용', cost: 5000, type: 'health' },
  ]

  const currentAge = 45
  const maxCost = Math.max(...events.map(e => e.cost))

  return (
    <div className="lifecycle-demo">
      <h1>생애주기 이벤트 시각화 제안</h1>

      {/* 제안 1: 세로 리스트 + 금액 바 차트 */}
      <section className="demo-section">
        <h2>제안 1: 세로 리스트 + 금액 바</h2>
        <p className="demo-desc">각 이벤트를 세로로 나열하고, 금액 크기에 비례하는 바로 비용 비교</p>
        <div className="proposal-1">
          {events.filter(e => e.cost > 0).map((event, idx) => (
            <div key={idx} className="event-row">
              <div className="event-info">
                <span className="event-age">{event.age}세</span>
                <span className="event-name">{event.event}</span>
              </div>
              <div className="event-bar-container">
                <div
                  className="event-bar"
                  style={{ width: `${(event.cost / maxCost) * 100}%` }}
                >
                  <span className="bar-label">{(event.cost / 10000).toFixed(1)}억</span>
                </div>
              </div>
            </div>
          ))}
          <div className="total-row">
            <span>총 예상 비용</span>
            <span className="total-amount">{(events.reduce((sum, e) => sum + e.cost, 0) / 10000).toFixed(1)}억원</span>
          </div>
        </div>
      </section>

      {/* 제안 2: 연도별 블록 */}
      <section className="demo-section">
        <h2>제안 2: 연도별 블록</h2>
        <p className="demo-desc">현재부터 기대수명까지 5년 단위 블록, 이벤트 있는 구간 강조</p>
        <div className="proposal-2">
          <div className="year-blocks">
            {[45, 50, 55, 60, 65, 70, 75, 80, 85, 90].map((age, idx) => {
              const eventsInRange = events.filter(e => e.age >= age && e.age < age + 5)
              const hasEvent = eventsInRange.length > 0
              const isRetirement = eventsInRange.some(e => e.type === 'retirement')
              return (
                <div key={idx} className={`year-block ${hasEvent ? 'has-event' : ''} ${isRetirement ? 'retirement' : ''}`}>
                  <div className="block-age">{age}대</div>
                  {eventsInRange.map((e, i) => (
                    <div key={i} className="block-event">
                      {e.event}
                      {e.cost > 0 && <span className="block-cost">{(e.cost/10000).toFixed(1)}억</span>}
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
          <div className="year-legend">
            <span className="current-marker">현재 {currentAge}세</span>
          </div>
        </div>
      </section>

      {/* 제안 3: 누적 비용 그래프 */}
      <section className="demo-section">
        <h2>제안 3: 누적 비용 그래프</h2>
        <p className="demo-desc">나이에 따른 누적 비용을 계단식으로 표시</p>
        <div className="proposal-3">
          <div className="cumulative-chart">
            <div className="chart-y-axis">
              <span>2억</span>
              <span>1억</span>
              <span>0</span>
            </div>
            <div className="chart-content">
              <svg viewBox="0 0 400 120" preserveAspectRatio="none">
                {/* 계단식 누적 그래프 */}
                <path
                  d="M 0,120
                     L 30,120 L 30,96
                     L 70,96 L 70,72
                     L 130,72 L 130,72
                     L 170,72 L 170,48
                     L 280,48 L 280,32
                     L 380,32 L 380,0
                     L 400,0"
                  fill="none"
                  stroke="#2c5282"
                  strokeWidth="2"
                />
                {/* 은퇴 시점 표시 */}
                <line x1="100" y1="0" x2="100" y2="120" stroke="#e53e3e" strokeWidth="1" strokeDasharray="4,2" />
                <text x="102" y="12" fill="#e53e3e" fontSize="10">은퇴</text>
              </svg>
              <div className="chart-events">
                {events.filter(e => e.cost > 0).map((e, idx) => (
                  <div
                    key={idx}
                    className="chart-event-dot"
                    style={{ left: `${((e.age - 45) / 45) * 100}%` }}
                    title={`${e.age}세: ${e.event}`}
                  />
                ))}
              </div>
            </div>
            <div className="chart-x-axis">
              <span>45세</span>
              <span>55세</span>
              <span>65세</span>
              <span>75세</span>
              <span>90세</span>
            </div>
          </div>
        </div>
      </section>

      {/* 제안 4: 카드 그리드 */}
      <section className="demo-section">
        <h2>제안 4: 카드 그리드</h2>
        <p className="demo-desc">이벤트별 카드, 남은 기간과 금액을 명확히 표시</p>
        <div className="proposal-4">
          {events.map((event, idx) => (
            <div key={idx} className={`event-card ${event.type} ${event.cost === 0 ? 'no-cost' : ''}`}>
              <div className="card-header">
                <span className="card-age">{event.age}세</span>
                <span className="card-years">{event.age - currentAge}년 후</span>
              </div>
              <div className="card-body">
                <div className="card-event">{event.event}</div>
                {event.cost > 0 ? (
                  <div className="card-cost">{(event.cost / 10000).toFixed(1)}억원</div>
                ) : (
                  <div className="card-milestone">중요 시점</div>
                )}
              </div>
              <div className="card-progress">
                <div
                  className="progress-bar"
                  style={{ width: `${Math.min(100, ((event.age - currentAge) / 45) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 제안 5: 타임라인 + 자산 잔액 오버레이 */}
      <section className="demo-section">
        <h2>제안 5: 타임라인 + 자산 잔액</h2>
        <p className="demo-desc">이벤트 발생 시 자산이 급격히 감소하는 모습을 시각화</p>
        <div className="proposal-5">
          <div className="asset-timeline">
            <div className="timeline-y-axis">
              <span>5억</span>
              <span>2.5억</span>
              <span>0</span>
            </div>
            <div className="timeline-chart">
              <svg viewBox="0 0 400 100" preserveAspectRatio="none">
                {/* 자산 감소 곡선 */}
                <path
                  d="M 0,20
                     L 25,20 L 25,40
                     L 60,42 L 60,58
                     L 85,60
                     L 110,62 L 110,75
                     L 210,78 L 210,85
                     L 300,88 L 300,95
                     L 400,100"
                  fill="rgba(49, 130, 206, 0.1)"
                  stroke="#3182ce"
                  strokeWidth="2"
                />
                {/* 이벤트 마커 */}
                <circle cx="25" cy="40" r="4" fill="#1a365d" />
                <circle cx="60" cy="58" r="4" fill="#1a365d" />
                <circle cx="85" cy="60" r="3" fill="#e53e3e" />
                <circle cx="110" cy="75" r="4" fill="#1a365d" />
                <circle cx="210" cy="85" r="4" fill="#1a365d" />
                <circle cx="300" cy="95" r="4" fill="#1a365d" />
              </svg>
              <div className="timeline-events">
                <div className="t-event" style={{ left: '6%' }}>
                  <span className="t-label">대학</span>
                </div>
                <div className="t-event" style={{ left: '15%' }}>
                  <span className="t-label">리모델링</span>
                </div>
                <div className="t-event retirement" style={{ left: '21%' }}>
                  <span className="t-label">은퇴</span>
                </div>
                <div className="t-event" style={{ left: '28%' }}>
                  <span className="t-label">결혼</span>
                </div>
                <div className="t-event" style={{ left: '53%' }}>
                  <span className="t-label">의료비</span>
                </div>
                <div className="t-event" style={{ left: '75%' }}>
                  <span className="t-label">요양</span>
                </div>
              </div>
            </div>
          </div>
          <div className="timeline-x-labels">
            <span>45세</span>
            <span>55세</span>
            <span>65세</span>
            <span>75세</span>
            <span>90세</span>
          </div>
        </div>
      </section>

      {/* 제안 6: 도넛 차트 + 리스트 */}
      <section className="demo-section">
        <h2>제안 6: 도넛 차트 + 리스트</h2>
        <p className="demo-desc">전체 비용 중 각 이벤트의 비중을 한눈에</p>
        <div className="proposal-6">
          <div className="donut-container">
            <svg viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" fill="none" stroke="#e2e8f0" strokeWidth="12" />
              {/* 각 이벤트별 세그먼트 */}
              <circle cx="50" cy="50" r="40" fill="none" stroke="#1a365d" strokeWidth="12"
                strokeDasharray="52.8 200" strokeDashoffset="0" transform="rotate(-90 50 50)" />
              <circle cx="50" cy="50" r="40" fill="none" stroke="#2c5282" strokeWidth="12"
                strokeDasharray="26.4 200" strokeDashoffset="-52.8" transform="rotate(-90 50 50)" />
              <circle cx="50" cy="50" r="40" fill="none" stroke="#3182ce" strokeWidth="12"
                strokeDasharray="31.6 200" strokeDashoffset="-79.2" transform="rotate(-90 50 50)" />
              <circle cx="50" cy="50" r="40" fill="none" stroke="#63b3ed" strokeWidth="12"
                strokeDasharray="21 200" strokeDashoffset="-110.8" transform="rotate(-90 50 50)" />
              <circle cx="50" cy="50" r="40" fill="none" stroke="#bee3f8" strokeWidth="12"
                strokeDasharray="15.8 200" strokeDashoffset="-131.8" transform="rotate(-90 50 50)" />
              <text x="50" y="46" textAnchor="middle" fontSize="10" fill="#1a202c">총</text>
              <text x="50" y="58" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#1a365d">1.9억</text>
            </svg>
          </div>
          <div className="donut-legend">
            {events.filter(e => e.cost > 0).map((event, idx) => {
              const colors = ['#1a365d', '#2c5282', '#3182ce', '#63b3ed', '#bee3f8']
              const total = events.reduce((sum, e) => sum + e.cost, 0)
              const percent = Math.round((event.cost / total) * 100)
              return (
                <div key={idx} className="legend-item">
                  <span className="legend-color" style={{ background: colors[idx] }}></span>
                  <span className="legend-name">{event.event}</span>
                  <span className="legend-percent">{percent}%</span>
                  <span className="legend-amount">{(event.cost / 10000).toFixed(1)}억</span>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* 제안 7: 은퇴 전/후 분리형 */}
      <section className="demo-section">
        <h2>제안 7: 은퇴 전/후 분리</h2>
        <p className="demo-desc">은퇴 시점을 기준으로 필요 자금을 명확히 구분</p>
        <div className="proposal-7">
          {(() => {
            const retirementAge = 55
            const beforeEvents = events.filter(e => e.age < retirementAge && e.cost > 0)
            const afterEvents = events.filter(e => e.age >= retirementAge && e.cost > 0)
            const beforeTotal = beforeEvents.reduce((sum, e) => sum + e.cost, 0)
            const afterTotal = afterEvents.reduce((sum, e) => sum + e.cost, 0)
            return (
              <>
                <div className="split-section before">
                  <div className="split-header">
                    <span className="split-title">은퇴 전</span>
                    <span className="split-years">앞으로 10년</span>
                  </div>
                  <div className="split-total">{(beforeTotal / 10000).toFixed(1)}억원</div>
                  <div className="split-events">
                    {beforeEvents.map((e, i) => (
                      <div key={i} className="split-event">
                        <span>{e.event}</span>
                        <span>{(e.cost / 10000).toFixed(1)}억</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="split-divider">
                  <div className="divider-line"></div>
                  <div className="divider-label">55세 은퇴</div>
                  <div className="divider-line"></div>
                </div>
                <div className="split-section after">
                  <div className="split-header">
                    <span className="split-title">은퇴 후</span>
                    <span className="split-years">35년간</span>
                  </div>
                  <div className="split-total">{(afterTotal / 10000).toFixed(1)}억원</div>
                  <div className="split-events">
                    {afterEvents.map((e, i) => (
                      <div key={i} className="split-event">
                        <span>{e.event}</span>
                        <span>{(e.cost / 10000).toFixed(1)}억</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )
          })()}
        </div>
      </section>

      {/* 제안 8: 남은 기간 강조형 */}
      <section className="demo-section">
        <h2>제안 8: 남은 기간 강조</h2>
        <p className="demo-desc">가장 가까운 이벤트를 크게, 시간적 긴박감 전달</p>
        <div className="proposal-8">
          {(() => {
            const sortedEvents = [...events].filter(e => e.cost > 0).sort((a, b) => a.age - b.age)
            const nextEvent = sortedEvents[0]
            const laterEvents = sortedEvents.slice(1)
            return (
              <>
                <div className="next-event-highlight">
                  <div className="next-badge">가장 가까운 이벤트</div>
                  <div className="next-countdown">
                    <span className="countdown-number">{nextEvent.age - currentAge}</span>
                    <span className="countdown-unit">년 후</span>
                  </div>
                  <div className="next-details">
                    <div className="next-name">{nextEvent.event}</div>
                    <div className="next-cost">{(nextEvent.cost / 10000).toFixed(1)}억원 필요</div>
                    <div className="next-monthly">
                      월 {Math.round(nextEvent.cost / ((nextEvent.age - currentAge) * 12))}만원씩 준비 필요
                    </div>
                  </div>
                </div>
                <div className="later-events">
                  <div className="later-title">이후 예정</div>
                  {laterEvents.map((e, i) => (
                    <div key={i} className="later-item">
                      <span className="later-years">{e.age - currentAge}년 후</span>
                      <span className="later-name">{e.event}</span>
                      <span className="later-cost">{(e.cost / 10000).toFixed(1)}억</span>
                    </div>
                  ))}
                </div>
              </>
            )
          })()}
        </div>
      </section>
    </div>
  )
}

export default LifecycleDemo

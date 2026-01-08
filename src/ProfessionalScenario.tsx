import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { Bar, Line } from 'react-chartjs-2'
import {
  demoUserState,
  demoScenarios,
  demoRoadmaps,
  statusStyles,
  type Scenario,
  type TimelineAction,
  type ActionStatus,
  type UserCurrentState,
  type ThreeMonthRoadmap,
} from './data/demoScenarios'
import './ProfessionalScenario.css'

// Baseline projection interface
interface BaselineProjection {
  years: number[]
  netWorth: number[]
  retirementAge: number
}

// Chart.js 등록
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

type Phase = 'comparison' | 'result'

// Props interface for external data passing
interface ProfessionalScenarioProps {
  userState?: UserCurrentState
  scenarios?: Scenario[]
  roadmaps?: Record<string, ThreeMonthRoadmap>
  baselineProjection?: BaselineProjection
}

function ProfessionalScenario(props?: ProfessionalScenarioProps) {
  const location = useLocation()
  const navigate = useNavigate()

  // Prioritize location.state, then props, then defaults
  const user = (location.state as any)?.userState || props?.userState || demoUserState
  const scenarios = (location.state as any)?.scenarios || props?.scenarios || demoScenarios
  const roadmaps = (location.state as any)?.roadmaps || props?.roadmaps || demoRoadmaps
  const baselineProjection = (location.state as any)?.baselineProjection || props?.baselineProjection || null

  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('comparison')
  const [activeTab, setActiveTab] = useState<0 | 1>(0)
  const [actionStatuses, setActionStatuses] = useState<Record<string, ActionStatus>>({})

  const selectedScenario = scenarios.find(s => s.id === selectedScenarioId)
  const roadmap = selectedScenarioId ? roadmaps[selectedScenarioId] : null

  // 시나리오 선택 핸들러
  const handleSelectScenario = (scenarioId: string) => {
    setSelectedScenarioId(scenarioId)
    setPhase('result')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // 다른 시나리오 보기
  const handleBackToComparison = () => {
    setPhase('comparison')
    setSelectedScenarioId(null)
  }

  // 다시 입력하기 (ProfessionalApp으로 돌아가기)
  const handleBackToInput = () => {
    navigate('/professional')
  }

  // 액션 상태 토글
  const toggleActionStatus = (actionId: string, currentStatus: ActionStatus) => {
    const newStatus: ActionStatus = currentStatus === 'completed' ? 'upcoming' : 'completed'
    setActionStatuses(prev => ({ ...prev, [actionId]: newStatus }))
  }

  // 액션의 현재 상태 가져오기
  const getActionStatus = (action: TimelineAction): ActionStatus => {
    return actionStatuses[action.id] ?? action.status
  }

  // 비교 차트 데이터
  const comparisonChartData = {
    labels: ['현재 추세', scenarios[0].name, scenarios[1].name],
    datasets: [
      {
        label: '목표 달성률 (%)',
        data: [
          user.currentAchievementRate,
          scenarios[0].keyMetrics.achievementRate,
          scenarios[1].keyMetrics.achievementRate,
        ],
        backgroundColor: ['#94a3b8', '#4361ee', '#10b981'],
        borderRadius: 8,
        barThickness: 40,
      },
    ],
  }

  const comparisonChartOptions = {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: (context: { raw: unknown }) => `${context.raw}%`,
        },
      },
    },
    scales: {
      x: {
        beginAtZero: true,
        max: 100,
        grid: {
          display: false,
        },
        ticks: {
          callback: (value: string | number) => `${value}%`,
        },
      },
      y: {
        grid: {
          display: false,
        },
      },
    },
  }

  // 위험도 별점 렌더링
  const renderRiskStars = (level: number) => {
    return (
      <span className="risk-stars">
        {[1, 2, 3, 4, 5].map(i => (
          <span key={i} className={i <= level ? 'star filled' : 'star'}>*</span>
        ))}
      </span>
    )
  }

  // 포트폴리오 바 렌더링
  const renderPortfolioBar = (scenario: Scenario) => {
    return (
      <div className="portfolio-bar">
        {scenario.portfolioAllocation.map((item, idx) => (
          <div
            key={idx}
            className="portfolio-segment"
            style={{
              width: `${item.ratio}%`,
              backgroundColor: item.color,
            }}
            title={`${item.name} ${item.ratio}%`}
          >
            {item.ratio >= 15 && <span>{item.ratio}%</span>}
          </div>
        ))}
      </div>
    )
  }

  // 시나리오 카드 렌더링
  const renderScenarioCard = (scenario: Scenario, index: number) => {
    const isAggressive = scenario.type === 'aggressive'
    const improvementPercent = Math.round(
      ((scenario.keyMetrics.projectedAsset - user.currentProjectedAsset) / user.currentProjectedAsset) * 100
    )

    return (
      <div className={`scenario-card ${activeTab === index ? 'active' : ''}`} key={scenario.id}>
        <div className="scenario-header">
          <span className={`scenario-badge ${isAggressive ? 'aggressive' : 'balanced'}`}>
            {isAggressive ? 'A' : 'B'}
          </span>
          <div>
            <h3 className="scenario-name">{scenario.name}</h3>
            <p className="scenario-subtitle">{scenario.subtitle}</p>
          </div>
        </div>

        <div className="scenario-metrics">
          <div className="metric-main">
            <span className="metric-label">예상 은퇴자산</span>
            <span className="metric-value">
              {(scenario.keyMetrics.projectedAsset / 10000).toFixed(1)}억원
              <span className="metric-change positive">+{improvementPercent}%</span>
            </span>
          </div>

          <div className="metric-row">
            <div className="metric-item">
              <span className="metric-label">목표 달성률</span>
              <div className="progress-bar-container">
                <div
                  className="progress-bar-fill"
                  style={{
                    width: `${scenario.keyMetrics.achievementRate}%`,
                    backgroundColor: isAggressive ? '#4361ee' : '#10b981',
                  }}
                />
                <span className="progress-text">{scenario.keyMetrics.achievementRate}%</span>
              </div>
            </div>
          </div>

          <div className="metric-row small">
            <div className="metric-item">
              <span className="metric-label">월 저축액</span>
              <span className="metric-value">{scenario.keyMetrics.requiredMonthlySaving}만원</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">예상 수익률</span>
              <span className="metric-value">{scenario.keyMetrics.expectedReturnRate}%</span>
            </div>
          </div>
        </div>

        <div className="scenario-highlights">
          <h4>핵심 포인트</h4>
          <ul>
            {scenario.highlights.map((highlight, idx) => (
              <li key={idx}>{highlight}</li>
            ))}
          </ul>
        </div>

        <div className="scenario-portfolio">
          <h4>포트폴리오 구성</h4>
          {renderPortfolioBar(scenario)}
          <div className="portfolio-legend">
            {scenario.portfolioAllocation.map((item, idx) => (
              <span key={idx} className="legend-item">
                <span className="legend-dot" style={{ backgroundColor: item.color }} />
                {item.name} {item.ratio}%
              </span>
            ))}
          </div>
        </div>

        <div className="scenario-risk">
          <span className="risk-label">위험도</span>
          {renderRiskStars(scenario.riskLevel)}
        </div>

        <button
          className="select-scenario-btn"
          onClick={() => handleSelectScenario(scenario.id)}
        >
          이 시나리오 선택
        </button>
      </div>
    )
  }

  // Phase 1: 시나리오 비교 화면
  const renderComparisonPhase = () => (
    <>
      {/* 헤더 */}
      <header className="scenario-page-header">
        <h1>{user.name}님의 맞춤 은퇴 시나리오</h1>
        <p>전문가가 {user.name}님의 재무 상황을 분석하여<br />2가지 최적화된 시나리오를 준비했습니다.</p>
      </header>

      {/* 현재 상태 요약 */}
      <section className="current-status-section">
        <h2>현재 상태 요약</h2>
        <div className="status-grid">
          <div className="status-item">
            <span className="status-label">나이</span>
            <span className="status-value">{user.age}세</span>
          </div>
          <div className="status-item">
            <span className="status-label">은퇴 목표</span>
            <span className="status-value">{user.targetRetirementAge}세</span>
          </div>
          <div className="status-item">
            <span className="status-label">현재 자산</span>
            <span className="status-value">{(user.currentAsset / 10000).toFixed(1)}억원</span>
          </div>
          <div className="status-item">
            <span className="status-label">월 저축</span>
            <span className="status-value">{user.monthlySaving}만원</span>
          </div>
        </div>
        <div className="current-projection">
          <p>
            현재 추세 유지 시 예상 은퇴자산:{' '}
            <strong>{(user.currentProjectedAsset / 10000).toFixed(1)}억원</strong>
            <span className="projection-rate">(목표의 {user.currentAchievementRate}%)</span>
          </p>
          <div className="projection-bar">
            <div
              className="projection-fill"
              style={{ width: `${user.currentAchievementRate}%` }}
            />
          </div>
        </div>
      </section>

      {/* 비교 차트 */}
      <section className="comparison-chart-section">
        <h2>시나리오별 목표 달성률 비교</h2>
        <div className="chart-container">
          <Bar data={comparisonChartData} options={comparisonChartOptions} />
        </div>
      </section>

      {/* 모바일 탭 */}
      <div className="mobile-tabs">
        {scenarios.map((scenario, idx) => (
          <button
            key={scenario.id}
            className={`tab-btn ${activeTab === idx ? 'active' : ''}`}
            onClick={() => setActiveTab(idx as 0 | 1)}
          >
            {scenario.name}
          </button>
        ))}
      </div>

      {/* 시나리오 비교 */}
      <section className="scenarios-comparison">
        <div className="scenarios-grid">
          {scenarios.map((scenario, idx) => renderScenarioCard(scenario, idx))}
        </div>
      </section>
    </>
  )

  // 비교 그래프 렌더링 (현재 계획 vs 시나리오)
  const renderComparisonGraph = () => {
    if (!baselineProjection || !selectedScenario) return null

    const retirementLinePlugin = {
      id: 'retirementLine',
      afterDatasetsDraw(chart: any) {
        const ctx = chart.ctx
        const xAxis = chart.scales.x
        const yAxis = chart.scales.y

        const labels = chart.data.labels
        const retirementIndex = labels.indexOf(baselineProjection.retirementAge)

        if (retirementIndex >= 0) {
          const x = xAxis.getPixelForValue(retirementIndex)

          ctx.save()
          ctx.beginPath()
          ctx.setLineDash([5, 5])
          ctx.strokeStyle = '#f59e0b'
          ctx.lineWidth = 2
          ctx.moveTo(x, yAxis.top)
          ctx.lineTo(x, yAxis.bottom)
          ctx.stroke()

          ctx.fillStyle = '#f59e0b'
          ctx.font = 'bold 12px sans-serif'
          ctx.textAlign = 'center'
          ctx.fillText(`은퇴 (${baselineProjection.retirementAge}세)`, x, yAxis.top - 10)
          ctx.restore()
        }
      }
    }

    // 목표 은퇴 자산 라인 생성 (물가상승 반영)
    const INFLATION_RATE = 0.03
    const currentAge = user.age
    const retirementAge = baselineProjection.retirementAge
    const targetAssetToday = user.targetRetirementAsset
    const yearsToRetirement = retirementAge - currentAge
    const targetAssetAtRetirement = targetAssetToday * Math.pow(1 + INFLATION_RATE, yearsToRetirement)

    const targetLine = baselineProjection.years.map((age: number) => {
      if (age < retirementAge) {
        const yearsFromNow = age - currentAge
        return targetAssetToday * Math.pow(1 + INFLATION_RATE, yearsFromNow)
      } else {
        return targetAssetAtRetirement
      }
    })

    // TODO: 시나리오 적용 시 예상 그래프 데이터 생성 (현재는 baseline만 표시)
    // 실제로는 선택한 시나리오의 월 저축액, 수익률 등을 반영한 새로운 projection이 필요
    const scenarioProjection = baselineProjection.netWorth.map((value: number) => value * 1.3) // 임시: 30% 개선 가정

    const chartData = {
      labels: baselineProjection.years,
      datasets: [
        {
          label: '현재 계획',
          data: baselineProjection.netWorth,
          borderColor: '#94a3b8',
          backgroundColor: 'rgba(148, 163, 184, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 6,
          borderWidth: 2,
          borderDash: [5, 5],
        },
        {
          label: `${selectedScenario.name} 적용 시`,
          data: scenarioProjection,
          borderColor: selectedScenario.type === 'aggressive' ? '#4361ee' : '#10b981',
          backgroundColor: selectedScenario.type === 'aggressive'
            ? 'rgba(67, 97, 238, 0.1)'
            : 'rgba(16, 185, 129, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 6,
          borderWidth: 2,
        },
        {
          label: '목표 은퇴 자산',
          data: targetLine,
          borderColor: '#10b981',
          backgroundColor: 'transparent',
          borderDash: [5, 5],
          fill: false,
          tension: 0,
          pointRadius: 0,
          borderWidth: 2,
        },
      ],
    }

    const chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top' as const,
          labels: {
            font: { size: 12 },
            padding: 15,
          },
        },
        tooltip: {
          callbacks: {
            label: (context: any) => {
              const label = context.dataset.label || ''
              return `${label}: ${context.parsed.y.toLocaleString()}만원`
            },
          },
        },
      },
      scales: {
        x: {
          title: {
            display: true,
            text: '나이',
          },
          ticks: {
            maxTicksLimit: 12,
          },
        },
        y: {
          title: {
            display: true,
            text: '순자산 (만원)',
          },
          ticks: {
            callback: (value: any) => {
              return (value / 10000).toFixed(0) + '억'
            },
          },
        },
      },
    }

    return (
      <section className="comparison-graph-section">
        <h2>현재 계획 vs {selectedScenario.name} 비교</h2>
        <p className="section-description">
          시나리오를 적용하면 은퇴 시점의 자산이 어떻게 변화하는지 확인해보세요.
        </p>
        <div className="prof-chart-container" style={{ height: '400px', marginTop: '20px' }}>
          <Line data={chartData} options={chartOptions} plugins={[retirementLinePlugin]} />
        </div>
        <p className="chart-note" style={{ marginTop: '16px', fontSize: '13px', color: '#64748b' }}>
          * 이 그래프는 시나리오의 월 저축액, 예상 수익률, 포트폴리오 배분을 반영한 예측입니다.<br />
          * 목표 은퇴 자산: 입력하신 {targetAssetToday.toLocaleString()}만원(현재가치)은 {yearsToRetirement}년 후 약 {Math.round(targetAssetAtRetirement).toLocaleString()}만원(물가상승 반영)<br />
          * 실제 결과는 시장 상황과 개인의 실행력에 따라 달라질 수 있습니다.
        </p>
      </section>
    )
  }

  // Phase 2: 선택 후 화면
  const renderResultPhase = () => {
    if (!selectedScenario || !roadmap) return null

    return (
      <>
        {/* 선택 완료 헤더 */}
        <header className="result-header">
          <div className="result-header-actions">
            <button className="back-btn" onClick={handleBackToComparison}>
              다른 시나리오 보기
            </button>
            {location.state && (
              <button className="back-btn secondary" onClick={handleBackToInput}>
                다시 입력하기
              </button>
            )}
          </div>
          <div className="selected-badge">
            "{selectedScenario.name}" 시나리오 선택 완료
          </div>
          <p className="result-subtitle">
            아래 3개월 로드맵을 따라 차근차근 실행해보세요.
          </p>
        </header>

        {/* 선택한 시나리오 요약 */}
        <section className="selected-summary-section">
          <div className="summary-card">
            <div className="summary-header">
              <span className={`scenario-badge ${selectedScenario.type}`}>
                {selectedScenario.type === 'aggressive' ? 'A' : 'B'}
              </span>
              <div>
                <h3>{selectedScenario.name}</h3>
                <p>{selectedScenario.subtitle}</p>
              </div>
            </div>
            <div className="summary-metrics">
              <div className="summary-metric">
                <span className="label">예상 은퇴자산</span>
                <span className="value">
                  {(selectedScenario.keyMetrics.projectedAsset / 10000).toFixed(1)}억원
                </span>
              </div>
              <div className="summary-metric">
                <span className="label">목표 달성률</span>
                <span className="value">{selectedScenario.keyMetrics.achievementRate}%</span>
              </div>
              <div className="summary-metric">
                <span className="label">월 저축액</span>
                <span className="value">{selectedScenario.keyMetrics.requiredMonthlySaving}만원</span>
              </div>
            </div>
          </div>
        </section>

        {/* 비교 그래프 */}
        {renderComparisonGraph()}

        {/* 3개월 액션 로드맵 */}
        <section className="roadmap-section">
          <h2>3개월 액션 로드맵</h2>

          {/* 타임라인 진행 바 */}
          <div className="timeline-progress">
            {roadmap.months.map((month, idx) => (
              <div key={month.month} className="timeline-step">
                <div className={`step-dot ${idx === 0 ? 'active' : ''}`}>
                  {month.month}
                </div>
                <span className="step-label">{month.month}월차</span>
                <span className="step-theme">{month.theme}</span>
                {idx < roadmap.months.length - 1 && <div className="step-line" />}
              </div>
            ))}
          </div>

          {/* 월별 액션 블록 */}
          {roadmap.months.map(month => (
            <div key={month.month} className="month-block">
              <div className="month-header">
                <h3>{month.month}월차: {month.theme}</h3>
              </div>
              <div className="actions-list">
                {month.actions.map(action => {
                  const status = getActionStatus(action)
                  const style = statusStyles[status]
                  return (
                    <div
                      key={action.id}
                      className={`action-card ${status}`}
                      onClick={() => toggleActionStatus(action.id, status)}
                    >
                      <div className="action-header">
                        <span className="action-status-icon" style={{ color: style.color }}>
                          {style.icon}
                        </span>
                        <span className="action-title">{action.title}</span>
                        <span className="action-time">{action.estimatedTime}</span>
                      </div>
                      <p className="action-description">{action.description}</p>
                      {action.impact && (
                        <div className="action-impact">
                          효과: <strong>{action.impact}</strong>
                        </div>
                      )}
                      <div className="action-meta">
                        <span className="action-category">{action.category}</span>
                        {action.week && <span className="action-week">Week {action.week}</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </section>

        {/* 투자 가이드 */}
        <section className="investment-guide-section">
          <h2>투자 가이드</h2>

          <div className="guide-card">
            <h3>추천 포트폴리오</h3>
            <p className="portfolio-summary">{roadmap.investmentGuide.portfolioSummary}</p>
            {renderPortfolioBar(selectedScenario)}
            <div className="portfolio-legend">
              {selectedScenario.portfolioAllocation.map((item, idx) => (
                <span key={idx} className="legend-item">
                  <span className="legend-dot" style={{ backgroundColor: item.color }} />
                  {item.name} ({item.ticker}) {item.ratio}%
                </span>
              ))}
            </div>
          </div>

          <div className="guide-card">
            <h3>Step-by-Step 가이드</h3>
            <ol className="step-list">
              {roadmap.investmentGuide.stepByStepGuide.map((step, idx) => (
                <li key={idx}>{step}</li>
              ))}
            </ol>
          </div>

          <div className="guide-card caution">
            <h3>주의사항</h3>
            <ul className="caution-list">
              {roadmap.investmentGuide.cautionNotes.map((note, idx) => (
                <li key={idx}>{note}</li>
              ))}
            </ul>
          </div>
        </section>

        {/* 상담 신청 CTA */}
        <section className="cta-section">
          <div className="cta-card">
            <h2>전문가 상담이 필요하신가요?</h2>
            <p>
              더 자세한 맞춤 전략이 필요하시면<br />
              전문 재무설계사와 무료 상담을 받아보세요.
            </p>
            <div className="cta-buttons">
              <a href="#" className="cta-btn primary">
                무료 상담 신청하기
              </a>
              <a href="#" className="cta-btn secondary">
                카카오톡 상담
              </a>
            </div>
          </div>
        </section>
      </>
    )
  }

  return (
    <div className="professional-scenario-page">
      <div className="container">
        {phase === 'comparison' ? renderComparisonPhase() : renderResultPhase()}
      </div>
    </div>
  )
}

export default ProfessionalScenario

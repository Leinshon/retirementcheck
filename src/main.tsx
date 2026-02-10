import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import SimpleApp from './SimpleApp.tsx'
import ProfessionalScenario from './ProfessionalScenario.tsx'
import ProfessionalApp from './ProfessionalApp.tsx'
import ProfessionalDiagnosis from './ProfessionalDiagnosis.tsx'
import DiagnosisReport from './DiagnosisReport.tsx'
import DiagnosisReportV2 from './DiagnosisReportV2.tsx'
import LifecycleDemo from './LifecycleDemo.tsx'
import ScenarioPlanning from './ScenarioPlanning.tsx'
import DemoData from './DemoData.tsx'
import Calculator from './Calculator.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/simple" element={<SimpleApp />} />
        <Route path="/scenario" element={<ProfessionalScenario />} />
        <Route path="/professional" element={<ProfessionalApp />} />
        <Route path="/professional/diagnosis" element={<ProfessionalDiagnosis />} />
        <Route path="/professional/scenario" element={<ProfessionalScenario />} />
        <Route path="/professional/report" element={<DiagnosisReport />} />
        <Route path="/professional/report-v2" element={<DiagnosisReportV2 />} />
        <Route path="/lifecycle-demo" element={<LifecycleDemo />} />
        <Route path="/scenario-planning" element={<ScenarioPlanning />} />
        <Route path="/demo" element={<DemoData />} />
        <Route path="/calculator" element={<Calculator />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)

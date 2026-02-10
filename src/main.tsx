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
        <Route path="/x9f2k1" element={<SimpleApp />} />
        <Route path="/m3p7q8" element={<ProfessionalScenario />} />
        <Route path="/v5n8w2" element={<ProfessionalApp />} />
        <Route path="/v5n8w2/d4h6j9" element={<ProfessionalDiagnosis />} />
        <Route path="/v5n8w2/m3p7q8" element={<ProfessionalScenario />} />
        <Route path="/v5n8w2/r7t3y1" element={<DiagnosisReport />} />
        <Route path="/v5n8w2/r7t3y1-v2" element={<DiagnosisReportV2 />} />
        <Route path="/k2c9f4" element={<LifecycleDemo />} />
        <Route path="/b8s5l7" element={<ScenarioPlanning />} />
        <Route path="/z6a1e3" element={<DemoData />} />
        <Route path="/calculator" element={<Calculator />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)

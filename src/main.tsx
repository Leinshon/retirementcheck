import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import SimpleApp from './SimpleApp.tsx'
import ProfessionalScenario from './ProfessionalScenario.tsx'
import ProfessionalApp from './ProfessionalApp.tsx'
import ProfessionalDiagnosis from './ProfessionalDiagnosis.tsx'

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
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)

import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import LoaderPage from './components/loader/LoaderPage'
import ExperienceCenterErrorBoundary from './pages/experience-center/ExperienceCenterErrorBoundary'

const ExperienceCenterLanding = lazy(() => import('./pages/experience-center/Landing'))
const ExperienceCenterSelection = lazy(() => import('./pages/experience-center/Selection'))
const ExperiencePlaceholder = lazy(() => import('./pages/experience-center/Placeholder'))
const CircleStepRoute = lazy(() => import('./pages/experience-center/CircleStepRoute'))

const PublicDemoApp = () => (
  <ExperienceCenterErrorBoundary>
    <div className="bg-gray-100">
      <Suspense fallback={<LoaderPage />}>
        <Routes>
          <Route path="/" element={<Navigate to="/experience-center" replace />} />
          <Route path="/experience-center">
            <Route index element={<ExperienceCenterLanding />} />
            <Route path="select" element={<ExperienceCenterSelection />} />
            <Route path="circle" element={<Navigate to="/experience-center/circle/intro" replace />} />
            <Route path="circle/*" element={<CircleStepRoute />} />
            <Route path=":experienceId" element={<ExperiencePlaceholder />} />
            <Route path="*" element={<Navigate to="/experience-center/select" replace />} />
          </Route>
          <Route path="*" element={<Navigate to="/experience-center" replace />} />
        </Routes>
      </Suspense>
    </div>
  </ExperienceCenterErrorBoundary>
)

export default PublicDemoApp

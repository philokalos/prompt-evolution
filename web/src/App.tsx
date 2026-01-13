import { Routes, Route } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import Layout from './components/layout/Layout';

// Lazy load pages for code splitting
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const InsightsPage = lazy(() => import('./pages/InsightsPage'));
const TrendsPage = lazy(() => import('./pages/TrendsPage'));
const ProjectsPage = lazy(() => import('./pages/ProjectsPage'));
const LibraryPage = lazy(() => import('./pages/LibraryPage'));
const GuidebookPage = lazy(() => import('./pages/GuidebookPage'));

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-2 border-app-border border-t-accent-primary"></div>
    </div>
  );
}

function App() {
  return (
    <Layout>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/insights" element={<InsightsPage />} />
          <Route path="/trends" element={<TrendsPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/guidebook" element={<GuidebookPage />} />
        </Routes>
      </Suspense>
    </Layout>
  );
}

export default App;

import { Suspense } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import Layout from "./pages/_layout";
import { queryClient } from "./lib/query-client";
import { AppProviders } from "@/components/system/AppProviders";
import { AuthGate } from "@/components/system/AuthGate";
import Home from "./pages/home";
import CompetenciesPage from "./pages/competencies";
import CompetencyDetailPage from "./pages/competency-detail";
import PersonsPage from "./pages/persons";
import PersonDetailPage from "./pages/person-detail";
import ObservePage from "./pages/observe";
import SignOffPage from "./pages/sign-off";
import RequestsPage from "./pages/requests";
import ReportsPage from "./pages/reports";
import MyOrienteesPage from "./pages/my-orientees";
import OrienteeWorkspacePage from "./pages/orientee-workspace";
import MyCompetenciesPage from "./pages/my-competencies";
import GroupsPage from "./pages/groups";
import AuditLogPage from "./pages/audit";
import PeoplePage from "./pages/people";
import NotFoundPage from "./pages/not-found";
import AssignmentsPage from "./pages/assignments";
import CompetencyMatrixPage from "./pages/competency-matrix";
import UnitLeaderDashboardPage from "./pages/unit-leader-dashboard";
import { AppErrorBoundary } from "./components/system/AppErrorBoundary";

// Determine the router basename from the URL.
// In production, the app is typically deployed at the root ("/") or a known
// sub-path. This helper accommodates either case by treating the first path
// segment as the base. If you deploy at "/", set APP_BASENAME = "/".
function getBase(pathname: string): string {
  const parts = pathname.split("/").filter(Boolean);
  return parts.length ? `/${parts[0]}/` : "/";
}
const APP_BASENAME = getBase(window.location.pathname);

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppProviders>
        <Router basename={APP_BASENAME}>
          <AppErrorBoundary>
            <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading…</div>}>
              <AuthGate>
                <Routes>
                  <Route path="/" element={<Layout />}>
                    <Route index element={<Home />} />
                    <Route path="my-orientees" element={<MyOrienteesPage />} />
                    <Route path="my-orientees/:id" element={<OrienteeWorkspacePage />} />
                    <Route path="my-competencies" element={<MyCompetenciesPage />} />
                    <Route path="competencies" element={<CompetenciesPage />} />
                    <Route path="competencies/:id" element={<CompetencyDetailPage />} />
                    <Route path="dashboard" element={<UnitLeaderDashboardPage />} />
                    <Route path="persons" element={<PersonsPage />} />
                    <Route path="persons/:id" element={<PersonDetailPage />} />
                    <Route path="observe" element={<ObservePage />} />
                    <Route path="sign-off" element={<SignOffPage />} />
                    <Route path="requests" element={<RequestsPage />} />
                    <Route path="reports" element={<ReportsPage />} />
                    <Route path="groups" element={<GroupsPage />} />
                    <Route path="audit" element={<AuditLogPage />} />
                    <Route path="assignments" element={<AssignmentsPage />} />
                    <Route path="competency-matrix" element={<CompetencyMatrixPage />} />
                    <Route path="people" element={<PeoplePage />} />
                    <Route path="*" element={<NotFoundPage />} />
                  </Route>
                </Routes>
              </AuthGate>
            </Suspense>
          </AppErrorBoundary>
        </Router>
      </AppProviders>
    </QueryClientProvider>
  );
}

export default App;
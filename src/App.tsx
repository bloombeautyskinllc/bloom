import { BrowserRouter, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import ScrollManager from './components/layout/ScrollManager';
import ScrollProgress from './components/decor/ScrollProgress';
import Home from './pages/Home';
import ComingSoon from './pages/ComingSoon';
import TreatmentPage from './pages/TreatmentPage';
import { routes } from './data/site';

function Layout() {
  const { pathname } = useLocation();

  return (
    <>
      <ScrollManager />
      <ScrollProgress />
      <Header />
      {/* Keyed by route so every page change fades in and replays its entrance animations */}
      <main key={pathname} className="animate-page-in">
        <Outlet />
      </main>
      <Footer />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path={routes.home} element={<Home />} />
          <Route path={routes.treatmentPattern} element={<TreatmentPage />} />
          <Route path={routes.booking} element={<ComingSoon title="Book your skin consultation" />} />
          <Route path={routes.privacy} element={<ComingSoon title="Privacy policy" />} />
          <Route path={routes.terms} element={<ComingSoon title="Terms of service" />} />
          <Route path={routes.intakeForm} element={<ComingSoon title="Client intake form" />} />
          <Route path="*" element={<ComingSoon title="Page not found" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

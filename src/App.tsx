import { BrowserRouter, Outlet, Route, Routes } from 'react-router-dom';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import ScrollManager from './components/layout/ScrollManager';
import Home from './pages/Home';
import ComingSoon from './pages/ComingSoon';
import TreatmentPage from './pages/TreatmentPage';
import { routes } from './data/site';

function Layout() {
  return (
    <>
      <ScrollManager />
      <Header />
      <main>
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

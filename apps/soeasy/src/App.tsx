import { Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import ThankYou from './pages/ThankYou';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/thank-you" element={<ThankYou />} />
    </Routes>
  );
}

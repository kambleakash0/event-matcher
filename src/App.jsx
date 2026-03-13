import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import AdminDashboard from './pages/AdminDashboard';
import UploadPage from './pages/UploadPage';
import EventDetailPage from './pages/EventDetailPage';
import MatchResultsPage from './pages/MatchResultsPage';

import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/admin" element={<LoginPage />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/event/:eventId" element={<EventDetailPage />} />
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/my-matches" element={<MatchResultsPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './components/LandingPage';
import PartyRoom from './components/PartyRoom';
import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/party/:partyId" element={<PartyRoom />} />
      </Routes>
    </Router>
  );
}

export default App;

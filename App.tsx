import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import GrokGenerator from './pages/GrokGenerator';
import VeoGenerator from './pages/VeoGenerator';
import { Video, Cpu } from 'lucide-react';

const Navigation = () => {
  const location = useLocation();

  return (
    <div className="bg-dark-900 border-b border-gray-800 p-4 flex justify-center gap-4">
      <Link 
        to="/" 
        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${location.pathname === '/' ? 'bg-brand-600 text-white' : 'bg-dark-800 text-gray-400 hover:bg-dark-700 hover:text-white'}`}
      >
        <Cpu size={18} />
        <span className="font-medium">Grok Video</span>
      </Link>
      <Link 
        to="/veo" 
        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${location.pathname === '/veo' ? 'bg-brand-600 text-white' : 'bg-dark-800 text-gray-400 hover:bg-dark-700 hover:text-white'}`}
      >
        <Video size={18} />
        <span className="font-medium">Veo Video</span>
      </Link>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <div className="min-h-screen bg-dark-900 text-white font-sans selection:bg-brand-500/30">
        <Navigation />
        <Routes>
          <Route path="/" element={<GrokGenerator />} />
          <Route path="/veo" element={<VeoGenerator />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App;

import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { DatabaseProvider } from './context/DatabaseContext';
import Layout from './components/Layout';
import Dashboard from './views/Dashboard';
import TimingView from './views/TimingView';
import RacesView from './views/RacesView';
import ParticipantsView from './views/ParticipantsView';
import ResultsView from './views/ResultsView';
import AdminView from './views/AdminView';
import SignaleurView from './views/SignaleurView';
import LiveView from './views/LiveView';
import MarshalInputView from './views/MarshalInputView';
import RemoteFinishView from './views/RemoteFinishView';

const App: React.FC = () => {
  return (
    <DatabaseProvider>
      <Router>
        <Routes>
          {/* Routes publiques et autonomes */}
          <Route path="/live" element={<LiveView />} />
          <Route path="/signaleur-terrain" element={<MarshalInputView />} />
          <Route path="/remote-finish" element={<RemoteFinishView />} />
          
          {/* Routes administration */}
          <Route path="/*" element={
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/timing" element={<TimingView />} />
                <Route path="/races" element={<RacesView />} />
                <Route path="/participants" element={<ParticipantsView />} />
                <Route path="/results" element={<ResultsView />} />
                <Route path="/admin" element={<AdminView />} />
                <Route path="/signaleur" element={<SignaleurView />} />
              </Routes>
            </Layout>
          } />
        </Routes>
      </Router>
    </DatabaseProvider>
  );
};

export default App;

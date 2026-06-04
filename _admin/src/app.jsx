import React from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import '../css/cachearoo.admin.css';

import {
  Route, Routes,
} from 'react-router-dom';
import { HashRouter, useParams } from 'react-router-dom';

import { Cachearoo } from 'cachearoo';

import StatusList from './components/status-list';
import KeyList from './components/key-list';
import BucketList from './components/bucket-list';
import VirtualPaths from './components/virtual-paths';
import TopMenu from './components/top-menu';

function KeyListContainer() {
  const { id } = useParams();
  return (
    <KeyList id={decodeURIComponent(id)} />
  );
}

const App = () => {
  const [clientReady, setClientReady] = React.useState(false);
  const [authError, setAuthError] = React.useState('');
  const [version, setVersion] = React.useState('');

  React.useEffect(() => {
    let cancelled = false;

    async function initClient() {
      try {
        const response = await fetch('/_auth');
        if (!response.ok) {
          throw new Error(`Authentication failed (${response.status})`);
        }
        const data = await response.json();
        const secure = window.location.protocol === 'https:';
        let port = parseInt(window.location.port, 10);
        if (!Number.isInteger(port)) {
          port = (secure ? 443 : 80);
        }
        globalThis.de = new Cachearoo({
          clientId: 'admin',
          host: window.location.hostname,
          port,
          apiKey: data.apiKey,
          secure,
        });
        if (!cancelled) {
          const title = data.version ? `Cachearoo ${data.version}` : 'Cachearoo';
          document.title = title;
          setVersion(data.version || '');
          setClientReady(true);
        }
      } catch (err) {
        if (!cancelled) {
          setAuthError(err.message);
        }
      }
    }

    initClient();

    return () => {
      cancelled = true;
    };
  }, []);

  if (authError) {
    return (
      <main className="app-shell app-shell-centered">
        <div className="empty-state">
          <h1>Unable to open admin</h1>
          <p>{authError}</p>
        </div>
      </main>
    );
  }

  return clientReady ? (
    <div className="app-shell">
      <HashRouter>
        <TopMenu version={version} />
        <main className="app-content">
          <Routes>
            <Route path="/" element={<BucketList />} />
            <Route path="/buckets" element={<BucketList />} />
            <Route path="/virtual-paths" element={<VirtualPaths />} />
            <Route path="/buckets/:id" element={<KeyListContainer />} />
            <Route path="/status" element={<StatusList />} />
          </Routes>
        </main>
      </HashRouter>
    </div>
  ) : (
    <main className="app-shell app-shell-centered">
      <div className="empty-state">
        <h1>Opening Cachearoo</h1>
        <p>Connecting to the admin API...</p>
      </div>
    </main>
  );
};

export default App;

import './App.scss';
import { useEffect, useState } from 'react';
import { useConnectionStatus } from '@ntcore/react';
import { ConnectionBackdrop } from '../components/ConnectionBackdrop';
import { ConnectionStatus } from '../components/ConnectionStatus';
import { GyroCard } from '../components/GyroCard';
import { AccelerometerCard } from '../components/AccelerometerCard';
import { PoseCard } from '../components/PoseCard';
import { AutoModeCard } from '../components/AutoModeCard';
import { AllTopicsTable } from '../components/AllTopicsTable';

export default function App() {
  const { connected } = useConnectionStatus();
  const [hasEverConnected, setHasEverConnected] = useState(false);
  const [backdropOpenByUser, setBackdropOpenByUser] = useState(false);
  const [manuallyClosed, setManuallyClosed] = useState(false);

  useEffect(() => {
    if (connected) {
      setHasEverConnected(true);
      setBackdropOpenByUser(false);
    }
  }, [connected]);

  const showBackdrop = (connected === false && !hasEverConnected && !manuallyClosed) || backdropOpenByUser;

  const handleBackdropClose = (escape: boolean) => {
    setBackdropOpenByUser(false);
    if (escape) setManuallyClosed(true);
  };

  return (
    <div className="dashboard">
      <ConnectionBackdrop open={showBackdrop} onClose={handleBackdropClose} />
      <h1>Example React Dashboard</h1>
      <ConnectionStatus onConnectionClick={() => setBackdropOpenByUser(true)} />
      <div className="cards">
        <div className="card sensors-card">
          <h2>Sensors</h2>
          <div className="value sensors-content">
            <section className="sensors-section">
              <h3 className="sensors-section-label">Gyro</h3>
              <GyroCard noCard />
            </section>
            <section className="sensors-section">
              <h3 className="sensors-section-label">Accelerometer</h3>
              <AccelerometerCard noCard />
            </section>
          </div>
        </div>
        <PoseCard />
        <AutoModeCard />
        <AllTopicsTable />
      </div>
    </div>
  );
}

import { ConnectionStatus } from '../components/ConnectionStatus';
import { GyroCard } from '../components/GyroCard';
import { AccelerometerCard } from '../components/AccelerometerCard';
import { PoseCard } from '../components/PoseCard';
import { AutoModeCard } from '../components/AutoModeCard';
import { AllTopicsTable } from '../components/AllTopicsTable';

export default function App() {
  return (
    <div className="dashboard">
      <h1>Example React Dashboard</h1>
      <ConnectionStatus />
      <div className="cards">
        <GyroCard />
        <AccelerometerCard />
        <PoseCard />
        <AutoModeCard />
        <AllTopicsTable />
      </div>
    </div>
  );
}

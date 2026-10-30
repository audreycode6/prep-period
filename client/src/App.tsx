import { HealthStatus } from './components/HealthStatus';
import { PlanList } from './components/PlanList';

export default function App() {
  return (
    <main>
      <h1>Prep Period</h1>
      <HealthStatus />
      <PlanList />
    </main>
  );
}

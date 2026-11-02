import { useState } from 'react';
import { HealthStatus } from './components/HealthStatus';
import { PlanEditor } from './components/PlanEditor';
import { PlanList } from './components/PlanList';

export default function App() {
  // which screen shows: the editor for this plan, or the plan list when null
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);

  return (
    <main>
      <h1>Prep Period</h1>
      <HealthStatus />
      {editingPlanId === null ? (
        <PlanList onOpen={setEditingPlanId} />
      ) : (
        <PlanEditor
          planId={editingPlanId}
          onClose={() => setEditingPlanId(null)}
        />
      )}
    </main>
  );
}

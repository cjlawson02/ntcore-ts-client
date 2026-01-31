import { useEffect, useMemo, useState } from 'react';
import { useNtcore, type NetworkTablesTypes } from '@ntcore/react';

function formatValue(value: NetworkTablesTypes | null): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value;
  if (value instanceof Uint8Array) return `<binary ${value.length}B>`;
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/**
 * Subscribes to all NetworkTables topics under "/" and displays each topic name and
 * latest value in a table. Subscribes directly so every update is merged (usePrefixTopic
 * only exposes the single latest update, so we'd miss topics when updates arrive in quick succession).
 */
export function AllTopicsTable() {
  const nt = useNtcore();
  const [byName, setByName] = useState<Record<string, NetworkTablesTypes | null>>({});

  useEffect(() => {
    if (!nt) return;
    const topic = nt.createPrefixTopic('/');
    const subuid = topic.subscribe((value, params) => {
      setByName((prev) => ({ ...prev, [params.name]: value }));
    });
    return () => topic.unsubscribe(subuid);
  }, [nt]);

  const rows = useMemo(() => {
    return Object.entries(byName).sort(([a], [b]) => a.localeCompare(b));
  }, [byName]);

  if (rows.length === 0) {
    return (
      <div className="card all-topics-table">
        <h2>All topics (/)</h2>
        <p className="all-topics-table__empty">No topics yet. Connect to a robot or wait for announcements.</p>
      </div>
    );
  }

  return (
    <div className="card all-topics-table">
      <h2>All topics (/)</h2>
      <div className="all-topics-table__scroll">
        <table className="all-topics-table__table" aria-label="All NetworkTables topics">
          <thead>
            <tr>
              <th>Topic</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([name, value]) => (
              <tr key={name}>
                <td className="all-topics-table__name">{name}</td>
                <td className="all-topics-table__value">{formatValue(value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import './AllTopicsTable.scss';
import { Fragment, useCallback, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { usePrefixTopicMap, type NetworkTablesTypes } from '@ntcore-ts/react';

function formatValue(value: NetworkTablesTypes | null): string {
  if (value == null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return JSON.stringify(value);
  if (value instanceof Uint8Array) return `<binary ${value.length}B>`;
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function parseJsonValue(value: NetworkTablesTypes | null): Record<string, unknown> | unknown[] | null {
  if (value == null) return null;
  if (typeof value === 'object' && !(value instanceof Uint8Array)) {
    return value as Record<string, unknown> | unknown[];
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed !== null && typeof parsed === 'object') {
        return parsed as Record<string, unknown> | unknown[];
      }
    } catch {
      // not JSON
    }
  }
  return null;
}

function isExpandableJson(val: unknown): val is Record<string, unknown> | unknown[] {
  return val !== null && typeof val === 'object' && !(val instanceof Uint8Array);
}

function formatJsonLeaf(val: unknown): string {
  if (val === null) return 'null';
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'string') return JSON.stringify(val);
  return String(val);
}

interface JsonExpanderProps {
  value: Record<string, unknown> | unknown[];
  expansionKeyPrefix: string;
  expanded: Set<string>;
  onToggle: (key: string) => void;
  depth?: number;
}

function JsonExpander({ value, expansionKeyPrefix, expanded, onToggle, depth = 0 }: JsonExpanderProps) {
  const entries = Array.isArray(value)
    ? (value as unknown[]).map((v, i) => [String(i), v] as [string, unknown])
    : Object.entries(value as Record<string, unknown>);

  return (
    <div className="all-topics-table__json-value">
      {entries.map(([key, val]) => {
        const expandKey = expansionKeyPrefix + '|' + key;
        const isExpandable = isExpandableJson(val);
        const isExpanded = expanded.has(expandKey);

        return (
          <div key={key} className="all-topics-table__json-entry" data-depth={depth}>
            {isExpandable ? (
              <>
                <button
                  type="button"
                  className="all-topics-table__json-expander"
                  aria-expanded={isExpanded}
                  aria-label={isExpanded ? 'Collapse' : 'Expand'}
                  onClick={() => onToggle(expandKey)}
                >
                  <span className="all-topics-table__expander-icon" aria-hidden>
                    {isExpanded ? '▼' : '▶'}
                  </span>
                </button>
                <span className="all-topics-table__json-key">{key}:</span>
                {isExpanded ? (
                  <div className="all-topics-table__json-children">
                    <JsonExpander
                      value={val as Record<string, unknown> | unknown[]}
                      expansionKeyPrefix={expandKey}
                      expanded={expanded}
                      onToggle={onToggle}
                      depth={depth + 1}
                    />
                  </div>
                ) : (
                  <span className="all-topics-table__json-preview">
                    {Array.isArray(val) ? `[${(val as unknown[]).length}]` : '{…}'}
                  </span>
                )}
              </>
            ) : (
              <>
                <span className="all-topics-table__json-expander-placeholder" aria-hidden />
                <span className="all-topics-table__json-key">{key}:</span>
                <span
                  className={`all-topics-table__json-leaf${val === null || val === undefined ? ' all-topics-table__json-leaf--keyword' : ''}`}
                >
                  {val === null ? 'null' : val === undefined ? 'undefined' : formatJsonLeaf(val)}
                </span>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

interface ValueCellProps {
  value: NetworkTablesTypes | null;
  rowKey: string;
  expanded: Set<string>;
  onToggleJsonKey: (key: string) => void;
  /** When true (row has children), hide null in the value cell */
  isExpandable?: boolean;
}

function ValueCell({ value, rowKey, expanded, onToggleJsonKey, isExpandable }: ValueCellProps) {
  const json = parseJsonValue(value);
  if (json !== null) {
    return <JsonExpander value={json} expansionKeyPrefix={rowKey} expanded={expanded} onToggle={onToggleJsonKey} />;
  }
  const formatted = formatValue(value);
  if (formatted === 'null' && isExpandable) return null;
  const isMono = formatted === 'null' || (formatted.startsWith('<binary ') && formatted.endsWith('B>'));
  return isMono ? <span className="all-topics-table__value-text">{formatted}</span> : formatted;
}

interface TopicNode {
  segment: string;
  fullPath: string;
  value: NetworkTablesTypes | null;
  children: TopicNode[];
}

function buildTree(rows: [string, NetworkTablesTypes | null][]): TopicNode {
  const root: TopicNode = { segment: '', fullPath: '', value: null, children: [] };
  for (const [name, value] of rows) {
    const segments = name.split('/').filter(Boolean);
    let current = root;
    for (let i = 0; i < segments.length; i++) {
      const key = segments[i];
      const fullPath = '/' + segments.slice(0, i + 1).join('/');
      let child = current.children.find((c) => c.segment === key);
      if (!child) {
        child = {
          segment: key,
          fullPath,
          value: i === segments.length - 1 ? value : null,
          children: [],
        };
        current.children.push(child);
      } else if (i === segments.length - 1) {
        child.value = value;
      }
      current = child;
    }
  }
  function sortChildren(node: TopicNode) {
    node.children.sort((a, b) => a.segment.localeCompare(b.segment));
    node.children.forEach(sortChildren);
  }
  sortChildren(root);
  return root;
}

/**
 * Subscribes to all NetworkTables topics under "/" via usePrefixTopicMap and displays each
 * topic name and latest value in a table. Topics are shown in a nested tree with row expanders.
 */
export function AllTopicsTable() {
  const byName = usePrefixTopicMap('/');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [jsonExpanded, setJsonExpanded] = useState<Set<string>>(new Set());

  const rows = useMemo(() => Object.entries(byName ?? {}).sort(([a], [b]) => a.localeCompare(b)), [byName]);

  const tree = useMemo(() => buildTree(rows), [rows]);

  const toggleInSet = useCallback(
    (setter: Dispatch<SetStateAction<Set<string>>>) => (key: string) => {
      setter((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
    },
    []
  );
  const toggleExpanded = toggleInSet(setExpanded);
  const toggleJsonKey = toggleInSet(setJsonExpanded);

  if (rows.length === 0) {
    return (
      <div className="card all-topics-table">
        <h2>All topics (/)</h2>
        <p className="all-topics-table__empty">No topics yet. Connect to a robot or wait for announcements.</p>
      </div>
    );
  }

  function renderRows(nodes: TopicNode[], depth: number): ReactNode {
    return nodes.map((node) => {
      const hasChildren = node.children.length > 0;
      const isExpanded = expanded.has(node.fullPath);
      return (
        <Fragment key={node.fullPath || 'root'}>
          <tr data-depth={depth} data-has-children={hasChildren || undefined}>
            <td className="all-topics-table__name">
              <span className="all-topics-table__name-cell">
                <span className="all-topics-table__indent" style={{ marginLeft: depth * 1.25 + 'rem' }} />
                {hasChildren ? (
                  <button
                    type="button"
                    className="all-topics-table__expander"
                    aria-expanded={isExpanded}
                    aria-label={isExpanded ? 'Collapse' : 'Expand'}
                    onClick={() => toggleExpanded(node.fullPath)}
                  >
                    <span className="all-topics-table__expander-icon" aria-hidden>
                      {isExpanded ? '▼' : '▶'}
                    </span>
                  </button>
                ) : (
                  <span className="all-topics-table__expander-placeholder" aria-hidden />
                )}
                <span className="all-topics-table__segment" title={node.fullPath}>
                  {node.segment || '/'}
                </span>
              </span>
            </td>
            <td className="all-topics-table__value">
              <ValueCell
                value={node.value}
                rowKey={node.fullPath}
                expanded={jsonExpanded}
                onToggleJsonKey={toggleJsonKey}
                isExpandable={hasChildren}
              />
            </td>
          </tr>
          {hasChildren && isExpanded ? renderRows(node.children, depth + 1) : null}
        </Fragment>
      );
    });
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
          <tbody>{renderRows(tree.children, 0)}</tbody>
        </table>
      </div>
    </div>
  );
}

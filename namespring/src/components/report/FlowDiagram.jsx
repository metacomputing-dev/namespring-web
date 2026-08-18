import React from 'react';
import { cx } from './ReportPrimitives';

function elementScope(element) {
  return `cr-v3-el-${element || 'neutral'}`;
}

export function FlowDiagram({ nodes = [], edges = [], className }) {
  if (!nodes.length) return null;
  return (
    <div className={cx('cr-v3-flow', className)} role="img" aria-label="발음 오행 흐름 도식">
      {nodes.map((node, index) => (
        <React.Fragment key={`${node.hangul}-${index}`}>
          <div className={cx('cr-v3-flow__node', elementScope(node.element))}>
            <span className="cr-v3-flow__glyph">{node.hangul}</span>
            <span className="cr-v3-flow__caption">
              {node.elementKo ? `${node.elementKo}(${node.polarity === 'Positive' ? '양' : '음'})` : '—'}
            </span>
          </div>
          {index < nodes.length - 1 && edges[index] ? (
            <div className="cr-v3-flow__edge">
              <span className="cr-v3-flow__edge-glyph" aria-hidden="true">
                {edges[index].favorable ? '─ ─ ▶' : '─ ✕ ─'}
              </span>
              <span
                className={cx(
                  'cr-v3-flow__edge-tag',
                  edges[index].favorable ? 'cr-v3-flow__edge-tag--good' : 'cr-v3-flow__edge-tag--clash',
                )}
              >
                {edges[index].label}
              </span>
            </div>
          ) : null}
        </React.Fragment>
      ))}
    </div>
  );
}

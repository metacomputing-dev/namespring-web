import React, { useEffect, useRef, useState } from 'react';

function FadeTransition({ transitionKey, duration = 320, children }) {
  const [rendered, setRendered] = useState({ key: transitionKey, node: children });
  const [visible, setVisible] = useState(true);
  const timerRef = useRef(null);

  useEffect(() => {
    if (rendered.key === transitionKey) {
      setRendered((prev) => ({ ...prev, node: children }));
      return;
    }

    setVisible(false);
    timerRef.current = window.setTimeout(() => {
      setRendered({ key: transitionKey, node: children });
      setVisible(true);
    }, duration);

    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, [children, duration, rendered.key, transitionKey]);

  return (
    <div
      className="ns-fade-transition"
      style={{ opacity: visible ? 1 : 0, '--ns-fade-duration': `${duration}ms` }}
    >
      {rendered.node}
    </div>
  );
}

export default FadeTransition;

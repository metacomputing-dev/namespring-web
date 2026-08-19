import React from 'react';

function AppBackground({ children, className = '' }) {
  return (
    <div className={`ns-app-background relative min-h-dvh overflow-hidden ${className}`}>
      <div className="relative z-10 min-h-dvh">{children}</div>
    </div>
  );
}

export default AppBackground;

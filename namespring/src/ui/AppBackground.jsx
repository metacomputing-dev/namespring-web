import React from 'react';

function AppBackground({ children, className = '' }) {
  return (
    <div className={`ns-app-background relative min-h-screen overflow-hidden ${className}`}>
      <div className="relative z-10 min-h-screen">{children}</div>
    </div>
  );
}

export default AppBackground;

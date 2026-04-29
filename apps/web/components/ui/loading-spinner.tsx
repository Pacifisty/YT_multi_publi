import React from 'react';

interface LoadingSpinnerProps {
  size?: number;
  color?: string;
}

export const LoadingSpinner = React.forwardRef<HTMLDivElement, LoadingSpinnerProps>(
  ({ size = 20, color = 'currentColor' }, ref) => {
    return (
      <div
        ref={ref}
        style={{
          width: size,
          height: size,
          border: `2px solid ${color}33`,
          borderTop: `2px solid ${color}`,
          borderRadius: '50%',
          animation: 'spin 600ms linear infinite',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        aria-hidden="true"
      />
    );
  }
);

LoadingSpinner.displayName = 'LoadingSpinner';

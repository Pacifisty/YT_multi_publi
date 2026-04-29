import React from 'react';
import { LoadingSpinner } from './loading-spinner';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      icon,
      iconPosition = 'left',
      children,
      disabled,
      className = '',
      style = {},
      ...props
    },
    ref
  ) => {
    const variantClasses: Record<ButtonVariant, string> = {
      primary: 'button-primary',
      secondary: 'button-secondary',
      danger: 'button-danger',
      ghost: 'button-ghost',
    };

    const sizeClasses: Record<ButtonSize, string> = {
      sm: 'button-sm',
      md: 'button-md',
      lg: 'button-lg',
    };

    const baseStyles: React.CSSProperties = {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
      fontFamily: 'var(--font-display, Inter, system-ui, sans-serif)',
      fontWeight: 500,
      border: 'none',
      borderRadius: 'var(--radius-sm, 8px)',
      transition: 'all 150ms var(--ease, cubic-bezier(0.4, 0, 0.2, 1))',
      willChange: 'transform, box-shadow, opacity',
      minHeight: '44px',
      minWidth: '44px',
      whiteSpace: 'nowrap',
      ...style,
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`button ${variantClasses[variant]} ${sizeClasses[size]} ${
          isLoading ? 'is-loading' : ''
        } ${className}`.trim()}
        style={baseStyles}
        {...props}
      >
        {isLoading && <LoadingSpinner size={size === 'sm' ? 16 : size === 'md' ? 18 : 20} />}
        {!isLoading && icon && iconPosition === 'left' && (
          <span className="button-icon" style={{ display: 'inline-flex', alignItems: 'center' }}>
            {icon}
          </span>
        )}
        {!isLoading && children && <span>{children}</span>}
        {!isLoading && icon && iconPosition === 'right' && (
          <span className="button-icon" style={{ display: 'inline-flex', alignItems: 'center' }}>
            {icon}
          </span>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

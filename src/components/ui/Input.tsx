import React, { forwardRef } from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  Icon?: React.ElementType;
  requiredMark?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, name, helperText, error, Icon, requiredMark, type = 'text', className = '', id, ...props }, ref) => {
    const inputId = id || name;
    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-bold text-ink-primary mb-1.5"
          >
            {label}
            {requiredMark && <span className="ml-1 text-[#EF4444]">*</span>}
          </label>
        )}
        <div className="relative">
          {Icon && (
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <Icon className="h-4 w-4 text-ink-tertiary" aria-hidden="true" />
            </div>
          )}
          <input
            id={inputId}
            name={name}
            type={type}
            ref={ref}
            aria-invalid={!!error}
            aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
            className={`block w-full h-11 px-4 bg-[#F8FAFC] focus:bg-white border rounded-xl text-sm font-medium text-ink-primary placeholder:text-ink-tertiary transition-all duration-150 focus:outline-none ${
              Icon ? 'pl-10' : ''
            } ${
              error
                ? 'border-[#EF4444] focus:border-[#EF4444] focus:ring-2 focus:ring-[#EF4444]/15'
                : 'border-[#CBD5E1] hover:border-[#94A3B8] focus:border-peri-500 focus:ring-2 focus:ring-peri-500/20'
            } disabled:bg-surface-subtle disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
            {...props}
          />
        </div>
        {error && (
          <p id={`${inputId}-error`} role="alert" className="mt-1.5 text-xs font-semibold text-[#EF4444]">
            {error}
          </p>
        )}
        {!error && helperText && (
          <p id={`${inputId}-helper`} className="mt-1.5 text-xs text-ink-tertiary">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

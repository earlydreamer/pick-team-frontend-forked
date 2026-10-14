import React, { forwardRef } from 'react';

export interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helperText?: string;
  error?: string;
  requiredMark?: boolean;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ label, name, helperText, error, requiredMark, className = '', id, rows = 3, ...props }, ref) => {
    const textareaId = id || name;
    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={textareaId}
            className="block text-xs font-medium text-ink-secondary mb-1.5"
          >
            {label}
            {requiredMark && <span className="ml-1 text-peri-600">*</span>}
          </label>
        )}
        <textarea
          id={textareaId}
          name={name}
          ref={ref}
          rows={rows}
          aria-invalid={!!error}
          className={`block w-full px-3 py-2 bg-white border rounded-lg text-sm text-ink-primary placeholder:text-ink-tertiary/60 transition-colors duration-150 focus:outline-none ${
            error
              ? 'border-rose-500 focus:border-rose-600 focus:ring-2 focus:ring-rose-500/15'
              : 'border-neutral-200 hover:border-neutral-300 focus:border-peri-500 focus:ring-2 focus:ring-peri-500/15'
          } disabled:bg-surface-subtle disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
          {...props}
        />
        {error && (
          <p role="alert" className="mt-1 text-xs text-rose-700">
            {error}
          </p>
        )}
        {!error && helperText && (
          <p className="mt-1 text-xs text-ink-tertiary">{helperText}</p>
        )}
      </div>
    );
  }
);

TextArea.displayName = 'TextArea';

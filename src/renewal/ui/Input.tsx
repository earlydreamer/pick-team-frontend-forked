import React, { forwardRef, useId } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  /** 입력 조건 등 지속적으로 보여 줄 설명 */
  help?: string;
  error?: string;
  Icon?: React.ElementType;
}

export const fieldClassName = (hasError: boolean, extra = '') =>
  `block w-full min-h-touch rounded-lg border bg-surface px-3 py-2.5 text-[0.9375rem] text-ink placeholder:text-neutral-500 transition-colors focus:outline-none focus-visible:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-surface-low disabled:text-neutral-500 ${
    hasError ? 'border-2 border-danger focus:ring-danger/30' : 'border-outline focus:border-primary focus:ring-primary/30'
  } ${extra}`.trim();

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, name, help, error, Icon, type = 'text', className = '', id, 'aria-describedby': describedBy, 'aria-invalid': ariaInvalid, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id || (name ? `field-${name}-${generatedId}` : generatedId);
    const descriptionId = `${inputId}-description`;
    const description = error || help;
    const describedByIds = [describedBy, description ? descriptionId : null].filter(Boolean).join(' ') || undefined;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="mb-1.5 block text-sm font-semibold text-ink">
            {label}
            {props.required && <span className="ml-0.5 text-danger" aria-hidden="true">*</span>}
          </label>
        )}
        <div className="relative">
          {Icon && (
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Icon className="h-5 w-5 text-neutral-500" />
            </div>
          )}
          <input
            id={inputId}
            name={name}
            type={type}
            ref={ref}
            aria-invalid={error ? true : ariaInvalid}
            aria-describedby={describedByIds}
            className={fieldClassName(Boolean(error), `${Icon ? 'pl-10' : ''} ${className}`)}
            {...props}
          />
        </div>
        {description && (
          <p id={descriptionId} className={`mt-1.5 text-sm ${error ? 'text-danger' : 'text-muted'}`}>
            {description}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';

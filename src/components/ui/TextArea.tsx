import React, { forwardRef, useId } from 'react';
import { fieldClassName } from './Input';

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  help?: string;
  error?: string;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ label, name, help, error, className = '', id, rows = 3, 'aria-describedby': describedBy, 'aria-invalid': ariaInvalid, ...props }, ref) => {
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
        <textarea
          id={inputId}
          name={name}
          ref={ref}
          rows={rows}
          aria-invalid={error ? true : ariaInvalid}
          aria-describedby={describedByIds}
          className={fieldClassName(Boolean(error), `leading-6 ${className}`)}
          {...props}
        />
        {description && (
          <p id={descriptionId} className={`mt-1.5 text-sm ${error ? 'text-danger' : 'text-muted'}`}>
            {description}
          </p>
        )}
      </div>
    );
  },
);

TextArea.displayName = 'TextArea';

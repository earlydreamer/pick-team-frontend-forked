import React, { useEffect, useId, useState } from 'react';
import type { PostInput } from '@/renewal/domain/collab';
import { Button, Modal, fieldClassName } from '@/renewal/ui';

/** 제목·본문 편집 대화상자. 게시글, 팀 공지, 워크스페이스 공지가 함께 쓴다. */
export const TextEditorModal: React.FC<{
  open: boolean;
  heading: string;
  initial?: PostInput;
  limits: { titleMax: number; contentMax: number };
  validate: (input: PostInput) => Partial<Record<keyof PostInput, string>>;
  submitLabel: string;
  description?: string;
  pending: boolean;
  onClose: () => void;
  onSubmit: (input: PostInput) => Promise<boolean>;
}> = ({ open, heading, initial, limits, validate, submitLabel, description, pending, onClose, onSubmit }) => {
  const id = useId();
  const [value, setValue] = useState<PostInput>({ title: '', content: '' });
  const [errors, setErrors] = useState<Partial<Record<keyof PostInput, string>>>({});
  useEffect(() => {
    if (!open) return;
    setValue(initial ?? { title: '', content: '' });
    setErrors({});
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const submit = async () => {
    const found = validate(value);
    setErrors(found);
    if (found.title) return document.getElementById(`${id}-title`)?.focus();
    if (found.content) return document.getElementById(`${id}-content`)?.focus();
    if (await onSubmit(value)) onClose();
  };
  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      preventClose={pending}
      title={heading}
      description={description}
      size="xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            취소
          </Button>
          <Button onClick={submit} loading={pending}>
            {submitLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label htmlFor={`${id}-title`} className="mb-1.5 block text-sm font-semibold">
            제목
          </label>
          <input
            id={`${id}-title`}
            value={value.title}
            maxLength={limits.titleMax}
            onChange={(event) => setValue((prev) => ({ ...prev, title: event.target.value }))}
            aria-invalid={errors.title ? true : undefined}
            aria-describedby={errors.title ? `${id}-title-error` : undefined}
            className={fieldClassName(Boolean(errors.title))}
          />
          {errors.title && (
            <p id={`${id}-title-error`} className="mt-1.5 text-sm text-danger">
              {errors.title}
            </p>
          )}
        </div>
        <div>
          <label htmlFor={`${id}-content`} className="mb-1.5 block text-sm font-semibold">
            내용
          </label>
          <textarea
            id={`${id}-content`}
            rows={8}
            value={value.content}
            maxLength={limits.contentMax}
            onChange={(event) => setValue((prev) => ({ ...prev, content: event.target.value }))}
            aria-invalid={errors.content ? true : undefined}
            aria-describedby={`${id}-content-count${errors.content ? ` ${id}-content-error` : ''}`}
            className={fieldClassName(Boolean(errors.content), 'leading-6')}
          />
          <div className="mt-1 flex justify-between gap-2 text-xs">
            <span id={`${id}-content-error`} className="text-sm text-danger">
              {errors.content}
            </span>
            <span id={`${id}-content-count`} className="text-muted tabular-nums">
              {value.content.length}/{limits.contentMax}자
            </span>
          </div>
        </div>
      </div>
    </Modal>
  );
};

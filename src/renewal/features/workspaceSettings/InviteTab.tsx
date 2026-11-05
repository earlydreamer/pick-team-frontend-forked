import React, { useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardDocumentIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { INVITE_EXPIRY_OPTIONS, inviteUrl, type WorkspaceSettings } from '@/renewal/domain/workspaceAdmin';
import { useRefreshInvite } from '@/renewal/data/queries';
import { Badge, Button, fieldClassName, toast } from '@/renewal/ui';
import { ConfirmModal } from '@/renewal/features/teamBuilding/shared';
import { SettingsSection, attempt, formatDate } from './parts';

/**
 * 초대 탭(13 §4.2). 현재 링크 복사, 만료·사용 현황, 재발급(이전 링크 즉시 무효, US-13-02).
 * 재발급 만료 기간은 기본 30일이고 "만료 없음"은 명시적으로 고른다(10-D2, 13-D3).
 */
export const InviteTab: React.FC<{ settings: WorkspaceSettings }> = ({ settings }) => {
  const id = useId();
  const refresh = useRefreshInvite(settings.id);
  const [expiry, setExpiry] = useState(INVITE_EXPIRY_OPTIONS[0].value);
  const [confirming, setConfirming] = useState(false);
  const linkRef = useRef<HTMLInputElement>(null);
  const invite = settings.invite;
  const url = invite ? inviteUrl(invite.code) : '';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('초대 링크를 복사했어요.');
    } catch {
      // 클립보드 권한이 없으면 직접 복사할 수 있게 링크를 선택해 둔다.
      linkRef.current?.select();
      toast.error('자동으로 복사하지 못했어요. 선택된 링크를 직접 복사해 주세요.');
    }
  };

  const reissue = async () => {
    const days = INVITE_EXPIRY_OPTIONS.find((option) => option.value === expiry)?.days ?? null;
    const ok = await attempt(() => refresh.mutateAsync(days), invite ? '새 초대 링크를 만들었어요. 이전 링크는 이제 쓸 수 없어요.' : '초대 링크를 만들었어요.');
    setConfirming(false);
    if (ok) requestAnimationFrame(() => linkRef.current?.focus());
  };

  return (
    <div className="space-y-4">
      <SettingsSection id={`${id}-current`} title="현재 초대 링크">
        {invite ? (
          <>
            <label htmlFor={`${id}-link`} className="sr-only">
              초대 링크
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                ref={linkRef}
                id={`${id}-link`}
                readOnly
                value={url}
                onFocus={(event) => event.currentTarget.select()}
                aria-describedby={`${id}-meta`}
                className={fieldClassName(false, 'font-mono text-sm')}
              />
              <Button variant="outline" leftIcon={<ClipboardDocumentIcon className="h-5 w-5" />} onClick={copy} disabled={invite.expired} className="w-full shrink-0 sm:w-auto">
                복사
              </Button>
            </div>
            <dl id={`${id}-meta`} className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-muted">만료</dt>
                <dd className="font-semibold">
                  {invite.expired ? (
                    <Badge tone="error" icon={<ExclamationTriangleIcon className="h-3.5 w-3.5" aria-hidden="true" />}>
                      만료됨
                    </Badge>
                  ) : invite.expiresAt ? (
                    `${formatDate(invite.expiresAt)}까지`
                  ) : (
                    '만료 없음'
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-muted">이 링크로 합류</dt>
                <dd className="font-semibold tabular-nums">{invite.usedCount}명</dd>
              </div>
              <div>
                <dt className="text-muted">멤버·정원</dt>
                <dd className="font-semibold tabular-nums">{settings.capacity ? `${settings.memberCount} / ${settings.capacity}명` : `${settings.memberCount}명, 정원 없음`}</dd>
              </div>
            </dl>
            {invite.expired && <p className="mt-3 text-sm text-danger">이 링크로는 더 이상 합류할 수 없어요. 아래에서 새 링크를 만들어 주세요.</p>}
          </>
        ) : (
          <p className="text-sm text-muted">사용할 수 있는 초대 링크가 없어요. 아래에서 새로 만들어 주세요.</p>
        )}
        <p className="mt-3 text-sm text-muted">
          합류 비밀번호 {settings.hasPassword ? '있음' : '없음'}
          {settings.myRole === 'OWNER' && (
            <>
              {' · '}
              <Link to="?tab=security" className="font-semibold text-primary underline-offset-2 hover:underline">
                보안에서 바꾸기
              </Link>
            </>
          )}
        </p>
      </SettingsSection>

      {!settings.archivedAt && (
      <SettingsSection id={`${id}-reissue`} title={invite ? '초대 링크 재발급' : '초대 링크 만들기'} description={invite ? '링크가 밖으로 퍼졌다면 새 링크를 만들어 이전 링크를 막으세요.' : undefined}>
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">만료 기간</legend>
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            {INVITE_EXPIRY_OPTIONS.map((option) => (
              <label key={option.value} className="flex min-h-touch cursor-pointer items-center gap-2 text-sm">
                <input type="radio" name={`${id}-expiry`} value={option.value} checked={expiry === option.value} onChange={() => setExpiry(option.value)} className="h-4 w-4 accent-primary" />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>
        {expiry === 'none' && <p className="mt-1 text-sm text-muted">만료 없는 링크는 재발급하기 전까지 계속 쓸 수 있어요.</p>}
        <Button className="mt-3" variant={invite ? 'outline' : 'primary'} onClick={() => (invite ? setConfirming(true) : reissue())} loading={!confirming && refresh.isPending}>
          {invite ? '재발급' : '링크 만들기'}
        </Button>
      </SettingsSection>
      )}

      <ConfirmModal
        open={confirming}
        title="초대 링크를 재발급할까요?"
        description="지금 링크는 바로 쓸 수 없게 돼요. 아직 합류하지 않은 사람에게는 새 링크를 다시 보내야 해요."
        confirmLabel="재발급"
        tone="danger"
        pending={refresh.isPending}
        onClose={() => setConfirming(false)}
        onConfirm={reissue}
      />
    </div>
  );
};

import React from 'react';
import { Link } from 'react-router-dom';
import { ClipboardDocumentListIcon, LockClosedIcon } from '@heroicons/react/24/outline';

/**
 * PR 카드 작성 전 동의 안내(11 §4.2 1단계, 01 §3-5).
 * 공개 범위는 11-D2 결정에 따라 "소속된 워크스페이스 멤버"로 안내한다. 카드 공개 플래그가 하나라서
 * 공개하면 ACTIVE로 소속된 모든 워크스페이스에서 보이기 때문이다.
 */
export const ConsentPanel: React.FC<{ workspaceName?: string }> = ({ workspaceName }) => (
  <div className="space-y-3">
    <div className="flex gap-3 rounded-card border border-outline-soft bg-surface-low p-4">
      <ClipboardDocumentListIcon className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
      <div>
        <h3 className="text-sm font-bold">수집하는 정보</h3>
        <p className="mt-1 text-sm leading-5 text-muted">희망 역할, 가용 시간, 기술 스택, 협업 스타일, 자기소개, 포트폴리오 링크, MBTI(선택)</p>
      </div>
    </div>
    <div className="flex gap-3 rounded-card border border-outline-soft bg-surface-low p-4">
      <LockClosedIcon className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
      <div>
        <h3 className="text-sm font-bold">공개 범위</h3>
        <p className="mt-1 text-sm leading-5 text-muted">
          {workspaceName ? `${workspaceName} 등 ` : ''}내가 소속된 워크스페이스의 멤버에게만 공개돼요. 워크스페이스에서 나가거나 차단되면 그 워크스페이스에서는 바로
          비공개돼요. 공개 여부는 내 PR 카드에서 언제든 바꿀 수 있어요.
        </p>
      </div>
    </div>
    <p className="text-sm">
      <Link to="/privacy" className="font-semibold text-primary underline underline-offset-4">
        개인정보 처리방침
      </Link>
    </p>
  </div>
);

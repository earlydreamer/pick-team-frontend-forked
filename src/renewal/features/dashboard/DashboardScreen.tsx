import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRightIcon, CheckCircleIcon, ExclamationTriangleIcon, FlagIcon, InformationCircleIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline';
import { relativeTime } from '@/renewal/domain/announcement';
import { writtenRate, type DashboardView } from '@/renewal/domain/dashboard';
import { SESSION_STATUS_LABEL, dDayLabel, formatDeadline } from '@/renewal/domain/teamBuilding';
import { isManager } from '@/renewal/domain/workspace';
import { DataError } from '@/renewal/data';
import { useApprove, useDashboard, useOpenReportCount, useRemindCardWriters, useWorkspace } from '@/renewal/data/queries';
import { Badge, Button, ErrorState, LoadingState, buttonClassName, toast } from '@/renewal/ui';
import { ForbiddenScreen, NotFoundScreen } from '@/renewal/screens/system';
import { useWritable } from '@/renewal/shell/useWritable';
import { josa } from '@/renewal/domain/josa';

const errorToast = (error: unknown) => toast.error(error instanceof Error ? error.message : '요청을 처리하지 못했어요. 다시 시도해 주세요.');

/** 기획의 위젯 A~D 구분은 화면에 쓰지 않고 제목만 보여 준다. */
const Widget: React.FC<{ id: string; title: string; children: React.ReactNode; className?: string }> = ({ id, title, children, className = '' }) => (
  <section aria-labelledby={id} className={`rounded-card border border-outline-soft bg-surface p-5 ${className}`}>
    <h2 id={id} className="mb-4 text-lg font-bold">
      {title}
    </h2>
    {children}
  </section>
);

const Progress: React.FC<{ value: number; label: string; tone?: 'primary' | 'warning' }> = ({ value, label, tone = 'primary' }) => (
  <div className={`h-2 overflow-hidden rounded-full ${tone === 'warning' ? 'bg-amber-100' : 'bg-peri-100'}`} role="progressbar" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
    <div className={`h-full rounded-full ${tone === 'warning' ? 'bg-warning' : 'bg-primary'}`} style={{ width: `${value}%` }} />
  </div>
);

/** 위젯 A: 가입·카드 현황. 카드 현황은 팀 빌딩 참여 대상(멤버 역할) 기준이다. */
const CardsWidget: React.FC<{ wsId: string; view: DashboardView }> = ({ wsId, view }) => {
  const remind = useRemindCardWriters(wsId);
  const writable = useWritable(wsId);
  const rate = writtenRate(view.cards);
  const { workspace, cards } = view;
  return (
    <Widget id="dsh-cards" title="가입·카드 현황">
      <p className="text-3xl font-bold tabular-nums">
        {workspace.memberCount}
        {workspace.capacity && <span className="text-lg font-semibold text-muted"> / {workspace.capacity}</span>}
        <span className="ml-1 text-base font-semibold text-muted">명 가입</span>
      </p>
      {cards.participants === 0 ? (
        <p className="mt-4 text-sm text-muted">아직 참여 멤버가 없어요. 초대 링크를 공유해 보세요.</p>
      ) : (
        <>
          <div className="mt-5 flex items-baseline justify-between">
            <p className="text-sm font-semibold">PR 카드 작성률</p>
            <p className="text-xl font-bold tabular-nums">{rate}%</p>
          </div>
          <div className="mt-1.5">
            <Progress value={rate} label="PR 카드 작성률" />
          </div>
          <p className="mt-2 text-sm text-muted tabular-nums">
            참여 멤버 {cards.participants}명 중 {cards.written}명 작성 · {cards.notWritten}명 미작성
          </p>
          <Button
            className="mt-4 w-full"
            variant="outline"
            leftIcon={<PaperAirplaneIcon className="h-5 w-5" />}
            disabled={cards.notWritten === 0 || !writable}
            loading={remind.isPending}
            onClick={async () => {
              try {
                const result = await remind.mutateAsync();
                toast.success(`${result.count}명에게 카드 작성 리마인드를 보냈어요.`);
              } catch (error) {
                errorToast(error);
              }
            }}
          >
            {cards.notWritten === 0 ? '모두 카드를 썼어요' : `미작성자 ${cards.notWritten}명에게 리마인드`}
          </Button>
        </>
      )}
    </Widget>
  );
};

/** 위젯 B: 팀 빌딩 현황 */
const TeamBuildingWidget: React.FC<{ wsId: string; view: DashboardView }> = ({ wsId, view }) => {
  const manage = `/ws/${wsId}/team-building/manage`;
  const tb = view.teamBuilding;
  return (
    <Widget id="dsh-tb" title="팀 빌딩 현황">
      {!tb ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">진행 중인 팀 빌딩이 없어요.</p>
          <Link to={manage} className={buttonClassName('primary', 'sm')}>
            세션 만들기
          </Link>
        </div>
      ) : (
        <>
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <Badge tone={tb.status === 'OPEN' ? 'primary' : tb.status === 'RESOLVED' ? 'success' : tb.status === 'CLOSING' ? 'warning' : 'neutral'}>
              {SESSION_STATUS_LABEL[tb.status]}
            </Badge>
            {tb.status === 'OPEN' && <span className="font-bold tabular-nums">{dDayLabel(tb.closesAt)}</span>}
            <span className="text-muted">
              {tb.status === 'DRAFT' ? '마감 예정' : '마감'} {formatDeadline(tb.closesAt)}
            </span>
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-surface-low px-3 py-2.5">
              <dt className="text-xs font-semibold text-muted">배정 완료</dt>
              <dd className="text-2xl font-bold tabular-nums">{tb.assigned}명</dd>
            </div>
            <div className={`rounded-lg px-3 py-2.5 ${tb.unassigned > 0 ? 'bg-amber-50' : 'bg-surface-low'}`}>
              <dt className="text-xs font-semibold text-muted">미배정</dt>
              <dd className={`text-2xl font-bold tabular-nums ${tb.unassigned > 0 ? 'text-warning' : ''}`}>{tb.unassigned}명</dd>
            </div>
          </dl>
          <Link to={manage} className="mt-4 inline-flex min-h-touch items-center gap-1 text-sm font-semibold text-primary underline-offset-4 hover:underline">
            세션 운영으로 이동
            <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
          </Link>
        </>
      )}
    </Widget>
  );
};

/** 위젯 C: 진행도 보드. 13-D1에 따라 팀 내부 내용 대신 완료율과 승인 대기 수만 보여 준다. */
const ProgressWidget: React.FC<{ view: DashboardView }> = ({ view }) => (
  <Widget id="dsh-progress" title="진행도 보드">
    {view.progress.length === 0 ? (
      <p className="text-sm text-muted">아직 결성된 팀이 없어요.</p>
    ) : (
      <ul className="space-y-3">
        {view.progress.map((item) => (
          <li key={item.teamId} className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)_auto] items-center gap-3 text-sm">
            <span className="truncate font-semibold">{item.teamName}</span>
            <span className="flex items-center gap-2">
              <span className="min-w-0 flex-1">
                <Progress value={item.completionRate} label={`${item.teamName} 칸반 완료율`} />
              </span>
              <span className="w-10 text-right font-semibold tabular-nums">{item.completionRate}%</span>
            </span>
            <span className={`text-xs tabular-nums ${item.pendingApprovals > 0 ? 'font-semibold text-warning' : 'text-muted'}`}>
              {item.pendingApprovals > 0 ? `승인 대기 ${item.pendingApprovals}건` : '대기 없음'}
            </span>
          </li>
        ))}
      </ul>
    )}
    {view.approvals.length > 0 && (
      <a href="#dsh-approvals" className="mt-4 inline-flex min-h-touch items-center gap-1 text-sm font-semibold text-primary underline-offset-4 hover:underline">
        승인 큐 처리
        <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
      </a>
    )}
  </Widget>
);

/** 위젯 D: 이상 신호. 차단 이력은 차단 목록으로, 전체에 알릴 일은 워크스페이스 공지 작성으로 잇는다(R16). */
/** 이상 신호. 팀 정체와 차단 이력에 더해 운영진이 처리할 신고 수를 맨 앞에 보인다(17 §2 1차 수신). */
const AlertsWidget: React.FC<{ wsId: string; view: DashboardView; writable: boolean }> = ({ wsId, view, writable }) => {
  const reports = useOpenReportCount(wsId, true).data ?? 0;
  return (
  <Widget id="dsh-alerts" title="이상 신호" className="lg:col-span-2">
    {view.alerts.length === 0 && reports === 0 ? (
      <p className="flex items-center gap-2 text-sm text-success">
        <CheckCircleIcon className="h-5 w-5" aria-hidden="true" />
        모든 팀이 정상적으로 진행 중이에요.
      </p>
    ) : (
      <ul className="grid gap-2 sm:grid-cols-2">
        {reports > 0 && (
          <li className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm">
            <FlagIcon className="mt-0.5 h-5 w-5 shrink-0 text-danger" aria-hidden="true" />
            <span className="min-w-0 flex-1 font-semibold">처리할 신고 {reports}건</span>
            <Link to={`/ws/${wsId}/settings?tab=reports`} className="inline-flex min-h-[1.5rem] shrink-0 items-center text-xs font-semibold text-primary underline-offset-2 hover:underline">
              신고 확인
            </Link>
          </li>
        )}
        {view.alerts.map((alert) =>
          alert.kind === 'INACTIVE_TEAM' ? (
            <li key={`team-${alert.teamId}`} className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-sm">
              <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden="true" />
              <span>
                <span className="font-semibold">{alert.teamName}</span>: {alert.days}일 동안 칸반 갱신이 없어요.
              </span>
            </li>
          ) : (
            <li key={`ban-${alert.account.id}`} className="flex items-start gap-2 rounded-lg bg-surface-low px-3 py-2.5 text-sm">
              <InformationCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-muted" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="font-semibold">{alert.account.name}</span>: 이번 기수 차단 이력 {alert.count}건
              </span>
              <Link to={`/ws/${wsId}/settings?tab=bans`} className="inline-flex min-h-[1.5rem] shrink-0 items-center text-xs font-semibold text-primary underline-offset-2 hover:underline">
                차단 목록
              </Link>
            </li>
          ),
        )}
      </ul>
    )}
    {writable && (
    <Link to={`/ws/${wsId}/announcements?new=1`} className="mt-3 inline-flex min-h-touch items-center gap-1 text-sm font-semibold text-primary underline-offset-4 hover:underline">
      전체 공지 쓰기
      <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
    </Link>
    )}
  </Widget>
  );
};

/** 진행도 승인 큐(13 §4.5). 승인하면 승인자로 지금 로그인한 계정이 기록된다. */
const ApprovalQueue: React.FC<{ wsId: string; view: DashboardView }> = ({ wsId, view }) => {
  const approve = useApprove(wsId);
  const writable = useWritable(wsId);
  const [busyId, setBusyId] = useState<string | null>(null);
  return (
    <section id="dsh-approvals" aria-labelledby="dsh-approvals-heading" className="scroll-mt-20 rounded-card border border-outline-soft bg-surface lg:col-span-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-outline-soft px-5 py-4">
        <h2 id="dsh-approvals-heading" className="text-lg font-bold">
          승인 대기 <span className="text-muted tabular-nums">{view.approvals.length}건</span>
        </h2>
        <p className="text-xs text-muted">승인하면 승인자로 내 이름이 기록돼요.</p>
      </div>
      {view.approvals.length === 0 ? (
        <p className="px-5 py-6 text-center text-sm text-muted">지금 처리할 승인 요청이 없어요.</p>
      ) : (
        <ul className="divide-y divide-outline-soft">
          {view.approvals.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-muted">{item.teamName}</p>
                <p className="font-semibold">{item.taskTitle}</p>
                <p className="text-sm text-muted">
                  요청자 {item.requester.name} · {relativeTime(item.requestedAt)}
                </p>
              </div>
              <div className="flex w-full justify-end gap-2 sm:w-auto">
                <Link to={`/ws/${wsId}/team/${item.teamId}/kanban?task=${item.id}`} className={buttonClassName('outline', 'sm')}>
                  상세 보기
                </Link>
                {writable && (
                <Button
                  size="sm"
                  loading={busyId === item.id}
                  disabled={busyId !== null && busyId !== item.id}
                  onClick={async () => {
                    setBusyId(item.id);
                    try {
                      await approve.mutateAsync(item.id);
                      toast.success(`${josa(item.taskTitle, '을/를')} 승인했어요.`);
                    } catch (error) {
                      errorToast(error);
                    } finally {
                      setBusyId(null);
                    }
                  }}
                >
                  승인
                </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

/**
 * SCR-DSH-01 강사 대시보드(13 §4.4, 목업 instructor-dashboard.html). 개설자·매니저 전용이며
 * 멤버가 주소로 들어오면 403 안내를 보여 준다(02-D2).
 */
export const DashboardScreen: React.FC = () => {
  const { wsId = '' } = useParams<{ wsId: string }>();
  const workspace = useWorkspace(wsId);
  const manager = isManager(workspace.data?.myRole);
  const dashboard = useDashboard(wsId, manager);
  const writable = !workspace.data?.archived;

  if (workspace.isLoading || (manager && dashboard.isLoading)) return <LoadingState className="min-h-[60vh]" label="대시보드를 불러오는 중이에요" />;
  if (workspace.error instanceof DataError && workspace.error.code === 'NOT_FOUND') return <NotFoundScreen />;
  if ((workspace.data && !manager) || (dashboard.error instanceof DataError && dashboard.error.code === 'FORBIDDEN')) return <ForbiddenScreen backTo={`/ws/${wsId}`} />;
  if (workspace.isError || dashboard.isError || !dashboard.data) {
    return (
      <ErrorState
        className="min-h-[60vh]"
        title="대시보드를 불러오지 못했어요"
        description="네트워크 상태를 확인한 뒤 다시 시도해 주세요."
        action={<Button onClick={() => (workspace.isError ? workspace.refetch() : dashboard.refetch())}>다시 시도</Button>}
      />
    );
  }

  const view = dashboard.data;
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold leading-8">강사 대시보드</h1>
        <p className="mt-1 text-sm text-muted">{view.workspace.name}</p>
      </header>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <div className="lg:row-span-2">
          <CardsWidget wsId={wsId} view={view} />
        </div>
        <TeamBuildingWidget wsId={wsId} view={view} />
        <ProgressWidget view={view} />
        <AlertsWidget wsId={wsId} view={view} writable={writable} />
        <ApprovalQueue wsId={wsId} view={view} />
      </div>
    </div>
  );
};

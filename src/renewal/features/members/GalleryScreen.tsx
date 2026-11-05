import React, { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowRightIcon, FunnelIcon, IdentificationIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { ROLES, ROLE_LABEL, WEEKLY_HOURS, WEEKLY_HOURS_LABEL, type Role, type WeeklyHours } from '@/renewal/domain/card';
import type { Member } from '@/renewal/domain/workspace';
import { Button, EmptyState, ErrorState, Skeleton, buttonClassName, fieldClassName } from '@/renewal/ui';
import { useMe, useMembers } from '@/renewal/data/queries';
import { MemberCardTile } from './MemberCardTile';

const PAGE_SIZE = 12;

type Filters = { roles: Role[]; hours?: WeeklyHours; tags: string[] };

/** 필터를 주소 쿼리에 담아 뒤로 가기와 링크 공유가 가능하게 한다. 예) ?role=BACKEND,FRONTEND&hours=H10_20&tags=React */
const readFilters = (params: URLSearchParams): Filters => ({
  roles: (params.get('role')?.split(',') ?? []).filter((value): value is Role => (ROLES as readonly string[]).includes(value)),
  hours: (WEEKLY_HOURS as readonly string[]).includes(params.get('hours') ?? '') ? (params.get('hours') as WeeklyHours) : undefined,
  tags: params.get('tags')?.split(',').filter(Boolean) ?? [],
});

const writeFilters = (filters: Filters) => {
  const params = new URLSearchParams();
  if (filters.roles.length) params.set('role', filters.roles.join(','));
  if (filters.hours) params.set('hours', filters.hours);
  if (filters.tags.length) params.set('tags', filters.tags.join(','));
  return params;
};

/**
 * 필터 조합은 AND로 적용한다(11 §4.4). 같은 필터 안에서 역할은 1·2순위 중 하나라도 고른 역할이면 통과하고,
 * 태그는 고른 태그를 모두 가진 카드만 통과한다.
 */
const matches = (member: Member, filters: Filters) => {
  const { card } = member;
  if (filters.roles.length && !filters.roles.some((role) => role === card.desiredRole1 || role === card.desiredRole2)) return false;
  if (filters.hours && card.weeklyAvailableHours !== filters.hours) return false;
  const tags = card.hashtags.map((tag) => tag.toLowerCase());
  if (filters.tags.some((tag) => !tags.includes(tag.toLowerCase()))) return false;
  return true;
};

const RoleFilter: React.FC<{ value: Role[]; onChange: (value: Role[]) => void }> = ({ value, onChange }) => (
  <fieldset>
    <legend className="mb-2 text-sm font-semibold">역할</legend>
    <div className="flex flex-wrap gap-1.5">
      {ROLES.map((role) => {
        const pressed = value.includes(role);
        return (
          <button
            key={role}
            type="button"
            aria-pressed={pressed}
            onClick={() => onChange(pressed ? value.filter((item) => item !== role) : [...value, role])}
            className={`min-h-[36px] rounded-full border px-3 text-sm font-medium transition-colors ${
              pressed ? 'border-primary bg-primary-container text-on-primary-container' : 'border-outline-soft bg-surface text-ink hover:bg-surface-container'
            }`}
          >
            {ROLE_LABEL[role]}
          </button>
        );
      })}
    </div>
  </fieldset>
);

const TagFilter: React.FC<{ value: string[]; onChange: (value: string[]) => void }> = ({ value, onChange }) => {
  const [draft, setDraft] = useState('');
  const add = () => {
    const tag = draft.trim().replace(/^#/, '');
    if (tag && !value.some((item) => item.toLowerCase() === tag.toLowerCase())) onChange([...value, tag]);
    setDraft('');
  };
  return (
    <div>
      <label htmlFor="gallery-tag" className="mb-2 block text-sm font-semibold">
        태그
      </label>
      <div className="flex flex-wrap items-center gap-1.5">
        {value.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-0.5 rounded-full bg-primary-container py-0.5 pl-2.5 pr-1 text-sm font-medium text-on-primary-container">
            {tag}
            <button
              type="button"
              onClick={() => onChange(value.filter((item) => item !== tag))}
              aria-label={`${tag} 태그 필터 빼기`}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full hover:bg-peri-200"
            >
              <XMarkIcon className="h-4 w-4" aria-hidden="true" />
            </button>
          </span>
        ))}
        <input
          id="gallery-tag"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
              event.preventDefault();
              add();
            }
          }}
          onBlur={add}
          placeholder="태그 입력 후 Enter"
          className={fieldClassName(false, 'min-h-[36px] w-44 py-1.5')}
        />
      </div>
    </div>
  );
};

/**
 * SCR-WS-02 멤버 카드 갤러리(11 §4.4, 목업 card-gallery.html).
 * 공개 카드를 먼저, 미작성 멤버를 흐린 자리 표시로 뒤에 둔다. 비공개 카드는 보이지 않는다(11 §5.2).
 */
export const GalleryScreen: React.FC = () => {
  const { wsId = '' } = useParams<{ wsId: string }>();
  const [params, setParams] = useSearchParams();
  const filters = readFilters(params);
  const me = useMe();
  const members = useMembers(wsId);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const setFilters = (next: Filters) => {
    setParams(writeFilters(next), { replace: true });
    setVisibleCount(PAGE_SIZE);
  };
  const filtering = filters.roles.length > 0 || Boolean(filters.hours) || filters.tags.length > 0;

  const { list, total, publicCount, myState } = useMemo(() => {
    const all = members.data ?? [];
    const myId = me.data?.id;
    const mine = all.find((member) => member.account.id === myId);
    const publicCards = all.filter((member) => member.cardState === 'PUBLIC');
    const notWritten = all.filter((member) => member.cardState === 'NOT_WRITTEN' && member.account.id !== myId);
    const shown = filtering ? publicCards.filter((member) => matches(member, filters)) : [...publicCards, ...notWritten];
    return { list: shown, total: all.length, publicCount: publicCards.length, myState: mine?.cardState };
  }, [members.data, me.data?.id, filtering, filters]);

  const filterPanel = (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,0.6fr)_minmax(0,1fr)]">
      <RoleFilter value={filters.roles} onChange={(roles) => setFilters({ ...filters, roles })} />
      <div>
        <label htmlFor="gallery-hours" className="mb-2 block text-sm font-semibold">
          주간 가용 시간
        </label>
        <select
          id="gallery-hours"
          value={filters.hours ?? ''}
          onChange={(event) => setFilters({ ...filters, hours: (event.target.value || undefined) as WeeklyHours | undefined })}
          className={fieldClassName(false, 'min-h-[36px] appearance-auto py-1.5')}
        >
          <option value="">전체</option>
          {WEEKLY_HOURS.map((hours) => (
            <option key={hours} value={hours}>
              {WEEKLY_HOURS_LABEL[hours]}
            </option>
          ))}
        </select>
      </div>
      <TagFilter value={filters.tags} onChange={(tags) => setFilters({ ...filters, tags })} />
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold leading-8">멤버 카드</h1>
          {members.data && (
            <p className="mt-0.5 text-sm text-muted tabular-nums">
              전체 {total}명 · 카드 공개 {publicCount}명
            </p>
          )}
        </div>
        <Link to="/me/card" className={buttonClassName('outline')}>
          내 카드 편집
          <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
        </Link>
      </header>

      {myState && myState !== 'PUBLIC' && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-card border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
          <p className="text-warning">
            {myState === 'PRIVATE' ? '내 카드는 비공개라 다른 멤버에게 보이지 않아요.' : '내 카드가 아직 없어서 다른 멤버에게 보이지 않아요.'}
          </p>
          <Link to={myState === 'PRIVATE' ? '/me/card' : `/ws/${wsId}/onboarding`} className="inline-flex min-h-touch items-center font-semibold text-ink underline underline-offset-4">
            {myState === 'PRIVATE' ? '공개 설정 바꾸기' : '카드 만들기'}
          </Link>
        </div>
      )}

      <section aria-label="필터" className="mt-5 rounded-card border border-outline-soft bg-surface p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3 lg:hidden">
          <button
            type="button"
            aria-expanded={filtersOpen}
            aria-controls="gallery-filters"
            onClick={() => setFiltersOpen((value) => !value)}
            className="inline-flex min-h-touch items-center gap-2 text-sm font-semibold"
          >
            <FunnelIcon className="h-5 w-5" aria-hidden="true" />
            필터{filtering ? ' 적용 중' : ''}
          </button>
        </div>
        <div id="gallery-filters" className={`${filtersOpen ? 'mt-4' : 'hidden'} lg:mt-0 lg:block`}>
          {filterPanel}
        </div>
        {filtering && (
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-outline-soft pt-3 text-sm">
            <p className="text-muted" role="status">
              조건에 맞는 카드 {list.length}장
            </p>
            <button type="button" onClick={() => setFilters({ roles: [], tags: [] })} className="min-h-touch font-semibold text-primary underline-offset-4 hover:underline">
              필터 초기화
            </button>
          </div>
        )}
      </section>

      <div className="mt-6">
        {members.isLoading && (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-label="멤버 카드를 불러오는 중">
            {Array.from({ length: 8 }).map((_, index) => (
              <li key={index} className="flex flex-col items-center gap-2 rounded-card border border-outline-soft bg-surface p-5">
                <Skeleton className="h-14 w-14 rounded-full" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-28" />
              </li>
            ))}
          </ul>
        )}
        {members.isError && (
          <ErrorState
            title="멤버 카드를 불러오지 못했어요"
            description="네트워크 상태를 확인한 뒤 다시 시도해 주세요."
            action={<Button onClick={() => members.refetch()}>다시 시도</Button>}
          />
        )}
        {members.data &&
          (list.length === 0 ? (
            filtering ? (
              <EmptyState
                icon={<FunnelIcon className="h-7 w-7" />}
                title="조건에 맞는 멤버가 없어요"
                description="필터를 바꿔 보세요."
                action={
                  <Button variant="outline" onClick={() => setFilters({ roles: [], tags: [] })}>
                    필터 초기화
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={<IdentificationIcon className="h-7 w-7" />}
                title="아직 카드를 작성한 멤버가 없어요"
                description="온보딩을 시작해 첫 카드를 만들어 보세요."
                action={
                  <Link to={`/ws/${wsId}/onboarding`} className={buttonClassName('primary')}>
                    카드 만들기
                  </Link>
                }
              />
            )
          ) : (
            <>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {list.slice(0, visibleCount).map((member) => (
                  <li key={member.account.id}>
                    <MemberCardTile member={member} to={`/ws/${wsId}/members/${member.account.id}`} isMe={member.account.id === me.data?.id} />
                  </li>
                ))}
              </ul>
              {list.length > visibleCount && (
                <div className="mt-6 flex justify-center">
                  <Button variant="outline" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>
                    더 보기 ({list.length - visibleCount}명 더)
                  </Button>
                </div>
              )}
            </>
          ))}
      </div>
    </div>
  );
};

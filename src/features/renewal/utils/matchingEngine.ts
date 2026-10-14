import {
  MatchBreakdown,
  MemberPRCardProfile,
  TeamRecruitment,
  ROLE_META,
  TIME_SLOT_META,
  WORKSTYLE_META,
} from '../types/renewal';

/**
 * Explainable Rule-Based Matching v1 (Spec 12-team-building.md §5.3)
 * - 역할 상보성: max 40 (팀의 미충원 모집 역할 ∩ 후보의 희망 역할: 1순위 40점, 2순위 22점)
 * - 가용 시간 겹침: max 25 (주간 시간대 슬롯 교집합 + 주간 시간 유사도)
 * - 목표 온도 근접: max 20 (5 - |후보 온도 - 팀 목표 온도| 비례)
 * - 협업 스타일: max 15 (선호 태그 교집합 가점, 후보 피함 ∩ 팀 선호 충돌 감점)
 * - MBTI: 가중치 0 (계산 미반영, 카드 장식만)
 */
export function calculateMemberToTeamMatch(
  candidate: MemberPRCardProfile,
  team: TeamRecruitment
): MatchBreakdown {
  const reasonsWithWeight: { text: string; weight: number }[] = [];

  // 1. 역할 상보성 (max 40)
  let roleScore = 0;
  const openRoles = team.recruitRoles.filter((r) => r.filledCount < r.totalCount);
  if (candidate.desiredRole1 && openRoles.some((r) => r.role === candidate.desiredRole1)) {
    roleScore = 40;
    const roleLabel = ROLE_META[candidate.desiredRole1]?.label || candidate.desiredRole1;
    reasonsWithWeight.push({
      text: `${roleLabel} 1순위 희망 — 팀 모집 포지션 정확히 일치`,
      weight: 40,
    });
  } else if (candidate.desiredRole2 && openRoles.some((r) => r.role === candidate.desiredRole2)) {
    roleScore = 24;
    const roleLabel = ROLE_META[candidate.desiredRole2]?.label || candidate.desiredRole2;
    reasonsWithWeight.push({
      text: `${roleLabel} 2순위 희망 — 팀 부족 포지션 보완 가능`,
      weight: 24,
    });
  } else if (candidate.desiredRole1 === 'FULLSTACK' && openRoles.length > 0) {
    roleScore = 28;
    reasonsWithWeight.push({
      text: '풀스택 희망 — 모집 중인 개발 포지션 유연 투입 가능',
      weight: 28,
    });
  } else {
    roleScore = 8;
  }

  // 2. 가용 시간 겹침 (max 25)
  let timeScore = 0;
  const candidateSlots = candidate.availableTimeSlots || [];
  const overlappingSlots = team.commonTimeSlots.filter((slot) => candidateSlots.includes(slot));
  if (team.commonTimeSlots.length > 0) {
    const ratio = overlappingSlots.length / team.commonTimeSlots.length;
    timeScore = Math.round(ratio * 18);
  } else {
    timeScore = 12;
  }
  if (candidate.weeklyAvailableHours && candidate.weeklyAvailableHours === team.weeklyHours) {
    timeScore = Math.min(25, timeScore + 7);
  } else if (candidate.weeklyAvailableHours) {
    timeScore = Math.min(25, timeScore + 4);
  }

  if (overlappingSlots.length > 0) {
    const slotNames = overlappingSlots.map((s) => TIME_SLOT_META[s]?.label || s).join('·');
    reasonsWithWeight.push({
      text: `선호 시간대(${slotNames}) ${overlappingSlots.length}개 구간 일치`,
      weight: timeScore,
    });
  }

  // 3. 목표 온도 근접 (max 20)
  const candTemp = candidate.goalTemperature || 3;
  const teamTemp = team.goalTemperature || 3;
  const diff = Math.abs(candTemp - teamTemp);
  const tempScore = Math.max(4, 20 - diff * 5);
  if (diff <= 1) {
    const tempWord = teamTemp >= 4 ? '수상·고완성도 지향' : teamTemp <= 2 ? '안정적 완주 지향' : '균형 잡힌 완성';
    reasonsWithWeight.push({
      text: `목표 온도 근접 (${tempWord}, ${candTemp}/5 ↔ 팀 ${teamTemp}/5)`,
      weight: tempScore,
    });
  }

  // 4. 협업 스타일 (max 15)
  const candPrefer = candidate.preferWorkstyleOptions || [];
  const candDislike = candidate.dislikeWorkstyleOptions || [];
  const teamPrefer = team.preferWorkstyles || [];

  const matchedStyles = teamPrefer.filter((s) => candPrefer.includes(s));
  const conflictStyles = teamPrefer.filter((s) => candDislike.includes(s));

  let styleScore = Math.min(15, 6 + matchedStyles.length * 5 - conflictStyles.length * 4);
  styleScore = Math.max(0, styleScore);

  if (matchedStyles.length > 0) {
    const styleNames = matchedStyles.map((s) => WORKSTYLE_META[s]?.label || s).join(', ');
    reasonsWithWeight.push({
      text: `협업 스타일 일치 (${styleNames})`,
      weight: styleScore,
    });
  }

  const totalScore = Math.min(100, Math.max(15, roleScore + timeScore + tempScore + styleScore));

  let stars: 1 | 2 | 3 | 4 | 5 = 3;
  if (totalScore >= 82) stars = 5;
  else if (totalScore >= 68) stars = 4;
  else if (totalScore >= 50) stars = 3;
  else if (totalScore >= 35) stars = 2;
  else stars = 1;

  const sortedReasons = reasonsWithWeight
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 2)
    .map((r) => r.text);

  if (sortedReasons.length === 0) {
    sortedReasons.push('기본 협업 시간대 및 워크스페이스 조건 부합');
  }

  return {
    roleScore,
    timeScore,
    tempScore,
    styleScore,
    totalScore,
    stars,
    reasons: sortedReasons,
  };
}

export function calculateMemberToMemberMatch(
  me: MemberPRCardProfile,
  other: MemberPRCardProfile
): MatchBreakdown {
  const virtualTeam: TeamRecruitment = {
    id: 'virtual',
    workspaceId: 'ws-1',
    sessionId: 'ses-1',
    name: me.name,
    intro: '',
    goalTemperature: me.goalTemperature || 3,
    commonTimeSlots: me.availableTimeSlots || ['AFTERNOON', 'EVENING'],
    weeklyHours: me.weeklyAvailableHours || 'H20_30',
    preferWorkstyles: me.preferWorkstyleOptions || ['ASYNC_FIRST', 'STRUCTURED'],
    leaderId: me.id,
    leaderName: me.name,
    memberIds: [me.id],
    // Complementary roles: roles different from my primary role
    recruitRoles: (['BACKEND', 'FRONTEND', 'FULLSTACK', 'PM', 'DESIGN', 'INFRA', 'AI_DATA'] as const)
      .filter((r) => r !== me.desiredRole1)
      .map((r) => ({ role: r, totalCount: 1, filledCount: 0, pendingApplyCount: 0 })),
    status: 'RECRUITING',
    createdAt: new Date().toISOString(),
  };

  return calculateMemberToTeamMatch(other, virtualTeam);
}

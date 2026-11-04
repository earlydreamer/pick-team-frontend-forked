import { describe, expect, it } from 'vitest';
import { josa } from './josa';

describe('josa', () => {
  it('받침에 따라 조사를 고른다', () => {
    expect(josa('알파팀', '을/를')).toBe('알파팀을');
    expect(josa('알파 스쿼드', '을/를')).toBe('알파 스쿼드를');
    expect(josa('달빛', '은/는')).toBe('달빛은');
    expect(josa('새 스터디', '은/는')).toBe('새 스터디는');
  });

  it('한글이 아니면 둘 다 쓴다', () => {
    expect(josa('Team A', '을/를')).toBe('Team A을(를)');
    expect(josa('API 2', '은/는')).toBe('API 2은(는)');
  });
});

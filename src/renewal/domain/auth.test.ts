import { describe, expect, it } from 'vitest';
import { isPasswordValid, safeRedirect, validateName, validateWorkspacePassword } from './auth';

describe('safeRedirect', () => {
  it('앱 안의 경로만 허용한다', () => {
    expect(safeRedirect('/ws/ws-1/members?role=BACKEND')).toBe('/ws/ws-1/members?role=BACKEND');
    expect(safeRedirect('https://evil.example')).toBeNull();
    expect(safeRedirect('//evil.example')).toBeNull();
    expect(safeRedirect('/\\evil.example')).toBeNull();
    expect(safeRedirect('')).toBeNull();
    expect(safeRedirect(null)).toBeNull();
  });

  it('인증 화면으로 되돌아가는 주소는 거절한다', () => {
    expect(safeRedirect('/login')).toBeNull();
    expect(safeRedirect('/signup?redirect=/ws')).toBeNull();
    expect(safeRedirect('/oauth/callback')).toBeNull();
    expect(safeRedirect('/loginhelp')).toBe('/loginhelp');
  });
});

describe('비밀번호 규칙', () => {
  it('가입 규칙은 대문자·소문자·숫자·특수문자를 모두 요구한다', () => {
    expect(isPasswordValid('Pickteam1!', 'signup')).toBe(true);
    expect(isPasswordValid('pickteam1!', 'signup')).toBe(false);
    expect(isPasswordValid('Pick1!', 'signup')).toBe(false);
  });

  it('재설정 규칙은 허용 문자 밖의 특수문자를 거절한다', () => {
    expect(isPasswordValid('pickteam1!', 'reset')).toBe(true);
    expect(isPasswordValid('pickteam1#', 'reset')).toBe(false);
  });
});

describe('입력 검증', () => {
  it('이름은 2~50자의 한글·영문·숫자·공백이다', () => {
    expect(validateName('김수강')).toBeUndefined();
    expect(validateName('김')).toBeDefined();
    expect(validateName('김수강!')).toBeDefined();
  });

  it('워크스페이스 비밀번호는 비워 두거나 4자 이상이다', () => {
    expect(validateWorkspacePassword('')).toBeUndefined();
    expect(validateWorkspacePassword('abc')).toBeDefined();
    expect(validateWorkspacePassword('abcd')).toBeUndefined();
  });
});

describe('extractInviteCode', () => {
  it('코드나 링크에서 초대 코드를 꺼낸다', async () => {
    const { extractInviteCode } = await import('./auth');
    expect(extractInviteCode(' SUMMER26 ')).toBe('SUMMER26');
    expect(extractInviteCode('https://pickteam.example/invite/SUMMER26?utm=x')).toBe('SUMMER26');
    expect(extractInviteCode('/invite/%E0%A4%A')).toBe('%E0%A4%A');
  });
});

/**
 * 한국어 조사 고르기. 사용자가 정한 이름(팀, 워크스페이스, 태스크) 뒤에 붙는 조사를 받침에 맞춘다.
 * 마지막 글자가 한글이 아니면(영문, 숫자 등) 받침을 알 수 없어 "을(를)"처럼 둘 다 쓴다.
 */
type Pair = '을/를' | '은/는' | '이/가' | '과/와';

const finalConsonant = (word: string): boolean | undefined => {
  const last = word.trim().slice(-1);
  const code = last.charCodeAt(0) - 0xac00;
  if (Number.isNaN(code) || code < 0 || code > 11171) return undefined;
  return code % 28 !== 0;
};

export const josa = (word: string, pair: Pair) => {
  const [withBatchim, withoutBatchim] = pair.split('/');
  const batchim = finalConsonant(word);
  if (batchim === undefined) return `${word}${withBatchim}(${withoutBatchim})`;
  return `${word}${batchim ? withBatchim : withoutBatchim}`;
};

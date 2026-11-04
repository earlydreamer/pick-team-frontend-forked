import type { DataSource } from './ports';
import { mockDataSource } from './mock/adapters';

/**
 * 화면이 쓰는 데이터 소스. 백엔드 리뉴얼 API가 생기면 http 어댑터를 추가하고 VITE_DATA_SOURCE로 고른다.
 * 지금은 목 어댑터만 있다.
 */
export const data: DataSource = mockDataSource;

export { DataError } from './ports';
export type { DataSource } from './ports';

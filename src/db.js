// Cloud SQL (PostgreSQL) 접속 계층
//
// Cloud Run → Cloud SQL 연결은 유닉스 소켓(/cloudsql/<연결이름>)을 씁니다.
// 로컬 개발은 일반 TCP(host/port)로 붙습니다. 둘 다 환경변수로 제어합니다.
//
//   INSTANCE_CONNECTION_NAME  프로젝트:리전:인스턴스   (Cloud Run에서 사용)
//   DB_HOST / DB_PORT                                  (로컬에서 사용)
//   DB_NAME / DB_USER / DB_PASSWORD
import pg from 'pg';

const {
  INSTANCE_CONNECTION_NAME,
  DB_HOST = '127.0.0.1',
  DB_PORT = '5432',
  DB_NAME = 'tamrapass',
  DB_USER = 'postgres',
  DB_PASSWORD = '',
} = process.env;

export const pool = new pg.Pool(
  INSTANCE_CONNECTION_NAME
    ? { host: `/cloudsql/${INSTANCE_CONNECTION_NAME}`, database: DB_NAME, user: DB_USER, password: DB_PASSWORD, max: 5 }
    : { host: DB_HOST, port: +DB_PORT, database: DB_NAME, user: DB_USER, password: DB_PASSWORD, max: 5 }
);

// SQLite 스타일의 ? 자리표시자를 Postgres의 $1, $2 로 변환.
// (기존 쿼리를 최소 수정으로 옮기기 위한 장치)
const toPg = sql => { let i = 0; return sql.replace(/\?/g, () => `$${++i}`); };

/** 여러 행 조회 */
export const q = async (sql, ...params) => (await pool.query(toPg(sql), params)).rows;

/** 한 행 조회 (없으면 undefined) */
export const q1 = async (sql, ...params) => (await q(sql, ...params))[0];

/** 실행만 (INSERT/UPDATE/DELETE) */
export const exec = async (sql, ...params) => { await pool.query(toPg(sql), params); };

/** 연결 확인 — 시작 시 한 번 호출해 실패를 빨리 드러냅니다 */
export async function ping() {
  const r = await q1('SELECT 1 AS ok');
  return !!r?.ok;
}

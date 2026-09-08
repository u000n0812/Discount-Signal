import { cookies } from "next/headers";
import { USER_ID_COOKIE } from "@/lib/constants";

/**
 * proxy.ts가 모든 요청에 쿠키를 보장하므로, 여기서 값이 없다는 건
 * 첫 방문이 아니라 프록시가 돌지 않았다는 뜻이다.
 */
export async function getUserId(): Promise<string | null> {
  const store = await cookies();
  return store.get(USER_ID_COOKIE)?.value ?? null;
}

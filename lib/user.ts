import { cookies } from 'next/headers';
import { randomUUID } from 'crypto';

const USER_ID_COOKIE = 'nexum_user_id';

export async function getUserId(): Promise<{
  userId: string;
  isNew: boolean;
}> {
  const cookieStore = await cookies();

  const existingUserId = cookieStore.get(USER_ID_COOKIE)?.value;

  if (existingUserId) {
    return {
      userId: existingUserId,
      isNew: false,
    };
  }

  return {
    userId: randomUUID(),
    isNew: true,
  };
}

export function setUserIdCookie(
  response: Response,
  userId: string,
) {
  response.headers.append(
    'Set-Cookie',
    `${USER_ID_COOKIE}=${userId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`,
  );
}
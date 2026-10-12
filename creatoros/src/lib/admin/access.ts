export function isPlatformAdmin(email: string): boolean {
  const admins = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (admins.length === 0) return false;
  return admins.includes(email.toLowerCase());
}

/**
 * Platform-admin access requires both an allow-listed email and a proven
 * mailbox. The email half alone is a claim anyone can make at signup; requiring
 * `emailVerified` (set by the verification link) means the requester proved
 * control of the allow-listed inbox first (D-15).
 */
export function isVerifiedPlatformAdmin(user: { email: string; emailVerified: boolean }): boolean {
  return user.emailVerified && isPlatformAdmin(user.email);
}

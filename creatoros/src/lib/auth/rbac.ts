export type Role = "owner" | "admin" | "editor" | "viewer";

export const ROLE_RANK: Record<Role, number> = {
  viewer: 0,
  editor: 1,
  admin: 2,
  owner: 3,
};

export type Permission =
  | "bio:read"
  | "bio:write"
  | "booking:read"
  | "booking:write"
  | "leads:read"
  | "leads:write"
  | "analytics:read"
  | "analytics:write"
  | "coach:read"
  | "email:read"
  | "email:write"
  | "store:read"
  | "store:write"
  | "courses:read"
  | "courses:write"
  | "billing:read"
  | "billing:write"
  | "community:read"
  | "community:write"
  | "settings:read"
  | "settings:write";

const PERMISSIONS: Record<Role, Permission[]> = {
  viewer: ["bio:read", "booking:read", "leads:read", "analytics:read", "email:read", "store:read", "courses:read", "community:read"],
  editor: ["bio:read", "bio:write", "booking:read", "booking:write", "leads:read", "leads:write", "analytics:read", "analytics:write", "email:read", "email:write", "store:read", "store:write", "courses:read", "courses:write", "community:read", "community:write"],
  admin: ["bio:read", "bio:write", "booking:read", "booking:write", "leads:read", "leads:write", "analytics:read", "analytics:write", "coach:read", "email:read", "email:write", "store:read", "store:write", "courses:read", "courses:write", "community:read", "community:write", "settings:read", "settings:write"],
  owner: ["bio:read", "bio:write", "booking:read", "booking:write", "leads:read", "leads:write", "analytics:read", "analytics:write", "coach:read", "email:read", "email:write", "store:read", "store:write", "courses:read", "courses:write", "billing:read", "billing:write", "community:read", "community:write", "settings:read", "settings:write"],
};

export function can(role: Role, perm: Permission): boolean {
  return PERMISSIONS[role]?.includes(perm) ?? false;
}
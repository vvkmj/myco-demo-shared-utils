/**
 * Represents a user record returned from the database.
 * Consumed by myco-demo-api-service in src/routes/users.ts
 */
export interface UserRecord {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  createdAt: Date;
}

/**
 * RENAMED from formatUser -> formatUserDisplay (BREAKING CHANGE)
 * myco-demo-api-service still imports `formatUser` — this will break its build.
 */
export function formatUserDisplay(user: UserRecord): string {
  return `[User] ${user.firstName} ${user.lastName} <${user.email}>`;
}

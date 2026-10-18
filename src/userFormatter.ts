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
 * Formats a raw UserRecord into a display-friendly string.
 * Signature: formatUser(user: UserRecord): string
 *
 * WARNING: myco-demo-api-service imports this with exactly this signature.
 * Changing the parameter name or type is a breaking change.
 */
export function formatUser(user: UserRecord): string {
  return `${user.firstName} ${user.lastName} <${user.email}>`;
}

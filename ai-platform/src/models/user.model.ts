import { query, queryOne } from '../db/postgres';

export interface User {
  id: string;
  firebase_uid: string;
  email: string;
  plan: string;
  created_at: Date;
  updated_at: Date;
}

export async function upsertUser(firebaseUid: string, email: string): Promise<User> {
  const [user] = await query<User>(
    `INSERT INTO users (firebase_uid, email)
     VALUES ($1, $2)
     ON CONFLICT (firebase_uid)
     DO UPDATE SET email = EXCLUDED.email, updated_at = NOW()
     RETURNING *`,
    [firebaseUid, email]
  );
  return user;
}

export function getUserByFirebaseUid(uid: string): Promise<User | null> {
  return queryOne<User>('SELECT * FROM users WHERE firebase_uid = $1', [uid]);
}

export function getUserById(id: string): Promise<User | null> {
  return queryOne<User>('SELECT * FROM users WHERE id = $1', [id]);
}

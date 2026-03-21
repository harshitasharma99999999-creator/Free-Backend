export interface User {
    id: string;
    firebase_uid: string;
    email: string;
    plan: string;
    created_at: Date;
    updated_at: Date;
}
export declare function upsertUser(firebaseUid: string, email: string): Promise<User>;
export declare function getUserByFirebaseUid(uid: string): Promise<User | null>;
export declare function getUserById(id: string): Promise<User | null>;

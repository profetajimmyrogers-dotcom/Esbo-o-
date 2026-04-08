export interface Sermon {
  id?: string;
  userId: string;
  tema: string;
  texto: string;
  agr: string;
  img: string;
  intro: string;
  pontos: string[];
  setores?: string[];
  apl: string;
  highlights?: Record<string, string>;
  createdAt?: any;
  updatedAt?: any;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role?: string;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

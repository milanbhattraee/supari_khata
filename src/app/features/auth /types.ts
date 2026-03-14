export interface AuthUser {
  _id: string;
  username: string;
  email: string | null;
}

export interface AuthResponse {
  user: AuthUser;
}

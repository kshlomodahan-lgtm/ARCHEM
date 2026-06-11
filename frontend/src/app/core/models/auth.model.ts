export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginUser {
  userId:   number;
  fullName: string;
  role:     string;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  token:   string;
  user:    LoginUser;
  theme?:  { colorScheme: string; darkMode: boolean };
}

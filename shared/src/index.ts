export type HealthResponse = {
  status: 'ok';
  timestamp: string;
};

export type Teacher = {
  id: string;
  email: string;
  createdAt: string;
  updatedAt: string;
};

export type SignupRequest = {
  email: string;
  password: string;
};

export type LoginRequest = SignupRequest;

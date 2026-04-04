export interface LoginDto {
  email: string;
  password: string;
}

export interface LoginValidationResult {
  ok: boolean;
  errors: string[];
}

export function validateLoginDto(input: Partial<LoginDto> | null | undefined): LoginValidationResult {
  const errors: string[] = [];

  if (!input?.email || !input.email.trim()) {
    errors.push('Email is required.');
  }

  if (!input?.password || !input.password.trim()) {
    errors.push('Password is required.');
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

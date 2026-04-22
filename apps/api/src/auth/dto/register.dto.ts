export interface RegisterDto {
  email: string;
  password: string;
  fullName?: string;
}

export interface RegisterValidationResult {
  ok: boolean;
  errors: string[];
}

export function validateRegisterDto(input: Partial<RegisterDto> | null | undefined): RegisterValidationResult {
  const errors: string[] = [];
  const email = input?.email?.trim() ?? '';
  const password = input?.password?.trim() ?? '';
  const fullName = input?.fullName?.trim() ?? '';

  if (!email) {
    errors.push('Email is required.');
  } else if (!email.includes('@')) {
    errors.push('Email must be valid.');
  }

  if (!password) {
    errors.push('Password is required.');
  } else if (password.length < 6) {
    errors.push('Password must be at least 6 characters.');
  }

  if (fullName && fullName.length < 2) {
    errors.push('Full name must be at least 2 characters when provided.');
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

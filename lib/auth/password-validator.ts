export interface ValidationResult {
  valid: boolean
  errors: string[]
}

export function validatePassword(password: string): ValidationResult {
  const errors: string[] = []

  if (password.length < 8) {
    errors.push('密码至少需要 8 个字符')
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('密码必须包含至少一个大写字母')
  }

  if (!/[a-z]/.test(password)) {
    errors.push('密码必须包含至少一个小写字母')
  }

  if (!/[0-9]/.test(password)) {
    errors.push('密码必须包含至少一个数字')
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('密码必须包含至少一个特殊字符')
  }

  // 检查常见弱密码
  const commonPasswords = ['password', '12345678', 'qwerty', 'abc123']
  if (commonPasswords.some((common) => password.toLowerCase().includes(common))) {
    errors.push('密码过于简单')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

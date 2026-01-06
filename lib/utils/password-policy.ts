/**
 * Password Policy Service
 * 
 * Migrated from AngularJS passwordPolicyService
 * Exact 1:1 match of logic
 */

export interface PasswordPolicy {
  password_min_length: number;
  password_complexity: number;
}

export interface PasswordConstraint {
  constraint: string;
  fulfilled: boolean;
}

const passwordComplexityConstraints = {
  upper: {
    bitmap: 1,
    regex: /[A-Z]/,
    error_message: 'have at least one uppercase letter (A - Z)'
  },
  digit: {
    bitmap: 4,
    regex: /[0-9]/,
    error_message: 'have at least one digit (i.e 0 - 9)'
  },
  punct: {
    bitmap: 8,
    regex: /[^A-Za-z0-9 ]/,
    error_message: 'have at least one special character (e.g & # %)'
  }
};

let adminDefinedPasswordPolicy: PasswordPolicy | null = null;

export function setAdminDefinedPasswordPolicy(passwordPolicy: PasswordPolicy | null) {
  if (passwordPolicy != null) {
    adminDefinedPasswordPolicy = passwordPolicy;
  }
}

export function getAdminDefinedPasswordPolicy(): PasswordPolicy | null {
  return adminDefinedPasswordPolicy;
}

export function classifyFulfilledAndUnfulfilledConstraintsByPassword(
  password: string
): PasswordConstraint[] {
  if (adminDefinedPasswordPolicy == null) {
    return [];
  }

  const data: PasswordConstraint[] = [];

  data.push({
    constraint: `be at least ${adminDefinedPasswordPolicy.password_min_length} characters long`,
    fulfilled: password.length >= adminDefinedPasswordPolicy.password_min_length
  });

  const constraints = passwordComplexityConstraints;
  for (const constraintName in constraints) {
    if (constraints.hasOwnProperty(constraintName)) {
      const constraint = constraints[constraintName as keyof typeof constraints];
      // If a constraint is part of the password policy provided, check
      // if the provided password satisfies it too.
      if ((constraint.bitmap & adminDefinedPasswordPolicy.password_complexity) === constraint.bitmap) {
        data.push({
          constraint: constraint.error_message,
          fulfilled: constraint.regex.test(password)
        });
      }
    }
  }

  return data;
}

export function checkIfAllConstraintsAreMet(password: string): boolean {
  const constraints = classifyFulfilledAndUnfulfilledConstraintsByPassword(password);
  let flag = true;
  constraints.forEach((value) => {
    if (value.fulfilled === false) {
      flag = false;
      return false;
    }
  });
  return flag;
}

export function getPasswordComplexityConstraintsBitMap() {
  return passwordComplexityConstraints;
}

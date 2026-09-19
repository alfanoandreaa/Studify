export function passwordRequirements(password: string) {
  return [
    { label: "Almeno 12 caratteri", valid: password.length >= 12 },
    { label: "Una maiuscola e una minuscola", valid: /[A-Z]/.test(password) && /[a-z]/.test(password) },
    { label: "Almeno un numero", valid: /[0-9]/.test(password) },
    { label: "Almeno un simbolo (es. !, ?, @)", valid: /[^\p{L}\p{N}\s]/u.test(password) },
  ];
}
export function validNewPassword(password: string) {
  return passwordRequirements(password).every((rule) => rule.valid);
}

const SCHEMA_ERROR_CODES = new Set(["P2021", "P2022"])
const AVAILABILITY_ERROR_CODES = new Set([
  "P1000",
  "P1001",
  "P1002",
  "P1008",
  "P1017",
  "P2024",
])

export function getPrismaErrorCode(error: unknown): string | null {
  if (
    typeof error === "object"
    && error !== null
    && "code" in error
    && typeof error.code === "string"
  ) {
    return error.code
  }
  return null
}

export function isPrismaSchemaUnavailable(error: unknown): boolean {
  const code = getPrismaErrorCode(error)
  return code !== null && SCHEMA_ERROR_CODES.has(code)
}

export function isPrismaTemporarilyUnavailable(error: unknown): boolean {
  const code = getPrismaErrorCode(error)
  return code !== null && AVAILABILITY_ERROR_CODES.has(code)
}

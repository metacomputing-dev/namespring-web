import { ApiHttpError } from "../api/_lib/http.js";
import { provisionAuthRoleV1 } from "../api/_lib/auth-role-provisioning.js";
import type {
  AuthRoleProvisioningOperationV1,
  AuthRoleProvisioningRoleV1,
} from "../api/_lib/auth-role-provisioning-contract.js";

const HELP = `Trusted NameSpring role provisioning

Dry-run (default):
  npm run auth:role -- --request-id <role_request_v1_...> --target-firebase-uid <uid> --operator-ref <ref> --operation <grant|revoke> --role <admin|premium_admin|premium_system>

Apply after reviewing the dry-run receipt:
  npm run auth:role -- <same arguments> --confirm APPLY

premium_system is revoke-only. Raw target/operator values are never printed.`;

interface ParsedCliV1 {
  readonly requestId: string;
  readonly targetFirebaseUid: string;
  readonly operatorRef: string;
  readonly operation: AuthRoleProvisioningOperationV1;
  readonly role: AuthRoleProvisioningRoleV1;
  readonly confirmed: boolean;
}

function parsePairs(argv: readonly string[]): Readonly<Record<string, string>> {
  const result: Record<string, string> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") return { help: "true" };
    if (!argument.startsWith("--")) throw new ApiHttpError(400, "ROLE_PROVISIONING_CLI_INVALID", "CLI arguments are invalid.");
    const equals = argument.indexOf("=");
    const name = equals >= 0 ? argument.slice(2, equals) : argument.slice(2);
    const value = equals >= 0 ? argument.slice(equals + 1) : argv[++index];
    if (!name || value === undefined || value.startsWith("--") || Object.hasOwn(result, name)) {
      throw new ApiHttpError(400, "ROLE_PROVISIONING_CLI_INVALID", "CLI arguments are invalid.");
    }
    result[name] = value;
  }
  return result;
}

function requireValue(values: Readonly<Record<string, string>>, name: string, environmentName?: string): string {
  const value = values[name] ?? (environmentName ? process.env[environmentName] : undefined);
  if (!value) throw new ApiHttpError(400, "ROLE_PROVISIONING_CLI_MISSING", `Missing --${name}.`);
  return value;
}

function parseCli(argv: readonly string[]): ParsedCliV1 | "help" {
  const values = parsePairs(argv);
  if (values.help === "true") return "help";
  const allowed = new Set(["request-id", "target-firebase-uid", "operator-ref", "operation", "role", "confirm"]);
  if (Object.keys(values).some((name) => !allowed.has(name))) {
    throw new ApiHttpError(400, "ROLE_PROVISIONING_CLI_INVALID", "CLI arguments are invalid.");
  }
  if (values.confirm !== undefined && values.confirm !== "APPLY") {
    throw new ApiHttpError(400, "ROLE_PROVISIONING_CONFIRMATION_INVALID", "Mutation confirmation must be exactly APPLY.");
  }
  return {
    requestId: requireValue(values, "request-id", "AUTH_ROLE_PROVISIONING_REQUEST_ID"),
    targetFirebaseUid: requireValue(
      values,
      "target-firebase-uid",
      "AUTH_ROLE_PROVISIONING_TARGET_FIREBASE_UID",
    ),
    operatorRef: requireValue(values, "operator-ref", "AUTH_ROLE_PROVISIONING_OPERATOR_REF"),
    operation: requireValue(values, "operation") as AuthRoleProvisioningOperationV1,
    role: requireValue(values, "role") as AuthRoleProvisioningRoleV1,
    confirmed: values.confirm === "APPLY",
  };
}

async function main(): Promise<void> {
  const parsed = parseCli(process.argv.slice(2));
  if (parsed === "help") {
    process.stdout.write(`${HELP}\n`);
    return;
  }
  const receipt = await provisionAuthRoleV1(parsed);
  process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
}

main().catch((error: unknown) => {
  const safe = error instanceof ApiHttpError
    ? { code: error.code, message: error.message }
    : { code: "ROLE_PROVISIONING_CLI_FAILED", message: "Role provisioning did not complete." };
  process.stderr.write(`${JSON.stringify({ error: safe })}\n`);
  process.exitCode = 1;
});

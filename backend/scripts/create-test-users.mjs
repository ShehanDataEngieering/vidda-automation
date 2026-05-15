/**
 * Creates test admin and employee users via the Clerk API with pre-verified emails.
 *
 * Usage:
 *   # Create admin (no companyId needed — set during onboarding)
 *   CLERK_SECRET_KEY=sk_xxx node scripts/create-test-users.mjs
 *
 *   # Create admin + employee (requires a companyId)
 *   CLERK_SECRET_KEY=sk_xxx node scripts/create-test-users.mjs <COMPANY_ID>
 */
import { createClerkClient } from '@clerk/backend';

const SECRET_KEY = process.env.CLERK_SECRET_KEY;
const COMPANY_ID = process.argv[2] ?? null;

if (!SECRET_KEY) {
  console.error('CLERK_SECRET_KEY must be set');
  process.exit(1);
}

const client = createClerkClient({ secretKey: SECRET_KEY });

async function createVerifiedUser(
  email: string,
  firstName: string,
  lastName: string,
  role: 'admin' | 'employee',
  employeeRole: string | null,
) {
  const user = await client.users.createUser({
    emailAddress: [email],
    firstName,
    lastName,
    password: 'AdminVidda2024!',
    skipPasswordChecks: true,
    publicMetadata: {
      companyId: COMPANY_ID ?? null,
      role,
      employeeRole: role === 'employee' ? (employeeRole ?? null) : null,
    },
  });

  const emailId = user.emailAddresses[0]?.id;
  if (emailId) {
    await client.emailAddresses.updateEmailAddress(emailId, { verified: true });
  }

  return user;
}

async function main() {
  try {
    const admin = await createVerifiedUser('admin@vidda.dev', 'Admin', 'Demo', 'admin', null);
    console.log(`[OK] Admin: ${admin.emailAddresses[0]?.emailAddress}  (${admin.id})`);

    if (COMPANY_ID) {
      const emp = await createVerifiedUser('employee@vidda.dev', 'Employee', 'Demo', 'employee', 'Compliance');
      console.log(`[OK] Employee: ${emp.emailAddresses[0]?.emailAddress}  (${emp.id})`);
    }

    console.log('\nCredentials (no verification code):');
    console.log('  admin@vidda.dev     / AdminVidda2024!   (admin)');
    if (COMPANY_ID) {
      console.log('  employee@vidda.dev  / AdminVidda2024!   (employee)');
    } else {
      console.log('\n  Create employee: node scripts/create-test-users.mjs <COMPANY_ID>');
    }
  } catch (err) {
    if (err.errors?.[0]?.code === 'form_identifier_exists') {
      console.log('[SKIP] Users already exist.');
    } else {
      console.error('Failed:', JSON.stringify(err.errors ?? err.message, null, 2));
      process.exit(1);
    }
  }
}

main();

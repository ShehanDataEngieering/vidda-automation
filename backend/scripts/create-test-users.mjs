/**
 * Creates test admin and employee users via the Clerk API.
 *
 * Usage:
 *   # Create admin (no companyId needed - will be set during onboarding)
 *   node scripts/create-test-users.mjs
 *
 *   # Create employee (requires a companyId from an already-onboarded admin)
 *   node scripts/create-test-users.mjs <COMPANY_ID>
 */
import { createClerkClient } from '@clerk/backend';

const SECRET_KEY = process.env.CLERK_SECRET_KEY;
const COMPANY_ID = process.argv[2] ?? null;

if (!SECRET_KEY) {
  console.error('CLERK_SECRET_KEY must be set in backend/.env');
  process.exit(1);
}

const client = createClerkClient({ secretKey: SECRET_KEY });

async function main() {
  try {
    const admin = await client.users.createUser({
      emailAddress: ['admin@test.vidda.dev'],
      firstName: 'Admin',
      lastName: 'Demo',
        password: 'AdminVidda2024!',
        publicMetadata: {
          companyId: COMPANY_ID,
          role: 'employee',
          employeeRole: 'Compliance',
        },
      });
      console.log(`[OK] Employee: ${employee.emailAddresses?.[0]?.emailAddress}  (${employee.id})`);
      console.log('         role=employee  companyId=' + COMPANY_ID + '  dept=Compliance');
    }

    console.log('\nCredentials:');
    console.log('  admin@test.vidda.dev     / AdminVidda2024!   (role: admin)');
    if (COMPANY_ID) {
      console.log('  employee@test.vidda.dev  / AdminVidda2024!   (role: employee)');
    } else {
      console.log('\n  Run again with companyId to create employee:');
      console.log('  node scripts/create-test-users.mjs <COMPANY_ID>');
    }
  } catch (err) {
    if (err.message?.includes('already exists') || err.errors?.[0]?.code === 'form_identifier_exists') {
      console.log('[SKIP] User already exists.');
    } else {
      console.error('Failed:', err.message ?? err);
      process.exit(1);
    }
  }
}

main();

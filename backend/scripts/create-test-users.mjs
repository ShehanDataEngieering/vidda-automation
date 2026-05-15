/**
 * Creates test admin and employee users via the Clerk API.
 *
 * Usage:
 *   1. Create a company first through the app (Onboarding page) to get a real companyId,
 *      OR use a placeholder UUID and update later.
 *   2. Set COMPANY_ID below.
 *   3. Run: node scripts/create-test-users.mjs
 */
import { createClerkClient } from '@clerk/backend';

const SECRET_KEY = process.env.CLERK_SECRET_KEY;
const COMPANY_ID = process.argv[2] ?? '';

if (!SECRET_KEY) {
  console.error('CLERK_SECRET_KEY must be set in backend/.env');
  process.exit(1);
}
if (!COMPANY_ID) {
  console.error('Usage: node scripts/create-test-users.mjs <COMPANY_ID>');
  console.error('  Get a real companyId by creating a company via the Onboarding page first.');
  process.exit(1);
}

const client = createClerkClient({ secretKey: SECRET_KEY });

async function main() {
  try {
    const admin = await client.users.createUser({
      emailAddress: ['admin@vidda-test.local'],
      firstName: 'Admin',
      lastName: 'Demo',
      password: 'TestPass123!',
      publicMetadata: {
        companyId: COMPANY_ID,
        role: 'admin',
        employeeRole: null,
      },
    });
    console.log(`[OK] Admin created:  ${admin.emailAddresses?.[0]?.emailAddress}  (${admin.id})`);

    const employee = await client.users.createUser({
      emailAddress: ['employee@vidda-test.local'],
      firstName: 'Employee',
      lastName: 'Demo',
      password: 'TestPass123!',
      publicMetadata: {
        companyId: COMPANY_ID,
        role: 'employee',
        employeeRole: 'Compliance',
      },
    });
    console.log(`[OK] Employee created: ${employee.emailAddresses?.[0]?.emailAddress}  (${employee.id})`);

    console.log('\nCredentials:');
    console.log('  admin@vidda-test.local    / TestPass123!    (role: admin)');
    console.log('  employee@vidda-test.local / TestPass123!    (role: employee, dept: Compliance)');
  } catch (err) {
    console.error('Failed:', err.message ?? err);
    process.exit(1);
  }
}

main();

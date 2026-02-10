/**
 * Simple Application Health Check
 */

const API_URL = 'http://localhost:3001/api/v1';

const results = {
  passed: 0,
  failed: 0,
  warnings: 0
};

function log(type, category, message) {
  const emoji = type === 'pass' ? '✅' : type === 'fail' ? '❌' : '⚠️';
  console.log(`${emoji} [${category}] ${message}`);
  
  if (type === 'pass') results.passed++;
  else if (type === 'fail') results.failed++;
  else results.warnings++;
}

async function testEndpoint(method, path, body, expectedStatuses, description) {
  try {
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(`${API_URL}${path}`, options);
    
    if (expectedStatuses.includes(response.status)) {
      log('pass', description, `Status ${response.status}`);
      return true;
    } else {
      log('fail', description, `Unexpected status ${response.status}`);
      return false;
    }
  } catch (error) {
    log('fail', description, `Error: ${error.message}`);
    return false;
  }
}

async function runTests() {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('     CAMPUS RESOURCE ENGINE - HEALTH CHECK');
  console.log('═══════════════════════════════════════════════════════\n');
  
  console.log('🔍 Testing Authentication Endpoints...\n');
  
  await testEndpoint(
    'POST',
    '/auth/login',
    { email: 'test@test.com', password: 'test' },
    [200, 400, 401],
    'Login Endpoint'
  );
  
  await testEndpoint(
    'POST',
    '/auth/register',
    { email: 'test@test.com', password: 'Test@123', firstName: 'Test', lastName: 'User', role: 'STUDENT' },
    [201, 400, 409],
    'Register Endpoint'
  );
  
  console.log('\n🔍 Testing Room Endpoints...\n');
  
  await testEndpoint(
    'GET',
    '/rooms',
    null,
    [200],
    'Get Rooms'
  );
  
  console.log('\n🔍 Testing Booking Endpoints...\n');
  
  await testEndpoint(
    'GET',
    '/bookings/availability',
    null,
    [200, 400],
    'Room Availability'
  );
  
  await testEndpoint(
    'GET',
    '/bookings/my',
    null,
    [200, 401],
    'Get My Bookings (requires auth)'
  );
  
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('                     TEST SUMMARY');
  console.log('═══════════════════════════════════════════════════════\n');
  
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`⚠️  Warnings: ${results.warnings}`);
  
  console.log('\n═══════════════════════════════════════════════════════\n');
  
  if (results.failed === 0) {
    console.log('🎉 ALL ENDPOINTS RESPONSIVE!\n');
  } else {
    console.log('⚠️  SOME ENDPOINTS MAY NEED ATTENTION\n');
  }
}

runTests();

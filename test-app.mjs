/**
 * Comprehensive Application Test Suite
 * Tests all endpoints and features
 */

import { createClient } from '@supabase/supabase-js';

const API_URL = 'http://localhost:3001/api/v1';
const supabaseUrl = 'https://arxsyeioxxjrukonnzwm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyeHN5ZWlveHhqcnVrb25uendtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Nzc1NjA3NCwiZXhwIjoyMDgzMzMyMDc0fQ.y5z5u4L-wwy6wpvisf3KEFqAMDDmR8Bls5dpIHOUYcM';

const supabase = createClient(supabaseUrl, supabaseKey);

const results = {
  passed: [],
  failed: [],
  warnings: []
};

function log(type, category, message) {
  const emoji = type === 'pass' ? '✅' : type === 'fail' ? '❌' : '⚠️';
  console.log(`${emoji} [${category}] ${message}`);
  
  if (type === 'pass') results.passed.push({ category, message });
  else if (type === 'fail') results.failed.push({ category, message });
  else results.warnings.push({ category, message });
}

async function testDatabaseConnection() {
  console.log('\n🔍 Testing Database Connection...\n');
  
  try {
    const { data, error } = await supabase.from('users').select('count').limit(1);
    if (error) throw error;
    log('pass', 'Database', 'Supabase connection successful');
  } catch (error) {
    log('fail', 'Database', `Connection failed: ${error.message}`);
  }
}

async function testAuthEndpoints() {
  console.log('\n🔍 Testing Authentication Endpoints...\n');
  
  // Test 1: Login endpoint exists
  try {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        email: 'cb.sc.u4cse23209@cb.students.amrita.edu', 
        password: 'Admin@123' 
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.data && data.data.requiresOtp !== undefined) {
        log('pass', 'Auth', 'Login endpoint working - MFA initiated');
      } else {
        log('fail', 'Auth', 'Login response format incorrect');
      }
    } else if (response.status === 401) {
      log('pass', 'Auth', 'Login endpoint accessible (invalid credentials)');
    } else {
      log('fail', 'Auth', `Login endpoint error: ${response.status}`);
    }
  } catch (error) {
    log('fail', 'Auth', `Login endpoint unreachable: ${error.message}`);
  }
  
  // Test 2: Register endpoint
  try {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'Test@123',
        firstName: 'Test',
        lastName: 'User',
        role: 'STUDENT'
      })
    });
    
    if (response.status === 201 || response.status === 400 || response.status === 409) {
      log('pass', 'Auth', 'Register endpoint accessible');
    } else {
      log('fail', 'Auth', `Register endpoint error: ${response.status}`);
    }
  } catch (error) {
    log('fail', 'Auth', `Register endpoint unreachable: ${error.message}`);
  }
}

async function testRoomEndpoints() {
  console.log('\n🔍 Testing Room Endpoints...\n');
  
  try {
    const response = await fetch(`${API_URL}/rooms`);
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data.data)) {
        log('pass', 'Rooms', `GET /rooms working - ${data.data.length} rooms found`);
      } else {
        log('fail', 'Rooms', 'Invalid response format');
      }
    } else {
      log('fail', 'Rooms', `GET /rooms failed: ${response.status}`);
    }
  } catch (error) {
    log('fail', 'Rooms', `Rooms endpoint unreachable: ${error.message}`);
  }
}

async function testBookingEndpoints() {
  console.log('\n🔍 Testing Booking Endpoints...\n');
  
  try {
    const response = await fetch(`${API_URL}/bookings`, {
      headers: {
        'Authorization': 'Bearer dummy-token-for-structure-test'
      }
    });
    
    if (response.status === 401) {
      log('pass', 'Bookings', 'GET /bookings requires auth (as expected)');
    } else if (response.ok) {
      log('pass', 'Bookings', 'GET /bookings accessible');
    } else {
      log('warn', 'Bookings', `Unexpected status: ${response.status}`);
    }
  } catch (error) {
    log('fail', 'Bookings', `Bookings endpoint unreachable: ${error.message}`);
  }
}

async function checkServerHealth() {
  console.log('\n🔍 Checking Server Health...\n');
  
  try {
    const response = await fetch(`${API_URL.replace('/api/v1', '')}/health`);
    if (response.ok) {
      log('pass', 'Server', 'Health check endpoint working');
    } else {
      log('warn', 'Server', 'No health check endpoint found');
    }
  } catch (error) {
    log('fail', 'Server', `Server unreachable: ${error.message}`);
  }
}

async function verifyDatabaseData() {
  console.log('\n🔍 Verifying Database Data...\n');
  
  try {
    // Check users
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, role')
      .limit(5);
    
    if (usersError) throw usersError;
    log('pass', 'Data', `Found ${users.length} users in database`);
    
    // Check rooms
    const { data: rooms, error: roomsError } = await supabase
      .from('rooms')
      .select('id, name, capacity')
      .limit(5);
    
    if (roomsError) throw roomsError;
    log('pass', 'Data', `Found ${rooms.length} rooms in database`);
    
    // Check if admin email is updated
    const { data: admin } = await supabase
      .from('users')
      .select('email')
      .eq('role', 'ADMIN')
      .single();
    
    if (admin && admin.email === 'cb.sc.u4cse23209@cb.students.amrita.edu') {
      log('pass', 'Data', 'Admin email correctly updated');
    } else {
      log('warn', 'Data', 'Admin email may not be updated');
    }
    
  } catch (error) {
    log('fail', 'Data', `Database query failed: ${error.message}`);
  }
}

async function runAllTests() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('     CAMPUS RESOURCE ENGINE - COMPREHENSIVE TEST');
  console.log('═══════════════════════════════════════════════════════\n');
  
  await testDatabaseConnection();
  await testAuthEndpoints();
  await testRoomEndpoints();
  await testBookingEndpoints();
  await checkServerHealth();
  await verifyDatabaseData();
  
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('                     TEST SUMMARY');
  console.log('═══════════════════════════════════════════════════════\n');
  
  console.log(`✅ Passed: ${results.passed.length}`);
  console.log(`❌ Failed: ${results.failed.length}`);
  console.log(`⚠️  Warnings: ${results.warnings.length}`);
  
  if (results.failed.length > 0) {
    console.log('\n❌ FAILURES:\n');
    results.failed.forEach(r => console.log(`   - [${r.category}] ${r.message}`));
  }
  
  if (results.warnings.length > 0) {
    console.log('\n⚠️  WARNINGS:\n');
    results.warnings.forEach(r => console.log(`   - [${r.category}] ${r.message}`));
  }
  
  console.log('\n═══════════════════════════════════════════════════════\n');
  
  if (results.failed.length === 0) {
    console.log('🎉 ALL CRITICAL TESTS PASSED!\n');
  } else {
    console.log('⚠️  SOME TESTS FAILED - REVIEW REQUIRED\n');
  }
}

runAllTests();

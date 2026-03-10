/**
 * Error Handling Testing - Quick Test Script
 * Tests error scenarios and edge cases
 */

import axios from 'axios';

const API_URL = process.env.API_URL || 'http://localhost:3001';
const TOKEN = process.env.TEST_TOKEN || '';

const headers = {
  'Authorization': `Bearer ${TOKEN}`,
  'Content-Type': 'application/json',
};

async function testInvalidInputs() {
  console.log('\n❌ Testing Invalid Input Handling...');
  
  const testCases = [
    {
      name: 'Negative capacity',
      endpoint: '/api/v1/admin/rooms',
      method: 'post',
      data: { name: 'Test', capacity: -5, buildingName: 'Building A' },
    },
    {
      name: 'Invalid date range',
      endpoint: '/api/v1/bookings',
      method: 'post',
      data: {
        roomId: 'room-001',
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() - 3600000).toISOString(), // End before start
      },
    },
    {
      name: 'Null values',
      endpoint: '/api/v1/auth/register',
      method: 'post',
      data: { email: null, firstName: 'Test', lastName: 'User', password: 'Test123!' },
    },
  ];

  let handled = 0;
  for (const test of testCases) {
    try {
      const res = await axios({
        method: test.method,
        url: `${API_URL}/api${test.endpoint}`,
        data: test.data,
        headers,
        validateStatus: () => true,
      });

      if ([400, 422, 403].includes(res.status)) {
        handled++;
        console.log(`  ✅ ${test.name}: Handled (Status ${res.status})`);
      } else {
        console.log(`  ⚠️  ${test.name}: Unexpected status ${res.status}`);
      }
    } catch (err) {
      handled++;
      console.log(`  ✅ ${test.name}: Error caught`);
    }
  }

  console.log(`Overall: ${handled}/${testCases.length} invalid inputs handled`);
}

async function testResourceNotFound() {
  console.log('\n🔍 Testing Resource Not Found Handling...');
  
  const notFoundTests = [
    '/api/v1/users/nonexistent-id',
    '/api/v1/rooms/nonexistent-id',
    '/api/v1/bookings/nonexistent-id',
  ];

  let notFound = 0;
  for (const endpoint of notFoundTests) {
    try {
      const res = await axios.get(`${API_URL}${endpoint}`, 
        { headers, validateStatus: () => true }
      );

      if (res.status === 404) {
        notFound++;
        console.log(`  ✅ ${endpoint}: Returned 404`);
      } else {
        console.log(`  ⚠️  ${endpoint}: Status ${res.status}`);
      }
    } catch (err) {
      console.error(`  ❌ Error: ${err.message}`);
    }
  }

  console.log(`Overall: ${notFound}/${notFoundTests.length} endpoints properly return 404`);
}

async function testTypeValidation() {
  console.log('\n🔤 Testing Type Validation...');
  
  try {
    // Send string where number expected
    const res = await axios.post(`${API_URL}/api/v1/admin/rooms`, 
      { name: 'Test', capacity: 'thirty', buildingName: 'Building A' },
      { headers, validateStatus: () => true }
    );

    if ([400, 422].includes(res.status)) {
      console.log('  ✅ String to number rejected');
    } else {
      console.log(`  ⚠️  Type validation missing (Status: ${res.status})`);
    }
  } catch (err) {
    console.error('  ❌ Error:', err.message);
  }
}

async function testUnauthorizedAccess() {
  console.log('\n🔐 Testing Unauthorized Access Handling...');
  
  const endpoints = [
    '/api/v1/admin/users',
    '/api/v1/admin/rooms',
    '/api/v1/admin/bookings',
  ];

  let unauthorized = 0;
  for (const endpoint of endpoints) {
    try {
      const res = await axios.get(`${API_URL}${endpoint}`, 
        { validateStatus: () => true } // No auth header
      );

      if (res.status === 401) {
        unauthorized++;
        console.log(`  ✅ ${endpoint}: Requires auth`);
      }
    } catch (err) {
      console.error(`  Error: ${err.message}`);
    }
  }

  console.log(`Overall: ${unauthorized}/${endpoints.length} endpoints properly secured`);
}

async function testDuplicateData() {
  console.log('\n⚠️  Testing Duplicate Data Handling...');
  
  const email = `unique-${Date.now()}@test.com`;

  try {
    // First registration
    const res1 = await axios.post(`${API_URL}/api/v1/auth/register`, 
      { email, firstName: 'User', lastName: 'One', password: 'Test123!' },
      { validateStatus: () => true }
    );

    if (res1.status === 201) {
      // Try to register again with same email
      const res2 = await axios.post(`${API_URL}/api/v1/auth/register`, 
        { email, firstName: 'User', lastName: 'Two', password: 'Test123!' },
        { validateStatus: () => true }
      );

      if (res2.status === 409) {
        console.log('  ✅ Duplicate email rejected with 409');
      } else if (res2.status === 400) {
        console.log('  ✅ Duplicate email rejected with 400');
      } else {
        console.log(`  ⚠️  Unexpected status: ${res2.status}`);
      }
    }
  } catch (err) {
    console.error('  ❌ Error:', err.message);
  }
}

async function testErrorMessages() {
  console.log('\n💬 Testing Error Message Quality...');
  
  try {
    const res = await axios.post(`${API_URL}/api/v1/auth/register`, 
      { email: 'invalid', firstName: '', lastName: '', password: '123' },
      { validateStatus: () => true }
    );

    if (res.status === 400) {
      const hasMessage = res.data.error || res.data.message;
      if (hasMessage) {
        console.log('  ✅ Error message included in response');
      } else {
        console.log('  ⚠️  Error message missing');
      }
    }
  } catch (err) {
    console.error('  ❌ Error:', err.message);
  }
}

async function runErrorTests() {
  console.log('========================================');
  console.log('  Error Handling Testing Suite');
  console.log('========================================');
  
  await testInvalidInputs();
  await testResourceNotFound();
  await testTypeValidation();
  await testUnauthorizedAccess();
  await testDuplicateData();
  await testErrorMessages();
  
  console.log('\n========================================');
  console.log('  Error Handling Testing Complete');
  console.log('========================================\n');
}

runErrorTests().catch(console.error);
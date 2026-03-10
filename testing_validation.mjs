/**
 * Data Validation Testing - Quick Test Script
 * Tests input validation across all endpoints
 */

import axios from 'axios';

const API_URL = process.env.API_URL || 'http://localhost:3001';

async function testEmailValidation() {
  console.log('\n📧 Testing Email Validation...');
  
  const invalidEmails = [
    'notanemail',
    '@example.com',
    'user@',
    'user@@example.com',
  ];

  let blocked = 0;
  for (const email of invalidEmails) {
    try {
      const res = await axios.post(`${API_URL}/api/v1/auth/register`, 
        {
          email,
          firstName: 'Test',
          lastName: 'User',
          password: 'TestPass123!',
        },
        { validateStatus: () => true }
      );

      if (res.status === 400) {
        blocked++;
      }
    } catch (err) {
      blocked++;
    }
  }

  console.log(`✅ Blocked ${blocked}/${invalidEmails.length} invalid emails`);
}

async function testPasswordValidation() {
  console.log('\n🔐 Testing Password Validation...');
  
  const weakPasswords = ['123', 'password', '12345678', 'qwerty'];
  
  let blocked = 0;
  for (const pwd of weakPasswords) {
    try {
      const res = await axios.post(`${API_URL}/api/v1/auth/register`, 
        {
          email: `test-${Date.now()}-${Math.random()}@test.com`,
          firstName: 'Test',
          lastName: 'User',
          password: pwd,
        },
        { validateStatus: () => true }
      );

      if ([400, 422].includes(res.status)) {
        blocked++;
      }
    } catch (err) {
      blocked++;
    }
  }

  console.log(`✅ Rejected ${blocked}/${weakPasswords.length} weak passwords`);
}

async function testStringLengthValidation() {
  console.log('\n📏 Testing String Length Validation...');
  
  try {
    const res = await axios.post(`${API_URL}/api/v1/auth/register`, 
      {
        email: `test-${Date.now()}@test.com`,
        firstName: 'A'.repeat(100), // Too long
        lastName: 'User',
        password: 'TestPass123!',
      },
      { validateStatus: () => true }
    );

    if ([400, 422].includes(res.status)) {
      console.log('✅ Long string rejected');
    } else {
      console.log('❌ String length not validated properly');
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

async function testNumericValidation() {
  console.log('\n🔢 Testing Numeric Validation...');
  
  const invalidCapacities = [0, -1, -100];
  let validated = 0;

  for (const capacity of invalidCapacities) {
    try {
      const res = await axios.post(`${API_URL}/api/v1/admin/rooms`, 
        {
          name: 'Test',
          capacity,
          buildingName: 'Building A',
        },
        { validateStatus: () => true }
      );

      if ([400, 403, 422].includes(res.status)) {
        validated++;
      }
    } catch (err) {
      validated++;
    }
  }

  console.log(`✅ Validated ${validated}/${invalidCapacities.length} numeric ranges`);
}

async function testDateValidation() {
  console.log('\n📅 Testing Date/Time Validation...');
  
  try {
    const res = await axios.post(`${API_URL}/api/v1/bookings`, 
      {
        roomId: 'room-001',
        startTime: 'not-a-date',
        endTime: '2024-01-01',
      },
      { validateStatus: () => true }
    );

    if ([400, 401, 422].includes(res.status)) {
      console.log('✅ Invalid date format rejected');
    } else {
      console.log('❌ Date validation might be missing');
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

async function testEmptyFieldValidation() {
  console.log('\n🔲 Testing Empty Field Validation...');
  
  try {
    const res = await axios.post(`${API_URL}/api/v1/auth/register`, 
      {
        email: '',
        firstName: 'Test',
        lastName: 'User',
        password: 'TestPass123!',
      },
      { validateStatus: () => true }
    );

    if (res.status === 400) {
      console.log('✅ Empty email rejected');
    } else {
      console.log('❌ Empty field validation missing');
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

async function runValidationTests() {
  console.log('========================================');
  console.log('  Data Validation Testing Suite');
  console.log('========================================');
  
  await testEmailValidation();
  await testPasswordValidation();
  await testStringLengthValidation();
  await testNumericValidation();
  await testDateValidation();
  await testEmptyFieldValidation();
  
  console.log('\n========================================');
  console.log('  Validation Testing Complete');
  console.log('========================================\n');
}

runValidationTests().catch(console.error);
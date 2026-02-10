-- Update email addresses
-- admin@campus.edu → cb.sc.u4cse23209@cb.students.amrita.edu
-- Student@campus.edu → cb.sc.u4cse23209@cb.students.amrita.edu  
-- Student2@campus.edu → cb.sc.u4cse23238@cb.students.amrita.edu

BEGIN;

-- Show current state
SELECT id, email, role, name FROM "User" 
WHERE email IN ('admin@campus.edu', 'Student@campus.edu', 'Student2@campus.edu')
ORDER BY email;

-- Update admin@campus.edu
UPDATE "User" 
SET email = 'cb.sc.u4cse23209@cb.students.amrita.edu'
WHERE email = 'admin@campus.edu';

-- Update Student@campus.edu  
UPDATE "User"
SET email = 'cb.sc.u4cse23209@cb.students.amrita.edu'
WHERE email = 'Student@campus.edu';

-- Update Student2@campus.edu
UPDATE "User"
SET email = 'cb.sc.u4cse23238@cb.students.amrita.edu'
WHERE email = 'Student2@campus.edu';

-- Verify updates
SELECT id, email, role, name FROM "User"
WHERE email IN (
  'cb.sc.u4cse23209@cb.students.amrita.edu',
  'cb.sc.u4cse23238@cb.students.amrita.edu'
)
ORDER BY email;

COMMIT;

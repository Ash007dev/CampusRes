import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateEmails() {
  try {
    console.log('Checking current users...\n');
    
    const users = await prisma.user.findMany({
      where: {
        email: {
          in: ['admin@campus.edu', 'Student@campus.edu', 'Student2@campus.edu']
        }
      },
      select: { id: true, email: true, role: true, name: true }
    });
    
    console.log('Current users:', JSON.stringify(users, null, 2));
    console.log('\nUpdating emails...\n');
    
    // Update admin@campus.edu
    const admin = await prisma.user.updateMany({
      where: { email: 'admin@campus.edu' },
      data: { email: 'cb.sc.u4cse23209@cb.students.amrita.edu' }
    });
    console.log(`Updated admin: ${admin.count} record(s)`);
    
    // Update Student@campus.edu
    const student1 = await prisma.user.updateMany({
      where: { email: 'Student@campus.edu' },
      data: { email: 'cb.sc.u4cse23209@cb.students.amrita.edu' }
    });
    console.log(`Updated Student: ${student1.count} record(s)`);
    
    // Update Student2@campus.edu
    const student2 = await prisma.user.updateMany({
      where: { email: 'Student2@campus.edu' },
      data: { email: 'cb.sc.u4cse23238@cb.students.amrita.edu' }
    });
    console.log(`Updated Student2: ${student2.count} record(s)`);
    
    console.log('\nVerifying updates...\n');
    const updated = await prisma.user.findMany({
      where: {
        email: {
          in: [
            'cb.sc.u4cse23209@cb.students.amrita.edu',
            'cb.sc.u4cse23238@cb.students.amrita.edu'
          ]
        }
      },
      select: { id: true, email: true, role: true, name: true }
    });
    
    console.log('Updated users:', JSON.stringify(updated, null, 2));
    console.log('\n✅ Email updates complete!');
    
  } catch (error) {
    console.error('Error updating emails:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

updateEmails();

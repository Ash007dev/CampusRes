import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function resetQuota() {
    try {
        // Find student2 (Arun Kumar)
        const user = await prisma.user.findUnique({
            where: { email: 'student2@amrita.edu' }
        });

        if (user) {
            // Delete all bookings for this user to reset quota
            const result = await prisma.booking.deleteMany({
                where: { userId: user.id }
            });
            console.log(`✓ Deleted ${result.count} bookings for Arun Kumar (${user.email})`);
            console.log('✓ Quota is now reset to 0/4 hrs');
        } else {
            console.log('User not found');
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

resetQuota();

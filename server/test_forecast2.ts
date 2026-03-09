import { demandForecastService } from './src/services/demandForecastService.js';
import { supabase } from './src/lib/supabase.js';

async function test() {
    try {
        console.log("Calling getDemandForecast(7)...");
        const res = await demandForecastService.getDemandForecast(7);
        console.log("Total Bookings Analyzed:", res.totalBookingsAnalyzed);

        let closedCount = 0;
        let lowCount = 0;
        let mediumCount = 0;
        let highCount = 0;

        for (const day of res.forecast) {
            for (const hour of day.hourlyDemand) {
                if (hour.peakLabel === 'CLOSED') closedCount++;
                else if (hour.peakLabel === 'LOW') lowCount++;
                else if (hour.peakLabel === 'MEDIUM') mediumCount++;
                else if (hour.peakLabel === 'HIGH') highCount++;

                if (hour.hour === 23) { // 11 PM
                    console.log(`11 PM on ${day.dayName}: ${hour.avgBookings} avg bookings, label: ${hour.peakLabel}`);
                }
            }
        }

        console.log(`Summary: ${closedCount} CLOSED, ${lowCount} LOW, ${mediumCount} MEDIUM, ${highCount} HIGH`);
    } catch (e) {
        console.error("Error:", e);
    }
}

test();

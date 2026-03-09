/**
 * =============================================================================
 * Campus Resource Engine - Demand Forecast Service (US 2.1)
 * =============================================================================
 * Aggregates historical booking data to predict daily demand patterns.
 * Admins use this to proactively schedule staff and open/close facilities.
 * =============================================================================
 */

import { supabase } from '../lib/supabase.js';
import { logger } from '../config/logger.js';
import { AppError } from '../utils/errors.js';
import { config } from '../config/index.js';
import { GoogleGenerativeAI, Schema, SchemaType } from '@google/generative-ai';

interface HourlyDemand {
    hour: number;
    avgBookings: number;
    peakLabel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CLOSED';
}

interface DayForecast {
    dayOfWeek: number;
    dayName: string;
    hourlyDemand: HourlyDemand[];
}

interface DemandForecastResult {
    forecast: DayForecast[];
    totalBookingsAnalyzed: number;
    periodDays: number;
    generatedAt: string;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// The JSON schema defining the shape we want from Gemini
const forecastSchema: Schema = {
    type: SchemaType.OBJECT,
    properties: {
        forecast: {
            type: SchemaType.ARRAY,
            description: "A 7-element array, one for each day of the week, starting from Sunday (dayOfWeek: 0)",
            items: {
                type: SchemaType.OBJECT,
                properties: {
                    dayOfWeek: { type: SchemaType.INTEGER, description: "0 for Sunday, 1 for Monday, etc." },
                    dayName: { type: SchemaType.STRING, description: "E.g., Sunday, Monday" },
                    hourlyDemand: {
                        type: SchemaType.ARRAY,
                        description: "A 24-element array representing each hour from 0 to 23",
                        items: {
                            type: SchemaType.OBJECT,
                            properties: {
                                hour: { type: SchemaType.INTEGER, description: "Hour of the day from 0 to 23" },
                                avgBookings: { type: SchemaType.NUMBER, description: "Predicted average bookings for this hour" },
                                peakLabel: {
                                    type: SchemaType.STRING,
                                    enum: ['LOW', 'MEDIUM', 'HIGH', 'CLOSED'],
                                    format: 'enum',
                                    description: "Demand intensity relative to the peak hour. Use 'CLOSED' if demand is 0 or campus is closed."
                                }
                            },
                            required: ["hour", "avgBookings", "peakLabel"]
                        }
                    }
                },
                required: ["dayOfWeek", "dayName", "hourlyDemand"]
            }
        }
    },
    required: ["forecast"]
};

export const demandForecastService = {
    /**
     * Generate demand forecast from historical booking data using Google Gemini API.
     * Falls back to statistical moving-average if API key is missing or call fails.
     *
     * @param days - Number of historical days to analyze (default 30)
     */
    async getDemandForecast(days: number = 30): Promise<DemandForecastResult> {
        try {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);

            // Fetch all non-cancelled bookings in the analysis window
            const { data: bookings, error } = await supabase
                .from('bookings')
                .select('start_time, end_time')
                .in('status', ['CONFIRMED', 'COMPLETED', 'NO_SHOW'])
                .gte('start_time', startDate.toISOString());

            if (error) {
                throw new AppError(`Failed to fetch bookings for forecast: ${error.message}`, 500);
            }

            const totalBookings = (bookings || []).length;

            // Try AI Forecast first if we have an API key
            if (config.ai.geminiApiKey) {
                try {
                    logger.info(`Generating AI demand forecast analyzing ${totalBookings} bookings over ${days} days...`);

                    const genAI = new GoogleGenerativeAI(config.ai.geminiApiKey);

                    // We use gemini-1.5-flash as it is fast and supports JSON schema output
                    const model = genAI.getGenerativeModel({
                        model: "gemini-1.5-flash",
                        generationConfig: {
                            responseMimeType: "application/json",
                            responseSchema: forecastSchema,
                        }
                    });

                    // Prepare an aggregated summary of the bookings to avoid passing massive prompt tokens.
                    // We build the same counts matrix as the heuristic approach, but we pass it to the AI as raw context.
                    const counts: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
                    const totalWeeks = Math.max(1, Math.ceil(days / 7));

                    for (const booking of bookings || []) {
                        const start = new Date(booking.start_time);
                        const end = new Date(booking.end_time);
                        const dayOfWeek = start.getUTCDay();

                        const startHour = start.getUTCHours();
                        const endHour = end.getUTCHours() + (end.getUTCMinutes() > 0 ? 1 : 0);
                        const finalEndHour = Math.min(endHour, 24);

                        for (let h = startHour; h < finalEndHour; h++) {
                            counts[dayOfWeek][h]++;
                        }
                    }

                    // Format the historical density for the prompt
                    let historicalContext = "Historical average booking density per hour over the last " + days + " days:\n\n";
                    for (let d = 0; d < 7; d++) {
                        historicalContext += `${DAY_NAMES[d]}:\n`;
                        for (let h = 0; h < 24; h++) {
                            const avg = parseFloat((counts[d][h] / totalWeeks).toFixed(2));
                            historicalContext += `  Hour ${h}: ${avg} bookings avg\n`;
                        }
                        historicalContext += "\n";
                    }

                    const prompt = `
You are an AI Demand Forecasting Engine for a Campus Resource Reservation System.
Your task is to analyze the historical booking density and predict the expected demand for the upcoming week.

Below is the historical average booking density per day and hour based on ${totalBookings} past bookings.
Please analyze this data and generate a predicted 7-day × 24-hour demand matrix.

For the prediction:
1. Smooth out minor anomalies from the historical data.
2. Maintain realistic patterns.
3. Determine if each hour is LOW, MEDIUM, or HIGH demand relative to the overall peak hour.
4. Assign 'CLOSED' to any hour where there is 0 demand OR the campus is closed. The campus is strictly closed before 8 AM and from 8 PM onwards (hours < 8 or >= 20). Demand for closed hours must be 0 and labeled 'CLOSED'.

Historical Data:
${historicalContext}
`;

                    const result = await model.generateContent(prompt);
                    const responseJson = JSON.parse(result.response.text());

                    return {
                        forecast: responseJson.forecast,
                        totalBookingsAnalyzed: totalBookings,
                        periodDays: days,
                        generatedAt: new Date().toISOString(),
                    };
                } catch (aiError) {
                    logger.warn({ error: aiError instanceof Error ? aiError.message : String(aiError) }, 'AI demand forecast failed, falling back to heuristic calculation');
                    // Fall through to heuristic calculation
                }
            } else {
                logger.info('No GEMINI_API_KEY provided. Using heuristic demand forecast calculation.');
            }

            // --- HEURISTIC FALLBACK ---

            // Build a 7×24 accumulator: counts[dayOfWeek][hour] = total bookings
            const counts: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
            // Track how many distinct weeks each day appeared (for averaging)
            const weeksSeen = new Set<string>();

            for (const booking of bookings || []) {
                const start = new Date(booking.start_time);
                const end = new Date(booking.end_time);
                const dayOfWeek = start.getUTCDay();

                // Track the week for averaging
                const weekKey = `${start.getUTCFullYear()}-W${Math.ceil((start.getUTCDate()) / 7)}`;
                weeksSeen.add(weekKey);

                // Count booking for each hour it spans
                const startHour = start.getUTCHours();
                const endHour = end.getUTCHours() + (end.getUTCMinutes() > 0 ? 1 : 0);
                const finalEndHour = Math.min(endHour, 24);

                for (let h = startHour; h < finalEndHour; h++) {
                    counts[dayOfWeek][h]++;
                }
            }

            // Number of weeks in our window for averaging
            const totalWeeks = Math.max(1, Math.ceil(days / 7));

            // Find maximum average for peak labeling (only within business hours 8-20)
            let maxAvg = 0;
            for (let d = 0; d < 7; d++) {
                for (let h = 8; h < 20; h++) {
                    const avg = counts[d][h] / totalWeeks;
                    if (avg > maxAvg) maxAvg = avg;
                }
            }

            // Build forecast
            const forecast: DayForecast[] = [];
            for (let d = 0; d < 7; d++) {
                const hourlyDemand: HourlyDemand[] = [];
                for (let h = 0; h < 24; h++) {
                    const avgBookings = parseFloat((counts[d][h] / totalWeeks).toFixed(2));
                    const ratio = maxAvg > 0 ? avgBookings / maxAvg : 0;

                    let peakLabel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CLOSED';
                    if (h < 8 || h >= 20 || avgBookings === 0) peakLabel = 'CLOSED';
                    else if (ratio <= 0.33) peakLabel = 'LOW';
                    else if (ratio <= 0.66) peakLabel = 'MEDIUM';
                    else peakLabel = 'HIGH';

                    // Zero out avgBookings if CLOSED
                    hourlyDemand.push({ hour: h, avgBookings: peakLabel === 'CLOSED' ? 0 : avgBookings, peakLabel });
                }

                forecast.push({
                    dayOfWeek: d,
                    dayName: DAY_NAMES[d],
                    hourlyDemand,
                });
            }

            return {
                forecast,
                totalBookingsAnalyzed: totalBookings,
                periodDays: days,
                generatedAt: new Date().toISOString(),
            };
        } catch (error) {
            logger.error({ error }, 'Error generating demand forecast');
            throw error instanceof AppError ? error : new AppError('Failed to generate demand forecast', 500);
        }
    },
};

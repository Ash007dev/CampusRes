/**
 * =============================================================================
 * Audit Logger Utility
 * =============================================================================
 * Handles audit log inserts with proper UUID generation and action mapping.
 * The audit_logs table requires:
 *   - A manually provided UUID id
 *   - A valid AuditAction enum value
 *   - A valid performed_by_id (FK to users table, NOT NULL)
 * =============================================================================
 */

import { randomUUID } from 'crypto';
import { supabase } from '../lib/supabase.js';
import { logger } from '../config/logger.js';

// Valid AuditAction enum values in the database
const VALID_ACTIONS = [
    'CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT',
    'APPROVE', 'REJECT', 'CANCEL', 'CHECK_IN',
] as const;

type ValidAction = typeof VALID_ACTIONS[number];

// Map non-enum actions to valid enum actions
const ACTION_MAP: Record<string, ValidAction> = {
    'REGISTER': 'CREATE',
    'BOOKING_CREATED': 'CREATE',
    'BOOKING_CANCELLED': 'CANCEL',
    'USER_LOGIN': 'LOGIN',
    'BROADCAST_SENT': 'CREATE',
    'NO_SHOW': 'UPDATE',
    'GHOST_KILL': 'UPDATE',
    'ROLE_CHANGE': 'UPDATE',
    'BLOCK': 'UPDATE',
    'UNBLOCK': 'UPDATE',
    'DEACTIVATE': 'UPDATE',
    'ACTIVATE': 'UPDATE',
};

function mapAction(action: string): ValidAction {
    if (VALID_ACTIONS.includes(action as ValidAction)) {
        return action as ValidAction;
    }
    return ACTION_MAP[action] || 'UPDATE';
}

interface AuditLogEntry {
    action: string;
    entity_type: string;
    entity_id?: string;
    performed_by_id?: string | null;
    details?: Record<string, any>;
    metadata?: Record<string, any>;
    previous_state?: Record<string, any>;
    new_state?: Record<string, any>;
    [key: string]: any;
}

/**
 * Insert an audit log entry with proper UUID and action mapping.
 * This function never throws — errors are logged but don't affect the caller.
 * 
 * IMPORTANT: performed_by_id is required (NOT NULL, FK to users).
 * If not provided, the audit log will be skipped with a warning.
 */
export async function logAudit(entry: AuditLogEntry): Promise<void> {
    try {
        // performed_by_id is required by the DB schema (NOT NULL FK constraint)
        if (!entry.performed_by_id) {
            logger.debug({ action: entry.action, entity_type: entry.entity_type },
                'Audit log skipped: no performed_by_id');
            return;
        }

        const mappedAction = mapAction(entry.action);

        const { error } = await supabase.from('audit_logs').insert({
            id: randomUUID(),
            action: mappedAction,
            entity_type: entry.entity_type,
            entity_id: entry.entity_id || 'unknown',
            performed_by_id: entry.performed_by_id,
            metadata: entry.metadata || entry.details || null,
            previous_state: entry.previous_state || null,
            new_state: entry.new_state || null,
        });

        if (error) {
            logger.warn({ error: error.message, action: entry.action, mappedAction }, 'Audit log insert failed');
        }
    } catch (err) {
        logger.warn({ err, action: entry.action }, 'Audit log insert exception');
    }
}

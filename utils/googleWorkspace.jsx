import { base44 } from '@/api/base44Client';

const GoogleWorkspaceConnection = base44.entities.GoogleWorkspaceConnection;
const Employee = base44.entities.Employee;

// Placeholder API base URL - will be replaced with actual backend
const API_BASE = '/api/google-workspace';

/**
 * Get the active Google Workspace connection (status = 'connected')
 * @returns {Promise<Object|null>} Active connection or null
 */
export async function getActiveConnection() {
  const connections = await GoogleWorkspaceConnection.filter({ status: 'connected' }, '-created_date', 1);
  return connections.length > 0 ? connections[0] : null;
}

/**
 * Get any Google Workspace connection (for settings page)
 * @returns {Promise<Object|null>} Connection or null
 */
export async function getConnection() {
  const connections = await GoogleWorkspaceConnection.list('-created_date', 1);
  return connections.length > 0 ? connections[0] : null;
}

/**
 * Create a new Google Workspace connection
 */
export async function createConnection({ domain, adminEmail, externalConnectionId, label }) {
  const now = new Date().toISOString();
  return await GoogleWorkspaceConnection.create({
    status: 'connected',
    domain,
    admin_email: adminEmail,
    connection_label: label || 'Google Workspace',
    external_connection_id: externalConnectionId,
    created_at: now,
    updated_at: now,
  });
}

/**
 * Disconnect Google Workspace
 */
export async function disconnect(connectionId) {
  return await GoogleWorkspaceConnection.update(connectionId, {
    status: 'not_connected',
    external_connection_id: null,
    updated_at: new Date().toISOString(),
  });
}

/**
 * Test the Google Workspace connection
 * Calls external endpoint to verify connectivity
 * @param {string} connectionId - Connection ID to test
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function testConnection(connectionId) {
  const connection = await GoogleWorkspaceConnection.filter({ id: connectionId });
  if (!connection.length) {
    return { ok: false, error: 'Connection not found' };
  }

  const conn = connection[0];
  const now = new Date().toISOString();

  try {
    // Stub: Simulate API call
    // In production: await fetch(`${API_BASE}/test`, { method: 'POST', body: JSON.stringify({ external_connection_id: conn.external_connection_id }) });
    console.log('[GoogleWorkspace] Testing connection:', conn.external_connection_id);
    
    // Simulate success
    const success = true;

    if (success) {
      await GoogleWorkspaceConnection.update(connectionId, {
        status: 'connected',
        last_sync_at: now,
        last_error: null,
        updated_at: now,
      });
      return { ok: true };
    }
  } catch (error) {
    const errorMessage = error.message || 'Failed to connect to Google Workspace API';
    await GoogleWorkspaceConnection.update(connectionId, {
      status: 'error',
      last_error: errorMessage,
      updated_at: now,
    });
    return { ok: false, error: errorMessage };
  }
}

/**
 * Generate a suggested primary email for an employee
 */
function generatePrimaryEmail(employee, domain) {
  const firstName = (employee.preferred_name || employee.first_name || 'user').toLowerCase().replace(/[^a-z]/g, '');
  const lastName = (employee.last_name || 'unknown').toLowerCase().replace(/[^a-z]/g, '');
  return `${firstName}.${lastName}@${domain}`;
}

/**
 * Provision a Google Workspace user for an employee
 * @param {Object} employee - Employee record
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function provisionUserForEmployee(employee) {
  // Check if sync is enabled
  if (employee.google_sync_enabled === false) {
    return { ok: false, error: 'Google sync is disabled for this employee' };
  }

  // Get active connection
  const connection = await getActiveConnection();
  if (!connection) {
    return { ok: false, error: 'No active Google Workspace connection' };
  }

  const now = new Date().toISOString();
  const primaryEmail = generatePrimaryEmail(employee, connection.domain);

  const payload = {
    external_connection_id: connection.external_connection_id,
    primaryEmail,
    name: {
      givenName: employee.preferred_name || employee.first_name,
      familyName: employee.last_name,
    },
    title: employee.job_title,
    // orgUnitPath can be added based on department later
  };

  try {
    // Stub: Simulate API call
    // In production: const response = await fetch(`${API_BASE}/provision-user`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    console.log('[GoogleWorkspace] Provisioning user:', payload);

    // Simulate successful response
    const simulatedUserId = `google-user-${Date.now()}`;

    // Update employee record
    await Employee.update(employee.id, {
      google_primary_email: primaryEmail,
      google_user_id: simulatedUserId,
      google_sync_status: 'provisioned',
      google_last_sync_at: now,
      google_last_error: null,
    });

    return { ok: true, google_user_id: simulatedUserId, google_primary_email: primaryEmail };
  } catch (error) {
    const errorMessage = error.message || 'Failed to provision Google Workspace user';
    
    await Employee.update(employee.id, {
      google_sync_status: 'error',
      google_last_error: errorMessage,
    });

    return { ok: false, error: errorMessage };
  }
}

/**
 * Suspend a Google Workspace user for an employee (used during offboarding)
 * @param {Object} employee - Employee record
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function suspendUserForEmployee(employee) {
  if (!employee.google_user_id) {
    return { ok: false, error: 'Employee has no linked Google account' };
  }

  const connection = await getActiveConnection();
  if (!connection) {
    return { ok: false, error: 'No active Google Workspace connection' };
  }

  const now = new Date().toISOString();

  const payload = {
    external_connection_id: connection.external_connection_id,
    google_user_id: employee.google_user_id,
  };

  try {
    // Stub: Simulate API call
    // In production: await fetch(`${API_BASE}/suspend-user`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    console.log('[GoogleWorkspace] Suspending user:', payload);

    // Update employee record
    await Employee.update(employee.id, {
      google_sync_status: 'suspended',
      google_last_sync_at: now,
      google_last_error: null,
    });

    return { ok: true };
  } catch (error) {
    const errorMessage = error.message || 'Failed to suspend Google Workspace user';

    await Employee.update(employee.id, {
      google_sync_status: 'error',
      google_last_error: errorMessage,
    });

    return { ok: false, error: errorMessage };
  }
}

/**
 * Update Google Workspace user profile for an employee
 * Keeps name, title, manager, department in sync
 * @param {Object} employee - Employee record
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function updateUserProfileForEmployee(employee) {
  if (!employee.google_user_id) {
    return { ok: false, error: 'Employee has no linked Google account' };
  }

  if (employee.google_sync_enabled === false) {
    return { ok: false, error: 'Google sync is disabled for this employee' };
  }

  const connection = await getActiveConnection();
  if (!connection) {
    return { ok: false, error: 'No active Google Workspace connection' };
  }

  const now = new Date().toISOString();

  const payload = {
    external_connection_id: connection.external_connection_id,
    google_user_id: employee.google_user_id,
    name: {
      givenName: employee.preferred_name || employee.first_name,
      familyName: employee.last_name,
    },
    title: employee.job_title,
    // Additional fields can be added: department, manager, phone, etc.
  };

  try {
    // Stub: Simulate API call
    // In production: await fetch(`${API_BASE}/update-user`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    console.log('[GoogleWorkspace] Updating user profile:', payload);

    // Update sync timestamp
    await Employee.update(employee.id, {
      google_last_sync_at: now,
      google_last_error: null,
    });

    return { ok: true };
  } catch (error) {
    const errorMessage = error.message || 'Failed to update Google Workspace user';

    await Employee.update(employee.id, {
      google_last_error: errorMessage,
    });

    return { ok: false, error: errorMessage };
  }
}
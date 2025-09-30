import { Handler } from 'aws-lambda';

// Tesla Energy API endpoints
const TESLA_AUTH_URL = 'https://auth.tesla.com/oauth2/v3/token';
const TESLA_API_URL = 'https://owner-api.teslamotors.com/api/1';

interface LambdaEvent {
  reservePercent: number; // 100 for midnight, 20 for 6am
}

// Get credentials from environment variables
function getCredentials() {
  const refreshToken = process.env.TESLA_REFRESH_TOKEN;
  const clientId = process.env.TESLA_CLIENT_ID;
  const clientSecret = process.env.TESLA_CLIENT_SECRET;

  if (!refreshToken || !clientId || !clientSecret) {
    throw new Error('Missing Tesla credentials in environment variables');
  }

  return { refreshToken, clientId, clientSecret };
}

// Get access token using refresh token
async function getAccessToken(): Promise<string> {
  const credentials = getCredentials();

  const response = await fetch(TESLA_AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      client_id: credentials.clientId,
      refresh_token: credentials.refreshToken,
    }),
  });

  if (!response.ok) {
    throw new Error(`Auth failed: ${response.statusText}`);
  }

  const data = (await response.json()) as { access_token: string };
  return data.access_token;
}

// Get list of energy sites (Powerwalls)
async function getEnergySites(accessToken: string): Promise<any[]> {
  const response = await fetch(`${TESLA_API_URL}/products`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to get products: ${response.statusText}`);
  }

  const data = (await response.json()) as { response: any[] };

  // Filter for energy sites (Powerwalls)
  return data.response.filter((product: any) => product.resource_type === 'battery');
}

// Get current site status
async function getSiteStatus(accessToken: string, siteId: string): Promise<any> {
  const response = await fetch(`${TESLA_API_URL}/energy_sites/${siteId}/site_status`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to get site status: ${response.statusText}`);
  }

  const data = (await response.json()) as { response: any };
  return data.response;
}

// Set backup reserve percentage
async function setBackupReserve(accessToken: string, siteId: string, percent: number): Promise<void> {
  const response = await fetch(`${TESLA_API_URL}/energy_sites/${siteId}/backup`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      backup_reserve_percent: percent,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Backup reserve API error:', {
      status: response.status,
      statusText: response.statusText,
      body: errorText,
      requestedPercent: percent,
    });
    throw new Error(`Failed to set backup reserve: ${response.statusText} - ${errorText}`);
  }

  const data = (await response.json()) as { response: { backup_reserve_percent: number } };
  console.log(`Successfully set backup reserve to ${percent}%`, data);

  // Verify the change took effect
  if (data.response && data.response.backup_reserve_percent !== undefined) {
    console.log('New backup reserve:', data.response.backup_reserve_percent);
  }
}

export const handler: Handler = async (event: LambdaEvent) => {
  try {
    console.log('Starting Powerwall backup reserve update...');
    console.log('Event received:', JSON.stringify(event));
    console.log('Reserve percent from event:', event.reservePercent);

    if (!event.reservePercent && event.reservePercent !== 0) {
      throw new Error('reservePercent not provided in event');
    }

    // Authenticate
    const accessToken = await getAccessToken();

    // Get energy sites
    const sites = await getEnergySites(accessToken);

    if (sites.length === 0) {
      throw new Error('No Powerwall systems found in account');
    }

    // Use first site (modify if you have multiple installations)
    const site = sites[0];
    const siteId = site.energy_site_id;

    console.log(`Using Powerwall site: ${site.site_name} (ID: ${siteId})`);

    // Get current status (optional, for logging)
    const status = await getSiteStatus(accessToken, siteId);
    console.log('Current battery level:', status.percentage_charged);
    console.log('Current backup reserve:', status.backup_reserve_percent);

    // Set new backup reserve
    await setBackupReserve(accessToken, siteId, event.reservePercent);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `Backup reserve set to ${event.reservePercent}%`,
        site: site.site_name,
        previousReserve: status.backup_reserve_percent,
        newReserve: event.reservePercent,
        currentCharge: status.percentage_charged,
      }),
    };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
};

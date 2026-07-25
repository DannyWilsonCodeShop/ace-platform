/**
 * Creates a portal account for customers or team members.
 * Uses Cognito admin APIs via Lambda (invoked through API).
 * 
 * For now in sandbox, we'll call the Cognito API directly since
 * the authenticated admin user has the necessary permissions.
 */

const API_ENDPOINT = 'https://zuq0ae5dqf.execute-api.us-east-1.amazonaws.com';

interface CreateUserParams {
  action: 'createCustomer' | 'createTeamMember';
  email: string;
  name: string;
  phone?: string;
  role?: 'manager' | 'crew' | 'performer' | 'customer';
}

interface CreateUserResult {
  success: boolean;
  message: string;
  error?: string;
}

export async function createPortalUser(params: CreateUserParams): Promise<CreateUserResult> {
  try {
    const response = await fetch(`${API_ENDPOINT}/create-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...params,
        sendWelcomeEmail: true,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, message: data.error || 'Failed to create user', error: data.error };
    }

    return { success: true, message: data.message };
  } catch (err: any) {
    return { success: false, message: err.message || 'Network error', error: err.message };
  }
}

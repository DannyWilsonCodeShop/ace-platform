/**
 * Create User Lambda
 * Creates Cognito accounts for customers and team members.
 * Called from the admin portal when:
 * 1. A quote is converted to a gig (auto-creates customer account)
 * 2. An owner/manager adds a new team member from Settings
 */

import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminAddUserToGroupCommand,
  AdminSetUserPasswordCommand,
} from '@aws-sdk/client-cognito-identity-provider';

const cognito = new CognitoIdentityProviderClient({ region: 'us-east-1' });
const USER_POOL_ID = process.env.USER_POOL_ID || '';

interface CreateUserEvent {
  action: 'createCustomer' | 'createTeamMember';
  email: string;
  name: string;
  phone?: string;
  role?: 'manager' | 'crew' | 'performer' | 'customer';
  sendWelcomeEmail?: boolean;
}

export const handler = async (event: CreateUserEvent) => {
  const { action, email, name, phone, role, sendWelcomeEmail = true } = event;

  const group = action === 'createCustomer' ? 'customer' : (role || 'crew');

  try {
    // Create the user
    const createResult = await cognito.send(new AdminCreateUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: email,
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'email_verified', Value: 'true' },
        { Name: 'name', Value: name },
        ...(phone ? [{ Name: 'phone_number', Value: phone }] : []),
      ],
      // If sendWelcomeEmail, Cognito sends temp password via email
      // If not, we suppress and set a permanent password
      MessageAction: sendWelcomeEmail ? undefined : 'SUPPRESS',
      DesiredDeliveryMediums: ['EMAIL'],
    }));

    // Add to group
    await cognito.send(new AdminAddUserToGroupCommand({
      UserPoolId: USER_POOL_ID,
      Username: email,
      GroupName: group,
    }));

    const userId = createResult.User?.Username || '';

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        userId,
        email,
        group,
        message: sendWelcomeEmail
          ? `Account created. Welcome email sent to ${email}.`
          : `Account created for ${email}.`,
      }),
    };
  } catch (err: any) {
    // If user already exists, just add to group
    if (err.name === 'UsernameExistsException') {
      try {
        await cognito.send(new AdminAddUserToGroupCommand({
          UserPoolId: USER_POOL_ID,
          Username: email,
          GroupName: group,
        }));
        return {
          statusCode: 200,
          body: JSON.stringify({
            success: true,
            email,
            group,
            message: `User already exists. Added to ${group} group.`,
          }),
        };
      } catch (groupErr) {
        return {
          statusCode: 500,
          body: JSON.stringify({ error: 'Failed to add existing user to group' }),
        };
      }
    }

    console.error('Create user error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || 'Failed to create user' }),
    };
  }
};

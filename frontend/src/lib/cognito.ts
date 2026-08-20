const CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID as string | undefined;
const ENDPOINT = "https://cognito-idp.ap-south-1.amazonaws.com/";

async function cognito(target: string, body: Record<string, unknown>) {
  if (!CLIENT_ID) {
    throw new Error("VITE_COGNITO_CLIENT_ID is missing. Add it to frontend/.env and restart npm run dev.");
  }
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/x-amz-json-1.1",
      "X-Amz-Target": target,
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as { message?: string; AuthenticationResult?: { IdToken: string } };
  if (!res.ok) {
    throw new Error(data.message || `Cognito ${res.status}`);
  }
  return data;
}

export async function signUp(email: string, password: string) {
  await cognito("AWSCognitoIdentityProviderService.SignUp", {
    ClientId: CLIENT_ID,
    Username: email,
    Password: password,
    UserAttributes: [{ Name: "email", Value: email }],
  });
}

export async function signIn(email: string, password: string): Promise<string> {
  const data = await cognito("AWSCognitoIdentityProviderService.InitiateAuth", {
    AuthFlow: "USER_PASSWORD_AUTH",
    ClientId: CLIENT_ID,
    AuthParameters: { USERNAME: email, PASSWORD: password },
  });
  const token = data.AuthenticationResult?.IdToken;
  if (!token) throw new Error("No IdToken");
  return token;
}
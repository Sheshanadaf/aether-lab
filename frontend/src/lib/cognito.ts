const CLIENT_ID = String(import.meta.env.VITE_COGNITO_CLIENT_ID ?? "")
  .trim()
  .replace(/^["']|["']$/g, "");
const ENDPOINT = "https://cognito-idp.ap-south-1.amazonaws.com/";

type CognitoBody = {
  message?: string;
  __type?: string;
  AuthenticationResult?: { IdToken: string };
};

export class CognitoError extends Error {
  cognitoType: string;
  constructor(message: string, cognitoType = "") {
    super(message);
    this.name = "CognitoError";
    this.cognitoType = cognitoType;
  }
}

async function cognito(target: string, body: Record<string, unknown>) {
  if (!CLIENT_ID || CLIENT_ID.includes("paste-terraform")) {
    throw new Error("Cognito is not configured. Add VITE_COGNITO_CLIENT_ID to frontend/.env and restart npm run dev.");
  }
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/x-amz-json-1.1",
      "X-Amz-Target": target,
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as CognitoBody;
  const cognitoType = (data.__type || "").split("#").pop() || "";
  if (!res.ok || /Exception$/.test(cognitoType)) {
    throw new CognitoError(data.message || cognitoType || `Cognito ${res.status}`, cognitoType);
  }
  return data;
}

export function friendlyAuthError(err: unknown, fallback = "That sign-in attempt failed.") {
  const type = err instanceof CognitoError ? err.cognitoType : "";
  const raw = err instanceof Error ? err.message : fallback;
  const text = `${type} ${raw}`.toLowerCase();
  if (text.includes("not configured") || text.includes("client_id")) {
    return raw;
  }
  if (text.includes("cannot be specified in both username and")) {
    return "Could not create the account. Try again, or sign in if you already have one.";
  }
  if (text.includes("validation errors") || text.includes("failed to satisfy") || text.includes("member must")) {
    return "Enter a valid email and a password with at least 8 characters, including uppercase, lowercase, and a number.";
  }
  if (text.includes("incorrect username") || text.includes("notauthorized")) {
    return "That email or password is not correct.";
  }
  if (text.includes("already exists") || text.includes("usernameexists") || text.includes("aliasexists")) {
    return "An account with that email already exists. Sign in instead.";
  }
  if (text.includes("invalidpassword") || text.includes("password did not conform") || text.includes("password must")) {
    return "Password needs 8+ characters, with uppercase, lowercase, and a number.";
  }
  if (text.includes("invalidparameter") || text.includes("invalid email")) {
    return "Enter a valid email address.";
  }
  if (text.includes("not confirmed") || text.includes("usernotconfirmed")) {
    return "This account is not confirmed yet.";
  }
  if (text.includes("limitexceeded") || text.includes("too many")) {
    return "Too many attempts. Wait a moment and try again.";
  }
  if (raw.length > 140) {
    return fallback;
  }
  return raw || fallback;
}

function emailUser(email: string) {
  return email.trim().toLowerCase();
}

export async function signUp(email: string, password: string) {
  // username_attributes = ["email"] — do not also send email in UserAttributes
  await cognito("AWSCognitoIdentityProviderService.SignUp", {
    ClientId: CLIENT_ID,
    Username: emailUser(email),
    Password: password,
  });
}

export async function signIn(email: string, password: string): Promise<string> {
  const data = await cognito("AWSCognitoIdentityProviderService.InitiateAuth", {
    AuthFlow: "USER_PASSWORD_AUTH",
    ClientId: CLIENT_ID,
    AuthParameters: { USERNAME: emailUser(email), PASSWORD: password },
  });
  const token = data.AuthenticationResult?.IdToken;
  if (!token) throw new CognitoError("Sign-in did not return a token.");
  return token;
}

async function signInRetry(email: string, password: string) {
  try {
    return await signIn(email, password);
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 400));
    return signIn(email, password);
  }
}

export async function createAccount(email: string, password: string): Promise<string> {
  try {
    await signUp(email, password);
  } catch (e) {
    const type = e instanceof CognitoError ? e.cognitoType : "";
    const message = e instanceof Error ? e.message : "";
    if (/UsernameExists|AliasExists/i.test(type) || /already exists/i.test(message)) {
      try {
        return await signIn(email, password);
      } catch {
        throw new CognitoError("An account with that email already exists. Sign in instead.", "UsernameExistsException");
      }
    }
    throw e;
  }
  return signInRetry(email, password);
}

import express from "express";
import crypto from "crypto";

const app = express();

const CLIENT_ID = "k8yMEe7fBbHSKo51T5aNwpWIptJrQGcB";
const ISSUER_BASE_URL = "https://dev-8jv8mok1bnikr1es.us.auth0.com";
const REDIRECT_URI = "http://192.168.18.156:3000/auth/callback";

const verifier = crypto.randomBytes(32).toString("base64url");

app.get("/login", (req, res) => {

  const challenge = crypto
    .createHash("sha256")
    .update(verifier)
    .digest("base64url");

  const state = crypto.randomUUID();

  console.log({
    verifier,
    challenge,
    state
  });

  const url =
    `${ISSUER_BASE_URL}/authorize?` +
    new URLSearchParams({
      response_type: "code",
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI, // La API Nuestra a la que el cliente va a redirigir después de autenticarse
      audience: "https://tm6l5mqj-3000.brs.devtunnels.ms", // La api a la qu eestoy pidiendo permisos (La del cliente en este caso)
      scope: "openid profile email offline_access",
      state,
      code_challenge: challenge,
      code_challenge_method: "S256",
    });
    console.log("Redirecting to:", url);
  return res.send(url);
  res.redirect(url);
});

app.get("/auth/callback", async (req, res) => {
  const { code, state } = req.query;

  console.log("Received code:", code);
  console.log("Received state:", state);

  // In a real application, you would verify the state and retrieve the verifier from a secure store

  const response = await fetch(
    "https://dev-8jv8mok1bnikr1es.us.auth0.com/oauth/token",
    {
        method: "POST",
        headers: {
        "Content-Type": "application/json",
        },
            body: JSON.stringify({
            grant_type: "authorization_code",
            client_id: CLIENT_ID,
            code: req.query.code,
            redirect_uri: REDIRECT_URI,
            code_verifier: verifier
        }),
    }
    );

    const tokens = await response.json();

    console.log(tokens, verifier);

    res.json({
        verifier,
        message: "Authentication successful",
        tokens,
    });
});

app.get("/api", (req, res) => {
  res.json({
    message: "Hello from the API!",
  });
});

app.listen(3000, () => console.log("Server running on http://localhost:3000"));
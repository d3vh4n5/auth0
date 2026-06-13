import express from "express";
import crypto from "crypto";
import { auth } from "express-oauth2-jwt-bearer";
import { config } from "dotenv";

config()

const app = express();

const CLIENT_ID = process.env.CLIENT_ID;
const ISSUER_BASE_URL = process.env.ISSUER_BASE_URL;
const REDIRECT_URI = process.env.REDIRECT_URI;
const AUDIENCE = process.env.AUDIENCE // Esta es la API a la que estoy pidiendo acceso, en Digito será la del cliente, Aquí será la misma solo para no tener 2 APIs distintas en este ejemplo

// El codigo verificador debería guardarse en DB junto con el state.
const verifiers = {}

app.get("/login", (req, res) => {
    const verifier = crypto.randomBytes(32).toString("base64url");

  const challenge = crypto
    .createHash("sha256")
    .update(verifier)
    .digest("base64url");

  const state = crypto.randomUUID();

  verifiers[`${state}`] = verifier // Guardaría el verifier asociado al state en un lugar seguro (DB)

  console.log(verifiers)

  const url =
    `${ISSUER_BASE_URL}/authorize?` +
    new URLSearchParams({
      response_type: "code",
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI, // La API Nuestra a la que el cliente va a redirigir después de autenticarse
      audience: AUDIENCE, // La api a la qu eestoy pidiendo permisos (La del cliente en este caso)
      scope: "openid profile email offline_access",
      state,
      code_challenge: challenge,
      code_challenge_method: "S256",
    });
    console.log("Resulting url:", url);
  return res.send(url);
  res.redirect(url);
});

app.get("/auth/callback", async (req, res) => {
  const { code, state } = req.query;

  const verifier = verifiers[state]

  console.log("Received code:", code);
  console.log("Received state:", state);
  console.log("Found verifier:", verifier);

  if (!verifier) 
    // Template de verificación fallida
    return res.status(401).json(
    {
        error: "No verifier found for this state"
    }
  )

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

    console.log({response})

    // Template de verificación exitosa
    res.json({
        verifier,
        message: "Authentication successful",
        tokens,
    });
});

// Esto en realidad, en el caso de Digito, sería la API del cliente, no estaría de nuestro lado
const checkJwt = auth({
  audience: AUDIENCE,
  issuerBaseURL: ISSUER_BASE_URL,
});

app.get("/api", checkJwt, (req, res) => {
  res.json({
    status: "OK",
    message: "Token válido: Accediendo a información protegida",
  });
});

app.listen(3000, () => console.log("Server running on http://localhost:3000"));
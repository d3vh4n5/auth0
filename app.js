import path from 'path';
import express from "express";
import crypto from "crypto";
import { auth } from "express-oauth2-jwt-bearer";
import { config } from "dotenv";
import { sendTemplate } from "./blip/campaign.service.js";

config()

const app = express();
app.use(express.json())

const CLIENT_ID = process.env.CLIENT_ID; // EL ID de cliente de Auth0
const ISSUER_BASE_URL = process.env.ISSUER_BASE_URL; // URL del cliente Auth0 que maneja los accesos
const REDIRECT_URI = process.env.REDIRECT_URI; // Mi callback
const AUDIENCE = process.env.AUDIENCE // Esta es la API a la que estoy pidiendo acceso

// El codigo verificador debería guardarse en DB junto con el state.
const sessions = new Map();
const authEvents = [];

function addAuthEvent(event) {

  authEvents.push(event);

  if (authEvents.length > 1000) {
    authEvents.shift();
  }
}

app.get('/v1/digito-auth0/session/:contactIdentity', (req, res) => {

  const { contactIdentity } = req.params;
  const userSession = sessions.get(contactIdentity);
  
  if (!userSession?.access_token) {
    
    addAuthEvent({
      identity: contactIdentity,
      event: 'NO_SESSION',
      timestamp: Date.now()
    });
    console.log(contactIdentity, "NO_SESSION")

    return res.send('NO_SESSION');
  }

  const REFRESH_MARGIN = 5 * 60 * 1000;

  if (Date.now() >= userSession.expiresAt - REFRESH_MARGIN) {

    addAuthEvent({
      identity: contactIdentity,
      event: 'TOKEN_EXPIRED',
      timestamp: Date.now()
    });
    console.log(contactIdentity, "TOKEN_EXPIRED")
    return res.send('TOKEN_EXPIRED');
  }

  addAuthEvent({
    identity: contactIdentity,
    event: 'TOKEN_OK',
    timestamp: Date.now()
  });
  console.log(contactIdentity, "TOKEN_OK")
  return res.send('TOKEN_OK');
});

app.get('/v1/digito-auth0/events/:contactIdentity', (req, res) => {

  const { contactIdentity } = req.params;

  const events = authEvents.filter(
    e => e.identity === contactIdentity
  );

  res.json(events);
});


app.post("/v1/digito-auth0/login", (req, res) => {
  const { identity } = req.body

  if (!identity) return res.status(400).json({ error: "identity not found" })

    const verifier = crypto.randomBytes(32).toString("base64url");
    
  const challenge = crypto
    .createHash("sha256")
    .update(verifier)
    .digest("base64url");

  const state = crypto.randomUUID();



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

    // Se guardaria en la tabla de sesiones
    const session = {
      state,
      verifier,
      identity,
      url,
      createdAt: Date.now()
    };

    sessions.set(identity, session);

    addAuthEvent({
      identity,
      state,
      event: 'LOGIN_STARTED',
      timestamp: Date.now()
    });

  return res.send(url);
  res.redirect(url);
});

// /v1/digito-auth0/callback
app.get("/auth/callback", async (req, res) => {
  const { code, state } = req.query;
  let verifier, identity, user;

  try{
    user = [...sessions.values()]
      .find(s => s.state === state);

    if (!user)
      return res.status(400).send('Invalid state');
    verifier = user.verifier
    identity = user.identity
  
  } catch ( error ) {
    // Template de fail
    return res.status(401).json({
        error: "No verifier found for this state"
    })
  }
  const phone = '+' + identity.split('@')[0]

  // In a real application, you would verify the state and retrieve the verifier from a secure store

  const response = await fetch(
    `${ISSUER_BASE_URL}/oauth/token`,
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

    // console.log({authResponseStatus: response.status, tokens})

    if (!response.ok) {
      const templateResult = await sendTemplate(phone, 'auth_result_fail_v1', 'en_US')
      console.error("Error de autenticacion: ", {tokens})
      addAuthEvent({
        identity: user?.identity,
        state,
        event: 'LOGIN_FAILED',
        error: error.message,
        timestamp: Date.now()
      });
      return res.sendFile(
        path.join(
          process.cwd(),
          'public',
          'auth-fail.html'
        )
      )
      return res.status(401).json(tokens);
    }

    sessions.set(user.identity, {
      ...user,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiresAt: Date.now() + (tokens.expires_in * 1000),
      authenticatedAt: Date.now()
    });

    addAuthEvent({
      identity: user.identity,
      state,
      event: 'LOGIN_SUCCESS',
      timestamp: Date.now()
    });

    // console.log({sessions})
    // Template de verificación exitosa
    // const templateResult = await sendTemplate(phone, 'auth_result_ok_v1', 'en_US')

    const loginfo = {
        verifier,
        message: "Authentication successful",
        tokens,
        // templateResult
    }
    // console.log(loginfo)
    // res.json(loginfo);
    console.log("Authentication successful")
    return res.sendFile(
      path.join(
        process.cwd(),
        'public',
        'auth-success.html'
      )
    )
    return res.redirect('https://wa.me/+5491171413315');
});

app.use(express.urlencoded({ extended: true }));

app.post('/keys', (req, res) => {
  console.log('Body recibido:');
  console.log(req.body);

  res.status(200).json({
    success: true,
    received: req.body
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
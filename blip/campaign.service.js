export async function sendTemplate(phone, templateName, templateLanguage){
    // Armar el body para la request del router
    const BLIP_ROUTER_URL = process.env.COMMANDS_URL;
    const BOT_KEY = process.env.BOT_KEY

    const botName = "syrdigitodev";
    const campaignName = "test-auth"
    const flowId = "65830bf6-05ec-420f-b23c-aa1f82f31964" // El identificador del bot que está en la config
    const id = generateUUID();

    const blipBody = {   
        "id": id,
        "to": "postmaster@activecampaign.msging.net",
        "method": "set",
        "uri": "/campaign/full",
        "type": "application/vnd.iris.activecampaign.full-campaign+json",
        "resource": {
            "campaign": {
                "name": `${campaignName}${id}`,
                "masterState": botName+"@msging.net",
                // "campaignType": "Batch",
                "campaignType": "Individual",
                "flowId": flowId,
                "stateId": "onboarding"
            },
            "audience": {
                "recipient": phone,
                // "messageParams": {
                //     "1": "Variable innecesaria"
                // }
            },
            // "audiences": [
            //     {
            //         "recipient": testPhone,
            //         "messageParams": {
            //             "1": first_name
            //         }
            //     }
            // ],
            "message": {
                "messageTemplate": templateName,
                "messageTemplateLanguage": templateLanguage,
                // "messageParams": ["1"]
            }
        }
    }
    
    console.log({blipBody: JSON.stringify(blipBody)})

    try {
        const resp = await fetch(BLIP_ROUTER_URL, {
            method: "POST",
            headers:{
                "Content-type": "application/json",
                "Authorization": BOT_KEY
            },
            body: JSON.stringify(blipBody),
        })

        const data = await resp.json(); 
        console.log("Response body:", data);
        return data
        res.status(200).send('Evento recibido');
    } catch (error) {
        console.error(error)
        res.json({error})
    }
}

  // Función para generar un UUID simulado
  function generateUUID() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
}
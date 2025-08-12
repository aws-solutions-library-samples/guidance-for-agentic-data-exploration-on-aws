const https = require('https');

const buildPath = (baseUrl,input) => {
  let path = baseUrl;

  // Set default values in case of missing parameters
  const baseParams = {
    count: 50,
  };

  // Iterate through parameters
  input.parameters.forEach((param) => {
    if(param.name !== 'count'){
        baseParams[param.name] = param.value.replace(new RegExp('"', 'g'), "") || baseParams[param.name];
    }
  });

  // Dynamically build querystring parameters
  const defaultParams = Object.entries(baseParams)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');

  path += `?${defaultParams}`;

  return path;
}

exports.handler = async (event, context) => {
    console.log('event: ', event);
    let action_response = {
        'actionGroup': event.actionGroup,
        'apiPath': event.apiPath,
        'httpMethod': event.httpMethod,
        'httpStatusCode': 200,
        'responseBody': null
    }
    
    if(!event || !event.parameters || !Array.isArray(event.parameters) || event.parameters.length < 1){
        action_response.responseBody = 'Required parameters are missing in the request, the following were provided: ' + JSON.stringify(event.parameters);
        action_response.httpStatusCode = 400;
        return {response : action_response}
    }
    
    try {
        const body = await new Promise((resolve, reject) => {
            const options = {
                'method': 'GET',
                'hostname': 'geocoding-api.open-meteo.com',
                'path': buildPath('/v1/search',event),
                'headers': {}
            }
            
            const req = https.request(options, (res) => {
                let body = '';
                res.setEncoding('utf8');
                res.on('data', (chunk) => body += chunk);
                res.on('end', () => resolve(body));
            });

            req.on('error', reject);
            req.end();
        });

        let api_response = {
            'application/json': {
                'body': {
                    'response': body
                }
            }
        }

        if(typeof(JSON.parse(body).results) === 'undefined'){
            api_response['application/json'].body.response = 'No city name matched with the name provided. Try again by splitting the name and/or increasing the count parameter to get more results';
        }

        // console.log('Successfully processed HTTPS response');

        action_response.responseBody = api_response;
        
        let response = {response: action_response};
        // console.log('return: ', JSON.stringify(response, null, 2));
        return response

    } catch (error) {
        console.error('Error:', error);
        throw error; // Rethrow the error for AWS Lambda to handle
    }
};

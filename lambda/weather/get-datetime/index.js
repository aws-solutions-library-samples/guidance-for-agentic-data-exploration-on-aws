const getCurrentTime = (timezone) => {
    const options = {
        timeZone: timezone,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        timeZoneName: 'short'
    };

    const formattedTime = new Date().toLocaleString('en-US', options);
    return formattedTime;
};

const getParameterByName = (parameters_list, name) => {
    const result = parameters_list.find(obj => obj.name === name);
    return result || {value: 'UTC'}; // Return null if the object is not found
}

exports.handler = async (event) => {
    console.log('event:', event);
    // Structure of the response for the Bedrock Agent
    let action_response = {
        'actionGroup': event.actionGroup,
        'apiPath': event.apiPath,
        'httpMethod': event.httpMethod,
        'httpStatusCode': 200,
        'responseBody': null
    }

  try {
      // Get the current time in the specified timezone
      const currentTime = getCurrentTime(getParameterByName(event.parameters || [],'timezone').value);
      let api_response = {
          'application/json': {
              'body': {
                  'response': JSON.stringify({current_date_time: currentTime})
              }
          }
      }
      // Return the response in a way that Bedrock agent will understand it
      action_response.responseBody = api_response;
      let response = {response: action_response};
    //   console.log('return: ', JSON.stringify(response, null, 2));
      return response
  } catch (error) {
      return {
          statusCode: 500,
          body: `Error: ${error.message}`
      };
  }
};

"use strict";

// lambda/get-weather/index.js
var https = require("https");
var buildPath = (baseUrl, input) => {
  let path = baseUrl;
  const baseParams = {
    current: "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,showers,snowfall,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m",
    hourly: "temperature_2m,wind_speed_10m,cloud_cover,precipitation_probability,snowfall,snow_depth",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,uv_index_max,precipitation_sum,rain_sum,snowfall_sum"
  };
  input.parameters.forEach((param) => {
    if (param.name === 'hourly' || param.name === "daily") {
      // Remove brackets, quotes, and spaces, then split and join
      baseParams[param.name] = param.value
        .replace(/[\[\]"]/g, '')  // remove brackets and quotes
        .split(',')               // split into array
        .map(item => item.trim()) // trim whitespace
        .join(',');              // join back with commas
    } else {
      baseParams[param.name] = param.value.replace(new RegExp('"', "g"), "") || baseParams[param.name];
    }
  });
  const defaultParams = Object.entries(baseParams).map(([key, value]) => `${key}=${value}`).join("&");
  path += `?${defaultParams}`;
  console.log("path: ", path);
  return path;
};

const MAX_EVENT_SIZE_KB = 25; // Maximum allowed size in KB

/**
 * Utility function to calculate size of an object in KB
 * @param {Object} obj - Object to calculate size for
 * @returns {number} Size in KB
 */
const calculateObjectSizeKB = (obj) => {
    const sizeInBytes = Buffer.byteLength(JSON.stringify(obj));
    return sizeInBytes / 1024;
};

/**
 * Validates event size and returns validation result
 * @param {Object} event - Lambda event object
 * @param {number} maxSizeKB - Maximum allowed size in KB
 * @returns {Object} Validation result
 */
const validateEventSize = (event, maxSizeKB = MAX_EVENT_SIZE_KB) => {
    const sizeKB = calculateObjectSizeKB(event);
    const factor = Math.round(Math.ceil(sizeKB/maxSizeKB))
    return {
        isValid: sizeKB <= maxSizeKB,
        size: sizeKB,
        maxAllowed: maxSizeKB,
        formattedSize: `${sizeKB.toFixed(2)} KB`,
        formattedMaxSize: `${maxSizeKB} KB`,
        factor 
    };
};
exports.handler = async (event, context) => {
  console.log("event: ", event);
  let action_response = {
    "actionGroup": event.actionGroup,
    "apiPath": event.apiPath,
    "httpMethod": event.httpMethod,
    "httpStatusCode": 200,
    "responseBody": null
  };
  if (!event || !event.parameters || !Array.isArray(event.parameters) || event.parameters.length < 2) {
    action_response.responseBody = "Required parameters are missing in the request, the following were provided: " + JSON.stringify(event.parameters);
    action_response.httpStatusCode = 400;
    return { response: action_response };
  }
  try {
    const body = await new Promise((resolve, reject) => {
      const options = {
        "method": "GET",
        "hostname": "api.open-meteo.com",
        "path": buildPath("/v1/forecast", event),
        "headers": {}
      };
      console.log("options: ", options);
      const req = https.request(options, (res) => {
        let body2 = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => body2 += chunk);
        res.on("end", () => resolve(body2));
      });
      req.on("error", reject);
      req.end();
    });
    let api_response = {
      "application/json": {
        "body": {
          "response": body
        }
      }
    };
    console.log("Successfully processed HTTPS response");

    //Check event size
    const sizeValidation = validateEventSize(api_response);
    if(sizeValidation.isValid)
    {
        console.log("Event size is valid");
        console.log("Event size: ", sizeValidation.formattedSize);
        console.log("Max allowed size: ", sizeValidation.formattedMaxSize);
        
    }
    else{
        console.log("Event size is not valid");
        console.log("Event size: ", sizeValidation.formattedSize);
        console.log("Max allowed size: ", sizeValidation.formattedMaxSize);      
    
        //If exceding size just respond back with static error message
        const errormessage = "Return payload exceeds limits, reduce search radius by factor = " + sizeValidation.factor
        api_response = {
          "application/json": {
            "body": {
              "response": errormessage
            }
          }
        };        
    }    
    action_response.responseBody = api_response;
    let response = { response: action_response };
    console.log("return: ", JSON.stringify(response, null, 2));
    
    return response;
  } catch (error) {
    console.error("Error:", error);
    throw error;
  }
};

import { getAwsExports } from './amplifyConfig';
import { fetchAuthSession } from "aws-amplify/auth";
import { useAmplifyContext } from './AmplifyContext';
import { configureAmplify } from "./amplifyConfig";

export class ApiClientBase<T> {

  async getHeaders(): Promise<Record<string, string>> {
    return {
      Authorization: `Bearer ${await this.getAccessToken()}`,
      "Content-Type": "application/json",
    };
  }

  async getAccessToken(): Promise<string | undefined> {
    const session = await fetchAuthSession();
    const accessToken = session.tokens?.accessToken?.toString();

    if (accessToken) {
      // Decode the token to inspect its contents
      const tokenPayload = JSON.parse(atob(accessToken.split('.')[1]));
      // console.log('Token scopes:', tokenPayload.scope);
    }
  
    return accessToken;
  }

  async callStreamingAPI(resource: string, method: string = "GET", body: any = null): Promise<Response> {
    let awsExports;
    try {
      awsExports = useAmplifyContext();
    } catch (error) {
      awsExports = await configureAmplify();
    }
    if (!awsExports) {
      throw new Error("AWS exports not available");
    }
    const url = `${awsExports.domainName}/${resource}`;
    const headers = await this.getHeaders();
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : null,
    });
    if (response.status === 401) {
      throw new Error("Unauthorized");
    }
    if (!response.ok) {
      const errorResponse = await response.json();
      throw new Error(errorResponse.message || "Network response was not ok");
    }
    return response;
  }
}

export class ChatApiClient extends ApiClientBase<any> {
  async query(path: string, message: string): Promise<Response> {
    const body = {
      'query': message,
      'sessionId': localStorage.getItem('sessionId'),
      'userId': localStorage.getItem('sessionId')
    };
    return this.callStreamingAPI(path, "POST", body);
  }
}

export class MetricsApiClient extends ApiClientBase<any> {
  async sendFeedback(sessionId: string, feedback: string): Promise<Response> {
    const body = {
      'sessionId': localStorage.getItem('sessionId'),
      feedback,
      timestamp: new Date().toISOString()
    };
    return this.callStreamingAPI('metrics', 'POST', body);
  }
}

export class RestApiClient<T> extends ApiClientBase<T> {

  private endpoint:string

  constructor(public resource: string) {
    super()
    const config = useAmplifyContext();
    if (!config) {
      throw new Error("AWS exports not available");
    }
    const api = config?.API?.REST?.[this.resource];
    if (!api) {
      throw new Error(`API ${this.resource} not available`);
    }
    this.endpoint = `${api.endpoint}`
  }

  async getAll(): Promise<T[]> {
    console.log("getAll", this.endpoint);
    try {
      const response = await fetch(this.endpoint+"?limit=250", {
        headers: await this.getHeaders(),
        mode: 'cors',
      });
      if (response.status === 401) {
        throw new Error("Unauthorized");
      }
      
      try {
        const text = await response.text(); // Get response as text first
        
        // Pre-process the text to handle escaped SQL content
        const processedText = text.replace(/\\'/g, "'")  // Replace \' with '
                                .replace(/\\\\/g, "\\"); // Replace \\ with \
        
        try {
          const data = JSON.parse(processedText);
          return data.items as T[];
        } catch (parseError) {
          console.error("JSON parse error:", parseError);
          console.error("Error position information:", (parseError as SyntaxError).message);
          // Log a small portion of the text around the error position if possible
          if (parseError instanceof SyntaxError) {
            const errorMatch = parseError.message.match(/position (\d+)/);
            if (errorMatch && errorMatch[1]) {
              const position = parseInt(errorMatch[1]);
              const start = Math.max(0, position - 50);
              const end = Math.min(processedText.length, position + 50);
              console.error("Text around error position:", processedText.substring(start, end));
            }
          }
          throw parseError;
        }
      } catch (textError) {
        console.error("Error reading response text:", textError);
        throw textError;
      }
    }
    catch (error) {
      console.error("Error fetching data:", error);
      throw error;
    }
  }

  async get(id: string): Promise<T> {
    try {
      const response = await fetch(`${this.endpoint}${id}`, {
        headers: await this.getHeaders(),
        mode: 'cors',
      });
      if (response.status === 401) {
        throw new Error("Unauthorized");
      }
      
      try {
        const text = await response.text();
        
        // Pre-process the text to handle escaped SQL content
        const processedText = text.replace(/\\'/g, "'")  // Replace \' with '
                                .replace(/\\\\/g, "\\"); // Replace \\ with \
        
        const data = JSON.parse(processedText);
        return data.items[0] as T;
      } catch (textError) {
        console.error("Error reading response text:", textError);
        throw textError;
      }
    }
    catch (error) {
      console.error("Error fetching data:", error);
      throw error;
    }
  }
}

import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { signIn } from 'aws-amplify/auth'
import { configureAmplify } from '../../src/utils/amplifyConfig';


 declare global {
    namespace Cypress {
      interface Chainable {
        authenticate(user:string):Promise<any>
      }
     }
 }

 Cypress.Commands.add('authenticate', async (user) => {
   const amplifyConfig = await configureAmplify();

  //TODO: sort out expiration 
   const ssmClient =
     new SSMClient({
       credentials: { 
        ...Cypress.env('awscredentials'),
        expiration: undefined 
       }, 
       region: amplifyConfig.region
     });
 
   const command = new GetParameterCommand ({
     Name: user,
     WithDecryption: true
   });
   const { Parameter } = await ssmClient.send(command);
   if (!Parameter?.Value) {
     throw new Error(`No value found for user ${user}`);
   }
   const [ u, pw ]  = Parameter.Value.split('/',2)
   return await signIn({
        username: u, 
        password: pw
    });
 })
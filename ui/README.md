# The UI

This is basic React with CloudScape

## Running Locally

1. Get your cloudfront output url from CFN or the stack.
2. `cd ui`
3. `curl https://{CloudfrontURL}/aws-exports.json > aws-exports.json`
4. `npm install`
5. `npm run start`
6. open `http://localhost:5173/`

## Testing Locally

The tests are currently instrumented as Cypress End-to-End tests

`export AWS_PROFILE=whatever`

Add your cognito credentials to SSM
`aws ssm put-parameter --name '/panoptic/e2e-testing' --value 'admin/<your-password>' --type SecureString`

`npx cypress run` for headless

or

`npx cypress open` to view

## Updating UI locally

`npm run build` and resolve any TS errors

`cd ..` out of `ui`

`cdk deploy UserInterfaceStack --profile prod --verbose --exclusively --require-approval=never`

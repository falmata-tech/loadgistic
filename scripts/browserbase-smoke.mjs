if(process.env.BROWSERBASE_ENABLED!=='true'){
 console.log('Browserbase disabled. Set BROWSERBASE_ENABLED=true with credentials to run hosted smoke tests.');
 process.exit(0);
}
const required=['BROWSERBASE_API_KEY','BROWSERBASE_PROJECT_ID'];
for(const key of required)if(!process.env[key])throw new Error(`Missing ${key}`);
console.log('Browserbase adapter is configured. Run the Playwright suite through your Browserbase connection endpoint as documented in docs/BROWSERBASE.md.');

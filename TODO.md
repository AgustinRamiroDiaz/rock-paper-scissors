# load testing https://docs.colyseus.io/tools/loadtest

# Explore DBs https://docs.colyseus.io/database

# Add OAuth with Google or Github

# Fix bot logs

bots-1        | @rps/bots dev: [RandomJoiner_2] failed to join room UMJfQ6ZMC: 206 |             }
bots-1        | @rps/bots dev: 207 |             return await this.consumeSeatReservation(response, rootSchema);
bots-1        | @rps/bots dev: 208 |         }
bots-1        | @rps/bots dev: 209 |         catch (error) {
bots-1        | @rps/bots dev: 210 |             if (error instanceof ServerError) {
bots-1        | @rps/bots dev: 211 |                 throw new MatchMakeError(error.message, error.code);
bots-1        | @rps/bots dev:                             ^
bots-1        | @rps/bots dev: MatchMakeError: room "UMJfQ6ZMC" not found
bots-1        | @rps/bots dev:  code: 522,
bots-1        | @rps/bots dev: 
bots-1        | @rps/bots dev:       at createMatchMakeRequest (/app/node_modules/.bun/@colyseus+sdk@0.17.36+1359ab870a80bf9a/node_modules/@colyseus/sdk/build/Client.mjs:211:23)
bots-1        | @rps/bots dev:       at async joinById (/app/node_modules/.bun/@colyseus+sdk@0.17.36+1359ab870a80bf9a/node_modules/@colyseus/sdk/build/Client.mjs:123:27)
bots-1        | @rps/bots dev:       at async joinRoom (/app/packages/bots/src/index.ts:212:37)
bots-1        | @rps/bots dev:       at async findAndJoinOrCreateRoom (/app/packages/bots/src/index.ts:152:35)
bots-1        | @rps/bots dev: 
# CrimeScope frontend

React 18, TypeScript, and Vite workspace. Start both the API and frontend from the
repository root as described in the [run and handoff guide](../docs/handoff.md).

The frontend reads the API through [`src/api/client.ts`](src/api/client.ts), uses
`VITE_DATA_MODE=api` and `VITE_API_BASE_URL=http://localhost:4000/api/v1` from
`.env.example`, and renders saved analytical results without refitting models in the
browser. The response contract is documented in the repository's
[API contract](../docs/api_contract.md).

The nine routes and active release/run scope are listed in the root [README](../README.md)
and [methodology guide](../docs/methodology.md).

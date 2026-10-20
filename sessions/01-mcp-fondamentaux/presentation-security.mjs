import { labCommand, securityCode, validateEndpoint } from './presentation-lab.mjs?v=session3-4';

export const securityChapters = [
  { id: 'security-lab', minutes: 10 }, { id: 'auth', minutes: 3 }, { id: 'tokens', minutes: 4 },
  { id: 'rights', minutes: 3 }, { id: 'token-hops', minutes: 4 },
  { id: 'mcp-threats', minutes: 3 }, { id: 'agent-identities', minutes: 3 },
];

export function securityPractice(settings) {
  const publicStep = labCommand(2, settings);
  const protectedUrl = settings.protectedEndpoint ? validateEndpoint(settings.protectedEndpoint).endpoint : undefined;
  if (protectedUrl === validateEndpoint(settings.endpoint).endpoint) throw new Error('Public and protected endpoints must be separate.');
  const commands = protectedUrl ? securityCode(protectedUrl) : undefined;
  return [
    { short: 'Public', title: '1. Read CT-1001 without signing in', browser: true,
      code: publicStep.code, segments: publicStep.segments,
      why: 'Predict: can an anonymous caller read this fictional ticket? Run the public request below and inspect its id and title.',
      output: 'Run the request to see the actual server response.',
      question: 'What did this successful request prove?',
      answer: 'The public demo exposes this read-only tool without a credential. A successful MCP call proves connectivity and execution, not that access to real company data would be appropriate.' },
    { short: 'No token', title: '2. Send the same request to the protected server',
      code: commands?.anonymous,
      why: 'Change only the endpoint. Copy the command into your terminal. Predict whether get_ticket will execute without an access token.',
      output: 'Expected outcome: HTTP 401. Run the command in your terminal to observe the actual result; this is not a captured response.',
      question: 'Was get_ticket executed before the refusal?',
      answer: 'No. The protected server rejects the missing credential before any tool or ticket API call. Signing in to an agent application does not by itself authorize its MCP client.' },
    { short: 'Allowed', title: '3. Present a token with permission to read',
      code: commands?.authenticated,
      why: 'Obtain an approved Entra access token for this MCP API with Mcp.Read. Use the masked terminal prompt below, or the token-acquisition instructions after this exercise. Keep the request body unchanged.',
      output: 'Expected outcome: CT-1001, if the valid token carries Mcp.Read and the backend succeeds. The actual response stays in your terminal.',
      question: 'Did authentication change the MCP tool?',
      answer: 'No. It is still get_ticket with ticketId CT-1001. The client now presents an access token for this MCP resource. The server verifies it, checks Mcp.Read and only then executes the tool.' },
    { short: 'Not permitted', title: '4. Keep a valid identity, remove the read permission',
      code: commands?.authenticated,
      why: 'Use a separately prepared, valid token for this same MCP API without Mcp.Read. A fake, expired or wrong-audience token demonstrates 401, not 403. Never edit a signed token.',
      output: 'Expected outcome: HTTP 403, only with a valid token lacking Mcp.Read. The presenter must prepare this case. No identity or token is created here.',
      question: 'Why is this refusal different from case 2?',
      answer: 'The credential passed validation, but permission was denied. Authentication is not authorization. This sandbox rejects the call before the tool or ticket API runs.' },
  ];
}

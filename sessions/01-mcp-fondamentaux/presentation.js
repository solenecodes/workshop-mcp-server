const json = (value) => JSON.stringify(value, null, 2);
const toolCall = (write = false) => ({
  jsonrpc: '2.0', id: 3, method: 'tools/call',
  params: {
    name: write ? 'set_service_status' : 'list_services',
    arguments: write
      ? { team_id: 'team-demo', service_id: 'svc-catalog', status: 'maintenance' }
      : { team_id: 'team-demo' },
  },
});
const result = (write = false) => ({
  jsonrpc: '2.0', id: 3,
  result: { content: [{ type: 'text', text: json(write
    ? { service_id: 'svc-catalog', team_id: 'team-demo', previous_status: 'healthy', status: 'maintenance' }
    : { services: [{ service_id: 'svc-catalog', team_id: 'team-demo', name: 'Catalogue', status: 'healthy' }] }) }] },
});
const node = (id, badge, name, description, state) => ({ id, badge, name, description, state });
const client = node('client', 'APP', 'AI app + MCP client', 'The client is a component inside the host application.', 'Ready');
const server = node('server', 'MCP', 'MCP server', 'Exposes tools and runs the requested operation.', 'Waiting for a request');
const store = node('store', 'DATA', 'Service store', 'Fictitious Catalogue service · team-demo', 'status: healthy');
const step = (title, description, from, to, message, category, outcome, extra = {}) => ({
  title, description, from, to, message: typeof message === 'string' ? message : json(message), category, outcome, ...extra,
});

const demos = {
  mcp: {
    label: 'MCP server animation',
    nodes: [client, server, node('api', 'API', 'Service API', 'Business operations behind the MCP tool.', 'No operation yet'), store],
    edges: [['client', 'server'], ['server', 'api'], ['api', 'store']],
    scenarios: [['read', 'Read the service status'], ['write', 'Change the service status']],
    steps(mode) {
      const write = mode === 'write';
      const operation = write ? 'set_service_status' : 'list_services';
      return [
        step('Establish the MCP connection.', 'The client starts a connection. This simplified exchange uses protocol version 2025-06-18 over Streamable HTTP.', 'client', 'server', { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'Workshop client', version: '1.0' } } }, 'Connection', 'No tool has run yet.', { states: { client: 'Connecting', server: 'Negotiating capabilities' } }),
        step('Agree on the available capabilities.', 'The server responds with its capabilities. The client then sends notifications/initialized before discovering tools.', 'server', 'client', { jsonrpc: '2.0', id: 1, result: { protocolVersion: '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'Service demo', version: '1.0' } } }, 'Connection', 'The connection is ready; business data is unchanged.', { states: { client: 'Connected', server: 'Ready' } }),
        step('Ask which tools are available.', 'The client sends tools/list. No model is needed to perform this protocol operation—Inspector can do it too.', 'client', 'server', { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }, 'Discovery', 'Discovery is not tool execution.'),
        step('Return the tool contract.', 'Names, descriptions and input schemas tell the application how to call the tools. This shows the selected tool; the full catalogue also includes the other operation.', 'server', 'client', { jsonrpc: '2.0', id: 2, result: { tools: [{ name: operation, description: write ? 'Change a fictitious service status.' : 'List fictitious services for a team.', inputSchema: { type: 'object', properties: write ? { team_id: { type: 'string', minLength: 1 }, service_id: { type: 'string', minLength: 1 }, status: { type: 'string', enum: ['healthy', 'degraded', 'maintenance'] } } : { team_id: { type: 'string', minLength: 1 } }, required: write ? ['team_id', 'service_id', 'status'] : ['team_id'] } }] } }, 'Discovery', `The application can now select ${operation}.`),
        step(write ? 'Request a confirmed status change.' : 'Request the current service status.', write ? 'The user asks for maintenance. After any required client confirmation, the application invokes the tool with structured arguments.' : 'The user asks for the current status. The model proposes a tool; the host delegates the call to its MCP client.', 'client', 'server', toolCall(write), 'Tool call', 'A structured call—not the user’s sentence—crosses the MCP connection.', { states: { server: 'Validating tool arguments' } }),
        step('Run the business operation.', 'The MCP server validates the tool name and arguments, then calls its service API. This first example deliberately has no per-team authorization; the third animation adds it.', 'server', 'api', `${write ? 'PATCH' : 'GET'} /teams/team-demo/services${write ? '/svc-catalog' : ''}${write ? '\n\n{"status":"maintenance"}' : ''}`, 'Execution', 'MCP can sit on top of an existing API; it does not replace that API.', { states: { server: 'Calling the service API', api: write ? 'Updating svc-catalog' : 'Reading team-demo' } }),
        step(write ? 'Update the stored status.' : 'Read the stored status.', 'The API accesses the fictitious data store. Moving to a previous step or restarting resets this illustration; no external data is changed.', 'api', 'store', write ? 'UPDATE svc-catalog\nhealthy → maintenance' : 'READ svc-catalog\nstatus = healthy', 'Business data', write ? 'Illustrated service state: maintenance.' : 'Illustrated service state: healthy.', { states: { store: `status: ${write ? 'maintenance' : 'healthy'}` } }),
        step('Return the stored data.', 'The store returns the observed state to the service API. The response is based on the read or write that just completed.', 'store', 'api', { service_id: 'svc-catalog', status: write ? 'maintenance' : 'healthy' }, 'Business data', 'The service API has the operation result.'),
        step('Return the business data to the server.', 'The API completes the operation and returns data. The server wraps the outcome in an MCP tool result.', 'api', 'server', write ? { service_id: 'svc-catalog', previous_status: 'healthy', status: 'maintenance' } : { services: [{ service_id: 'svc-catalog', status: 'healthy' }] }, 'Result', 'The tool result is based on the operation, not a model guess.', { states: { api: 'Operation completed', server: 'Preparing tool result' } }),
        step('Give the result back to the application.', 'The client receives the response with the same request ID. The application can use the observed result to answer. For a real write, call the read tool again to verify the change.', 'server', 'client', result(write), 'Result', write ? 'Completed: Catalogue changed from healthy to maintenance.' : 'Completed: Catalogue is healthy.', { tone: 'success', states: { client: 'Tool result received', server: 'Ready for the next call' } }),
      ];
    },
  },
  apim: {
    label: 'API Management gateway animation',
    nodes: [client, node('gateway', 'APIM', 'API Management', 'Routes MCP traffic and applies configured policies.', 'No request processed'), server, store],
    edges: [['client', 'gateway'], ['gateway', 'server'], ['server', 'store']],
    scenarios: [['allowed', 'Within the configured rate limit'], ['limited', 'Rate limit exceeded · HTTP 429']],
    steps(mode) {
      const limited = mode === 'limited';
      const initial = [
        step('Send the tool call to the gateway.', 'The client uses the APIM endpoint instead of the server’s direct URL. Tool names and arguments do not change. The MCP connection is assumed to be established.', 'client', 'gateway', `POST https://gateway.example.invalid/mcp\n\n${json(toolCall())}`, 'Routing', 'Backend tool executions: 0', { states: { gateway: 'Request received' } }),
        step('Evaluate a configured rate-limit policy.', 'This example allows 10 requests per minute for the configured caller key. The counter and limit are illustrative; actual policy scope and caller identification must be configured.', null, 'gateway', `Configured policy: 10 requests / minute\nCaller key: workshop-demo\nThis request: ${limited ? '11' : '4'} of 10`, 'Gateway policy', 'Backend tool executions: 0', { states: { gateway: limited ? 'Limit exceeded' : 'Policy passed' } }),
      ];
      if (limited) return [...initial,
        step('Reject before forwarding.', 'APIM returns HTTP 429. The request never reaches the MCP server and no service data is accessed.', 'gateway', 'client', 'HTTP/1.1 429 Too Many Requests\nRetry-After: 30\n\nConfigured rate limit exceeded.', 'Gateway rejection', 'Blocked: 0 backend tool executions. The server is untouched.', { tone: 'blocked', states: { gateway: '429 · not forwarded', client: 'Retry later', server: 'Not called', store: 'status: healthy · untouched' } }),
      ];
      return [...initial,
        step('Forward to the existing MCP server.', 'APIM proxies the MCP request to the configured backend. This illustration focuses on routing and rate limiting, not an authenticated gateway-to-backend design.', 'gateway', 'server', `Backend: https://server.example.invalid/mcp\nMethod: tools/call\nTool: list_services\nArguments: {"team_id":"team-demo"}`, 'Routing', 'The existing server receives the original tool operation.', { states: { gateway: 'Forwarded', server: 'Processing tool call' } }),
        step('Execute the requested read.', 'The MCP server validates the tool arguments and reads the fictitious service. Gateway policy checks do not replace business authorization inside the service.', 'server', 'store', 'list_services(team_id="team-demo")\n→ Catalogue: healthy', 'Backend execution', 'Backend tool executions: 1', { states: { store: 'status: healthy · read', server: 'Tool completed' } }),
        step('Send the MCP result through the gateway.', 'The existing server returns its MCP tool result to APIM. APIM does not need to invent or recreate the tool.', 'server', 'gateway', result(), 'Return path', 'Backend tool executions: 1', { states: { gateway: 'Response received' } }),
        step('Deliver the result to the client.', 'The client receives the tool response through its configured entry point. Configured diagnostics can record duration and outcome without logging secrets.', 'gateway', 'client', 'HTTP/1.1 200 OK\n\nMCP tool result: Catalogue is healthy.\nGateway diagnostic: request completed.', 'Return path', 'Completed: gateway policy applied, 1 backend execution.', { tone: 'success', states: { gateway: '200 · completed', client: 'Tool result received' } }),
      ];
    },
  },
  auth: {
    label: 'Authentication and authorization animation',
    nodes: [client, node('identity', 'ID', 'Authorization server', 'For example, Microsoft Entra ID. Handles sign-in and token issuance.', 'No token issued'), node('server', 'MCP', 'Protected MCP server', 'Validates access tokens and enforces business permissions.', 'Protected resource'), store],
    edges: [['client', 'identity'], ['client', 'server'], ['server', 'store']],
    scenarios: [['allowed', 'Valid token · write allowed'], ['audience', 'Wrong token audience · rejected'], ['scope', 'Missing write scope · denied'], ['team', 'No access to the requested team · denied']],
    steps(mode) {
      const badAudience = mode === 'audience';
      const missingScope = mode === 'scope';
      const wrongTeam = mode === 'team';
      const base = [
        step('Call the protected endpoint without a token.', 'The client tries to access the MCP resource. A tool is not allowed to run just because the client knows its name.', 'client', 'server', 'POST /mcp\nAuthorization: [not present]', 'Protected resource', 'Service writes: 0', { states: { server: 'No access token' } }),
        step('Challenge the client with HTTP 401.', 'The server identifies where the client can find protected-resource metadata. This is an authentication challenge, not a tool result.', 'server', 'client', 'HTTP/1.1 401 Unauthorized\nWWW-Authenticate: Bearer resource_metadata=\n  "https://server.example.invalid/.well-known/oauth-protected-resource"', 'Challenge', 'No token → no tool execution.', { states: { client: 'Authentication required' } }),
        step('Discover the authorization server.', 'The client reads protected-resource metadata, finds its authorization server, then reads that server’s metadata. These discovery exchanges are grouped here for clarity.', 'client', 'identity', 'Resource metadata → authorization server URL\nAuthorization-server metadata → authorization/token endpoints\nTarget resource: https://server.example.invalid', 'Discovery', 'The token request must target the intended MCP resource.', { states: { client: 'Authorization endpoints discovered', identity: 'Ready for authorization' } }),
        step('Sign in and authorize the client.', 'The user signs in through the authorization server. Consent is shown if required. For a public client, the authorization-code flow uses PKCE; the app does not collect the user’s password.', 'client', 'identity', 'Authorization request (simplified)\nresponse_type=code\ncode_challenge_method=S256\nscope=services.write\nresource=https://server.example.invalid', 'User authentication', 'Sign-in proves identity; it does not grant every business permission.', { states: { identity: 'User signed in · code issued' } }),
        step('Exchange the code for an access token.', 'The client submits the authorization code and PKCE verifier. The authorization server issues an access token. Claims shown below are explanatory examples, not a real token.', 'identity', 'client', 'Token exchange (client → authorization server)\ngrant_type=authorization_code\ncode_verifier=[not displayed]\n\nToken response (authorization server → client)\naccess_token=[never displayed]', 'Token issuance', 'The MCP request uses an access token, not an ID token.', { states: { identity: 'Access token issued', client: 'Access token available' } }),
        step('Retry the tool call with a bearer token.', badAudience ? 'Negative test: replace the correct access token with a token intended for a different API. The resource server must reject it.' : missingScope ? 'Negative test: use a valid token with services.read but no services.write. A signed token alone does not grant write permission.' : wrongTeam ? 'The token is valid and has the write scope, but the authenticated caller belongs to a different team. The server must check team access separately.' : 'The client sends the write request with an access token intended for this resource. Team membership comes from trusted server-side policy, not from the submitted team_id.', 'client', 'server', `Authorization: Bearer [not displayed]\n\nIllustrative token claims:\naud = ${badAudience ? 'https://other-api.example.invalid' : 'https://server.example.invalid'}\nscp = ${missingScope ? 'services.read' : 'services.write'}\n\n${json(toolCall(true))}`, 'Authenticated request', 'Service writes: 0 · token and permission checks still pending.', { states: { server: 'Checking the access token' } }),
      ];
      if (badAudience) return [...base,
        step('Reject a token intended for another resource.', 'The resource server checks issuer, signature, lifetime and audience. This token has the wrong audience, so it is not accepted. A real client would need a token for this resource.', 'server', 'client', 'HTTP/1.1 401 Unauthorized\nWWW-Authenticate: Bearer error="invalid_token"\n\nRejected: token audience does not match this resource.', 'Token validation', 'Rejected: invalid token. Service writes: 0.', { tone: 'blocked', states: { server: 'Invalid token · rejected', client: '401 · obtain appropriate token', store: 'status: healthy · untouched' } }),
      ];
      base.push(step('Validate the access token.', 'The resource server checks the trusted issuer, signature, lifetime and intended audience. Local JWT validation normally uses trusted signing keys; the identity provider is not contacted for every tool call.', null, 'server', 'Issuer: trusted\nSignature: valid\nLifetime: valid\nAudience: this MCP resource\n\nToken accepted. Continue to authorization.', 'Token validation', 'Valid token ≠ unrestricted access. Service writes: 0.', { states: { server: 'Token valid · checking permissions' } }));
      if (missingScope || wrongTeam) return [...base,
        step(missingScope ? 'Deny the write: required scope is missing.' : 'Deny the write: this team is not allowed.', 'Authentication succeeded, but authorization failed. This example rejects at the application-policy layer with HTTP 403 before executing the tool. Other implementations may surface business denial as an MCP tool error.', 'server', 'client', `HTTP/1.1 403 Forbidden\n\n${missingScope ? 'Required scope: services.write\nGranted scope: services.read' : 'Requested team: team-demo\nCaller team access: another-team'}\nDecision: do not execute set_service_status`, 'Business authorization', 'Denied: authenticated, but not authorized. Service writes: 0.', { tone: 'blocked', states: { server: 'Permission denied', client: '403 · access denied', store: 'status: healthy · untouched' } }),
      ];
      return [...base,
        step('Check scope and team access.', 'The server verifies services.write and checks the authenticated caller’s access to team-demo. These are example application rules that must be implemented explicitly.', null, 'server', 'Required scope: services.write → granted\nRequested team: team-demo → allowed\nTool: set_service_status → permitted', 'Business authorization', 'Permission granted for this operation and this team.', { states: { server: 'Write authorized' } }),
        step('Execute the authorized change.', 'Only after the token and business checks pass does the server change the fictitious service state.', 'server', 'store', 'set_service_status(\n  team_id="team-demo",\n  service_id="svc-catalog",\n  status="maintenance"\n)', 'Execution', 'Service writes: 1 · Catalogue is now in maintenance.', { states: { store: 'status: maintenance', server: 'Write completed' } }),
        step('Return the tool result.', 'The client receives the result of the authorized write. A client confirmation and a server permission check solve different problems; both may be needed.', 'server', 'client', result(true), 'Result', 'Completed: valid token, sufficient permission, 1 service write.', { tone: 'success', states: { client: 'Authorized result received' } }),
      ];
    },
  },
};

const motion = matchMedia('(prefers-reduced-motion: reduce)');
const controllers = [];
const svgNS = 'http://www.w3.org/2000/svg';

function createDemo(mount, config) {
  const fragment = document.getElementById('demo-template').content.cloneNode(true);
  mount.append(fragment);
  const root = mount.querySelector('.demo');
  root.setAttribute('aria-label', config.label);
  const diagram = root.querySelector('.diagram');
  diagram.classList.add(mount.dataset.demo);
  const nodes = new Map();
  for (const item of config.nodes) {
    const element = document.createElement('article');
    element.className = 'node';
    element.dataset.node = item.id;
    for (const [tag, className, text] of [['span', 'node-icon', item.badge], ['h3', '', item.name], ['p', '', item.description], ['span', 'node-state', item.state]]) {
      const child = document.createElement(tag);
      child.className = className;
      child.textContent = text;
      element.append(child);
    }
    root.querySelector('.diagram-nodes').append(element);
    nodes.set(item.id, element);
  }
  const select = root.querySelector('select');
  select.setAttribute('aria-label', `${config.label}: scenario`);
  config.scenarios.forEach(([value, label]) => select.add(new Option(label, value)));
  const paths = root.querySelector('[data-paths]');
  const activePath = root.querySelector('[data-active-path]');
  const packet = root.querySelector('[data-packet]');
  const play = root.querySelector('[data-play]');
  const next = root.querySelector('[data-next]');
  const prev = root.querySelector('[data-prev]');
  const picker = root.querySelector('.step-picker');
  const outcome = root.querySelector('.outcome');
  let steps = config.steps(select.value);
  let index = 0;
  let playing = false;
  let timer = null;
  let frame = null;
  let picks = [];

  function route(from, to) {
    if (!from || !to) return '';
    const box = diagram.getBoundingClientRect();
    const a = nodes.get(from).getBoundingClientRect();
    const b = nodes.get(to).getBoundingClientRect();
    const x1 = a.left + a.width / 2 - box.left;
    const y1 = a.top + a.height / 2 - box.top;
    const x2 = b.left + b.width / 2 - box.left;
    const y2 = b.top + b.height / 2 - box.top;
    if (Math.abs(y1 - y2) < 20) {
      const direction = x2 > x1 ? 1 : -1;
      const start = x1 + direction * a.width / 2;
      const end = x2 - direction * b.width / 2;
      return `M ${start} ${y1} L ${end} ${y2}`;
    }
    if (Math.abs(x1 - x2) < 20 && Math.abs(y2 - y1) < a.height + b.height) {
      const direction = y2 > y1 ? 1 : -1;
      return `M ${x1} ${y1 + direction * a.height / 2} L ${x2} ${y2 - direction * b.height / 2}`;
    }
    if (Math.abs(x1 - x2) < 20) return `M ${a.left - box.left} ${y1} L 12 ${y1} L 12 ${y2} L ${b.left - box.left} ${y2}`;
    const start = (y2 < y1 ? a.top : a.bottom) - box.top;
    const end = (y2 < y1 ? b.bottom : b.top) - box.top;
    const middle = (start + end) / 2;
    return `M ${x1} ${start} L ${x1} ${middle} L ${x2} ${middle} L ${x2} ${end}`;
  }

  function stopPacket() {
    cancelAnimationFrame(frame);
    frame = null;
    packet.setAttribute('visibility', 'hidden');
  }

  function draw(animate = false) {
    stopPacket();
    paths.replaceChildren();
    for (const [from, to] of config.edges) {
      const path = document.createElementNS(svgNS, 'path');
      path.setAttribute('d', route(from, to));
      path.setAttribute('class', 'connection');
      paths.append(path);
    }
    const current = steps[index];
    const pathData = route(current.from, current.to);
    activePath.setAttribute('d', pathData);
    activePath.classList.toggle('blocked', current.tone === 'blocked');
    packet.classList.toggle('blocked', current.tone === 'blocked');
    if (!pathData || motion.matches || !animate) return;
    const length = activePath.getTotalLength();
    let started = null;
    const origin = activePath.getPointAtLength(0);
    packet.setAttribute('cx', origin.x);
    packet.setAttribute('cy', origin.y);
    packet.setAttribute('visibility', 'visible');
    function tick(time) {
      if (started === null) started = time;
      const progress = Math.min((time - started) / 1100, 1);
      const point = activePath.getPointAtLength(length * progress);
      packet.setAttribute('cx', point.x);
      packet.setAttribute('cy', point.y);
      if (progress < 1) frame = requestAnimationFrame(tick);
      else { frame = null; packet.setAttribute('visibility', 'hidden'); }
    }
    frame = requestAnimationFrame(tick);
  }

  function updatePlay() {
    play.textContent = playing ? 'Pause' : index === steps.length - 1 ? 'Play again' : 'Play animation';
    play.setAttribute('aria-pressed', String(playing));
    root.dataset.playing = String(playing);
  }

  function pause() {
    playing = false;
    clearTimeout(timer);
    timer = null;
    stopPacket();
    updatePlay();
  }

  function render(animate = false) {
    const current = steps[index];
    root.dataset.step = String(index + 1);
    root.querySelector('.step-title').textContent = current.title;
    root.querySelector('.step-description').textContent = current.description;
    root.querySelector('.step-category').textContent = current.category;
    root.querySelector('.message-code').textContent = current.message;
    root.querySelector('.message-direction').textContent = current.from
      ? `${current.from.toUpperCase()} → ${current.to.toUpperCase()}`
      : `CHECK AT ${current.to.toUpperCase()}`;
    outcome.textContent = current.outcome;
    outcome.className = `outcome ${current.tone || ''}`;
    root.querySelector('.step-count').textContent = `Step ${index + 1} / ${steps.length}`;
    root.querySelector('.progress-track > span').style.width = `${(index + 1) / steps.length * 100}%`;
    prev.disabled = index === 0;
    next.disabled = index === steps.length - 1;
    config.nodes.forEach((item) => {
      const element = nodes.get(item.id);
      let state = item.state;
      for (let position = 0; position <= index; position++) state = steps[position].states?.[item.id] ?? state;
      element.querySelector('.node-state').textContent = state;
      element.classList.toggle('is-active', current.from === item.id || current.to === item.id);
      element.classList.toggle('is-blocked', current.tone === 'blocked' && (current.from === item.id || current.to === item.id));
    });
    picks.forEach((button, position) => {
      button.setAttribute('aria-pressed', String(position === index));
      button.classList.toggle('is-complete', position < index);
    });
    updatePlay();
    draw(animate);
  }

  function schedule() {
    timer = setTimeout(() => {
      if (!playing) return;
      if (index === steps.length - 1) { pause(); return; }
      index++;
      render(true);
      if (index === steps.length - 1) {
        playing = false;
        timer = null;
        updatePlay();
      } else schedule();
    }, 3400);
  }

  function rebuild() {
    pause();
    steps = config.steps(select.value);
    index = 0;
    picker.replaceChildren();
    picks = steps.map((item, position) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'step-pick';
      button.textContent = String(position + 1).padStart(2, '0');
      button.setAttribute('aria-label', `Step ${position + 1}: ${item.title}`);
      button.title = item.title;
      button.addEventListener('click', () => { pause(); index = position; render(true); });
      picker.append(button);
      return button;
    });
    render();
  }

  play.addEventListener('click', () => {
    if (playing) { pause(); return; }
    controllers.forEach((controller) => controller.pause());
    if (index === steps.length - 1) index = 0;
    playing = true;
    render(true);
    schedule();
  });
  next.addEventListener('click', () => { pause(); index = Math.min(index + 1, steps.length - 1); render(true); });
  prev.addEventListener('click', () => { pause(); index = Math.max(index - 1, 0); render(true); });
  root.querySelector('[data-reset]').addEventListener('click', () => { pause(); index = 0; render(); });
  select.addEventListener('change', rebuild);
  function updateMotion() {
    pause();
    play.disabled = motion.matches;
    root.querySelector('.motion-note').hidden = !motion.matches;
    draw();
  }
  motion.addEventListener('change', updateMotion);
  if ('ResizeObserver' in window) new ResizeObserver(() => draw(frame !== null)).observe(diagram);
  else window.addEventListener('resize', () => draw(frame !== null));
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) pause();
    }).observe(root);
  }
  controllers.push({ pause });
  rebuild();
  updateMotion();
  mount.nextElementSibling.open = false;
}

document.querySelectorAll('[data-demo]').forEach((mount) => createDemo(mount, demos[mount.dataset.demo]));
document.addEventListener('visibilitychange', () => {
  if (document.hidden) controllers.forEach((controller) => controller.pause());
});
window.addEventListener('pagehide', () => controllers.forEach((controller) => controller.pause()));

const menu = document.querySelector('.menu');
const navigation = document.querySelector('.nav-links');
const mobile = matchMedia('(max-width: 760px)');
function closeMenu(focus = false) {
  navigation.classList.remove('is-open');
  menu.setAttribute('aria-expanded', 'false');
  if (focus) menu.focus();
}
menu.addEventListener('click', () => {
  menu.setAttribute('aria-expanded', String(navigation.classList.toggle('is-open')));
});
navigation.addEventListener('click', (event) => {
  if (!(event.target instanceof Element)) return;
  const link = event.target.closest('a');
  if (!link) return;
  closeMenu();
  if (mobile.matches) {
    const target = document.querySelector(link.hash);
    target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  }
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && navigation.classList.contains('is-open')) closeMenu(true);
});
mobile.addEventListener('change', () => {
  const hiddenFocus = mobile.matches ? navigation.contains(document.activeElement) : document.activeElement === menu;
  closeMenu();
  if (hiddenFocus) (mobile.matches ? menu : navigation.querySelector('a')).focus();
});
menu.hidden = false;
const print = document.getElementById('print');
let printState = null;
function preparePrint() {
  controllers.forEach((controller) => controller.pause());
  if (printState) return;
  printState = [...document.querySelectorAll('.fallback')].map((element) => ({ element, open: element.open }));
  printState.forEach(({ element }) => { element.open = true; });
}
function finishPrint() {
  if (!printState) return;
  printState.forEach(({ element, open }) => { element.open = open; });
  printState = null;
}
window.addEventListener('beforeprint', preparePrint);
window.addEventListener('afterprint', finishPrint);
matchMedia('print').addEventListener('change', (event) => {
  if (event.matches) preparePrint();
  else finishPrint();
});
print.addEventListener('click', () => {
  preparePrint();
  window.print();
});
print.hidden = false;
document.documentElement.classList.add('enhanced');

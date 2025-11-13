const API_BASE = process.env.REACT_APP_API_BASE || process.env.REACT_APP_BACKEND_URL;

/**
 * PUBLIC_INTERFACE
 * Perform a POST to an API endpoint or return a mocked response when API is not available.
 * This function respects environment configuration and never logs secrets.
 */
export async function postJson(path, body, opts) {
  const useMock = (opts && opts.mock) || !API_BASE;
  if (useMock) {
    // Mock a basic echo-like AI response with slight delay to simulate network.
    await new Promise((r) => setTimeout(r, 250));
    const content =
      typeof body === 'object' && body && 'messages' in body
        ? (body.messages || []).map((m) => m.content).join('\n')
        : 'Hello';
    return {
      id: 'mock-' + Date.now(),
      content: `Sure — here's a structured response:\n\n- You said: "${content}"\n- This is a mock assistant answer following the Ocean Professional theme.\n\n\`\`\`js\n// sample code\nexport const greet = (name) => 'Hello ' + name;\n\`\`\`\n`,
      createdAt: new Date().toISOString(),
    };
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    signal: opts && opts.signal,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Request failed: ${res.status} ${text}`);
  }
  return res.json();
}

/**
 * PUBLIC_INTERFACE
 * Simulate streaming tokens from a mock source. Consumers get progressive chunks.
 */
export function mockStream(content, cb, done, delayMs = 30) {
  const tokens = content.split(/(\s+)/); // keep spaces
  let i = 0;
  const timer = setInterval(() => {
    if (i >= tokens.length) {
      clearInterval(timer);
      done();
      return;
    }
    cb(tokens[i]);
    i++;
  }, delayMs);
  return () => clearInterval(timer);
}

import { randomUUID } from 'node:crypto';
import { checkRateLimit } from '../lib/rateLimit.js';
import { config } from '../config.js';
import { getOllamaHostHeader, ollamaRequest } from '../lib/ollamaHttp.js';

function formatFetchError(err) {
  const base = err?.message || 'Model error.';
  const cause = err?.cause;
  const code = cause?.code || cause?.errno;
  const extra = code ? ` (${code})` : '';
  return `${base}${extra}`;
}

function buildSystemPrompt(appType) {
  // ── Special media-type prompts ────────────────────────────────────────────
  if (appType === 'presentation') {
    return [
      'You are EIOR Coder, an expert at creating beautiful, interactive web presentations.',
      '',
      'Generate a complete Reveal.js HTML presentation based on the user description.',
      '',
      'OUTPUT FORMAT — follow EXACTLY:',
      '## Project: [presentation title]',
      '## Tech Stack',
      'Reveal.js CDN, HTML5, CSS3',
      '## File Tree',
      'index.html',
      '',
      'Then output:',
      'FILE: index.html',
      '```html',
      '[complete reveal.js presentation]',
      '```',
      '## Setup & Run',
      'Open index.html in a browser. Press Space or Arrow keys to navigate.',
      '',
      'RULES:',
      '- Use Reveal.js from CDN (https://cdn.jsdelivr.net/npm/reveal.js)',
      '- Include 8–15 slides with varied layouts (title, content, image placeholder, code, two-column, quote)',
      '- Use a professional dark theme (black or night)',
      '- Add speaker notes using <aside class="notes">',
      '- Include CSS transitions and animations',
      '- Make it visually impressive with proper typography and spacing',
      '- ALL in a single self-contained index.html file',
    ].join('\n');
  }

  if (appType === 'pdf-document') {
    return [
      'You are EIOR Coder, an expert at creating beautiful, print-ready HTML documents.',
      '',
      'Generate a complete styled HTML document that looks great when printed to PDF.',
      '',
      'OUTPUT FORMAT:',
      '## Project: [document title]',
      '## Tech Stack',
      'HTML5, CSS3 (print-optimized)',
      '## File Tree',
      'document.html',
      '',
      'Then:',
      'FILE: document.html',
      '```html',
      '[complete HTML document]',
      '```',
      '## Setup & Run',
      'Open in browser → File → Print → Save as PDF',
      '',
      'RULES:',
      '- A4 page size (210mm × 297mm) with proper margins (20mm)',
      '- Professional typography: clean serif or sans-serif fonts from Google Fonts',
      '- Proper document structure: cover page, table of contents, sections, page numbers',
      '- Print-friendly CSS: @media print rules, page-break-before/after, no background colors',
      '- Include header and footer with document title and page numbers',
      '- ALL in a single self-contained document.html file',
    ].join('\n');
  }

  if (appType === 'svg-image') {
    return [
      'You are EIOR Coder, an expert SVG artist and data visualization engineer.',
      '',
      'Generate a beautiful, complex SVG image or graphic based on the user description.',
      '',
      'OUTPUT FORMAT:',
      '## Project: [image/graphic title]',
      '## Tech Stack',
      'SVG, CSS animations',
      '## File Tree',
      'image.svg',
      '',
      'Then:',
      'FILE: image.svg',
      '```svg',
      '[complete SVG]',
      '```',
      '## Setup & Run',
      'Open image.svg in any browser or image viewer.',
      '',
      'RULES:',
      '- Use a proper viewBox (e.g., "0 0 800 600")',
      '- Include rich detail: gradients, patterns, masks, clip-paths where appropriate',
      '- Add CSS animations for visual interest (<style> inside SVG)',
      '- Use semantic grouping with <g> elements and descriptive IDs',
      '- Make it production-quality and visually impressive',
      '- ALL in a single self-contained image.svg file',
    ].join('\n');
  }

  if (appType === 'infographic') {
    return [
      'You are EIOR Coder, an expert at creating beautiful HTML infographics and data visualizations.',
      '',
      'Generate a complete, interactive HTML infographic based on the user description.',
      '',
      'OUTPUT FORMAT:',
      '## Project: [infographic title]',
      '## Tech Stack',
      'HTML5, CSS3, vanilla JavaScript, SVG charts',
      '## File Tree',
      'infographic.html',
      '',
      'Then:',
      'FILE: infographic.html',
      '```html',
      '[complete infographic]',
      '```',
      '## Setup & Run',
      'Open infographic.html in a browser.',
      '',
      'RULES:',
      '- Create a visually stunning, modern design with a clear color palette',
      '- Use pure CSS or inline SVG for all charts (NO external dependencies)',
      '- Include: statistics, charts (bar/pie/line using SVG), icons, data callouts',
      '- Add CSS animations (fade-in, count-up effect using JS)',
      '- Responsive layout that works on different screen widths',
      '- ALL in a single self-contained infographic.html file',
    ].join('\n');
  }

  if (appType === 'email-template') {
    return [
      'You are EIOR Coder, an expert at creating responsive HTML email templates.',
      '',
      'Generate a production-ready HTML email template based on the user description.',
      '',
      'OUTPUT FORMAT:',
      '## Project: [email template name]',
      '## Tech Stack',
      'HTML email (table-based layout), inline CSS',
      '## File Tree',
      'email.html',
      '',
      'Then:',
      'FILE: email.html',
      '```html',
      '[complete email template]',
      '```',
      '## Setup & Run',
      'Open email.html in a browser to preview. Copy HTML into your email provider.',
      '',
      'RULES:',
      '- Table-based layout for maximum email client compatibility',
      '- ALL CSS must be inline (email clients strip <style> tags)',
      '- Max width 600px, centered',
      '- Include preheader text (hidden preview text)',
      '- Professional header, content sections, CTA button, footer with unsubscribe',
      '- Fallback fonts: Arial, Helvetica, sans-serif',
      '- Mobile-responsive using media queries in a <style> block',
    ].join('\n');
  }

  if (appType === 'landing-page') {
    return [
      'You are EIOR Coder, an expert at creating stunning marketing landing pages.',
      '',
      'Generate a complete, modern marketing landing page based on the user description.',
      '',
      'OUTPUT FORMAT:',
      '## Project: [product/company name]',
      '## Tech Stack',
      'HTML5, TailwindCSS CDN, vanilla JavaScript',
      '## File Tree',
      'index.html',
      '',
      'Then:',
      'FILE: index.html',
      '```html',
      '[complete landing page]',
      '```',
      '## Setup & Run',
      'Open index.html in a browser.',
      '',
      'RULES:',
      '- Use TailwindCSS via CDN for styling',
      '- Sections: Hero, Features/Benefits, Social Proof, Pricing, FAQ, CTA, Footer',
      '- Modern design: gradient backgrounds, card components, icons (use Unicode or inline SVG)',
      '- Smooth scroll, sticky navbar, mobile hamburger menu',
      '- Conversion-focused: strong CTAs, benefit-oriented copy',
      '- ALL in a single self-contained index.html file',
    ].join('\n');
  }

  const typeHint = appType ? `\nProject type requested: ${appType}\n` : '';

  return [
    'You are EIOR Coder, an expert full-stack software engineer who builds complete, production-ready web applications and tools.',
    typeHint,
    'TASK: Generate a complete, working application based on the user description.',
    '',
    '════════════════════════════════════════',
    'OUTPUT FORMAT — follow EXACTLY in this order:',
    '════════════════════════════════════════',
    '',
    '1. Start with exactly this header:',
    '   ## Project: [descriptive project name]',
    '',
    '2. Then:',
    '   ## Tech Stack',
    '   [List the key technologies/frameworks being used]',
    '',
    '3. Then:',
    '   ## File Tree',
    '   [Show the complete directory structure as an ASCII tree]',
    '',
    '4. Then for EACH FILE, output:',
    '   FILE: path/to/filename.ext',
    '   ```language',
    '   [complete file contents]',
    '   ```',
    '',
    '5. Finally:',
    '   ## Setup & Run',
    '   [Step-by-step commands to install dependencies and run the project]',
    '',
    '════════════════════════════════════════',
    'STRICT RULES:',
    '════════════════════════════════════════',
    '- Generate COMPLETE, WORKING code — zero placeholders like "// TODO", "YOUR_KEY_HERE", or empty functions.',
    '- Include ALL files needed to run: package.json, tsconfig, config files, entry points, components, styles.',
    '- Every file must have real, functional content — not stubs.',
    '- Use modern best practices:',
    '  * TypeScript with proper types where appropriate',
    '  * Proper error handling and input validation',
    '  * Responsive, mobile-friendly UI for web apps',
    '  * Environment variable support via .env.example (never hardcode secrets)',
    '  * A clear README.md',
    '',
    'FRAMEWORK PREFERENCES (unless user specifies):',
    '  * Web apps/SPAs → React 18 + Vite + TypeScript + TailwindCSS',
    '  * Full-stack web → Next.js 14 (App Router) + TypeScript + TailwindCSS',
    '  * REST APIs → Express.js + TypeScript OR Fastify + TypeScript',
    '  * Python web → FastAPI + Pydantic',
    '  * CLI tools → Node.js CLI with commander OR Python with argparse/typer',
    '  * HTML/CSS/JS → Vanilla, semantic HTML5, modern CSS (Grid/Flex), no framework',
    '',
    'COMMON PATTERNS TO INCLUDE:',
    '  * For React/Next.js: proper routing, reusable components, CSS modules or Tailwind',
    '  * For APIs: CORS setup, request validation, JSON error responses, health check endpoint',
    '  * For databases: connection pooling, migration scripts',
    '  * Always add .gitignore appropriate for the stack',
    '  * Always add .env.example with all required variables documented',
  ].join('\n');
}

/**
 * Free vibecode: generate a full working app scaffold (no API key required).
 *
 * Base URL: /api/vibecode
 * Auth:     none
 */
export default async function freeVibecodeRoutes(fastify) {
  fastify.post('/', {
    schema: {
      body: {
        type: 'object',
        required: ['description'],
        properties: {
          description: { type: 'string', minLength: 1, maxLength: 12000 },
          appType: { type: 'string', maxLength: 100 },
          stream: { type: 'boolean' },
        },
      },
    },
    handler: async (request, reply) => {
      const { description, appType, stream = true } = request.body;

      const forwardedFor = request.headers['x-forwarded-for'];
      const ip = (typeof forwardedFor === 'string' && forwardedFor.split(',')[0]?.trim()) || request.ip || 'anonymous';
      const rl = await checkRateLimit(`freevibe:${ip}`);
      reply.header('X-RateLimit-Limit', rl.limit);
      reply.header('X-RateLimit-Remaining', rl.remaining);
      reply.header('X-RateLimit-Reset', rl.reset);
      if (!rl.success) {
        return reply.code(429).send({ error: 'Rate limit exceeded. Try again later.' });
      }

      const systemPrompt = buildSystemPrompt(appType);

      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: description },
      ];

      // ── Groq path ────────────────────────────────────────────────────────────
      if (config.groq.apiKey) {
        const groqBody = {
          model: config.groq.model,
          messages,
          stream,
          max_tokens: 8192,
          temperature: 0.2,
        };

        let groqRes;
        try {
          groqRes = await fetch(`${config.groq.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${config.groq.apiKey}`,
            },
            body: JSON.stringify(groqBody),
          });
        } catch (err) {
          return reply.code(502).send({ error: formatFetchError(err) });
        }

        if (!groqRes.ok) {
          const text = await groqRes.text().catch(() => '');
          let errMsg = text;
          try { errMsg = JSON.parse(text)?.error?.message || text; } catch {}
          return reply.code(groqRes.status).send({ error: errMsg || `Groq error ${groqRes.status}` });
        }

        if (!stream) {
          const data = await groqRes.json();
          const output = data.choices?.[0]?.message?.content ?? '';
          return reply.send({ id: `vibecode-${randomUUID().replace(/-/g, '')}`, output });
        }

        // Streaming
        const id = `vibecode-${randomUUID().replace(/-/g, '')}`;
        const created = Math.floor(Date.now() / 1000);

        reply.raw.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
          'X-Accel-Buffering': 'no',
        });

        reply.raw.write(`data: ${JSON.stringify({ id, event: 'start', created })}\n\n`);

        const decoder = new TextDecoder();
        let buffer = '';
        let full = '';

        for await (const rawChunk of groqRes.body) {
          buffer += decoder.decode(rawChunk, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (data === '[DONE]') {
              reply.raw.write(`data: ${JSON.stringify({ id, event: 'done', output: full })}\n\n`);
              break;
            }
            try {
              const chunk = JSON.parse(data);
              const token = chunk.choices?.[0]?.delta?.content ?? '';
              if (token) {
                full += token;
                reply.raw.write(`data: ${JSON.stringify({ id, event: 'token', token })}\n\n`);
              }
            } catch {}
          }
        }

        reply.raw.write('data: [DONE]\n\n');
        reply.raw.end();
        return;
      }

      // ── Ollama path ──────────────────────────────────────────────────────────
      const baseUrl = config.ollama.baseUrl;
      const ollamaUnavailable =
        !baseUrl ||
        /PLACEHOLDER/i.test(baseUrl) ||
        (config.env === 'production' && /^http:\/\/localhost\b/i.test(baseUrl));

      if (ollamaUnavailable) {
        return reply.code(503).send({
          error: 'AI backend not configured. Add a GROQ_API_KEY environment variable (free at console.groq.com) and redeploy.',
        });
      }

      const hostHeader = getOllamaHostHeader(baseUrl, config.ollama.hostHeader);

      if (!stream) {
        try {
          const res = await ollamaRequest({
            baseUrl, path: '/api/chat', method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            hostHeader,
            body: JSON.stringify({ model: config.ollama.model, messages, stream: false }),
            timeoutMs: 180_000,
          });
          if (!res.ok) {
            const text = await res.text().catch(() => '');
            return reply.code(res.status).send({ error: `Ollama ${res.status}: ${text}` });
          }
          const data = await res.json();
          return reply.send({ id: `vibecode-${randomUUID().replace(/-/g, '')}`, output: data.message?.content ?? '' });
        } catch (err) {
          if (err?.name === 'TimeoutError') return reply.code(504).send({ error: 'Model timed out.' });
          return reply.code(502).send({ error: formatFetchError(err) });
        }
      }

      let ollamaRes;
      try {
        ollamaRes = await ollamaRequest({
          baseUrl, path: '/api/chat', method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          hostHeader,
          body: JSON.stringify({ model: config.ollama.model, messages, stream: true }),
          timeoutMs: 180_000,
        });
      } catch (err) {
        if (err?.name === 'TimeoutError') return reply.code(504).send({ error: 'Model timed out.' });
        return reply.code(502).send({ error: formatFetchError(err) });
      }

      if (!ollamaRes.ok) {
        const text = await ollamaRes.text().catch(() => '');
        return reply.code(ollamaRes.status).send({ error: `Ollama ${ollamaRes.status}: ${text}` });
      }

      const id = `vibecode-${randomUUID().replace(/-/g, '')}`;
      const created = Math.floor(Date.now() / 1000);

      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });

      reply.raw.write(`data: ${JSON.stringify({ id, event: 'start', created })}\n\n`);

      const decoder = new TextDecoder();
      let buffer = '';
      let full = '';

      for await (const rawChunk of ollamaRes.body) {
        buffer += decoder.decode(rawChunk, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.trim()) continue;
          let chunk;
          try { chunk = JSON.parse(line); } catch { continue; }
          const token = chunk.message?.content ?? '';
          if (token) {
            full += token;
            reply.raw.write(`data: ${JSON.stringify({ id, event: 'token', token })}\n\n`);
          }
          if (chunk.done) {
            reply.raw.write(`data: ${JSON.stringify({ id, event: 'done', output: full })}\n\n`);
          }
        }
      }

      reply.raw.write('data: [DONE]\n\n');
      reply.raw.end();
    },
  });
}

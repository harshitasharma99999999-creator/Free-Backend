'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const PUBLIC_BASE = `${API_BASE}/api/public`;

export default function DocsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">API Documentation</h1>
        <p className="text-muted-foreground">Complete reference for the AI API Proxy</p>
      </div>

      {/* Authentication */}
      <Card>
        <CardHeader>
          <CardTitle>Authentication</CardTitle>
          <CardDescription>Include your API key in every request</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm">Option 1 — Authorization header (recommended):</p>
          <pre className="rounded-lg bg-muted p-4 text-sm overflow-x-auto">
            {`Authorization: Bearer fk_your_api_key_here`}
          </pre>
          <p className="text-sm">Option 2 — X-API-Key header:</p>
          <pre className="rounded-lg bg-muted p-4 text-sm overflow-x-auto">
            {`X-API-Key: fk_your_api_key_here`}
          </pre>
          <p className="text-sm">Option 3 — Query parameter:</p>
          <pre className="rounded-lg bg-muted p-4 text-sm overflow-x-auto">
            {`GET ${PUBLIC_BASE}/v1/health?apiKey=fk_your_api_key_here`}
          </pre>
        </CardContent>
      </Card>

      {/* Rate Limits & Credits */}
      <Card>
        <CardHeader>
          <CardTitle>Rate Limits & Credits</CardTitle>
          <CardDescription>Usage limits per plan</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4">Plan</th>
                  <th className="text-left py-2 pr-4">Image Credits</th>
                  <th className="text-left py-2 pr-4">Video Credits</th>
                  <th className="text-left py-2">Rate Limit</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr className="border-b">
                  <td className="py-2 pr-4">Free</td>
                  <td className="py-2 pr-4">10</td>
                  <td className="py-2 pr-4">2</td>
                  <td className="py-2">60 req/min</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 pr-4">Pro</td>
                  <td className="py-2 pr-4">200</td>
                  <td className="py-2 pr-4">50</td>
                  <td className="py-2">200 req/min</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Enterprise</td>
                  <td className="py-2 pr-4">2,000</td>
                  <td className="py-2 pr-4">500</td>
                  <td className="py-2">Unlimited</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-sm text-muted-foreground">Image generation costs 1 credit. Video generation costs 5 credits.</p>
          <p className="text-sm text-muted-foreground">Rate limit headers:</p>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
            <li><code className="rounded bg-muted px-1">X-RateLimit-Limit</code> — max requests per window</li>
            <li><code className="rounded bg-muted px-1">X-RateLimit-Remaining</code> — remaining in current window</li>
            <li><code className="rounded bg-muted px-1">X-RateLimit-Reset</code> — Unix timestamp when the window resets</li>
          </ul>
        </CardContent>
      </Card>

      {/* Image Generation */}
      <Card>
        <CardHeader>
          <CardTitle>Image Generation</CardTitle>
          <CardDescription>POST /v1/generate-image — 1 credit per call</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Generate an image from a text prompt. Returns a URL to the generated image.</p>

          <div>
            <p className="text-sm font-medium mb-2">Request body:</p>
            <pre className="rounded-lg bg-muted p-4 text-sm overflow-x-auto">
{`{
  "prompt": "A futuristic city at sunset, digital art"
}`}
            </pre>
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Response:</p>
            <pre className="rounded-lg bg-muted p-4 text-sm overflow-x-auto">
{`{
  "success": true,
  "imageUrl": "https://...",
  "provider": "replicate",
  "model": "sdxl",
  "creditsRemaining": 9
}`}
            </pre>
          </div>

          <div>
            <p className="text-sm font-medium mb-2">curl example:</p>
            <pre className="rounded-lg bg-muted p-4 text-sm overflow-x-auto">
{`curl -X POST "${PUBLIC_BASE}/v1/generate-image" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"prompt": "A futuristic city at sunset"}'`}
            </pre>
          </div>

          <div>
            <p className="text-sm font-medium mb-2">JavaScript example:</p>
            <pre className="rounded-lg bg-muted p-4 text-sm overflow-x-auto">
{`const response = await fetch("${PUBLIC_BASE}/v1/generate-image", {
  method: "POST",
  headers: {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    prompt: "A futuristic city at sunset",
  }),
});
const data = await response.json();
console.log(data.imageUrl);`}
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* Video Generation */}
      <Card>
        <CardHeader>
          <CardTitle>Video Generation</CardTitle>
          <CardDescription>POST /v1/generate-video — 5 credits per call</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Generate a video from a text prompt. Returns a URL to the generated video.</p>

          <div>
            <p className="text-sm font-medium mb-2">Request body:</p>
            <pre className="rounded-lg bg-muted p-4 text-sm overflow-x-auto">
{`{
  "prompt": "A cat walking on a beach, cinematic"
}`}
            </pre>
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Response:</p>
            <pre className="rounded-lg bg-muted p-4 text-sm overflow-x-auto">
{`{
  "success": true,
  "videoUrl": "https://...",
  "provider": "replicate",
  "model": "text-to-video",
  "creditsRemaining": 45
}`}
            </pre>
          </div>

          <div>
            <p className="text-sm font-medium mb-2">curl example:</p>
            <pre className="rounded-lg bg-muted p-4 text-sm overflow-x-auto">
{`curl -X POST "${PUBLIC_BASE}/v1/generate-video" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"prompt": "A cat walking on a beach"}'`}
            </pre>
          </div>

          <div>
            <p className="text-sm font-medium mb-2">JavaScript example:</p>
            <pre className="rounded-lg bg-muted p-4 text-sm overflow-x-auto">
{`const response = await fetch("${PUBLIC_BASE}/v1/generate-video", {
  method: "POST",
  headers: {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    prompt: "A cat walking on a beach",
  }),
});
const data = await response.json();
console.log(data.videoUrl);`}
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* Utility Endpoints */}
      <Card>
        <CardHeader>
          <CardTitle>Utility Endpoints</CardTitle>
          <CardDescription>Base URL: {PUBLIC_BASE}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <p className="font-mono text-sm font-medium text-primary">GET /v1/health</p>
            <p className="text-sm text-muted-foreground mt-1">Check API status. Returns status and timestamp.</p>
            <pre className="rounded-lg bg-muted p-4 text-sm overflow-x-auto mt-2">
{`curl -H "X-API-Key: YOUR_KEY" "${PUBLIC_BASE}/v1/health"`}
            </pre>
          </div>

          <div>
            <p className="font-mono text-sm font-medium text-primary">GET /v1/echo?message=...</p>
            <p className="text-sm text-muted-foreground mt-1">Echo back a message. Useful for testing your API key.</p>
            <pre className="rounded-lg bg-muted p-4 text-sm overflow-x-auto mt-2">
{`curl -H "X-API-Key: YOUR_KEY" "${PUBLIC_BASE}/v1/echo?message=hello"`}
            </pre>
          </div>

          <div>
            <p className="font-mono text-sm font-medium text-primary">GET /v1/random?min=0&max=100</p>
            <p className="text-sm text-muted-foreground mt-1">Random integer in range [min, max].</p>
            <pre className="rounded-lg bg-muted p-4 text-sm overflow-x-auto mt-2">
{`curl -H "X-API-Key: YOUR_KEY" "${PUBLIC_BASE}/v1/random?min=1&max=6"`}
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* Error codes */}
      <Card>
        <CardHeader>
          <CardTitle>Error Codes</CardTitle>
          <CardDescription>Standard error responses</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p><strong>401 Unauthorized</strong> — Missing or invalid API key.</p>
          <p><strong>402 Payment Required</strong> — Insufficient credits. Upgrade your plan.</p>
          <p><strong>429 Too Many Requests</strong> — Rate limit exceeded. Check X-RateLimit-Reset header.</p>
          <p><strong>502 Bad Gateway</strong> — External AI provider error. Try again or contact support.</p>
          <p className="text-muted-foreground mt-2">All errors include an <code className="rounded bg-muted px-1">error</code> field and optionally <code className="rounded bg-muted px-1">message</code>.</p>
        </CardContent>
      </Card>
    </div>
  );
}

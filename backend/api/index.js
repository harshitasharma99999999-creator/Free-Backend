export default async function handler(_req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.status(200).send(
    JSON.stringify({
      name: 'Free API',
      version: '1.0',
      status: 'running',
    })
  );
}

"use strict";
/**
 * Hetzner Cloud VPS service
 * API docs: https://docs.hetzner.cloud/
 * Free to use (pay-per-use, ~€3-10/mo per server)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.VPS_PLANS = void 0;
exports.hetznerConfigured = hetznerConfigured;
exports.createServer = createServer;
exports.getServer = getServer;
exports.powerOnServer = powerOnServer;
exports.powerOffServer = powerOffServer;
exports.deleteServer = deleteServer;
exports.mapHetznerStatus = mapHetznerStatus;
const config_1 = require("../utils/config");
const BASE = 'https://api.hetzner.cloud/v1';
exports.VPS_PLANS = {
    starter: { serverType: 'cx11', cores: 1, memoryGb: 2, diskGb: 20, label: 'Starter', price: '$4/mo' },
    standard: { serverType: 'cx21', cores: 2, memoryGb: 4, diskGb: 40, label: 'Standard', price: '$7/mo' },
    pro: { serverType: 'cx31', cores: 2, memoryGb: 8, diskGb: 80, label: 'Pro', price: '$13/mo' },
};
function hetznerConfigured() {
    return !!config_1.config.HETZNER_API_TOKEN;
}
function headers() {
    return {
        'Authorization': `Bearer ${config_1.config.HETZNER_API_TOKEN}`,
        'Content-Type': 'application/json',
    };
}
async function hetznerRequest(method, path, body) {
    const res = await fetch(`${BASE}${path}`, {
        method,
        headers: headers(),
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Hetzner API ${res.status}: ${text}`);
    }
    // 204 No Content
    if (res.status === 204)
        return {};
    return res.json();
}
async function createServer(opts) {
    const plan = exports.VPS_PLANS[opts.plan];
    const body = {
        name: opts.name,
        server_type: plan.serverType,
        image: opts.image ?? 'ubuntu-22.04',
        location: opts.location ?? 'fsn1', // Falkenstein, Germany (fast, cheap)
        start_after_create: true,
        labels: { managed_by: 'eior' },
    };
    const data = await hetznerRequest('POST', '/servers', body);
    return {
        id: data.server.id,
        ip: data.server.public_net.ipv4?.ip ?? null,
        status: data.server.status,
    };
}
async function getServer(id) {
    const data = await hetznerRequest('GET', `/servers/${id}`);
    return data.server;
}
async function powerOnServer(id) {
    await hetznerRequest('POST', `/servers/${id}/actions/poweron`);
}
async function powerOffServer(id) {
    await hetznerRequest('POST', `/servers/${id}/actions/poweroff`);
}
async function deleteServer(id) {
    await hetznerRequest('DELETE', `/servers/${id}`);
}
function mapHetznerStatus(status) {
    switch (status) {
        case 'running': return 'running';
        case 'off': return 'stopped';
        case 'initializing':
        case 'starting':
        case 'rebuilding':
        case 'migrating': return 'creating';
        case 'stopping': return 'stopped';
        default: return 'error';
    }
}
//# sourceMappingURL=hetzner.service.js.map
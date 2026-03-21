"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VPS_PLANS = void 0;
exports.getNextVmid = getNextVmid;
exports.createVM = createVM;
exports.startVM = startVM;
exports.stopVM = stopVM;
exports.deleteVM = deleteVM;
exports.getVMStatus = getVMStatus;
exports.proxmoxConfigured = isConfigured;
const config_1 = require("../utils/config");
const logger_1 = require("../utils/logger");
// ── VPS plan definitions ───────────────────────────────────────────────────────
exports.VPS_PLANS = {
    starter: { cores: 1, memoryMb: 1024, diskGb: 20, label: 'Starter', price: 'Free' },
    standard: { cores: 2, memoryMb: 2048, diskGb: 40, label: 'Standard', price: '$5/mo' },
    pro: { cores: 4, memoryMb: 4096, diskGb: 80, label: 'Pro', price: '$10/mo' },
};
// ── Proxmox API helper ────────────────────────────────────────────────────────
function isConfigured() {
    return !!(config_1.config.PROXMOX_HOST && config_1.config.PROXMOX_TOKEN_ID && config_1.config.PROXMOX_TOKEN_SECRET);
}
async function proxmoxFetch(path, options = {}) {
    if (!isConfigured())
        throw new Error('Proxmox is not configured on this server');
    const url = `${config_1.config.PROXMOX_HOST}/api2/json${path}`;
    const res = await fetch(url, {
        ...options,
        headers: {
            'Authorization': `PVEAPIToken=${config_1.config.PROXMOX_TOKEN_ID}=${config_1.config.PROXMOX_TOKEN_SECRET}`,
            'Content-Type': 'application/json',
            ...(options.headers ?? {}),
        },
        // Proxmox uses self-signed certs in most setups
        // @ts-ignore
        agent: undefined,
        signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
        const body = await res.text();
        throw new Error(`Proxmox API ${res.status}: ${body}`);
    }
    const json = await res.json();
    return json.data;
}
// ── Get next available VMID ───────────────────────────────────────────────────
async function getNextVmid() {
    const data = await proxmoxFetch('/cluster/nextid');
    return parseInt(data, 10);
}
// ── Create a new VM from cloud-init template ──────────────────────────────────
async function createVM(opts) {
    const node = config_1.config.PROXMOX_NODE;
    const storage = config_1.config.PROXMOX_STORAGE;
    const tmplId = config_1.config.PROXMOX_TEMPLATE_VMID;
    const plan = exports.VPS_PLANS[opts.plan];
    logger_1.logger.info({ vmid: opts.vmid, plan: opts.plan }, 'Creating Proxmox VM');
    // Clone the template
    await proxmoxFetch(`/nodes/${node}/qemu/${tmplId}/clone`, {
        method: 'POST',
        body: JSON.stringify({
            newid: opts.vmid,
            name: opts.name,
            full: 1,
            storage,
        }),
    });
    // Wait briefly for clone to complete
    await new Promise(r => setTimeout(r, 3000));
    // Resize disk + set CPU/RAM
    await proxmoxFetch(`/nodes/${node}/qemu/${opts.vmid}/config`, {
        method: 'PUT',
        body: JSON.stringify({
            cores: plan.cores,
            memory: plan.memoryMb,
            sockets: 1,
        }),
    });
    // Resize disk to plan size
    await proxmoxFetch(`/nodes/${node}/qemu/${opts.vmid}/resize`, {
        method: 'PUT',
        body: JSON.stringify({ disk: 'scsi0', size: `${plan.diskGb}G` }),
    });
}
// ── Start a VM ────────────────────────────────────────────────────────────────
async function startVM(vmid) {
    const node = config_1.config.PROXMOX_NODE;
    await proxmoxFetch(`/nodes/${node}/qemu/${vmid}/status/start`, { method: 'POST' });
}
// ── Stop a VM ─────────────────────────────────────────────────────────────────
async function stopVM(vmid) {
    const node = config_1.config.PROXMOX_NODE;
    await proxmoxFetch(`/nodes/${node}/qemu/${vmid}/status/stop`, { method: 'POST' });
}
// ── Delete a VM ───────────────────────────────────────────────────────────────
async function deleteVM(vmid) {
    const node = config_1.config.PROXMOX_NODE;
    // Stop first if running
    try {
        await stopVM(vmid);
        await new Promise(r => setTimeout(r, 2000));
    }
    catch { }
    await proxmoxFetch(`/nodes/${node}/qemu/${vmid}`, { method: 'DELETE' });
}
// ── Get VM status ─────────────────────────────────────────────────────────────
async function getVMStatus(vmid) {
    const node = config_1.config.PROXMOX_NODE;
    try {
        const data = await proxmoxFetch(`/nodes/${node}/qemu/${vmid}/status/current`);
        return {
            vmid,
            status: data.status === 'running' ? 'running' : 'stopped',
            uptime: data.uptime,
            cpu: data.cpu,
            mem: data.mem,
        };
    }
    catch {
        return { vmid, status: 'unknown' };
    }
}
//# sourceMappingURL=proxmox.service.js.map
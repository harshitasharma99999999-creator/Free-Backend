/**
 * Hetzner Cloud VPS service
 * API docs: https://docs.hetzner.cloud/
 * Free to use (pay-per-use, ~€3-10/mo per server)
 */
export declare const VPS_PLANS: {
    readonly starter: {
        readonly serverType: "cx11";
        readonly cores: 1;
        readonly memoryGb: 2;
        readonly diskGb: 20;
        readonly label: "Starter";
        readonly price: "$4/mo";
    };
    readonly standard: {
        readonly serverType: "cx21";
        readonly cores: 2;
        readonly memoryGb: 4;
        readonly diskGb: 40;
        readonly label: "Standard";
        readonly price: "$7/mo";
    };
    readonly pro: {
        readonly serverType: "cx31";
        readonly cores: 2;
        readonly memoryGb: 8;
        readonly diskGb: 80;
        readonly label: "Pro";
        readonly price: "$13/mo";
    };
};
export type VpsPlan = keyof typeof VPS_PLANS;
export declare function hetznerConfigured(): boolean;
export interface HetznerServer {
    id: number;
    name: string;
    status: 'running' | 'off' | 'initializing' | 'starting' | 'stopping' | 'rebuilding' | 'migrating' | 'deleting' | 'unknown';
    public_net: {
        ipv4?: {
            ip: string;
        };
        ipv6?: {
            ip: string;
        };
    };
    server_type: {
        name: string;
        cores: number;
        memory: number;
        disk: number;
    };
    created: string;
}
export declare function createServer(opts: {
    name: string;
    plan: VpsPlan;
    location?: string;
    image?: string;
}): Promise<{
    id: number;
    ip: string | null;
    status: string;
}>;
export declare function getServer(id: number): Promise<HetznerServer>;
export declare function powerOnServer(id: number): Promise<void>;
export declare function powerOffServer(id: number): Promise<void>;
export declare function deleteServer(id: number): Promise<void>;
export declare function mapHetznerStatus(status: string): 'running' | 'stopped' | 'creating' | 'error';

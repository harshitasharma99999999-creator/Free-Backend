export declare const VPS_PLANS: {
    readonly starter: {
        readonly cores: 1;
        readonly memoryMb: 1024;
        readonly diskGb: 20;
        readonly label: "Starter";
        readonly price: "Free";
    };
    readonly standard: {
        readonly cores: 2;
        readonly memoryMb: 2048;
        readonly diskGb: 40;
        readonly label: "Standard";
        readonly price: "$5/mo";
    };
    readonly pro: {
        readonly cores: 4;
        readonly memoryMb: 4096;
        readonly diskGb: 80;
        readonly label: "Pro";
        readonly price: "$10/mo";
    };
};
export type VpsPlan = keyof typeof VPS_PLANS;
export interface VMCreateOptions {
    vmid: number;
    name: string;
    plan: VpsPlan;
}
export interface VMStatus {
    vmid: number;
    status: 'running' | 'stopped' | 'unknown';
    uptime?: number;
    cpu?: number;
    mem?: number;
}
declare function isConfigured(): boolean;
export declare function getNextVmid(): Promise<number>;
export declare function createVM(opts: VMCreateOptions): Promise<void>;
export declare function startVM(vmid: number): Promise<void>;
export declare function stopVM(vmid: number): Promise<void>;
export declare function deleteVM(vmid: number): Promise<void>;
export declare function getVMStatus(vmid: number): Promise<VMStatus>;
export { isConfigured as proxmoxConfigured };

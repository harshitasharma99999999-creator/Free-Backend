export interface VideoOptions {
    prompt: string;
    duration?: number;
}
export interface VideoResult {
    videoUrl: string;
    model: string;
    provider: 'replicate';
    status: 'completed';
}
export declare function generateVideo(opts: VideoOptions): Promise<VideoResult>;
export declare const videoModels: () => {
    id: string;
    name: string;
    type: string;
    provider: string;
}[];

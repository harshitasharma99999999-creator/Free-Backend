export interface ImageOptions {
    prompt: string;
    negativePrompt?: string;
    width?: number;
    height?: number;
    n?: number;
}
export interface ImageResult {
    images: string[];
    model: string;
    provider: 'automatic1111' | 'replicate';
}
export declare function generateImage(opts: ImageOptions): Promise<ImageResult>;
export declare const imageModels: () => {
    id: string;
    name: string;
    type: string;
    provider: string;
}[];

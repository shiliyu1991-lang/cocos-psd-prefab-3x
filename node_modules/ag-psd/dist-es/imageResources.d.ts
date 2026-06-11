import { ImageResources } from './psd';
import { PsdReader } from './psdReader';
import { PsdWriter } from './psdWriter';
export interface InternalImageResources extends ImageResources {
    layersGroup?: number[];
    layerGroupsEnabledId?: number[];
}
export interface ResourceHandler {
    key: number;
    has: (target: InternalImageResources) => boolean | number;
    read: (reader: PsdReader, target: InternalImageResources, left: () => number) => void;
    write: (writer: PsdWriter, target: InternalImageResources, index: number) => void;
}
export declare const resourceHandlers: ResourceHandler[];
export declare const resourceHandlersMap: {
    [key: number]: ResourceHandler;
};

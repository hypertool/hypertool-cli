import { useContext, useMemo } from "react";

import { wrapConnectorHooks } from "@craftjs/utils";

import { useEditor } from "../../../../../craft";
import { Layer } from "../interfaces";
import { useLayerManager } from "../manager";

import { LayerContext } from "./LayerContext";

export function useLayer<S = null>(collect?: (layer: Layer) => S) {
    const {
        id,
        depth,
        connectors: internalConnectors,
    } = useContext(LayerContext);

    const { actions: managerActions, ...collected } = useLayerManager(
        (state) => {
            return (
                id && state.layers[id] && collect && collect(state.layers[id])
            );
        },
    ) as any;

    const { children } = useEditor((state, query) => ({
        children: state.nodes[id] && query.node(id).descendants(),
    }));

    const actions = useMemo(() => {
        return {
            toggleLayer: () => managerActions.toggleLayer(id),
        };
    }, [managerActions, id]);

    const connectors = useMemo(
        () =>
            wrapConnectorHooks({
                layer: (el: HTMLElement) => internalConnectors.layer(el, id),
                drag: (el: HTMLElement) => internalConnectors.drag(el, id),
                layerHeader: (el: HTMLElement) =>
                    internalConnectors.layerHeader(el, id),
            }),
        [internalConnectors, id],
    );

    return {
        id,
        depth,
        children,
        actions,
        connectors,
        ...collected,
    };
}

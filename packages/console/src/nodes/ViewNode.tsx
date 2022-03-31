import type { ReactElement } from "react";

import PropertiesForm from "../screens/app-builder/panels/properties-editor/PropertiesForm";
import { CraftComponent } from "../types";

import Node from "./Node";
import View, { IProps } from "./View";

const ViewNode: CraftComponent<IProps> = (props: IProps): ReactElement => {
    const { children } = props;
    return (
        <Node>
            <View {...props}>{children}</View>
        </Node>
    );
};

ViewNode.defaultProps = {
    height: "400px",
    width: "400px",
    backgroundColor: "white",
};

ViewNode.craft = {
    props: ViewNode.defaultProps,
    related: {
        settings: () => (
            <PropertiesForm
                groups={[
                    {
                        title: "General",
                        fields: [
                            {
                                id: "id",
                                size: "small",
                                help: "An identifier that uniquely identifies the node.",
                                type: "text",
                                required: true,
                                title: "ID",
                            },
                            {
                                id: "width",
                                size: "small",
                                help: "The width of the view.",
                                type: "text",
                                required: true,
                                title: "Width",
                            },
                            {
                                id: "height",
                                size: "small",
                                help: "The height of the view.",
                                type: "text",
                                required: true,
                                title: "Height",
                            },
                            {
                                id: "backgroundColor",
                                size: "small",
                                help: "The background color of the view.",
                                type: "text",
                                required: true,
                                title: "Background Color",
                            },
                        ],
                    },
                ]}
                validationSchema={undefined}
            />
        ),
    },
};

export default ViewNode;
